const EVENTO_PAUSA_ALTRE = 'conscio:pausa-altre-tracce'

/** Instagram, Facebook e simili: un solo audio e gesto utente che scade subito. */
export function browserAudioRestrittivo() {
  if (typeof navigator === 'undefined') return false
  return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|Twitter|TikTok|Bytedance|Snapchat|WhatsApp/i
    .test(navigator.userAgent || '')
}

export function applicaPlaysInline(el) {
  if (!el) return
  el.setAttribute('playsinline', 'true')
  el.setAttribute('webkit-playsinline', 'true')
  el.playsInline = true
}

export function riavvolgiSicuro(el) {
  if (!el) return
  try {
    el.currentTime = 0
  } catch {
    /* iOS InvalidStateError se i metadati non sono pronti */
  }
}

export function errorePlayIgnorabile(err) {
  return err?.name === 'AbortError'
}

export function messaggioErroreRiproduzione() {
  if (browserAudioRestrittivo()) {
    return 'Da Instagram o Facebook l’audio spesso è bloccato. Apri il sito in Safari o Chrome, poi riprova.'
  }
  return 'Non è stato possibile riprodurre la traccia. Riprova.'
}

export function pausaAltreTracce(el) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENTO_PAUSA_ALTRE, { detail: el }))
}

export function ascoltaPausaAltreTracce(audioRef, onPausa) {
  function handler(e) {
    if (e.detail === audioRef.current) return
    onPausa()
  }
  window.addEventListener(EVENTO_PAUSA_ALTRE, handler)
  return () => window.removeEventListener(EVENTO_PAUSA_ALTRE, handler)
}

export function erroreMediaIgnorabile(el) {
  const code = el?.error?.code
  return code === 1 /* MEDIA_ERR_ABORTED */
}

/**
 * play() muto nel click, così l’elemento resta sbloccato dopo la campana.
 * Non mettere in pausa da onPlay mentre è in corso: su iOS lo sblocco fallirebbe.
 */
export function avviaSblocco(el) {
  applicaPlaysInline(el)
  el.muted = true
  el.volume = 0
  const playP = el.play().then(() => true, () => false)

  const partito = new Promise(resolve => {
    let chiuso = false
    const fine = ok => {
      if (chiuso) return
      chiuso = true
      resolve(ok)
    }
    el.addEventListener('playing', () => fine(true), { once: true })
    playP.then(fine)
    window.setTimeout(() => fine(false), 2500)
  })

  return {
    async chiudi() {
      const ok = await partito
      try { el.pause() } catch { /* ignore */ }
      riavvolgiSicuro(el)
      el.muted = true
      el.volume = 0
      return ok
    }
  }
}

export async function avviaPlay(el) {
  if (!el) throw new Error('no audio')
  applicaPlaysInline(el)
  try {
    await el.play()
  } catch (err) {
    if (errorePlayIgnorabile(err) || err?.name === 'NotAllowedError') throw err
    try { el.load() } catch { /* ignore */ }
    applicaPlaysInline(el)
    await new Promise(risolvi => window.setTimeout(risolvi, 80))
    await el.play()
  }
}
