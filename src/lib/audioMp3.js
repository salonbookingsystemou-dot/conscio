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

function leggiU32(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

// Xing/Info/VBRI non è audio: dice quanti frame ha il file di origine.
// Tenendolo nel file unito, il browser mostra la durata del primo paragrafo.
function eIntestazioneDurata(frame) {
  if (frame.length < 8) return false
  const mono = ((frame[3] >> 6) & 3) === 3
  const offset = 4 + (mono ? 17 : 32)
  if (offset + 8 <= frame.length) {
    const tag = String.fromCharCode(frame[offset], frame[offset + 1], frame[offset + 2], frame[offset + 3])
    if (tag === 'Xing' || tag === 'Info') return true
  }
  return frame.length >= 40
    && String.fromCharCode(frame[36], frame[37], frame[38], frame[39]) === 'VBRI'
}

function durataDichiarata(frame, campioni) {
  const mono = ((frame[3] >> 6) & 3) === 3
  const offset = 4 + (mono ? 17 : 32)
  if (offset + 12 > frame.length) return null
  const tag = String.fromCharCode(frame[offset], frame[offset + 1], frame[offset + 2], frame[offset + 3])
  if (tag !== 'Xing' && tag !== 'Info') return null
  const flags = leggiU32(frame, offset + 4)
  if ((flags & 1) === 0) return null
  const n = leggiU32(frame, offset + 8)
  if (!n || !campioni) return null
  return (n * CAMPIONI_PER_FRAME) / campioni
}

function estraiFrame(bytes) {
  const frames = []
  let i = saltaId3(bytes)
  while (i < bytes.length - 4 && !frameA(bytes, i)) i += 1
  while (i + 4 <= bytes.length) {
    const frame = frameA(bytes, i)
    if (!frame) break
    const slice = bytes.subarray(i, i + frame.lunghezza)
    if (!eIntestazioneDurata(slice)) frames.push(slice)
    i += frame.lunghezza
  }
  return frames
}

// Durata vera da un MP3 già in memoria, oppure null se i metadati del browser bastano.
// Se l'intestazione Xing copre solo il primo spezzone, si usa la dimensione del file.
export function durataDaPrefisso(bytes, totale) {
  if (!bytes?.length || !Number.isFinite(totale) || totale < 128) return null
  if (bytes.length >= totale) return durataMp3(bytes)
  const inizio = saltaId3(bytes)
  let i = inizio
  while (i < bytes.length - 4 && !frameA(bytes, i)) i += 1
  let dichiarato = null
  let bitrate = 0
  let campioni = 0
  let visti = 0
  while (i + 4 <= bytes.length && visti < 8) {
    const frame = frameA(bytes, i)
    if (!frame) break
    const slice = bytes.subarray(i, i + frame.lunghezza)
    if (eIntestazioneDurata(slice)) {
      dichiarato = dichiarato ?? durataDichiarata(slice, frame.campioni)
    } else {
      if (!bitrate) {
        bitrate = frame.bitrate
        campioni = frame.campioni
      } else if (frame.bitrate !== bitrate) {
        return null
      }
      visti += 1
    }
    i += frame.lunghezza
  }
  if (!bitrate || !campioni || visti < 2) return null
  const daDimensione = (Math.max(0, totale - inizio) * 8) / bitrate
  if (!(daDimensione >= 8)) return null
  if (dichiarato > 0 && daDimensione > dichiarato * 1.08 && daDimensione > dichiarato + 3) {
    return daDimensione
  }
  return null
}

// Lunghezza del tag ID3 anche quando supera i byte letti (copertine incluse).
export function lunghezzaId3(bytes) {
  if (bytes?.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const size = ((bytes[6] & 0x7f) << 21)
      | ((bytes[7] & 0x7f) << 14)
      | ((bytes[8] & 0x7f) << 7)
      | (bytes[9] & 0x7f)
    return 10 + size + ((bytes[5] & 0x10) ? 10 : 0)
  }
  return 0
}

// Formato dall'inizio di un MP3 (MPEG-1 layer III): null se non si trovano due
// frame di fila. `scarto` è la posizione nel file del primo byte di `bytes`.
export function infoMp3(bytes, totale, scarto = 0) {
  if (!bytes?.length) return null
  for (let i = 0; i + 4 <= bytes.length; i += 1) {
    const primo = frameA(bytes, i)
    if (!primo || !frameA(bytes, i + primo.lunghezza)) continue
    const slice = bytes.subarray(i, i + primo.lunghezza)
    const intestazione = eIntestazioneDurata(slice)
    const audio = intestazione ? frameA(bytes, i + primo.lunghezza) : primo
    const tag = intestazione ? String.fromCharCode(...slice.subarray(4 + (primo.canali === 3 ? 17 : 32), 8 + (primo.canali === 3 ? 17 : 32))) : ''
    const daDimensione = Number.isFinite(totale) && totale > 0
      ? (Math.max(0, totale - scarto - i) * 8) / audio.bitrate
      : null
    return {
      bitrate: audio.bitrate,
      campioni: audio.campioni,
      mono: audio.canali === 3,
      vbr: tag === 'Xing' || (intestazione && tag !== 'Info'),
      dichiarata: intestazione ? durataDichiarata(slice, primo.campioni) : null,
      daDimensione
    }
  }
  return null
}

async function durataDaCache(url) {
  if (typeof caches === 'undefined') return null
  const match = await caches.match(url)
  if (!match) return null
  const sec = durataMp3(new Uint8Array(await match.arrayBuffer()))
  return sec >= 8 ? sec : null
}

export async function durataNotaMp3(url) {
  if (!url) return null
  try {
    const inCache = await durataDaCache(url)
    if (inCache) return inCache
  } catch {
    /* cache non disponibile */
  }
  try {
    const head = await fetch(url, { method: 'HEAD', mode: 'cors', credentials: 'omit' })
    const parziale = await fetch(url, {
      headers: { Range: 'bytes=0-8191' },
      mode: 'cors',
      credentials: 'omit'
    })
    const bytes = new Uint8Array(await parziale.arrayBuffer())
    if (!bytes.length) return null
    const range = parziale.headers.get('content-range') || ''
    const dalRange = Number(range.split('/')[1])
    const totale = Number.isFinite(dalRange) && dalRange > 0
      ? dalRange
      : Number(head.headers.get('content-length'))
    if (Number.isFinite(totale) && bytes.length >= totale) return durataMp3(bytes)
    return durataDaPrefisso(bytes, totale)
  } catch {
    return null
  }
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
    while (i + 4 <= parti[0].length) {
      const frame = frameA(parti[0], i)
      if (!frame) return null
      const slice = parti[0].subarray(i, i + frame.lunghezza)
      if (!eIntestazioneDurata(slice)) return frame
      i += frame.lunghezza
    }
    return null
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
