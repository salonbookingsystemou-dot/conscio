import { useEffect, useRef, useState } from 'react'
import { ascoltoCompletato, recuperaAscoltoSeManca, registraAscoltoCompleto } from '../lib/ascolto.js'
import { assicuraTracciaOffline } from '../lib/cacheTracce.js'
import { urlAudioSenzaTesto } from '../lib/tracce.js'
import {
  GAP_DOPO_CAMPANA_MS,
  precaricaCampanaTibetana,
  suonaCampanaTibetana
} from '../lib/campanaTibetana.js'
import {
  applicaPlaysInline,
  ascoltaPausaAltreTracce,
  avviaPlay,
  avviaSblocco,
  browserAudioRestrittivo,
  erroreMediaIgnorabile,
  errorePlayIgnorabile,
  messaggioErroreRiproduzione,
  pausaAltreTracce,
  riavvolgiSicuro
} from '../lib/riproduzioneAudio.js'

function formattaTempo(secondi) {
  if (!Number.isFinite(secondi) || secondi < 0) return '0:00'
  const m = Math.floor(secondi / 60)
  const s = Math.floor(secondi % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function IconaPlay() {
  return (
    <svg className="player-icona player-icona-play" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9.05 6.15v11.7c0 .7.76 1.14 1.36.78l9.05-5.85a.9.9 0 0 0 0-1.56l-9.05-5.85a.9.9 0 0 0-1.36.78z"
        fill="currentColor"
      />
    </svg>
  )
}

function IconaPausa() {
  return (
    <svg className="player-icona" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7.1" y="6" width="3.2" height="12" rx="1.5" fill="currentColor" />
      <rect x="13.7" y="6" width="3.2" height="12" rx="1.5" fill="currentColor" />
    </svg>
  )
}

function IconaStop() {
  return (
    <svg className="player-icona" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7.2" y="7.2" width="9.6" height="9.6" rx="2.2" fill="currentColor" />
    </svg>
  )
}

export default function TracciaGuidata({
  src,
  persistenzaKey,
  onCompleto,
  onDurata,
  onAscolto,
  onPersistenza,
  anteprima = false
}) {
  const audioRef = useRef(null)
  const playedRef = useRef(0)
  const lastRef = useRef(0)
  const onCompletoRef = useRef(onCompleto)
  const onDurataRef = useRef(onDurata)
  const onAscoltoRef = useRef(onAscolto)
  const onPersistenzaRef = useRef(onPersistenza)
  const durataNotaRef = useRef(0)
  const contatoGiro = useRef(ascoltoCompletato(persistenzaKey))
  const accreditatoRef = useRef(0)
  const campanaRef = useRef(null)
  const ignoraEventiRef = useRef(false)
  const annullaAvvioRef = useRef(false)
  const contaAscoltoRef = useRef(false)
  onCompletoRef.current = onCompleto
  onDurataRef.current = onDurata
  onAscoltoRef.current = onAscolto
  onPersistenzaRef.current = onPersistenza

  const [completo, setCompleto] = useState(() => ascoltoCompletato(persistenzaKey))
  const [percento, setPercento] = useState(() => (ascoltoCompletato(persistenzaKey) ? 100 : 0))
  const [inRiproduzione, setInRiproduzione] = useState(false)
  const [posizione, setPosizione] = useState(0)
  const [durata, setDurata] = useState(0)
  const [errore, setErrore] = useState(false)
  const [inCampana, setInCampana] = useState(false)

  useEffect(() => {
    precaricaCampanaTibetana()
  }, [])

  useEffect(() => {
    applicaPlaysInline(audioRef.current)
  }, [src])

  useEffect(() => {
    return ascoltaPausaAltreTracce(audioRef, () => {
      annullaAvvioRef.current = true
      campanaRef.current?.ferma()
      campanaRef.current = null
      setInCampana(false)
      const el = audioRef.current
      if (el) el.pause()
      setInRiproduzione(false)
    })
  }, [])

  // Scarica in background la traccia reale così è disponibile anche offline.
  useEffect(() => {
    if (anteprima || !src) return
    assicuraTracciaOffline(urlAudioSenzaTesto(src))
  }, [src, anteprima])

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
    accreditatoRef.current = 0
    contaAscoltoRef.current = false
    annullaAvvioRef.current = true
    campanaRef.current?.ferma()
    campanaRef.current = null
    setInCampana(false)
    const el = audioRef.current
    if (el) {
      el.pause()
      riavvolgiSicuro(el)
    }
    onCompletoRef.current?.(gia)
    onDurataRef.current?.(0)
    return () => {
      annullaAvvioRef.current = true
      campanaRef.current?.ferma()
      campanaRef.current = null
    }
  }, [persistenzaKey, src])

  function registraDurata(secondi) {
    if (!Number.isFinite(secondi) || secondi <= 0) return
    setDurata(secondi)
    if (!anteprima && recuperaAscoltoSeManca(persistenzaKey, secondi)) {
      onAscoltoRef.current?.()
    }
    if (Math.abs(durataNotaRef.current - secondi) < 0.5) return
    durataNotaRef.current = secondi
    onDurataRef.current?.(secondi)
  }

  function marca(secondi) {
    if (!contaAscoltoRef.current && !contatoGiro.current) return
    const d = Number.isFinite(secondi) && secondi > 0 ? secondi : audioRef.current?.duration
    if (!Number.isFinite(d) || d < 8) return
    if (playedRef.current < d * 0.9) return
    if (contatoGiro.current && d <= accreditatoRef.current + 1) return
    accreditatoRef.current = d
    contatoGiro.current = true
    if (!anteprima) {
      registraAscoltoCompleto(persistenzaKey, d)
      onPersistenzaRef.current?.(d)
      onAscoltoRef.current?.()
    }
    setCompleto(true)
    setPercento(100)
    onCompletoRef.current?.(true)
  }

  function onTimeUpdate(e) {
    if (ignoraEventiRef.current || !contaAscoltoRef.current) return
    const el = e.currentTarget
    const t = el.currentTime
    const d = el.duration
    setPosizione(t)
    if (Number.isFinite(d) && d > 0) registraDurata(d)
    if (!Number.isFinite(d) || d < 8) return
    const delta = t - lastRef.current
    if (delta > 0 && delta < 1.5) playedRef.current += delta
    lastRef.current = t
    if (!completo) {
      setPercento(Math.min(100, Math.round((playedRef.current / d) * 100)))
    }
    if (playedRef.current >= d * 0.95 || contatoGiro.current) marca(d)
  }

  function onSeeking(e) {
    if (ignoraEventiRef.current || !contaAscoltoRef.current) return
    lastRef.current = e.currentTarget.currentTime
  }

  function onEnded(e) {
    if (ignoraEventiRef.current || !contaAscoltoRef.current) return
    setInRiproduzione(false)
    const d = e.currentTarget.duration
    if (Number.isFinite(d) && d >= 8 && playedRef.current >= d * 0.9) marca(d)
  }

  function onLoadedMetadata(e) {
    registraDurata(e.currentTarget.duration)
  }

  async function ascolta() {
    const el = audioRef.current
    if (!el) return
    applicaPlaysInline(el)
    pausaAltreTracce(el)
    const dallInizio = el.currentTime < 0.15
    const skipCampana = dallInizio && browserAudioRestrittivo()
    annullaAvvioRef.current = false
    if (!anteprima) assicuraTracciaOffline(urlAudioSenzaTesto(src))
    try {
      setErrore(false)
      if (dallInizio && !skipCampana) {
        contaAscoltoRef.current = false
        ignoraEventiRef.current = true
        setInCampana(true)
        setInRiproduzione(true)
        /* Traccia per prima: il gesto utente sblocca l’elemento che deve suonare. */
        const sblocco = avviaSblocco(el)
        void precaricaCampanaTibetana()
        const suono = suonaCampanaTibetana()
        campanaRef.current = suono
        const [esito] = await Promise.all([suono.attesa, sblocco.chiudi()])
        campanaRef.current = null
        if (annullaAvvioRef.current || esito !== 'fine') {
          setInCampana(false)
          setInRiproduzione(false)
          ignoraEventiRef.current = false
          return
        }
        await new Promise(risolvi => window.setTimeout(risolvi, GAP_DOPO_CAMPANA_MS))
        if (annullaAvvioRef.current) {
          setInCampana(false)
          setInRiproduzione(false)
          ignoraEventiRef.current = false
          return
        }
        setInCampana(false)
        el.pause()
        riavvolgiSicuro(el)
        el.muted = false
        el.volume = 1
        playedRef.current = 0
        lastRef.current = 0
        ignoraEventiRef.current = false
      } else if (dallInizio && skipCampana) {
        contaAscoltoRef.current = false
        el.muted = false
        el.volume = 1
        riavvolgiSicuro(el)
        playedRef.current = 0
        lastRef.current = 0
      }
      if (annullaAvvioRef.current) {
        setInRiproduzione(false)
        return
      }
      contaAscoltoRef.current = true
      await avviaPlay(el)
      setInRiproduzione(true)
    } catch (err) {
      campanaRef.current?.ferma()
      campanaRef.current = null
      setInCampana(false)
      if (errorePlayIgnorabile(err) || annullaAvvioRef.current) {
        setInRiproduzione(false)
        return
      }
      setErrore(true)
      setInRiproduzione(false)
    }
  }

  function pausa() {
    annullaAvvioRef.current = true
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
    annullaAvvioRef.current = true
    if (campanaRef.current) {
      campanaRef.current.ferma()
      campanaRef.current = null
      setInCampana(false)
    }
    const el = audioRef.current
    if (!el) return
    el.pause()
    riavvolgiSicuro(el)
    lastRef.current = 0
    playedRef.current = 0
    contatoGiro.current = false
    accreditatoRef.current = 0
    setInRiproduzione(false)
    setPosizione(0)
  }

  const avanzamento = durata > 0 ? Math.min(100, (posizione / durata) * 100) : 0
  const fermo = !inRiproduzione && !inCampana && posizione === 0

  return (
    <div className="traccia-settimana">
      <p><strong>{anteprima ? 'Anteprima traccia' : 'Traccia guidata'}</strong></p>
      <p className="hint">
        {anteprima
          ? (inCampana
            ? 'Campana di apertura… poi inizia la traccia.'
            : 'Stesso player della settimana, senza registrare l’ascolto.')
          : inCampana
            ? 'Campana di apertura… poi inizia la traccia.'
            : completo
              ? 'Traccia ascoltata per intero. Con almeno una traccia puoi registrare la sessione.'
              : 'Ascolta la traccia fino alla fine. Ne basta una per aprire le annotazioni del giorno.'}
      </p>
      <audio
        ref={audioRef}
        className="player-audio-nativo"
        src={urlAudioSenzaTesto(src)}
        preload="metadata"
        playsInline
        onTimeUpdate={onTimeUpdate}
        onSeeking={onSeeking}
        onEnded={onEnded}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={() => {
          if (ignoraEventiRef.current || campanaRef.current) return
          setInRiproduzione(true)
        }}
        onPause={() => {
          if (ignoraEventiRef.current || campanaRef.current) return
          setInRiproduzione(false)
        }}
        onError={e => {
          if (ignoraEventiRef.current || erroreMediaIgnorabile(e.currentTarget)) return
          setErrore(true)
        }}
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
        <p className="campo-errore" role="alert">
          {messaggioErroreRiproduzione()}
        </p>
      )}
    </div>
  )
}
