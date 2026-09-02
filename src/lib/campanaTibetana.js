const CAMPANA_SRC = `${import.meta.env.BASE_URL}audio/campana-tibetana.mp3`

export function suonaCampanaTibetana() {
  const audio = new Audio(CAMPANA_SRC)
  audio.preload = 'auto'
  let chiuso = false
  let risolvi

  function chiudi() {
    if (chiuso) return
    chiuso = true
    try {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    } catch { /* già fermato */ }
  }

  const attesa = new Promise(done => {
    risolvi = done
    const fine = () => {
      if (chiuso) return
      chiuso = true
      done('fine')
    }
    audio.addEventListener('ended', fine, { once: true })
    audio.addEventListener('error', () => {
      if (chiuso) return
      chiuso = true
      done('fine')
    }, { once: true })
  })

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
