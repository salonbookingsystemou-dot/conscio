import { useEffect, useRef, useState } from 'react'
import { ascoltoCompletato, memorizzaAscolto, recuperaAscoltoSeManca, registraAscoltoCompleto } from '../lib/ascolto.js'
import { suonaCampanaTibetana } from '../lib/campanaTibetana.js'

function formattaTempo(secondi) {
  if (!Number.isFinite(secondi) || secondi < 0) return '0:00'
  const m = Math.floor(secondi / 60)
  const s = Math.floor(secondi % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function IconaPlay() {
  return (
    <svg className="player-icona" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.2 5.6v12.8L18.4 12 8.2 5.6z" fill="currentColor" />
    </svg>
  )
}

function IconaPausa() {
  return (
    <svg className="player-icona" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6.5" y="5.5" width="3.8" height="13" rx="1" fill="currentColor" />
      <rect x="13.7" y="5.5" width="3.8" height="13" rx="1" fill="currentColor" />
    </svg>
  )
}

function IconaStop() {
  return (
    <svg className="player-icona" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" />
    </svg>
  )
}

export default function TracciaGuidata({ src, persistenzaKey, onCompleto, onDurata, onAscolto }) {
  const audioRef = useRef(null)
  const playedRef = useRef(0)
  const lastRef = useRef(0)
  const onCompletoRef = useRef(onCompleto)
  const onDurataRef = useRef(onDurata)
  const onAscoltoRef = useRef(onAscolto)
  const durataNotaRef = useRef(0)
  const contatoGiro = useRef(ascoltoCompletato(persistenzaKey))
  const campanaRef = useRef(null)
  const ignoraEventiRef = useRef(false)
  onCompletoRef.current = onCompleto
  onDurataRef.current = onDurata
  onAscoltoRef.current = onAscolto

  const [completo, setCompleto] = useState(() => ascoltoCompletato(persistenzaKey))
  const [percento, setPercento] = useState(() => (ascoltoCompletato(persistenzaKey) ? 100 : 0))
  const [inRiproduzione, setInRiproduzione] = useState(false)
  const [posizione, setPosizione] = useState(0)
  const [durata, setDurata] = useState(0)
  const [errore, setErrore] = useState(false)
  const [inCampana, setInCampana] = useState(false)

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
    contatoGiro.current = gia
    campanaRef.current?.ferma()
    campanaRef.current = null
    setInCampana(false)
    const el = audioRef.current
    if (el) {
      el.pause()
      el.currentTime = 0
    }
    onCompletoRef.current?.(gia)
    onDurataRef.current?.(0)
    return () => {
      campanaRef.current?.ferma()
      campanaRef.current = null
    }
  }, [persistenzaKey, src])

  function registraDurata(secondi) {
    if (!Number.isFinite(secondi) || secondi <= 0) return
    setDurata(secondi)
    if (recuperaAscoltoSeManca(persistenzaKey, secondi)) {
      onAscoltoRef.current?.()
    }
    if (Math.abs(durataNotaRef.current - secondi) < 0.5) return
    durataNotaRef.current = secondi
    onDurataRef.current?.(secondi)
  }

  function marca(secondi) {
    if (contatoGiro.current) return
    contatoGiro.current = true
    const d = Number.isFinite(secondi) && secondi > 0 ? secondi : audioRef.current?.duration
    if (Number.isFinite(d) && d > 0) {
      registraAscoltoCompleto(persistenzaKey, d)
      onAscoltoRef.current?.()
    } else {
      memorizzaAscolto(persistenzaKey)
    }
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
    if (!Number.isFinite(d) || d <= 0) return
    const delta = t - lastRef.current
    if (delta > 0 && delta < 1.5) playedRef.current += delta
    lastRef.current = t
    if (!completo) {
      setPercento(Math.min(100, Math.round((playedRef.current / d) * 100)))
    }
    if (playedRef.current >= d * 0.95) marca(d)
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

  async function sbloccaAudio(el) {
    ignoraEventiRef.current = true
    const muto = el.muted
    try {
      el.muted = true
      const avvio = el.play().catch(() => {})
      await Promise.race([
        avvio,
        new Promise(risolvi => window.setTimeout(risolvi, 80))
      ])
      el.pause()
      el.currentTime = 0
      lastRef.current = 0
    } catch {
      /* lo sblocco serve a Safari; se fallisce, play() dopo la campana riprova */
    }
    el.muted = muto
    ignoraEventiRef.current = false
  }

  async function ascolta() {
    const el = audioRef.current
    if (!el) return
    const dallInizio = el.currentTime < 0.15
    try {
      setErrore(false)
      if (dallInizio) {
        setInCampana(true)
        setInRiproduzione(true)
        const suono = suonaCampanaTibetana()
        campanaRef.current = suono
        const sblocco = sbloccaAudio(el)
        const esito = await suono.attesa
        await sblocco
        campanaRef.current = null
        setInCampana(false)
        if (esito !== 'fine') {
          setInRiproduzione(false)
          return
        }
      }
      await el.play()
      setInRiproduzione(true)
    } catch {
      campanaRef.current?.ferma()
      campanaRef.current = null
      setInCampana(false)
      setErrore(true)
      setInRiproduzione(false)
    }
  }

  function pausa() {
    if (campanaRef.current) {
      campanaRef.current.ferma()
      campanaRef.current = null
      setInCampana(false)
      setInRiproduzione(false)
      return
    }
    const el = audioRef.current
    if (!el) return
    el.pause()
    setInRiproduzione(false)
  }

  function stop() {
    if (campanaRef.current) {
      campanaRef.current.ferma()
      campanaRef.current = null
      setInCampana(false)
    }
    const el = audioRef.current
    if (!el) return
    el.pause()
    el.currentTime = 0
    lastRef.current = 0
    playedRef.current = 0
    contatoGiro.current = false
    setInRiproduzione(false)
    setPosizione(0)
  }

  const avanzamento = durata > 0 ? Math.min(100, (posizione / durata) * 100) : 0
  const fermo = !inRiproduzione && !inCampana && posizione === 0

  return (
    <div className="traccia-settimana">
      <p><strong>Traccia guidata</strong></p>
      <p className="hint">
        {inCampana
          ? 'Campana di apertura… poi inizia la traccia.'
          : completo
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
        onPlay={() => {
          if (ignoraEventiRef.current) return
          setInRiproduzione(true)
        }}
        onPause={() => {
          if (ignoraEventiRef.current || campanaRef.current) return
          setInRiproduzione(false)
        }}
        onError={() => setErrore(true)}
      >
        Il browser non riproduce questa traccia.
      </audio>
      <div className="player-comandi" role="group" aria-label="Controlli traccia">
        <button
          type="button"
          className="player-btn player-btn-play"
          onClick={ascolta}
          disabled={inRiproduzione || inCampana}
          aria-label={fermo ? 'Ascolta' : 'Riprendi'}
          title={fermo ? 'Ascolta' : 'Riprendi'}
        >
          <IconaPlay />
        </button>
        <button
          type="button"
          className="player-btn"
          onClick={pausa}
          disabled={!inRiproduzione && !inCampana}
          aria-label="Pausa"
          title="Pausa"
        >
          <IconaPausa />
        </button>
        <button
          type="button"
          className="player-btn"
          onClick={stop}
          disabled={fermo && !inRiproduzione && !inCampana}
          aria-label="Stop"
          title="Stop"
        >
          <IconaStop />
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
