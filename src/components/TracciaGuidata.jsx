import { useEffect, useRef, useState } from 'react'
import { ascoltoCompletato, memorizzaAscolto } from '../lib/ascolto.js'

export default function TracciaGuidata({ src, persistenzaKey, onCompleto }) {
  const [completo, setCompleto] = useState(() => ascoltoCompletato(persistenzaKey))
  const [percento, setPercento] = useState(() => (ascoltoCompletato(persistenzaKey) ? 100 : 0))
  const playedRef = useRef(0)
  const lastRef = useRef(0)
  const onCompletoRef = useRef(onCompleto)
  onCompletoRef.current = onCompleto

  useEffect(() => {
    const gia = ascoltoCompletato(persistenzaKey)
    setCompleto(gia)
    setPercento(gia ? 100 : 0)
    playedRef.current = 0
    lastRef.current = 0
    onCompletoRef.current?.(gia)
  }, [persistenzaKey, src])

  function marca() {
    memorizzaAscolto(persistenzaKey)
    setCompleto(true)
    setPercento(100)
    onCompletoRef.current?.(true)
  }

  function onTimeUpdate(e) {
    if (completo) return
    const el = e.currentTarget
    const t = el.currentTime
    const d = el.duration
    if (!Number.isFinite(d) || d <= 0) return
    const delta = t - lastRef.current
    if (delta > 0 && delta < 1.5) playedRef.current += delta
    lastRef.current = t
    setPercento(Math.min(100, Math.round((playedRef.current / d) * 100)))
    if (playedRef.current >= d * 0.95) marca()
  }

  function onSeeking(e) {
    lastRef.current = e.currentTarget.currentTime
  }

  function onEnded(e) {
    const d = e.currentTarget.duration
    if (Number.isFinite(d) && playedRef.current >= d * 0.9) marca()
  }

  return (
    <div className="traccia-settimana">
      <p><strong>Traccia guidata</strong></p>
      <p className="hint">
        {completo
          ? 'Traccia ascoltata per intero. Puoi registrare la sessione.'
          : 'Ascolta la traccia fino alla fine: è il materiale della sessione. Poi si apre il log.'}
      </p>
      <audio
        className="player-audio"
        controls
        controlsList="nodownload"
        src={src}
        preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onSeeking={onSeeking}
        onEnded={onEnded}
      >
        Il browser non riproduce questa traccia.
      </audio>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${percento}%` }} />
      </div>
      <p className="hint">{completo ? 'Completata' : `Ascolto ${percento}%`}</p>
    </div>
  )
}
