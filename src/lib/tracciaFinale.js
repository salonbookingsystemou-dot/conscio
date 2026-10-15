// Unisce i paragrafi in PCM, regola il volume sulla traccia intera e codifica
// una sola volta in MP3 mono. Con le campane (predefinito) il file comincia e
// finisce con la campana tibetana: suona anche a schermo spento e offline.
//
// Volume: misura la loudness integrata (ITU-R BS.1770, in LUFS) di tutta la
// traccia e la porta a OBIETTIVO_LUFS. Un paragrafo si corregge da solo solo se
// si scosta più di SCARTO_MAX_DB dal resto (un'uscita anomala di ElevenLabs):
// le differenze piccole, come una chiusura più sommessa, restano.

import { CAMPIONI } from './rifinisciVoce'

export const KBPS = 96
const OBIETTIVO_LUFS = -18
const SCARTO_MAX_DB = 2
const BOOST_MAX_DB = 12
// Un paragrafo di ElevenLabs può uscire anche 20 dB sotto il resto della
// traccia: deve poter salire fin lì per non restare più basso degli altri.
const BOOST_PARAGRAFO_MAX_DB = 30
const TETTO = 10 ** (-1 / 20)
const BLOCCO_MP3 = 1152

// Filtro K (pre-filtro di BS.1770) calcolato per la frequenza di campionamento.
function filtroK(fs) {
  let K = Math.tan(Math.PI * 1681.974450955533 / fs)
  const Q1 = 0.7071752369554196
  const Vh = 10 ** (3.999843853973347 / 20)
  const Vb = Vh ** 0.4996667741545416
  let a0 = 1 + K / Q1 + K * K
  const shelf = {
    b: [(Vh + Vb * K / Q1 + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q1 + K * K) / a0],
    a: [2 * (K * K - 1) / a0, (1 - K / Q1 + K * K) / a0]
  }
  K = Math.tan(Math.PI * 38.13547087602444 / fs)
  const Q2 = 0.5003270373238773
  a0 = 1 + K / Q2 + K * K
  const passaAlto = {
    b: [1, -2, 1],
    a: [2 * (K * K - 1) / a0, (1 - K / Q2 + K * K) / a0]
  }
  return [shelf, passaAlto]
}

// Potenza media dei blocchi di 400 ms con passo di 100 ms, sommata sui canali.
// Filtra un campione alla volta: una traccia lunga non va copiata in memoria.
function potenzeBlocchi(canali, fs, scala = 1) {
  const [shelf, pa] = filtroK(fs)
  const [sb0, sb1, sb2] = shelf.b
  const [sa1, sa2] = shelf.a
  const [pa1, pa2] = pa.a
  const passo = Math.round(fs * 0.1)
  const decimi = []
  for (const x of canali) {
    let sx1 = 0; let sx2 = 0; let sy1 = 0; let sy2 = 0
    let py1 = 0; let py2 = 0
    let somma = 0; let n = 0; let j = 0
    for (let i = 0; i < x.length; i += 1) {
      const v = x[i] * scala
      const s = sb0 * v + sb1 * sx1 + sb2 * sx2 - sa1 * sy1 - sa2 * sy2
      const k = s - 2 * sy1 + sy2 - pa1 * py1 - pa2 * py2
      sx2 = sx1; sx1 = v; sy2 = sy1; sy1 = s
      py2 = py1; py1 = k
      somma += k * k
      n += 1
      if (n === passo) {
        decimi[j] = (decimi[j] || 0) + somma
        j += 1
        somma = 0
        n = 0
      }
    }
  }
  const out = []
  for (let j = 0; j + 3 < decimi.length; j += 1) {
    out.push((decimi[j] + decimi[j + 1] + decimi[j + 2] + decimi[j + 3]) / (4 * passo))
  }
  return out
}

function blocchi(pcm) {
  return potenzeBlocchi([pcm], CAMPIONI, 1 / 0x8000)
}

const daPotenza = z => -0.691 + 10 * Math.log10(z)

// canali: Float32Array per canale (-1…1). Restituisce la loudness integrata e
// quella di ogni blocco di 400 ms (uno ogni 100 ms), in LUFS.
export function misuraLoudness(canali, fs) {
  const potenze = potenzeBlocchi(canali, fs)
  return {
    integrata: integrata(potenze),
    blocchi: potenze.map(z => (z > 0 ? daPotenza(z) : -Infinity))
  }
}

function integrata(potenze) {
  const sopraAssoluta = potenze.filter(z => z > 0 && daPotenza(z) > -70)
  if (!sopraAssoluta.length) return null
  const media = sopraAssoluta.reduce((s, z) => s + z, 0) / sopraAssoluta.length
  const soglia = daPotenza(media) - 10
  const valide = sopraAssoluta.filter(z => daPotenza(z) > soglia)
  if (!valide.length) return null
  return daPotenza(valide.reduce((s, z) => s + z, 0) / valide.length)
}

function guadagniPerParagrafo(pcmParagrafi) {
  const potenze = pcmParagrafi.map(blocchi)
  const traccia = integrata(potenze.flat())
  if (traccia == null) return pcmParagrafi.map(() => 1)
  const globaleDb = Math.min(BOOST_MAX_DB, OBIETTIVO_LUFS - traccia)
  return potenze.map(p => {
    const propria = integrata(p)
    let correzione = 0
    if (propria != null) {
      const scarto = propria - traccia
      if (scarto > SCARTO_MAX_DB) correzione = SCARTO_MAX_DB - scarto
      if (scarto < -SCARTO_MAX_DB) correzione = -SCARTO_MAX_DB - scarto
    }
    return 10 ** (Math.min(BOOST_PARAGRAFO_MAX_DB, globaleDb + correzione) / 20)
  })
}

function limita(s) {
  const abs = Math.abs(s)
  if (abs <= TETTO) return s
  const morbido = TETTO + (0.98 - TETTO) * Math.tanh((abs - TETTO) / (1 - TETTO))
  return s < 0 ? -morbido : morbido
}

const respira = () => new Promise(r => setTimeout(r, 0))

// ── Campana tibetana ────────────────────────────────────────────────────────

// Silenzio fra la campana iniziale e la voce, e fra l'ultima parola e la campana finale.
const PAUSA_DOPO_CAMPANA = 1
const PAUSA_PRIMA_CAMPANA = 2
// La campana sta poco sotto il parlato: accompagna, non sovrasta.
const CAMPANA_SOTTO_DB = 3

function urlCampana() {
  return `${import.meta.env.BASE_URL || '/'}audio/campana-tibetana.mp3`
}

/** Decodifica un file audio in PCM mono a 44,1 kHz (Int16Array). */
export async function decodificaMono(arrayBuffer) {
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!Offline) throw new Error('DECODIFICA_NON_DISPONIBILE')
  const ctx = new Offline(1, 1, CAMPIONI)
  const audio = await ctx.decodeAudioData(arrayBuffer.slice(0))
  const n = audio.length
  const pcm = new Int16Array(n)
  const canali = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c))
  for (let i = 0; i < n; i += 1) {
    let somma = 0
    for (const canale of canali) somma += canale[i]
    const v = Math.max(-1, Math.min(1, somma / canali.length))
    pcm[i] = v < 0 ? Math.round(v * 0x8000) : Math.round(v * 0x7fff)
  }
  return pcm
}

let campanaPronta = null

/** PCM della campana e il guadagno che la porta poco sotto la voce. */
async function campana() {
  if (!campanaPronta) {
    campanaPronta = (async () => {
      const res = await fetch(urlCampana(), { cache: 'force-cache' })
      if (!res.ok) throw new Error('CAMPANA_NON_TROVATA')
      const pcm = await decodificaMono(await res.arrayBuffer())
      const misura = integrata(blocchi(pcm))
      let gain = misura == null ? 1 : 10 ** ((OBIETTIVO_LUFS - CAMPANA_SOTTO_DB - misura) / 20)
      let picco = 0
      for (let i = 0; i < pcm.length; i += 1) picco = Math.max(picco, Math.abs(pcm[i]) / 0x8000)
      if (picco * gain > TETTO) gain = TETTO / picco
      return { pcm, gain }
    })().catch(err => {
      campanaPronta = null
      throw err
    })
  }
  return campanaPronta
}

// paragrafi: [{ pcm: Int16Array, pausaDopo: secondi }]
export async function preparaMp3(paragrafi, onAvanzamento, { campane = true } = {}) {
  const validi = (paragrafi || []).filter(p => p.pcm?.length)
  if (!validi.length) throw new Error('AUDIO_VUOTO')
  const gain = guadagniPerParagrafo(validi.map(p => p.pcm))
  const suono = campane ? await campana() : null
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const encoder = new Mp3Encoder(1, CAMPIONI, KBPS)
  const pezzi = []
  const blocco = new Int16Array(BLOCCO_MP3)
  const extra = suono
    ? 2 * suono.pcm.length + Math.round((PAUSA_DOPO_CAMPANA + PAUSA_PRIMA_CAMPANA) * CAMPIONI)
    : 0
  const totale = extra + validi.reduce((n, p, i) => (
    n + p.pcm.length + Math.round((Number(p.pausaDopo) || 0) * CAMPIONI)
  ), 0)
  let fatti = 0
  let daUltimoRespiro = 0

  async function codifica(sorgente, g) {
    for (let i = 0; i < sorgente.length; i += BLOCCO_MP3) {
      const n = Math.min(BLOCCO_MP3, sorgente.length - i)
      for (let j = 0; j < n; j += 1) {
        const s = limita((sorgente[i + j] / 0x8000) * g)
        blocco[j] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
      }
      const mp3 = encoder.encodeBuffer(n === BLOCCO_MP3 ? blocco : blocco.subarray(0, n))
      if (mp3?.length) pezzi.push(new Uint8Array(mp3))
      fatti += n
      daUltimoRespiro += n
      if (daUltimoRespiro >= CAMPIONI * 5) {
        daUltimoRespiro = 0
        onAvanzamento?.(fatti / totale)
        await respira()
      }
    }
  }

  if (suono) {
    await codifica(suono.pcm, suono.gain)
    await codifica(new Int16Array(Math.round(PAUSA_DOPO_CAMPANA * CAMPIONI)), 0)
  }
  for (let i = 0; i < validi.length; i += 1) {
    await codifica(validi[i].pcm, gain[i])
    // Anche dopo l’ultimo paragrafo: silenzio prima della campana di chiusura.
    const pausa = Math.round((Number(validi[i].pausaDopo) || 0) * CAMPIONI)
    if (pausa > 0) await codifica(new Int16Array(pausa), 0)
  }
  if (suono) {
    await codifica(new Int16Array(Math.round(PAUSA_PRIMA_CAMPANA * CAMPIONI)), 0)
    await codifica(suono.pcm, suono.gain)
  }
  const coda = encoder.flush()
  if (coda?.length) pezzi.push(new Uint8Array(coda))
  onAvanzamento?.(1)
  const out = new Uint8Array(pezzi.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of pezzi) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

/**
 * Aggiunge le campane a un file audio già pronto (caricato, o generato prima del
 * 15/10/2026): lo decodifica, regola il volume e lo ricodifica una volta.
 */
export async function aggiungiCampane(arrayBuffer, onAvanzamento) {
  const pcm = await decodificaMono(arrayBuffer)
  return preparaMp3([{ pcm, pausaDopo: 0 }], onAvanzamento, { campane: true })
}
