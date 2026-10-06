// Controllo delle tracce delle pratiche formali, come le riceve il partecipante.
// Tre livelli: collegamenti (database), file (indirizzo pubblico), ascolto
// tecnico (file decodificato nel browser). Legge soltanto: non scrive nulla.

import { infoMp3, lunghezzaId3 } from './audioMp3.js'
import { supabase } from './supabaseClient'
import { misuraLoudness } from './tracciaFinale.js'
import { AUDIO_MAX, elencaTracce, urlAudioSenzaTesto } from './tracce.js'

const TIPI_FORMALI = new Set(['formale', 'a_casa'])
const CACHE_TRACCE = 'tracce-audio-v2'
const PREFISSO = 65536
const FS_ANALISI = 16000
const OBIETTIVO_LUFS = -18

export const LIVELLI = ['errore', 'attenzione', 'nota']

function esito(livello, testo, extra = {}) {
  return { livello, testo, ...extra }
}

export function peggiore(esiti) {
  if (!esiti?.length) return 'ok'
  for (const livello of LIVELLI) {
    if (esiti.some(e => e.livello === livello)) return livello === 'nota' ? 'ok' : livello
  }
  return 'ok'
}

export function formattaTempo(secondi) {
  if (!Number.isFinite(secondi) || secondi < 0) return '0:00'
  const m = Math.floor(secondi / 60)
  const s = Math.floor(secondi % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function minuti(n) {
  return n === 1 ? '1 minuto' : `${n} minuti`
}

// ── Livello 1 · collegamenti ────────────────────────────────────────────────

export async function leggiCiclo(cicloId) {
  const [risposta, tracce] = await Promise.all([
    supabase
      .from('lezioni')
      .select('id, numero_settimana, tema, traccia_id, traccia_audio, esercizi(id, tipo, descrizione, traccia_id, traccia_audio, durata_minuti, ordine)')
      .eq('ciclo_id', cicloId)
      .order('numero_settimana', { ascending: true }),
    elencaTracce()
  ])
  if (risposta.error) throw risposta.error
  return { lezioni: risposta.data || [], tracce }
}

function tracciaDaUrl(url, tracce) {
  const pulito = urlAudioSenzaTesto(url)
  if (!pulito) return null
  return tracce.find(t => urlAudioSenzaTesto(t.url) === pulito) || null
}

// Stessa regola di `programma_del_partecipante`: traccia collegata, poi vecchio
// indirizzo, poi l'audio della settimana se nessuna pratica ne ha uno.
function sorgente(esercizio, lezione, perId, settimanaSenzaAudio) {
  const collegata = esercizio.traccia_id ? perId.get(esercizio.traccia_id) : null
  if (collegata?.url) return { tipo: 'libreria', url: collegata.url, traccia: collegata }
  const vecchio = String(esercizio.traccia_audio || '').trim()
  if (vecchio) return { tipo: 'indirizzo', url: vecchio, traccia: null }
  if (settimanaSenzaAudio) {
    const daSettimana = lezione.traccia_id ? perId.get(lezione.traccia_id) : null
    const url = daSettimana?.url || String(lezione.traccia_audio || '').trim()
    if (url) return { tipo: 'settimana', url, traccia: daSettimana || null }
  }
  return null
}

export function controllaCollegamenti({ lezioni, tracce }) {
  const perId = new Map(tracce.map(t => [t.id, t]))
  const settimane = []
  const usate = new Set()
  for (const lezione of [...lezioni].sort((a, b) => a.numero_settimana - b.numero_settimana)) {
    const esercizi = [...(lezione.esercizi || [])].sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0))
    const settimanaSenzaAudio = !esercizi.some(e => (
      (e.traccia_id && perId.get(e.traccia_id)?.url) || String(e.traccia_audio || '').trim()
    ))
    const pratiche = esercizi.filter(e => TIPI_FORMALI.has(e.tipo)).map(e => {
      const esiti = []
      const fonte = sorgente(e, lezione, perId, settimanaSenzaAudio)
      if (e.traccia_id && !perId.get(e.traccia_id)) {
        esiti.push(esito('errore', 'La traccia collegata non esiste più in libreria.'))
      }
      let traccia = fonte?.traccia || null
      if (!fonte) {
        esiti.push(esito('errore', 'Nessuna traccia: il partecipante non ha niente da ascoltare.'))
      } else if (fonte.tipo === 'indirizzo') {
        traccia = tracciaDaUrl(fonte.url, tracce)
        esiti.push(traccia
          ? esito('nota', `Collegata solo con l’indirizzo del file di «${traccia.titolo}». Ricollegala dalla settimana perché segua le modifiche della libreria.`)
          : esito('attenzione', 'Il file non è in libreria: se viene spostato o eliminato, qui non si vede.'))
      } else if (fonte.tipo === 'settimana') {
        esiti.push(esito('nota', 'Usa l’audio generale della settimana.'))
      }
      if (traccia) usate.add(traccia.id)
      const minPratica = Number(e.durata_minuti)
      const minTraccia = Number(traccia?.durata_minuti)
      if (minPratica > 0 && minTraccia > 0) {
        const scarto = Math.abs(minPratica - minTraccia)
        if (scarto >= 3 && scarto / minTraccia > 0.25) {
          esiti.push(esito('attenzione', `La pratica indica ${minuti(minPratica)}, la traccia ne dura ${minTraccia}.`))
        }
      }
      return {
        id: e.id,
        descrizione: String(e.descrizione || '').trim() || 'Pratica senza nome',
        durataMinuti: minPratica > 0 ? minPratica : null,
        url: fonte ? urlAudioSenzaTesto(fonte.url) : '',
        urlCompleto: fonte?.url || '',
        traccia,
        esiti
      }
    })
    settimane.push({
      id: lezione.id,
      numero: lezione.numero_settimana,
      tema: String(lezione.tema || '').trim(),
      pratiche
    })
  }
  const nonUsate = tracce.filter(t => !usate.has(t.id))
  return { settimane, nonUsate }
}

// ── Livello 2 · file ────────────────────────────────────────────────────────

function conParametro(url) {
  const u = new URL(url)
  u.searchParams.set('controllo', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  return u.href
}

// Le copie scaricate per il controllo non devono restare nella cache delle tracce.
export async function pulisciCacheControllo() {
  if (typeof caches === 'undefined') return
  try {
    const cache = await caches.open(CACHE_TRACCE)
    const chiavi = await cache.keys()
    await Promise.all(chiavi.filter(r => r.url.includes('controllo=')).map(r => cache.delete(r)))
  } catch {
    /* cache non disponibile */
  }
}

async function leggiByte(url, da, a) {
  const risposta = await fetch(conParametro(url), {
    headers: { Range: `bytes=${da}-${a}` },
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store'
  })
  if (!risposta.ok) return null
  return new Uint8Array(await risposta.arrayBuffer())
}

export async function controllaFile(url, traccia) {
  const esiti = []
  if (!/^https:\/\//i.test(url || '')) {
    return { esiti: [esito('errore', 'L’indirizzo del file non è valido.')], info: null }
  }
  let head
  try {
    head = await fetch(url, { method: 'HEAD', mode: 'cors', credentials: 'omit', cache: 'no-store' })
  } catch {
    return { esiti: [esito('errore', 'Il file non risponde: problema di rete o di permessi.')], info: null }
  }
  if (!head.ok) {
    const testo = head.status === 404 || head.status === 400
      ? `Il file non esiste più nello storage (errore ${head.status}).`
      : `Il file non si apre (errore ${head.status}).`
    return { esiti: [esito('errore', testo)], info: null }
  }
  const tipo = String(head.headers.get('content-type') || '').toLowerCase()
  const totale = Number(head.headers.get('content-length'))
  if (tipo && !tipo.startsWith('audio/') && !tipo.includes('octet-stream')) {
    esiti.push(esito('errore', `Il file non è un audio (${tipo}).`))
  }
  if (Number.isFinite(totale) && totale > 0) {
    if (totale < 20 * 1024) esiti.push(esito('errore', 'Il file è quasi vuoto.'))
    if (totale > AUDIO_MAX) {
      esiti.push(esito('attenzione', `Il file pesa ${Math.round(totale / 1048576)} MB: su rete mobile parte lento.`))
    }
  }
  let info = null
  if (!tipo || tipo.includes('mpeg') || tipo.includes('mp3')) {
    try {
      let bytes = await leggiByte(url, 0, PREFISSO - 1)
      let scarto = 0
      const id3 = lunghezzaId3(bytes)
      if (bytes && id3 >= bytes.length - 8) {
        scarto = id3
        bytes = await leggiByte(url, id3, id3 + PREFISSO - 1)
      }
      info = infoMp3(bytes, totale, scarto)
      if (!info) esiti.push(esito('attenzione', 'Non riesco a leggere l’intestazione MP3: fai l’ascolto tecnico.'))
    } catch {
      esiti.push(esito('attenzione', 'Non riesco a leggere l’inizio del file.'))
    }
  }
  const durata = info?.vbr ? info.dichiarata : (info?.daDimensione ?? null)
  if (info?.dichiarata && info.daDimensione && !info.vbr) {
    const scarto = Math.abs(info.dichiarata - info.daDimensione)
    if (scarto > 3 && scarto / info.daDimensione > 0.08) {
      esiti.push(esito('nota', `L’intestazione dichiara ${formattaTempo(info.dichiarata)} ma il file dura circa ${formattaTempo(info.daDimensione)}. Il player dell’app lo corregge; altri player no.`))
    }
  }
  const minLibreria = Number(traccia?.durata_minuti)
  if (durata > 0 && minLibreria > 0) {
    const scarto = Math.abs(minLibreria * 60 - durata)
    if (scarto > 60 && scarto / durata > 0.15) {
      esiti.push(esito('attenzione', `In libreria risulta ${minuti(minLibreria)}, ma il file dura ${formattaTempo(durata)}.`))
    }
  }
  return { esiti, info: { tipo, totale, durata, ...info } }
}

// ── Livello 3 · ascolto tecnico ─────────────────────────────────────────────

async function scaricaTutto(url, segnale) {
  const indirizzo = conParametro(url)
  try {
    const risposta = await fetch(indirizzo, { mode: 'cors', credentials: 'omit', cache: 'no-store', signal: segnale })
    if (!risposta.ok) throw new Error(`HTTP_${risposta.status}`)
    return await risposta.arrayBuffer()
  } finally {
    window.setTimeout(() => { void pulisciCacheControllo() }, 2000)
  }
}

async function decodifica(dati) {
  const Contesto = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!Contesto) throw new Error('DECODIFICA_NON_DISPONIBILE')
  const contesto = new Contesto(1, FS_ANALISI, FS_ANALISI)
  return new Promise((risolvi, rifiuta) => {
    const promessa = contesto.decodeAudioData(dati, risolvi, rifiuta)
    if (promessa?.then) promessa.then(risolvi, rifiuta)
  })
}

const potenza = lufs => (Number.isFinite(lufs) ? 10 ** ((lufs + 0.691) / 10) : 0)
const daPotenza = z => (z > 0 ? -0.691 + 10 * Math.log10(z) : -Infinity)

// Loudness di ogni secondo dai blocchi di 400 ms (uno ogni 100 ms).
function perSecondo(blocchi) {
  const out = []
  for (let s = 0; s * 10 < blocchi.length; s += 1) {
    let somma = 0
    let n = 0
    for (let j = s * 10; j < Math.min(blocchi.length, s * 10 + 10); j += 1) {
      somma += potenza(blocchi[j])
      n += 1
    }
    out.push(daPotenza(somma / n))
  }
  return out
}

// Tratti di voce molto più bassi del resto: almeno 5 s di parlato sotto la
// traccia di 8 dB o più. Il silenzio non interrompe il tratto, la voce normale sì:
// paragrafi bassi di fila separati da pause formano un solo tratto.
function trattiBassi(secondi, riferimento) {
  const voce = secondi.map(l => l > riferimento - 30)
  const liscia = secondi.map((_, s) => {
    let somma = 0
    let n = 0
    for (let k = s - 1; k <= s + 1; k += 1) {
      if (k >= 0 && k < secondi.length && voce[k]) {
        somma += potenza(secondi[k])
        n += 1
      }
    }
    return n ? daPotenza(somma / n) : -Infinity
  })
  const bassa = liscia.map((l, s) => voce[s] && l < riferimento - 8)
  const tratti = []
  let corrente = null
  for (let s = 0; s < secondi.length; s += 1) {
    if (bassa[s]) {
      if (!corrente) corrente = { da: s, a: s, somma: 0, n: 0 }
      corrente.a = s
      corrente.somma += potenza(secondi[s])
      corrente.n += 1
    } else if (corrente && voce[s]) {
      tratti.push(corrente)
      corrente = null
    }
  }
  if (corrente) tratti.push(corrente)
  return tratti
    .filter(t => t.n >= 5)
    .map(t => ({ da: t.da, a: t.a + 1, voce: t.n, scarto: riferimento - daPotenza(t.somma / t.n) }))
}

function silenzioPiuLungo(secondi, riferimento) {
  let migliore = { da: 0, durata: 0 }
  let da = -1
  for (let s = 0; s <= secondi.length; s += 1) {
    const zitto = s < secondi.length && !(secondi[s] > riferimento - 35)
    if (zitto && da < 0) da = s
    if (!zitto && da >= 0) {
      if (s - da > migliore.durata) migliore = { da, durata: s - da }
      da = -1
    }
  }
  return migliore
}

export async function ascoltoTecnico(url, { durataFile, segnale } = {}) {
  const dati = await scaricaTutto(url, segnale)
  let buffer
  try {
    buffer = await decodifica(dati)
  } catch {
    return { esiti: [esito('errore', 'Il browser non riesce a decodificare il file: il partecipante non lo sentirà.')], misure: null }
  }
  const canali = []
  for (let c = 0; c < buffer.numberOfChannels; c += 1) canali.push(buffer.getChannelData(c))
  return analizzaCanali(canali, buffer.sampleRate, { durataFile })
}

export function analizzaCanali(canali, fs, { durataFile } = {}) {
  const esiti = []
  const { integrata, blocchi } = misuraLoudness(canali, fs)
  const durata = (canali[0]?.length || 0) / fs
  if (integrata == null) {
    return { esiti: [esito('errore', 'Il file è muto.')], misure: { durata } }
  }
  if (integrata < OBIETTIVO_LUFS - 8) {
    esiti.push(esito('attenzione', `Volume generale basso (${Math.round(integrata)} LUFS; le tracce generate stanno a ${OBIETTIVO_LUFS}).`))
  } else if (integrata > OBIETTIVO_LUFS + 6) {
    esiti.push(esito('attenzione', `Volume generale alto (${Math.round(integrata)} LUFS; le tracce generate stanno a ${OBIETTIVO_LUFS}).`))
  }
  const secondi = perSecondo(blocchi)
  // Un paragrafo intero più basso è un difetto; una chiusura sommessa di pochi
  // secondi è spesso voluta, quindi resta una nota.
  for (const t of trattiBassi(secondi, integrata)) {
    const inChiusura = t.a >= durata - 30
    esiti.push(esito(
      t.voce >= 10 && !inChiusura ? 'attenzione' : 'nota',
      inChiusura
        ? `La chiusura, da ${formattaTempo(t.da)}, è circa ${Math.round(t.scarto)} dB più bassa del resto: di solito è una campana o un saluto sommesso.`
        : `Da ${formattaTempo(t.da)} a ${formattaTempo(t.a)} la voce è circa ${Math.round(t.scarto)} dB più bassa del resto.`,
      { da: Math.max(0, t.da - 2) }
    ))
  }
  const inizioVoce = secondi.findIndex(l => l > integrata - 30)
  if (inizioVoce >= 8) {
    esiti.push(esito('attenzione', `La traccia resta in silenzio per ${inizioVoce} secondi all’inizio: può sembrare che non parta.`, { da: 0 }))
  }
  const coda = blocchi.slice(-2).filter(Number.isFinite)
  if (coda.length && Math.max(...coda) > integrata - 6) {
    esiti.push(esito('attenzione', 'La traccia finisce mentre c’è ancora voce: potrebbe essere tagliata.', { da: Math.max(0, durata - 10) }))
  }
  const silenzio = silenzioPiuLungo(secondi, integrata)
  if (silenzio.durata >= 90 && silenzio.da > inizioVoce) {
    esiti.push(esito('nota', `Silenzio di ${formattaTempo(silenzio.durata)} da ${formattaTempo(silenzio.da)}: verifica che sia una pausa voluta.`, { da: Math.max(0, silenzio.da - 3) }))
  }
  if (durataFile > 0 && Math.abs(durataFile - durata) > 5 && Math.abs(durataFile - durata) / durata > 0.05) {
    esiti.push(esito('attenzione', `Il file sembra durare ${formattaTempo(durataFile)}, ma l’audio vero è ${formattaTempo(durata)}.`))
  }
  return { esiti, misure: { durata, integrata } }
}

export function etichettaSettimana(numero) {
  return numero === 9 ? 'Intensiva' : `Settimana ${numero}`
}
