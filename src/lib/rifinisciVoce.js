// Porta l'audio di ElevenLabs a PCM mono 44,1 kHz e toglie i fade di apertura.
// Il paragrafo resta non compresso: si ascolta così e il file della traccia
// si codifica una volta sola, alla fine (lib/tracciaFinale.js).
// ElevenLabs manda PCM grezzo se il piano lo consente, altrimenti MP3.

import { rifinisciCampioni } from './audioVoce'

export const CAMPIONI = 44100

let contesto = null

function contestoAudio() {
  const C = window.AudioContext || window.webkitAudioContext
  if (!C) throw new Error('AUDIO_ASSENTE')
  if (!contesto || contesto.state === 'closed') contesto = new C()
  return contesto
}

async function ricampiona(canali, sampleRate) {
  const prima = canali[0]
  if (sampleRate === CAMPIONI) return canali
  const lunghezza = Math.max(1, Math.ceil(prima.length * CAMPIONI / sampleRate))
  const offline = new OfflineAudioContext(canali.length, lunghezza, CAMPIONI)
  const buffer = offline.createBuffer(canali.length, prima.length, sampleRate)
  canali.forEach((ch, c) => buffer.copyToChannel(ch, c))
  const fonte = offline.createBufferSource()
  fonte.buffer = buffer
  fonte.connect(offline.destination)
  fonte.start()
  const reso = await offline.startRendering()
  return canali.map((_, c) => new Float32Array(reso.getChannelData(c)))
}

function daPcm16(bytes) {
  const n = Math.floor(bytes.byteLength / 2)
  const vista = new DataView(bytes.buffer, bytes.byteOffset, n * 2)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i += 1) out[i] = vista.getInt16(i * 2, true) / 0x8000
  return out
}

async function decodifica(bytes, formato) {
  if (String(formato || '').startsWith('pcm_')) {
    const rate = Number(String(formato).split('_')[1]) || CAMPIONI
    const [mono] = await ricampiona([daPcm16(bytes)], rate)
    return mono
  }
  const ctx = contestoAudio()
  const copia = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const decodificato = await ctx.decodeAudioData(copia)
  const canali = []
  for (let c = 0; c < decodificato.numberOfChannels; c += 1) {
    canali.push(new Float32Array(decodificato.getChannelData(c)))
  }
  const ricampionati = await ricampiona(canali, decodificato.sampleRate)
  if (ricampionati.length === 1) return ricampionati[0]
  const mono = new Float32Array(ricampionati[0].length)
  for (const ch of ricampionati) {
    for (let i = 0; i < mono.length; i += 1) mono[i] += ch[i] / ricampionati.length
  }
  return mono
}

export function aInt16(samples) {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
  }
  return out
}

// Restituisce il parlato del pezzo come Int16Array mono a 44,1 kHz.
export async function rifinisciVoce(bytes, formato) {
  if (!bytes?.length) throw new Error('AUDIO_VUOTO')
  const mono = await decodifica(bytes, formato)
  if (!mono.length) throw new Error('AUDIO_VUOTO')
  const [rifinito] = rifinisciCampioni([mono], CAMPIONI)
  if (!rifinito?.length) throw new Error('AUDIO_VUOTO')
  return aInt16(rifinito)
}

export function unisciPcm(pezzi) {
  const totale = pezzi.reduce((n, p) => n + p.length, 0)
  const out = new Int16Array(totale)
  let offset = 0
  for (const p of pezzi) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

// WAV per l'ascolto del singolo paragrafo, senza compressione.
export function wavDa(pcm) {
  const dati = pcm.length * 2
  const buffer = new ArrayBuffer(44 + dati)
  const v = new DataView(buffer)
  const scrivi = (o, s) => { for (let i = 0; i < s.length; i += 1) v.setUint8(o + i, s.charCodeAt(i)) }
  scrivi(0, 'RIFF')
  v.setUint32(4, 36 + dati, true)
  scrivi(8, 'WAVE')
  scrivi(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, CAMPIONI, true)
  v.setUint32(28, CAMPIONI * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  scrivi(36, 'data')
  v.setUint32(40, dati, true)
  new Int16Array(buffer, 44).set(pcm)
  return new Blob([buffer], { type: 'audio/wav' })
}
