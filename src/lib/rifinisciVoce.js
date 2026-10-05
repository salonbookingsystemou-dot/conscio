// Decodifica il MP3 di ElevenLabs, toglie i fade e allinea il volume, poi lo ricodifica.
// Un solo passaggio: l'ascolto del paragrafo e il file unito usano lo stesso audio.

import { concatenaConPause } from './audioMp3'
import { rifinisciCampioni } from './audioVoce'

const CAMPIONI = 44100
const KBPS = 192
const BLOCCO = 1152

let contesto = null

function contestoAudio() {
  const C = window.AudioContext || window.webkitAudioContext
  if (!C) throw new Error('AUDIO_ASSENTE')
  if (!contesto || contesto.state === 'closed') contesto = new C()
  return contesto
}

async function a44100(buffer) {
  if (buffer.sampleRate === CAMPIONI && buffer.numberOfChannels <= 2) return buffer
  const lunghezza = Math.max(1, Math.ceil(buffer.duration * CAMPIONI))
  const canali = Math.min(2, buffer.numberOfChannels)
  const offline = new OfflineAudioContext(canali, lunghezza, CAMPIONI)
  const fonte = offline.createBufferSource()
  fonte.buffer = buffer
  fonte.connect(offline.destination)
  fonte.start()
  return offline.startRendering()
}

function aInt16(samples) {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
  }
  return out
}

async function codifica(sinistra, destra) {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const encoder = new Mp3Encoder(2, CAMPIONI, KBPS)
  const l = aInt16(sinistra)
  const r = aInt16(destra)
  const pezzi = []
  for (let i = 0; i < l.length; i += BLOCCO) {
    const codificato = encoder.encodeBuffer(l.subarray(i, i + BLOCCO), r.subarray(i, i + BLOCCO))
    if (codificato?.length) pezzi.push(new Uint8Array(codificato))
  }
  const coda = encoder.flush()
  if (coda?.length) pezzi.push(new Uint8Array(coda))
  let totale = 0
  for (const parte of pezzi) totale += parte.length
  const out = new Uint8Array(totale)
  let offset = 0
  for (const parte of pezzi) {
    out.set(parte, offset)
    offset += parte.length
  }
  return out
}

export async function rifinisciMp3(bytes) {
  if (!bytes?.length) throw new Error('AUDIO_VUOTO')
  const ctx = contestoAudio()
  const copia = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const decodificato = await ctx.decodeAudioData(copia)
  const buffer = await a44100(decodificato)
  const canali = []
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    canali.push(new Float32Array(buffer.getChannelData(c)))
  }
  const rifiniti = rifinisciCampioni(canali, buffer.sampleRate)
  if (!rifiniti.length) throw new Error('AUDIO_VUOTO')
  const sinistra = rifiniti[0]
  const destra = rifiniti[1] ? rifiniti[1] : sinistra
  const mp3 = await codifica(sinistra, destra)
  return concatenaConPause([mp3], [])
}
