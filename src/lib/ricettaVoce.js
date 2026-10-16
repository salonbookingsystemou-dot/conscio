// Ricetta della generazione: testo, pause e impostazioni, senza l’audio.
// I limiti di velocità sono gli stessi di generaVoce.js.

const VELOCITA_MIN = 0.7
const VELOCITA_MAX = 1.2
const VELOCITA_PASSO = 0.05
const STABILITA_MIN = 0.5
const STABILITA_MAX = 1
const STABILITA_PASSO = 0.01
const MODELLI = ['eleven_multilingual_v2', 'eleven_v4', 'eleven_v3', 'eleven_flash_v2_5']
const ID_OK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function idBozzaValido(valore) {
  return ID_OK.test(String(valore || ''))
}

export function velocitaRicetta(valore) {
  const n = Number(valore)
  if (!Number.isFinite(n)) return 1
  const passi = Math.round(n / VELOCITA_PASSO)
  const arrotondata = Math.round(passi * VELOCITA_PASSO * 100) / 100
  return Math.min(VELOCITA_MAX, Math.max(VELOCITA_MIN, arrotondata))
}

// null: modello senza stabilità regolabile, o paragrafo generato prima del cursore
// (vale la predefinita del suo modello: 0,85 per v4, 0,62 per v2).
export function stabilitaRicetta(valore) {
  if (valore == null || valore === '') return null
  const n = Number(valore)
  if (!Number.isFinite(n)) return null
  const arrotondata = Math.round(Math.round(n / STABILITA_PASSO) * STABILITA_PASSO * 100) / 100
  return Math.min(STABILITA_MAX, Math.max(STABILITA_MIN, arrotondata))
}

export function variazioneRicetta(valore) {
  const n = Number(valore)
  return Number.isInteger(n) && n >= 0 && n <= 4294967295 ? n : null
}

export function pausaRicetta(valore) {
  const n = Number(valore)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(300, Math.round(n))
}

// Data ISO (quando è stato generato il paragrafo), o null.
export function dataRicetta(valore) {
  if (!valore) return null
  const t = Date.parse(String(valore))
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

function agganciatoRicetta(valore) {
  return typeof valore === 'boolean' ? valore : null
}

function formatoAudio(valore) {
  if (valore === 'gzip' || valore === 'pcm') return valore
  return null
}

// Dalla riga del database ai paragrafi dell’editor, ancora senza campioni.
export function normalizzaRicetta(valore) {
  if (!valore || typeof valore !== 'object' || Array.isArray(valore)) return null
  const grezzi = Array.isArray(valore.paragrafi) ? valore.paragrafi : []
  const paragrafi = []
  for (const p of grezzi) {
    const testo = String(p?.testo || '').trim()
    if (!testo || !idBozzaValido(p?.id)) continue
    const formato = formatoAudio(p.audio)
    paragrafi.push({
      id: String(p.id),
      testo,
      pausaDopo: pausaRicetta(p.pausa_dopo),
      audio: null,
      requestId: String(p.richiesta_id || ''),
      modello: String(p.modello || ''),
      voceId: String(p.voce_id || ''),
      obsoleto: Boolean(p.obsoleto),
      seed: variazioneRicetta(p.variazione),
      velocita: p.velocita == null ? 1 : velocitaRicetta(p.velocita),
      stabilita: stabilitaRicetta(p.stabilita),
      // Dalla versione 3. Nelle precedenti mancano: null, nessun badge.
      agganciato: agganciatoRicetta(p.agganciato),
      generatoIl: dataRicetta(p.generato_il),
      audioFormato: formato,
      audioSalvato: false,
      audioMancante: false
    })
  }
  if (paragrafi.length === 0) return null
  // Fino alla versione 1 la pausa dopo l’ultimo paragrafo non entrava nel file:
  // si azzera, così le bozze salvate prima suonano come prima.
  if (!(Number(valore.versione) >= 2)) paragrafi[paragrafi.length - 1].pausaDopo = 0
  const modelloSalvato = String(valore.modello || '')
  return {
    modello: MODELLI.includes(modelloSalvato) ? modelloSalvato : MODELLI[0],
    voceId: String(valore.voce_id || ''),
    velocita: velocitaRicetta(valore.velocita),
    stabilita: stabilitaRicetta(valore.stabilita),
    variazione: variazioneRicetta(valore.variazione),
    pausaPredefinita: pausaRicetta(valore.pausa_predefinita ?? 10),
    paragrafi
  }
}

// Dall’editor alla riga. `omessi` sono paragrafi il cui audio non è entrato in archivio.
export function ricettaDaStato(stato, { omessi = new Set(), formatoNuovo = 'gzip' } = {}) {
  const paragrafi = []
  for (const p of stato?.paragrafi || []) {
    const testo = String(p?.testo || '').trim()
    if (!testo || !idBozzaValido(p?.id)) continue
    const tieneAudio = Boolean(p.audio) && !omessi.has(p.id)
    let audio = null
    if (tieneAudio) audio = p.audioSalvato ? (p.audioFormato || formatoNuovo) : formatoNuovo
    paragrafi.push({
      id: String(p.id),
      testo,
      pausa_dopo: pausaRicetta(p.pausaDopo),
      richiesta_id: String(p.requestId || ''),
      modello: String(p.modello || ''),
      voce_id: String(p.voceId || ''),
      variazione: variazioneRicetta(p.seed),
      velocita: p.velocita == null ? null : velocitaRicetta(p.velocita),
      stabilita: stabilitaRicetta(p.stabilita),
      agganciato: agganciatoRicetta(p.agganciato),
      generato_il: dataRicetta(p.generatoIl),
      obsoleto: Boolean(p.obsoleto),
      audio
    })
  }
  return {
    // 3: per paragrafo anche `agganciato` e `generato_il`. Si leggono anche la 1 e la 2.
    versione: 3,
    modello: MODELLI.includes(stato?.modelloId) ? stato.modelloId : MODELLI[0],
    voce_id: String(stato?.voceId || ''),
    velocita: velocitaRicetta(stato?.velocita),
    stabilita: stabilitaRicetta(stato?.stabilita),
    variazione: variazioneRicetta(stato?.variazione),
    pausa_predefinita: pausaRicetta(stato?.pausaPredefinita ?? 10),
    paragrafi
  }
}

export function nomeFileBozza(id, formato) {
  return `${id}.${formato === 'pcm' ? 'pcm' : 'pcm.gz'}`
}
