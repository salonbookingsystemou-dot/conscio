import { useEffect, useMemo, useRef, useState } from 'react'
import { ascoltoCompletato, avanzaAscolto, memorizzaAscolto, recuperaAscoltoSeManca, registraAscoltoCompleto } from '../lib/ascolto.js'
import { durataNotaMp3 } from '../lib/audioMp3.js'
import { testoDaUrlAudio, urlAudioSenzaTesto } from '../lib/tracce.js'
import {
  STATO_IN_CORSO,
  STATO_PRONTA,
  annullaScaricamento,
  assicuraTracciaOffline,
  scaricaTraccia,
  togliTraccia,
  tracciaRemota,
  useStatoTraccia
} from '../lib/cacheTracce.js'
import {
  applicaPlaysInline,
  ascoltaPausaAltreTracce,
  avviaPlay,
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

export function formattaTempo(secondi) {
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

function IconaScarica() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconaSpunta() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m5.5 12.5 4 4 9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Copia della traccia sul telefono, per ascoltarla anche senza rete.
function ScaricaPerOffline({ src, titolo }) {
  const { stato, percentuale, errore } = useStatoTraccia(src)
  if (!tracciaRemota(src)) return null
  return (
    <div className="card-traccia-offline">
      {stato === STATO_PRONTA && (
        <>
          <p className="card-traccia-offline-stato is-pronta">
            <IconaSpunta />
            <span>Scaricata sul telefono</span>
          </p>
          <button
            type="button"
            className="btn btn-text is-piccolo"
            onClick={() => togliTraccia(src)}
            aria-label={`Togli dal telefono la traccia ${titolo}`}
          >
            Togli
          </button>
        </>
      )}
      {stato === STATO_IN_CORSO && (
        <>
          <p className="card-traccia-offline-stato" role="status">
            <span>Scaricamento {percentuale}%</span>
            <span className="card-traccia-offline-barra" aria-hidden="true">
              <span style={{ width: `${percentuale}%` }} />
            </span>
          </p>
          <button
            type="button"
            className="btn btn-text is-piccolo"
            onClick={() => annullaScaricamento(src)}
          >
            Annulla
          </button>
        </>
      )}
      {stato !== STATO_PRONTA && stato !== STATO_IN_CORSO && (
        <button
          type="button"
          className="btn btn-text is-piccolo card-traccia-offline-scarica"
          onClick={() => scaricaTraccia(src)}
        >
          <IconaScarica />
          Scarica per ascoltare senza rete
        </button>
      )}
      {errore && stato !== STATO_IN_CORSO && (
        <p className="campo-errore card-traccia-offline-errore" role="alert">{errore}</p>
      )}
    </div>
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
  anteprima = false,
  inizio = 0,
  modalita = 'percorso',
  onAvvio,
  vista,
  scaricabile = false
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
  const vetrinaIniziale = modalita === 'vetrina'
  const vetrinaRef = useRef(vetrinaIniziale)
  const onAvvioRef = useRef(onAvvio)
  const avviatoVetrina = useRef(false)
  vetrinaRef.current = modalita === 'vetrina'
  onAvvioRef.current = onAvvio
  const contatoGiro = useRef(vetrinaIniziale ? false : ascoltoCompletato(persistenzaKey))
  const accreditatoRef = useRef(0)
  const ignoraEventiRef = useRef(false)
  const annullaAvvioRef = useRef(false)
  const contaAscoltoRef = useRef(false)
  const giaAscoltataRef = useRef(giaAscoltata)
  const posizioneRealeRef = useRef(0)
  const wallRef = useRef(0)
  const inizioRef = useRef(inizio)
  inizioRef.current = inizio
  giaAscoltataRef.current = giaAscoltata
  onCompletoRef.current = onCompleto
  onDurataRef.current = onDurata
  onAscoltoRef.current = onAscolto
  onPersistenzaRef.current = onPersistenza

  const [completo, setCompleto] = useState(
    () => !vetrinaIniziale && (giaAscoltata || ascoltoCompletato(persistenzaKey))
  )
  const [inRiproduzione, setInRiproduzione] = useState(false)
  const [posizione, setPosizione] = useState(0)
  const [durata, setDurata] = useState(0)
  const [errore, setErrore] = useState(false)

  const soglia = Number.isFinite(sogliaCompletamento)
    ? Math.min(1, Math.max(0.5, sogliaCompletamento))
    : 0.95

  useEffect(() => {
    applicaPlaysInline(audioRef.current)
  }, [src])

  useEffect(() => {
    return ascoltaPausaAltreTracce(audioRef, () => {
      annullaAvvioRef.current = true
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
    // `giaAscoltata` diventa true a circa il 95%, quando il salvataggio aggiorna
    // il programma. Non è tra le dipendenze: altrimenti questo effetto mette in
    // pausa e riavvolge la traccia mentre gli ultimi minuti stanno ancora suonando.
    const vetrina = vetrinaRef.current
    const gia = vetrina ? false : (giaAscoltataRef.current || ascoltoCompletato(persistenzaKey))
    if (!vetrina && giaAscoltataRef.current && persistenzaKey) memorizzaAscolto(persistenzaKey)
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
    avviatoVetrina.current = false
    accreditatoRef.current = 0
    contaAscoltoRef.current = false
    annullaAvvioRef.current = true
    const el = audioRef.current
    if (el) {
      el.pause()
      riavvolgiSicuro(el)
    }
    onCompletoRef.current?.(gia)
    onDurataRef.current?.(0)
    if (durataFileRef.current >= 8) applicaDurataRef.current(durataFileRef.current)
    const partenza = Number(inizioRef.current)
    if (partenza >= 1) {
      posizioneRealeRef.current = partenza
      setPosizione(partenza)
    }
    return () => {
      annullaAvvioRef.current = true
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
    if (!anteprima && !vetrinaRef.current && recuperaAscoltoSeManca(persistenzaKey, scelta)) {
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
    if (vetrinaRef.current) {
      if (contatoGiro.current) return
      contatoGiro.current = true
      onCompletoRef.current?.(true)
      return
    }
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
    annullaAvvioRef.current = false
    if (!anteprima && !vetrinaRef.current) assicuraTracciaOffline(urlAudioSenzaTesto(src))
    try {
      setErrore(false)
      // La campana tibetana è dentro il file, all'inizio e alla fine (dal 15/10/2026):
      // il player non ne suona una sua.
      if (dallInizio) {
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
      el.muted = false
      el.volume = 1
      await avviaPlay(el)
      setInRiproduzione(true)
      if (vetrinaRef.current && !avviatoVetrina.current) {
        avviatoVetrina.current = true
        onAvvioRef.current?.()
      }
    } catch (err) {
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
    if (inRiproduzione) pausa()
    else ascolta()
  }

  function vaiA(secondi) {
    const el = audioRef.current
    if (!el || !(durata > 0)) return
    const limite = Number.isFinite(el.duration) && el.duration > 0 ? Math.min(durata, el.duration) : durata
    const t = Math.min(Math.max(0, secondi), Math.max(0, limite - 0.5))
    try { el.currentTime = t } catch { /* metadati non pronti: lo riprende ascolta() */ }
    posizioneRealeRef.current = t
    lastRef.current = t
    wallRef.current = performance.now()
    setPosizione(t)
    if (!inRiproduzione) ascolta()
  }

  function clicOnda(e) {
    const barre = e.currentTarget.children
    if (!barre.length) return
    const box = e.currentTarget.getBoundingClientRect()
    const sinistra = barre[0].getBoundingClientRect().left
    const destra = Math.min(box.right, barre[barre.length - 1].getBoundingClientRect().right)
    if (!(destra > sinistra)) return
    const quota = Math.min(1, Math.max(0, (e.clientX - sinistra) / (destra - sinistra)))
    vaiA(quota * durata)
  }

  function tastoOnda(e) {
    const passo = 10
    const tasti = {
      ArrowRight: posizione + passo,
      ArrowUp: posizione + passo,
      ArrowLeft: posizione - passo,
      ArrowDown: posizione - passo,
      Home: 0,
      End: durata
    }
    if (!(e.key in tasti)) return
    e.preventDefault()
    vaiA(tasti[e.key])
  }

  const avanzamento = useMemo(() => {
    if (completo && !inRiproduzione && posizione === 0) return 100
    if (!(durata > 0)) return 0
    return Math.min(100, Math.round((posizione / durata) * 100))
  }, [completo, inRiproduzione, posizione, durata])

  const metaDurata = durata >= 8 ? formattaTempo(durata) : etichettaDurata
  const testoDescrizione = modalita === 'vetrina'
    ? ''
    : (String(descrizione || '').trim() || testoDaUrlAudio(src))
  const srcAudio = urlAudioSenzaTesto(src)

  const inPlay = inRiproduzione

  const audio = (
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
          if (ignoraEventiRef.current) return
          setInRiproduzione(true)
        }}
        onPause={() => {
          if (ignoraEventiRef.current) return
          setInRiproduzione(false)
        }}
        onError={e => {
          if (ignoraEventiRef.current || erroreMediaIgnorabile(e.currentTarget)) return
          setErrore(true)
        }}
      >
        Il browser non riproduce questa traccia.
      </audio>
  )

  if (vista) {
    return vista({
      audio,
      inPlay,
      posizione,
      durata,
      errore: errore ? messaggioErroreRiproduzione() : '',
      alterna: toggleRiproduzione,
      vaiA
    })
  }

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
            {modalita === 'vetrina' ? 'traccia audio' : (completo ? 'ascoltata' : 'traccia audio')}
          </p>
        </div>
      </header>
      {testoDescrizione ? (
        <p className="card-traccia-descrizione">{testoDescrizione}</p>
      ) : null}
      {audio}
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
          role="slider"
          tabIndex={durata > 0 ? 0 : -1}
          aria-label="Punto della traccia"
          aria-valuemin={0}
          aria-valuemax={Math.round(durata)}
          aria-valuenow={Math.round(posizione)}
          aria-valuetext={`${formattaTempo(posizione)} di ${formattaTempo(durata)}`}
          aria-disabled={!(durata > 0)}
          onClick={clicOnda}
          onKeyDown={tastoOnda}
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
      {scaricabile && modalita !== 'vetrina' && (
        <ScaricaPerOffline src={srcAudio} titolo={titolo} />
      )}
    </article>
  )
}
