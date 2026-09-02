const CAMPANA_SRC = `${import.meta.env.BASE_URL}audio/campana-tibetana.mp3`
/** Pausa dopo la campana, prima della traccia (ms). */
export const GAP_DOPO_CAMPANA_MS = 400

let audioCtx = null
let buffer = null
let htmlPronto = null
let preloadPromise = null

function getCtx() {
  const C = window.AudioContext || window.webkitAudioContext
  if (!C) return null
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new C()
  }
  return audioCtx
}

function audioHtml() {
  if (!htmlPronto) {
    htmlPronto = new Audio(CAMPANA_SRC)
    htmlPronto.preload = 'auto'
    htmlPronto.load()
  }
  return htmlPronto
}

export function precaricaCampanaTibetana() {
  if (buffer) return Promise.resolve(true)
  if (preloadPromise) return preloadPromise

  preloadPromise = (async () => {
    audioHtml()
    const ctx = getCtx()
    const res = await fetch(CAMPANA_SRC)
    if (!res.ok) throw new Error('campana non trovata')
    const raw = await res.arrayBuffer()
    if (ctx) {
      buffer = await ctx.decodeAudioData(raw.slice(0))
      return true
    }
    await new Promise(done => {
      const el = audioHtml()
      if (el.readyState >= 3) done()
      else {
        el.addEventListener('canplaythrough', () => done(), { once: true })
        el.addEventListener('error', () => done(), { once: true })
      }
    })
    return true
  })().catch(() => {
    preloadPromise = null
    return false
  })

  return preloadPromise
}

function suonaDaBuffer(ctx) {
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})

  const source = ctx.createBufferSource()
  const gain = ctx.createGain()
  gain.gain.value = 1
  source.buffer = buffer
  source.connect(gain)
  gain.connect(ctx.destination)

  let chiuso = false
  let risolvi
  let timer = null

  function termina(esito) {
    if (chiuso) return
    chiuso = true
    if (timer) window.clearTimeout(timer)
    risolvi?.(esito)
  }

  const attesa = new Promise(done => {
    risolvi = done
  })

  source.onended = () => termina('fine')
  timer = window.setTimeout(
    () => termina('fine'),
    Math.ceil(buffer.duration * 1000) + 80
  )

  source.start(0)

  return {
    attesa,
    ferma() {
      if (chiuso) return
      try {
        gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03)
        source.stop(ctx.currentTime + 0.08)
      } catch { /* già fermato */ }
      termina('stop')
    }
  }
}

function suonaDaHtml() {
  const audio = audioHtml()
  let chiuso = false
  let risolvi

  function chiudi() {
    if (chiuso) return
    chiuso = true
    try {
      audio.pause()
      audio.currentTime = 0
    } catch { /* già fermato */ }
  }

  const attesa = new Promise(done => {
    risolvi = done
    audio.addEventListener('ended', () => {
      if (chiuso) return
      chiuso = true
      done('fine')
    }, { once: true })
    audio.addEventListener('error', () => {
      if (chiuso) return
      chiuso = true
      done('fine')
    }, { once: true })
  })

  try {
    audio.pause()
    audio.currentTime = 0
  } catch { /* ignore */ }

  const avvio = audio.play()
  if (avvio?.catch) {
    avvio.catch(() => {
      if (chiuso) return
      chiuso = true
      risolvi?.('fine')
    })
  }

  return {
    attesa,
    ferma() {
      chiudi()
      risolvi?.('stop')
    }
  }
}

/**
 * Riproduce la campana già in memoria (se precaricata).
 * Stesso gesto utente → partenza immediata.
 */
export function suonaCampanaTibetana() {
  const ctx = getCtx()
  if (ctx && buffer) return suonaDaBuffer(ctx)
  return suonaDaHtml()
}
