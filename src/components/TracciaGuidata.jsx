import { useEffect, useRef, useState } from 'react'
import { ascoltoCompletato, memorizzaAscolto } from '../lib/ascolto.js'

function formattaTempo(secondi) {
  if (!Number.isFinite(secondi) || secondi < 0) return '0:00'
  const m = Math.floor(secondi / 60)
  const s = Math.floor(secondi % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TracciaGuidata({ src, persistenzaKey, onCompleto, onDurata }) {
  const audioRef = useRef(null)
  const playedRef = useRef(0)
  const lastRef = useRef(0)
  const onCompletoRef = useRef(onCompleto)
  const onDurataRef = useRef(onDurata)
  const durataNotaRef = useRef(0)
  onCompletoRef.current = onCompleto
  onDurataRef.current = onDurata

  const [completo, setCompleto] = useState(() => ascoltoCompletato(persistenzaKey))
  const [percento, setPercento] = useState(() => (ascoltoCompletato(persistenzaKey) ? 100 : 0))
  const [inRiproduzione, setInRiproduzione] = useState(false)
  const [posizione, setPosizione] = useState(0)
  const [durata, setDurata] = useState(0)
  const [errore, setErrore] = useState(false)

  useEffect(() => {
    const gia = ascoltoCompletato(persistenzaKey)
    setCompleto(gia)
    setPercento(gia ? 100 : 0)
    setInRiproduzione(false)
    setPosizione(0)
    setDurata(0)
    setErrore(false)
    playedRef.current = 0
    lastRef.current = 0
    durataNotaRef.current = 0
    const el = audioRef.current
    if (el) {
      el.pause()
      el.currentTime = 0
    }
    onCompletoRef.current?.(gia)
    onDurataRef.current?.(0)
  }, [persistenzaKey, src])

  function registraDurata(secondi) {
    if (!Number.isFinite(secondi) || secondi <= 0) return
    setDurata(secondi)
    if (Math.abs(durataNotaRef.current - secondi) < 0.5) return
    durataNotaRef.current = secondi
    onDurataRef.current?.(secondi)
  }

  function marca() {
    memorizzaAscolto(persistenzaKey)
    setCompleto(true)
    setPercento(100)
    onCompletoRef.current?.(true)
  }

  function onTimeUpdate(e) {
    const el = e.currentTarget
    const t = el.currentTime
    const d = el.duration
    setPosizione(t)
    if (Number.isFinite(d) && d > 0) registraDurata(d)
    if (completo) return
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
    setInRiproduzione(false)
    const d = e.currentTarget.duration
    if (Number.isFinite(d) && playedRef.current >= d * 0.9) marca()
  }

  function onLoadedMetadata(e) {
    registraDurata(e.currentTarget.duration)
  }

  async function ascolta() {
    const el = audioRef.current
    if (!el) return
    try {
      await el.play()
      setInRiproduzione(true)
      setErrore(false)
    } catch {
      setErrore(true)
      setInRiproduzione(false)
    }
  }

  function pausa() {
    const el = audioRef.current
    if (!el) return
    el.pause()
    setInRiproduzione(false)
  }

  function stop() {
    const el = audioRef.current
    if (!el) return
    el.pause()
    el.currentTime = 0
    lastRef.current = 0
    setInRiproduzione(false)
    setPosizione(0)
  }

  const avanzamento = durata > 0 ? Math.min(100, (posizione / durata) * 100) : 0
  const fermo = !inRiproduzione && posizione === 0

  return (
    <div className="traccia-settimana">
      <p><strong>Traccia guidata</strong></p>
      <p className="hint">
        {completo
          ? 'Traccia ascoltata per intero. Puoi registrare la sessione.'
          : 'Ascolta la traccia fino alla fine: è il materiale della sessione. Poi si apre il log.'}
      </p>
      <audio
        ref={audioRef}
        className="player-audio-nativo"
        src={src}
        preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onSeeking={onSeeking}
        onEnded={onEnded}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={() => setInRiproduzione(true)}
        onPause={() => setInRiproduzione(false)}
        onError={() => setErrore(true)}
      >
        Il browser non riproduce questa traccia.
      </audio>
      <div className="player-comandi">
        <button
          type="button"
          className="btn"
          onClick={ascolta}
          disabled={inRiproduzione}
        >
          {fermo ? 'Ascolta' : 'Riprendi'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={pausa}
          disabled={!inRiproduzione}
        >
          Pausa
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={stop}
          disabled={fermo && !inRiproduzione}
        >
          Stop
        </button>
      </div>
      <p className="player-tempo">
        {formattaTempo(posizione)} / {formattaTempo(durata)}
      </p>
      <div
        className="progress"
        role="meter"
        aria-label="Posizione nella traccia"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(avanzamento)}
      >
        <span style={{ width: `${avanzamento}%` }} />
      </div>
      <p className="hint">{completo ? 'Completata' : `Ascolto ${percento}%`}</p>
      {errore && (
        <p className="hint" style={{ color: 'var(--danger)' }}>
          Non è stato possibile riprodurre la traccia. Riprova.
        </p>
      )}
    </div>
  )
}
