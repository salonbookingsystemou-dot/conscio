/** Pausa dopo la campana, prima della traccia (ms). */
export const GAP_DOPO_CAMPANA_MS = 400

function urlCampana() {
  try {
    return new URL('audio/campana-tibetana.mp3', window.location.origin + '/').href
  } catch {
    return `${import.meta.env.BASE_URL}audio/campana-tibetana.mp3`
  }
}

function isIos() {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

let blobUrl = null
let buffer = null
let audioCtx = null
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
    htmlPronto = new Audio()
    htmlPronto.preload = 'auto'
    htmlPronto.setAttribute('playsinline', 'true')
    htmlPronto.setAttribute('webkit-playsinline', 'true')
    htmlPronto.src = blobUrl || urlCampana()
    htmlPronto.load()
  } else if (blobUrl && htmlPronto.src !== blobUrl) {
    htmlPronto.src = blobUrl
    htmlPronto.load()
  }
  return htmlPronto
}

export function precaricaCampanaTibetana() {
  if (blobUrl && buffer) return Promise.resolve(true)
  if (preloadPromise) return preloadPromise

  preloadPromise = (async () => {
    const res = await fetch(urlCampana(), { credentials: 'same-origin', cache: 'force-cache' })
    if (!res.ok) throw new Error('campana non trovata')
    const raw = await res.arrayBuffer()
    const copia = raw.slice(0)
    blobUrl = URL.createObjectURL(new Blob([copia], { type: 'audio/mpeg' }))

    const el = audioHtml()
    el.src = blobUrl
    el.load()

    try {
      const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext
      if (Offline) {
        const offline = new Offline(1, 1, 44100)
        buffer = await offline.decodeAudioData(raw.slice(0))
      }
    } catch {
      buffer = null
    }

    await new Promise(done => {
      if (el.readyState >= 2) done()
      else {
        el.addEventListener('canplaythrough', () => done(), { once: true })
        el.addEventListener('loadeddata', () => done(), { once: true })
        el.addEventListener('error', () => done(), { once: true })
        window.setTimeout(done, 4000)
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
    Math.ceil(buffer.duration * 1000) + 120
  )

  const avvia = () => {
    try {
      source.start(0)
    } catch {
      termina('fine')
    }
  }

  if (ctx.state === 'suspended') {
    /* Avvio resume nel gesto; start dopo resume (ok per Web Audio su iOS). */
    ctx.resume().then(avvia).catch(avvia)
  } else {
    avvia()
  }

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
  let timer = null

  function chiudi() {
    if (chiuso) return
    chiuso = true
    if (timer) window.clearTimeout(timer)
    try {
      audio.pause()
      audio.currentTime = 0
    } catch { /* già fermato */ }
  }

  const attesa = new Promise(done => {
    risolvi = done
  })

  function termina(esito) {
    if (chiuso) return
    chiuso = true
    if (timer) window.clearTimeout(timer)
    risolvi?.(esito)
  }

  audio.addEventListener('ended', () => termina('fine'), { once: true })
  audio.addEventListener('error', () => termina('fine'), { once: true })

  try {
    audio.pause()
    audio.currentTime = 0
  } catch { /* ignore */ }
  audio.muted = false
  audio.volume = 1

  const avvio = audio.play()
  if (avvio?.then) {
    avvio.then(() => {
      const ms = Number.isFinite(audio.duration) && audio.duration > 0
        ? Math.ceil(audio.duration * 1000) + 200
        : 8000
      timer = window.setTimeout(() => termina('fine'), ms)
    }).catch(() => {
      /* Fallback Web Audio se HTML è bloccato. */
      const ctx = getCtx()
      if (ctx && buffer) {
        const alt = suonaDaBuffer(ctx)
        alt.attesa.then(esito => termina(esito === 'stop' ? 'stop' : 'fine'))
        return
      }
      termina('fine')
    })
  } else {
    timer = window.setTimeout(() => termina('fine'), 5000)
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
 * Deve essere chiamata in modo sincrono nel gestore del click
 * (prima di qualsiasi await), altrimenti iOS blocca l’audio.
 */
export function suonaCampanaTibetana() {
  const ctx = getCtx()
  if (ctx?.state === 'suspended') {
    void ctx.resume()
  }

  /* Su iPhone Chrome/Safari l’HTMLAudioElement rispetta meglio il gesto utente. */
  if (isIos() || !buffer || !ctx) {
    return suonaDaHtml()
  }
  return suonaDaBuffer(ctx)
}
