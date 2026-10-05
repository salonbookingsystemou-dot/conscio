import { supabase, supabaseAnonKey, supabaseUrl } from './supabaseClient'

export const MODELLI = [
  {
    id: 'eleven_multilingual_v2',
    nome: 'Multilingual v2',
    creditiPerCarattere: 1,
    aggancia: true,
    max: 9000,
    nota: 'La voce resta continua da un paragrafo all’altro. Un carattere, un credito.'
  },
  {
    id: 'eleven_v4',
    nome: 'v4',
    creditiPerCarattere: 1,
    aggancia: true,
    max: 9000,
    nota: 'Più espressivo, con la voce continua da un paragrafo all’altro. Accetta tag come [whispers]; per le pause usa i puntini, non <break>.'
  },
  {
    id: 'eleven_v3',
    nome: 'V3',
    creditiPerCarattere: 1,
    aggancia: false,
    max: 4500,
    nota: 'Registro stabile, lo stesso da un paragrafo all’altro. Le pause restano silenzio aggiunto qui. Un carattere, un credito.'
  },
  {
    id: 'eleven_flash_v2_5',
    nome: 'Flash v2.5',
    creditiPerCarattere: 0.5,
    aggancia: true,
    max: 9000,
    nota: 'Più rapido e costa mezzo credito a carattere. La voce è più piatta.'
  }
]

export function modelloDaId(id) {
  return MODELLI.find(m => m.id === id) || MODELLI[0]
}

// Moltiplicatore del parlato accettato da ElevenLabs (1 = ritmo della voce).
export const VELOCITA_MIN = 0.7
export const VELOCITA_MAX = 1.2
export const VELOCITA_PASSO = 0.05

export function velocitaDi(valore) {
  const n = Number(valore)
  if (!Number.isFinite(n)) return 1
  const passi = Math.round(n / VELOCITA_PASSO)
  const arrotondata = Math.round(passi * VELOCITA_PASSO * 100) / 100
  return Math.min(VELOCITA_MAX, Math.max(VELOCITA_MIN, arrotondata))
}

export function dividiScript(testo) {
  return String(testo || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n\s*\n/)
    .map(blocco => blocco.replace(/[ \t]+\n/g, '\n').trim())
    .filter(Boolean)
}

export function spezzaTesto(testo, max) {
  const limite = Math.max(500, Number(max) || 4500)
  let resto = String(testo || '').trim()
  if (!resto) return []
  if (resto.length <= limite) return [resto]
  const pezzi = []
  while (resto.length > limite) {
    const finestra = resto.slice(0, limite)
    let taglio = Math.max(
      finestra.lastIndexOf('. '),
      finestra.lastIndexOf('! '),
      finestra.lastIndexOf('? '),
      finestra.lastIndexOf('\n')
    )
    if (taglio < limite * 0.4) taglio = finestra.lastIndexOf(' ')
    if (taglio < 1) taglio = limite
    pezzi.push(resto.slice(0, taglio + 1).trim())
    resto = resto.slice(taglio + 1).trim()
  }
  if (resto) pezzi.push(resto)
  return pezzi
}

export function stimaGenerazione(paragrafi, modello, velocita = 1) {
  const testi = (paragrafi || []).map(p => String(p.testo || '').trim()).filter(Boolean)
  const caratteri = testi.reduce((n, t) => n + t.length, 0)
  const pause = (paragrafi || []).slice(0, -1).reduce((n, p) => n + (Number(p.pausaDopo) || 0), 0)
  const crediti = Math.ceil(caratteri * (modello?.creditiPerCarattere || 1))
  const ritmo = velocitaDi(velocita)
  return {
    caratteri,
    crediti,
    pauseSecondi: pause,
    minutiVoce: caratteri / 1000 / ritmo,
    minutiPause: pause / 60
  }
}

function messaggioDaCodice(code, messaggio) {
  if (messaggio) return messaggio
  if (code === 'NON_AUTORIZZATO') return 'Serve l’accesso del facilitatore.'
  if (code === 'CHIAVE_MANCANTE') return 'Manca la chiave ElevenLabs sul server (secret ELEVENLABS_API_KEY).'
  if (code === 'FUNZIONE_ASSENTE') return 'La generazione non è ancora attiva sul server.'
  if (code === 'RETE') return 'Non sono riuscito a raggiungere il server. Riprova.'
  return 'Non è stato possibile generare l’audio.'
}

async function chiama(corpo, signal) {
  if (!supabaseUrl || !supabaseAnonKey) {
    const err = new Error(messaggioDaCodice('RETE'))
    err.code = 'RETE'
    throw err
  }
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    const err = new Error(messaggioDaCodice('NON_AUTORIZZATO'))
    err.code = 'NON_AUTORIZZATO'
    throw err
  }
  let res
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/genera-voce`, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(corpo)
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    const rete = new Error(messaggioDaCodice('RETE'))
    rete.code = 'RETE'
    throw rete
  }
  const tipo = res.headers.get('content-type') || ''
  if (!res.ok || tipo.includes('application/json')) {
    let payload = null
    try { payload = await res.json() } catch { payload = null }
    const code = res.status === 404 ? 'FUNZIONE_ASSENTE' : (payload?.errore || 'ERRORE')
    const err = new Error(messaggioDaCodice(code, payload?.messaggio))
    err.code = code
    throw err
  }
  const audio = new Uint8Array(await res.arrayBuffer())
  if (audio.length < 32) {
    const err = new Error('ElevenLabs ha restituito un audio vuoto.')
    err.code = 'AUDIO_VUOTO'
    throw err
  }
  return {
    audio,
    requestId: res.headers.get('x-request-id') || '',
    aggancioPerso: res.headers.get('x-aggancio-perso') === '1',
    formato: res.headers.get('x-formato') || 'mp3_44100_128'
  }
}

export async function elencaVociJson(signal) {
  if (!supabaseUrl || !supabaseAnonKey) {
    const err = new Error(messaggioDaCodice('RETE'))
    err.code = 'RETE'
    throw err
  }
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    const err = new Error(messaggioDaCodice('NON_AUTORIZZATO'))
    err.code = 'NON_AUTORIZZATO'
    throw err
  }
  let res
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/genera-voce`, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ azione: 'voci' })
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    const rete = new Error(messaggioDaCodice('RETE'))
    rete.code = 'RETE'
    throw rete
  }
  let payload = null
  try { payload = await res.json() } catch { payload = null }
  if (!res.ok) {
    const code = res.status === 404 ? 'FUNZIONE_ASSENTE' : (payload?.errore || 'ERRORE')
    const err = new Error(messaggioDaCodice(code, payload?.messaggio))
    err.code = code
    throw err
  }
  return Array.isArray(payload?.voci) ? payload.voci : []
}

export function generaPezzo({ testo, voceId, modello, precedenti, successivo, seed, velocita, signal }) {
  return chiama({
    azione: 'paragrafo',
    testo,
    voceId,
    modello,
    precedenti: precedenti || [],
    successivo: successivo || '',
    seed,
    velocita: velocitaDi(velocita)
  }, signal)
}
