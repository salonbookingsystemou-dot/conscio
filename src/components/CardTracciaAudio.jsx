import { useEffect, useMemo, useRef, useState } from 'react'
import { ascoltoCompletato, avanzaAscolto, memorizzaAscolto, recuperaAscoltoSeManca, registraAscoltoCompleto } from '../lib/ascolto.js'
import { durataNotaMp3 } from '../lib/audioMp3.js'
import { testoDaUrlAudio, urlAudioSenzaTesto } from '../lib/tracce.js'
import { assicuraTracciaOffline } from '../lib/cacheTracce.js'
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
import { COLORI } from '../lib/colori.js'

const ACCENTO_DEFAULT = COLORI.accent
/* Silhouette copiata dal mock (40 barre, altezze relative 29–97). */
const BARRE_ONDA = [
  10, 16, 21, 13, 18, 25, 14, 8, 20, 24, 11, 17, 28, 16, 10, 21, 18, 13, 25, 14,
  8, 20, 24, 11, 17, 27, 16, 10, 21, 18, 13, 24, 14, 8, 20, 25, 11, 17, 23, 13
]

function formattaTempo(secondi) {
  if (!Number.isFinite(secondi) || secondi < 0) return '0:00'
  const m = Math.floor(secondi / 60)
  const s = Math.floor(secondi % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function IconaOnda() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="9" width="2.4" height="6" rx="1.2" fill="currentColor" />
      <rect x="9.2" y="5" width="2.4" height="14" rx="1.2" fill="currentColor" />
      <rect x="13.9" y="7" width="2.4" height="10" rx="1.2" fill="currentColor" />
      <rect x="18.6" y="4" width="2.4" height="16" rx="1.2" fill="currentColor" />
    </svg>
  )
}

function IconaPlay() {
  return (
    <svg className="card-traccia-icona card-traccia-icona-play" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9.05 6.15v11.7c0 .7.76 1.14 1.36.78l9.05-5.85a.9.9 0 0 0 0-1.56l-9.05-5.85a.9.9 0 0 0-1.36.78z"
        fill="currentColor"
      />
    </svg>
  )
}

function IconaPausa() {
  return (
    <svg className="card-traccia-icona" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7.1" y="6" width="3.2" height="12" rx="1.5" fill="currentColor" />
      <rect x="13.7" y="6" width="3.2" height="12" rx="1.5" fill="currentColor" />
    </svg>
  )
}

function IconaStop() {
  return (
    <svg className="card-traccia-icona" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7.2" y="7.2" width="9.6" height="9.6" rx="2.2" fill="currentColor" />
    </svg>
  )
}

export default function CardTracciaAudio({
  src,
  titolo = 'Body Scan',
  etichettaDurata = '',
  descrizione,
  coloreAccento = ACCENTO_DEFAULT,
  sogliaCompletamento = 0.95,
  persistenzaKey,
  giaAscoltata = false,
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
  const durataFileRef = useRef(0)
  const fileProntoRef = useRef(false)
  const srcMisuratoRef = useRef('')
  const applicaDurataRef = useRef(() => {})
  const marcaRef = useRef(() => {})
  const contatoGiro = useRef(ascoltoCompletato(persistenzaKey))
  const accreditatoRef = useRef(0)
  const campanaRef = useRef(null)
  const ignoraEventiRef = useRef(false)
  const annullaAvvioRef = useRef(false)
  const contaAscoltoRef = useRef(false)
  const giaAscoltataRef = useRef(giaAscoltata)
  const posizioneRealeRef = useRef(0)
  const wallRef = useRef(0)
  giaAscoltataRef.current = giaAscoltata
  onCompletoRef.current = onCompleto
  onDurataRef.current = onDurata
  onAscoltoRef.current = onAscolto
  onPersistenzaRef.current = onPersistenza

  const [completo, setCompleto] = useState(
    () => giaAscoltata || ascoltoCompletato(persistenzaKey)
  )
  const [inRiproduzione, setInRiproduzione] = useState(false)
  const [posizione, setPosizione] = useState(0)
  const [durata, setDurata] = useState(0)
  const [errore, setErrore] = useState(false)
  const [inCampana, setInCampana] = useState(false)

  const soglia = Number.isFinite(sogliaCompletamento)
    ? Math.min(1, Math.max(0.5, sogliaCompletamento))
    : 0.95

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
      if (el) {
        if (Number.isFinite(el.currentTime) && el.currentTime >= 0.15) {
          posizioneRealeRef.current = el.currentTime
        }
        el.pause()
      }
      setInRiproduzione(false)
      if (posizioneRealeRef.current >= 1) setPosizione(posizioneRealeRef.current)
    })
  }, [])

  useEffect(() => {
    if (anteprima || !src) return
    assicuraTracciaOffline(urlAudioSenzaTesto(src))
  }, [src, anteprima])

  useEffect(() => {
    // `giaAscoltata` diventa true a circa il 95%, quando il salvataggio aggiorna
    // il programma. Non è tra le dipendenze: altrimenti questo effetto mette in
    // pausa e riavvolge la traccia mentre gli ultimi minuti stanno ancora suonando.
    const gia = giaAscoltataRef.current || ascoltoCompletato(persistenzaKey)
    if (giaAscoltataRef.current && persistenzaKey) memorizzaAscolto(persistenzaKey)
    setCompleto(gia)
    setInRiproduzione(false)
    setPosizione(0)
    setDurata(0)
    setErrore(false)
    playedRef.current = 0
    lastRef.current = 0
    wallRef.current = 0
    posizioneRealeRef.current = 0
    durataNotaRef.current = 0
    const url = urlAudioSenzaTesto(src)
    if (srcMisuratoRef.current !== url) {
      durataFileRef.current = 0
      fileProntoRef.current = !url
      srcMisuratoRef.current = ''
    }
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
    if (durataFileRef.current >= 8) applicaDurataRef.current(durataFileRef.current)
    return () => {
      annullaAvvioRef.current = true
      campanaRef.current?.ferma()
      campanaRef.current = null
    }
  }, [persistenzaKey, src])

  useEffect(() => {
    const url = urlAudioSenzaTesto(src)
    if (!url) {
      fileProntoRef.current = true
      return undefined
    }
    let attivo = true
    durataNotaMp3(url).then(sec => {
      if (!attivo) return
      if (sec >= 8) {
        durataFileRef.current = sec
        srcMisuratoRef.current = url
      }
      fileProntoRef.current = true
      applicaDurataRef.current(sec || audioRef.current?.duration || 0)
      if (audioRef.current?.ended) marcaRef.current(durataFileRef.current || audioRef.current.duration, true)
    }).catch(() => {
      if (!attivo) return
      fileProntoRef.current = true
      applicaDurataRef.current(audioRef.current?.duration || 0)
      if (audioRef.current?.ended) marcaRef.current(audioRef.current.duration, true)
    })
    return () => { attivo = false }
  }, [src])

  function scegliDurata(secondiElemento) {
    const daFile = durataFileRef.current
    const daEl = Number.isFinite(secondiElemento) && secondiElemento > 0 ? secondiElemento : 0
    if (daFile >= 8 && (daEl < 8 || (daFile > daEl * 1.08 && daFile > daEl + 3))) return daFile
    return daEl || (daFile >= 8 ? daFile : 0)
  }

  function registraDurata(secondi) {
    if (!fileProntoRef.current) return
    const scelta = scegliDurata(secondi)
    if (!(scelta > 0)) return
    setDurata(scelta)
    if (!anteprima && recuperaAscoltoSeManca(persistenzaKey, scelta)) {
      onAscoltoRef.current?.()
    }
    if (Math.abs(durataNotaRef.current - scelta) < 0.5) return
    durataNotaRef.current = scelta
    onDurataRef.current?.(scelta)
  }
  applicaDurataRef.current = registraDurata

  function durataPerCredito(secondi) {
    if (!fileProntoRef.current) return null
    const scelta = scegliDurata(secondi)
    if (scelta >= 8) return scelta
    const ascoltato = playedRef.current
    if (Number.isFinite(ascoltato) && ascoltato >= 8) return ascoltato
    return null
  }

  function marca(secondi, finito = false) {
    if (!contaAscoltoRef.current && !contatoGiro.current) return
    const d = durataPerCredito(secondi)
    if (d == null) return
    const sogliaEffettiva = finito ? 0.9 : soglia
    if (playedRef.current < d * sogliaEffettiva) return
    // «Ascoltata» in card solo a traccia finita. Il credito (90–95%) resta prima,
    // così le annotazioni si aprono, ma gli ultimi minuti continuano a suonare.
    if (finito) setCompleto(true)
    if (contatoGiro.current && d <= accreditatoRef.current + 1) return
    accreditatoRef.current = d
    contatoGiro.current = true
    if (!anteprima) {
      registraAscoltoCompleto(persistenzaKey, d)
      if (onPersistenzaRef.current) onPersistenzaRef.current(d)
      else onAscoltoRef.current?.()
    }
    onCompletoRef.current?.(true)
  }
  marcaRef.current = marca

  function onTimeUpdate(e) {
    if (ignoraEventiRef.current || !contaAscoltoRef.current) return
    const el = e.currentTarget
    const t = el.currentTime
    const d = el.duration
    // In pausa alcuni browser azzerano currentTime: la barra non deve saltare al 100%.
    if (el.paused && t < 0.15 && posizioneRealeRef.current >= 1) return
    if (Number.isFinite(t) && t >= 0.15) posizioneRealeRef.current = t
    setPosizione(t)
    const affidabile = scegliDurata(d)
    if (affidabile > 0) registraDurata(d)
    accreditaIntervallo(el, Number.isFinite(t) ? t : 0)
    if (!(affidabile >= 8)) return
    if (playedRef.current >= affidabile * soglia || contatoGiro.current) marca(affidabile, el.ended)
  }

  function accreditaIntervallo(el, t) {
    const now = performance.now()
    const precedente = wallRef.current || now
    const deltaOrologio = (now - precedente) / 1000
    wallRef.current = now
    const deltaMedia = t - lastRef.current
    lastRef.current = t
    if (!(deltaMedia > 0) || (el.paused && !el.ended)) return
    playedRef.current = avanzaAscolto(playedRef.current, deltaMedia, deltaOrologio)
  }

  function onSeeking(e) {
    if (ignoraEventiRef.current || !contaAscoltoRef.current) return
    lastRef.current = e.currentTarget.currentTime
    wallRef.current = performance.now()
  }

  function onEnded(e) {
    if (ignoraEventiRef.current || !contaAscoltoRef.current) return
    setInRiproduzione(false)
    const el = e.currentTarget
    const t = el.currentTime
    const fine = Number.isFinite(t) && t >= 0.15
      ? t
      : (Number.isFinite(el.duration) ? el.duration : 0)
    if (fine >= 0.15) {
      posizioneRealeRef.current = fine
      setPosizione(fine)
    }
    accreditaIntervallo(el, fine)
    const d = durataPerCredito(el.duration)
    if (d != null && playedRef.current >= d * 0.9) marca(d, true)
  }

  function onLoadedMetadata(e) {
    registraDurata(e.currentTarget.duration)
  }

  async function ascolta() {
    const el = audioRef.current
    if (!el) return
    applicaPlaysInline(el)
    pausaAltreTracce(el)
    const ricordata = posizioneRealeRef.current
    if (!el.ended && el.currentTime < 0.15 && ricordata >= 1) {
      try { el.currentTime = ricordata } catch { /* metadati non pronti */ }
    }
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
        wallRef.current = performance.now()
        posizioneRealeRef.current = 0
        ignoraEventiRef.current = false
      } else if (dallInizio && skipCampana) {
        contaAscoltoRef.current = false
        el.muted = false
        el.volume = 1
        riavvolgiSicuro(el)
        playedRef.current = 0
        lastRef.current = 0
        wallRef.current = performance.now()
        posizioneRealeRef.current = 0
      }
      if (annullaAvvioRef.current) {
        setInRiproduzione(false)
        return
      }
      contaAscoltoRef.current = true
      wallRef.current = performance.now()
      if (!dallInizio && Number.isFinite(el.currentTime)) lastRef.current = el.currentTime
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
    const t = el.currentTime
    if (Number.isFinite(t) && t >= 0.15) posizioneRealeRef.current = t
    el.pause()
    setInRiproduzione(false)
    if (posizioneRealeRef.current >= 1) setPosizione(posizioneRealeRef.current)
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
    const giaCredito = contatoGiro.current
    el.pause()
    riavvolgiSicuro(el)
    lastRef.current = 0
    playedRef.current = 0
    wallRef.current = 0
    posizioneRealeRef.current = 0
    setInRiproduzione(false)
    setPosizione(0)
    if (giaCredito) setCompleto(true)
  }

  function toggleRiproduzione() {
    if (inRiproduzione || inCampana) pausa()
    else ascolta()
  }

  const avanzamento = useMemo(() => {
    if (completo && !inRiproduzione && posizione === 0) return 100
    if (!(durata > 0)) return 0
    return Math.min(100, Math.round((posizione / durata) * 100))
  }, [completo, inRiproduzione, posizione, durata])

  const metaDurata = durata >= 8 ? formattaTempo(durata) : etichettaDurata
  const testoDescrizione = inCampana
    ? 'Campana di apertura… poi inizia la traccia.'
    : (String(descrizione || '').trim() || testoDaUrlAudio(src))
  const srcAudio = urlAudioSenzaTesto(src)

  const inPlay = inRiproduzione || inCampana

  return (
    <article
      className="card-traccia"
      style={{ '--card-traccia-accento': coloreAccento || ACCENTO_DEFAULT }}
    >
      <p className="card-traccia-eyebrow">Traccia guidata</p>
      <header className="card-traccia-testa">
        <span className="card-traccia-badge-icona" aria-hidden="true">
          <IconaOnda />
        </span>
        <div className="card-traccia-titoli">
          <h3 className="card-traccia-titolo">{titolo}</h3>
          <p className="card-traccia-meta">
            {metaDurata ? <>{metaDurata}{' · '}</> : null}
            {completo ? 'ascoltata' : 'traccia audio'}
          </p>
        </div>
      </header>
      {testoDescrizione ? (
        <p className="card-traccia-descrizione">{testoDescrizione}</p>
      ) : null}
      <audio
        ref={audioRef}
        className="player-audio-nativo"
        src={srcAudio}
        preload="metadata"
        playsInline
        onTimeUpdate={onTimeUpdate}
        onSeeking={onSeeking}
        onEnded={onEnded}
        onLoadedMetadata={onLoadedMetadata}
        onDurationChange={onLoadedMetadata}
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
      <div className="card-traccia-controlli" role="group" aria-label="Controlli traccia">
        <button
          type="button"
          className={`card-traccia-play${inPlay ? ' is-on' : ''}`}
          onClick={toggleRiproduzione}
          aria-label={inPlay ? 'Metti in pausa' : 'Riproduci traccia'}
        >
          {inPlay ? <IconaPausa /> : <IconaPlay />}
        </button>
        <button
          type="button"
          className="card-traccia-stop"
          onClick={stop}
          aria-label="Ferma e riavvolgi la traccia"
        >
          <IconaStop />
        </button>
        <div
          className="card-traccia-onda"
          aria-hidden="true"
        >
          {BARRE_ONDA.map((h, i) => {
            const sogliaBarra = ((i + 1) / BARRE_ONDA.length) * 100
            const ascoltata = avanzamento >= sogliaBarra
            return (
              <span
                key={i}
                className={`card-traccia-barra${ascoltata ? ' is-on' : ''}`}
                style={{ height: `${h}px` }}
              />
            )
          })}
        </div>
      </div>
      <div className="card-traccia-fondo">
        <p className="card-traccia-tempo">
          {formattaTempo(posizione)}
          {' · '}
          {formattaTempo(durata)}
        </p>
        <span className="card-traccia-percento">
          {completo && avanzamento >= 95 ? 'Completata' : `Ascolto ${avanzamento}%`}
        </span>
      </div>
      {errore && (
        <p className="campo-errore" role="alert">
          {messaggioErroreRiproduzione()}
        </p>
      )}
    </article>
  )
}
