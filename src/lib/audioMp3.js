// Unisce MP3 dello stesso formato e inserisce silenzio vero tra un pezzo e l'altro.
// Il parlato non viene ricodificato: si tengono i frame di ElevenLabs.

const BITRATE_MPEG1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
const CAMPIONI_MPEG1 = [44100, 48000, 32000]
const CAMPIONI_PER_FRAME = 1152

function saltaId3(bytes) {
  if (
    bytes.length >= 10
    && bytes[0] === 0x49
    && bytes[1] === 0x44
    && bytes[2] === 0x33
  ) {
    const size = ((bytes[6] & 0x7f) << 21)
      | ((bytes[7] & 0x7f) << 14)
      | ((bytes[8] & 0x7f) << 7)
      | (bytes[9] & 0x7f)
    return Math.min(bytes.length, 10 + size)
  }
  return 0
}

function frameA(bytes, i) {
  if (i + 4 > bytes.length) return null
  if (bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) return null
  const versione = (bytes[i + 1] >> 3) & 3
  const layer = (bytes[i + 1] >> 1) & 3
  if (versione !== 3 || layer !== 1) return null
  const indiceBitrate = (bytes[i + 2] >> 4) & 15
  const indiceCampioni = (bytes[i + 2] >> 2) & 3
  const padding = (bytes[i + 2] >> 1) & 1
  if (indiceBitrate === 0 || indiceBitrate === 15 || indiceCampioni > 2) return null
  const bitrate = BITRATE_MPEG1_L3[indiceBitrate] * 1000
  const campioni = CAMPIONI_MPEG1[indiceCampioni]
  const canali = (bytes[i + 3] >> 6) & 3
  const lunghezza = Math.floor((144 * bitrate) / campioni) + padding
  if (lunghezza < 4 || i + lunghezza > bytes.length) return null
  return { bitrate, campioni, canali, lunghezza }
}

function estraiFrame(bytes) {
  const frames = []
  let i = saltaId3(bytes)
  while (i < bytes.length - 4 && !frameA(bytes, i)) i += 1
  while (i + 4 <= bytes.length) {
    const frame = frameA(bytes, i)
    if (!frame) break
    frames.push(bytes.subarray(i, i + frame.lunghezza))
    i += frame.lunghezza
  }
  return frames
}

function unisci(parti) {
  let totale = 0
  for (const parte of parti) totale += parte.length
  const out = new Uint8Array(totale)
  let offset = 0
  for (const parte of parti) {
    out.set(parte, offset)
    offset += parte.length
  }
  return out
}

let cacheSilenzio = new Map()

async function frameDiSilenzio(campioni, bitrate, mono) {
  const chiave = `${campioni}:${bitrate}:${mono ? 1 : 2}`
  const gia = cacheSilenzio.get(chiave)
  if (gia) return gia
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const encoder = new Mp3Encoder(mono ? 1 : 2, campioni, bitrate / 1000)
  const blocco = new Int16Array(CAMPIONI_PER_FRAME)
  const pezzi = []
  const quanti = campioni * 2
  for (let n = 0; n < quanti; n += CAMPIONI_PER_FRAME) {
    const codificato = mono ? encoder.encodeBuffer(blocco) : encoder.encodeBuffer(blocco, blocco)
    if (codificato?.length) pezzi.push(codificato)
  }
  const coda = encoder.flush()
  if (coda?.length) pezzi.push(coda)
  const frames = estraiFrame(unisci(pezzi))
  const utili = frames.length > 4 ? frames.slice(2, -1) : frames
  if (utili.length === 0) throw new Error('SILENZIO_MP3')
  cacheSilenzio.set(chiave, utili)
  return utili
}

function silenzio(utili, secondi, campioni) {
  const necessari = Math.round(Number(secondi) * campioni / CAMPIONI_PER_FRAME)
  if (necessari <= 0) return []
  const frames = []
  for (let i = 0; i < necessari; i += 1) frames.push(utili[i % utili.length])
  return frames
}

export function durataMp3(bytes) {
  const frames = estraiFrame(bytes)
  if (frames.length === 0) return null
  const primo = frameA(frames[0], 0)
  if (!primo) return null
  return (frames.length * CAMPIONI_PER_FRAME) / primo.campioni
}

export async function concatenaConPause(pezzi, pauseSecondi) {
  const parti = (pezzi || []).filter(p => p && p.length)
  if (parti.length === 0) throw new Error('AUDIO_VUOTO')
  const primo = (() => {
    let i = saltaId3(parti[0])
    while (i < parti[0].length - 4 && !frameA(parti[0], i)) i += 1
    return frameA(parti[0], i)
  })()
  if (!primo) throw new Error('MP3_NON_LETTO')
  const mono = primo.canali === 3
  const utili = await frameDiSilenzio(primo.campioni, primo.bitrate, mono)
  const frames = []
  parti.forEach((pezzo, indice) => {
    const delPezzo = estraiFrame(pezzo)
    if (delPezzo.length === 0) throw new Error('MP3_NON_LETTO')
    frames.push(...delPezzo)
    const pausa = Number(pauseSecondi?.[indice]) || 0
    if (indice < parti.length - 1 && pausa > 0) {
      frames.push(...silenzio(utili, pausa, primo.campioni))
    }
  })
  return unisci(frames)
}
