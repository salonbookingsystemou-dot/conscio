// Unisce i paragrafi in PCM, regola il volume sulla traccia intera e codifica
// una sola volta in MP3 mono.
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

function applicaBiquad(x, { b, a }) {
  const y = new Float32Array(x.length)
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0
  for (let i = 0; i < x.length; i += 1) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v
    y[i] = v
  }
  return y
}

// Potenza media dei blocchi di 400 ms con passo di 100 ms.
function blocchi(pcm) {
  const x = new Float32Array(pcm.length)
  for (let i = 0; i < pcm.length; i += 1) x[i] = pcm[i] / 0x8000
  const [shelf, pa] = filtroK(CAMPIONI)
  const k = applicaBiquad(applicaBiquad(x, shelf), pa)
  const lungo = Math.round(CAMPIONI * 0.4)
  const passo = Math.round(CAMPIONI * 0.1)
  const quad = new Float64Array(k.length + 1)
  for (let i = 0; i < k.length; i += 1) quad[i + 1] = quad[i] + k[i] * k[i]
  const out = []
  for (let da = 0; da + lungo <= k.length; da += passo) {
    out.push((quad[da + lungo] - quad[da]) / lungo)
  }
  return out
}

const daPotenza = z => -0.691 + 10 * Math.log10(z)

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

// paragrafi: [{ pcm: Int16Array, pausaDopo: secondi }]
export async function preparaMp3(paragrafi, onAvanzamento) {
  const validi = (paragrafi || []).filter(p => p.pcm?.length)
  if (!validi.length) throw new Error('AUDIO_VUOTO')
  const gain = guadagniPerParagrafo(validi.map(p => p.pcm))
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const encoder = new Mp3Encoder(1, CAMPIONI, KBPS)
  const pezzi = []
  const blocco = new Int16Array(BLOCCO_MP3)
  const totale = validi.reduce((n, p, i) => (
    n + p.pcm.length + (i < validi.length - 1 ? Math.round((Number(p.pausaDopo) || 0) * CAMPIONI) : 0)
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

  for (let i = 0; i < validi.length; i += 1) {
    await codifica(validi[i].pcm, gain[i])
    const pausa = i < validi.length - 1 ? Math.round((Number(validi[i].pausaDopo) || 0) * CAMPIONI) : 0
    if (pausa > 0) await codifica(new Int16Array(pausa), 0)
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
