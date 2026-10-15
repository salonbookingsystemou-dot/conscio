import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import CardTracciaAudio, { formattaTempo } from './CardTracciaAudio.jsx'
import { etichettaVoce } from '../lib/vetrina.js'

export const FUOCO = { centro: 'center', alto: 'center top', basso: 'center bottom' }
const SALTO = 15

function movimentoRidotto() {
  if (typeof window === 'undefined') return false
  const riduci = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return Boolean(riduci || navigator.connection?.saveData)
}

function voceBreve(voce) {
  if (voce?.tipo === 'sintetica') return 'Voce sintetica'
  return etichettaVoce(voce)
}

function etichetteTag(traccia) {
  const tag = traccia?.tag || {}
  return [tag.pratica?.[0], tag.livello?.[0] || tag.contesto?.[0]]
    .map(voce => voce?.etichetta)
    .filter(Boolean)
}

export function Credito({ sfondo, className = 'ascolta-credito' }) {
  if (!sfondo?.autore) return null
  const cosa = sfondo.tipo === 'video' ? 'Video' : 'Foto'
  const servizio = sfondo.fonte === 'unsplash'
    ? ['Unsplash', 'https://unsplash.com/?utm_source=conscio&utm_medium=referral']
    : sfondo.fonte === 'pexels'
      ? ['Pexels', 'https://www.pexels.com/']
      : null
  return (
    <p className={className}>
      {cosa} di{' '}
      {sfondo.autore_link
        ? <a href={sfondo.autore_link} target="_blank" rel="noopener noreferrer">{sfondo.autore}</a>
        : sfondo.autore}
      {servizio && (
        <>
          {' '}su <a href={servizio[1]} target="_blank" rel="noopener noreferrer">{servizio[0]}</a>
        </>
      )}
    </p>
  )
}

function Sfondo({ sfondo = {}, conVideo = true }) {
  const [soloPoster, setSoloPoster] = useState(movimentoRidotto)
  const [rotto, setRotto] = useState(false)
  const videoRef = useRef(null)
  const video = conVideo && sfondo.tipo === 'video' && sfondo.url && !soloPoster && !rotto
  const immagine = sfondo.poster_url || sfondo.url
  const posizione = FUOCO[sfondo.fuoco] || 'center'

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const aggiorna = () => setSoloPoster(media.matches || Boolean(navigator.connection?.saveData))
    aggiorna()
    media.addEventListener?.('change', aggiorna)
    return () => media.removeEventListener?.('change', aggiorna)
  }, [])

  useEffect(() => {
    setRotto(false)
    setSoloPoster(movimentoRidotto())
  }, [sfondo.url])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return undefined
    // iOS avvia da solo un video con traccia audio solo se è muto anche come
    // attributo; React imposta soltanto la proprietà.
    el.muted = true
    el.defaultMuted = true
    el.setAttribute('muted', '')
    let attivo = true
    const eventi = ['pointerdown', 'touchend', 'keydown']
    // Con il risparmio energetico iOS rifiuta l'avvio automatico: si riprova
    // al primo gesto, lasciando intanto il poster.
    function riprova() {
      eventi.forEach(nome => window.removeEventListener(nome, riprova, true))
      if (attivo) el.play()?.catch?.(() => {})
    }
    el.play()?.catch?.(() => {
      if (attivo) eventi.forEach(nome => window.addEventListener(nome, riprova, true))
    })
    return () => {
      attivo = false
      eventi.forEach(nome => window.removeEventListener(nome, riprova, true))
    }
  }, [video, sfondo.url])

  return (
    <div className="ascolta-sfondo" aria-hidden="true">
      {video ? (
        <video
          ref={videoRef}
          src={sfondo.url}
          poster={sfondo.poster_url || undefined}
          muted
          autoPlay
          loop
          playsInline
          preload="auto"
          style={{ objectPosition: posizione }}
          onError={() => setSoloPoster(true)}
        />
      ) : immagine && !rotto ? (
        <img
          src={immagine}
          alt=""
          style={{ objectPosition: posizione }}
          onError={() => setRotto(true)}
        />
      ) : null}
      <div className="ascolta-velo" />
    </div>
  )
}

function Icona({ children, piena = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={piena ? 'currentColor' : 'none'}
      stroke={piena ? 'none' : 'currentColor'}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

const IconaPlay = () => (
  <Icona piena><path d="M8.5 5.6v12.8c0 .8.86 1.28 1.53.86l10.1-6.4a1 1 0 0 0 0-1.72l-10.1-6.4c-.67-.42-1.53.06-1.53.86z" /></Icona>
)
const IconaPausa = () => (
  <Icona piena>
    <rect x="6.5" y="5.5" width="3.6" height="13" rx="1.4" />
    <rect x="13.9" y="5.5" width="3.6" height="13" rx="1.4" />
  </Icona>
)
const IconaIndietro = () => <Icona><path d="M14.5 6 8.5 12l6 6" /></Icona>
const IconaCondividi = () => (
  <Icona>
    <path d="M12 15V3.5M8 7.5l4-4 4 4" />
    <path d="M7.5 10.5H6.5a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6.5 20.5h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1" />
  </Icona>
)
export const IconaCaso = () => (
  <Icona>
    <path d="M16.5 4.5h3v3M4.5 19.5 19.5 4.5M19.5 16.5v3h-3M14.5 14.5l5 5M4.5 4.5l5 5" />
  </Icona>
)
const IconaInfo = () => (
  <Icona>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5M12 7.6v.1" />
  </Icona>
)
const IconaChiudi = () => <Icona><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></Icona>

function IconaSalto({ avanti = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={avanti ? 'translate(24 0) scale(-1 1)' : undefined}
      >
        <path d="M5.2 9.2A7.8 7.8 0 1 1 4.6 15" />
        <path d="M4.6 4.8v4.6h4.6" />
      </g>
      <text x="12" y="15.2" textAnchor="middle" fontSize="7" fontWeight="600" fill="currentColor">
        {SALTO}
      </text>
    </svg>
  )
}

function Avanzamento({ posizione, durata, vaiA }) {
  const pronta = durata > 0
  const quota = pronta ? Math.min(100, (posizione / durata) * 100) : 0

  function clic(e) {
    const box = e.currentTarget.getBoundingClientRect()
    if (!pronta || !(box.width > 0)) return
    vaiA(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * durata)
  }

  function tasto(e) {
    const tasti = {
      ArrowRight: posizione + 10,
      ArrowUp: posizione + 10,
      ArrowLeft: posizione - 10,
      ArrowDown: posizione - 10,
      Home: 0,
      End: durata
    }
    if (!(e.key in tasti)) return
    e.preventDefault()
    vaiA(tasti[e.key])
  }

  return (
    <div
      className="ascolta-player-barra"
      role="slider"
      tabIndex={pronta ? 0 : -1}
      aria-label="Punto della traccia"
      aria-valuemin={0}
      aria-valuemax={Math.round(durata)}
      aria-valuenow={Math.round(posizione)}
      aria-valuetext={`${formattaTempo(posizione)} di ${formattaTempo(durata)}`}
      aria-disabled={!pronta}
      onClick={clic}
      onKeyDown={tasto}
    >
      <span className="ascolta-player-barra-piena" style={{ width: `${quota}%` }} />
    </div>
  )
}

export default function PlayerVetrina({
  traccia,
  inEvidenza = false,
  onAvvio,
  onCompleto,
  onSorprendi,
  onCondividi,
  apriSubito = false,
  informazioni,
  avviso = ''
}) {
  const [aperto, setAperto] = useState(apriSubito)
  const [info, setInfo] = useState(false)
  const playRef = useRef(null)
  const chiudiRef = useRef(null)
  const chiudiInfoRef = useRef(null)
  // Ultimo stato del player, per fermare l'audio quando si chiude lo schermo intero.
  const statoRef = useRef(null)
  const idTitolo = useId()
  const idInfo = useId()
  const sfondo = traccia.sfondo || {}
  const autore = traccia.autore?.nome
  const voce = voceBreve(traccia.voce)
  const minuti = traccia.durata_minuti ? `${traccia.durata_minuti} min` : ''
  const etichette = etichetteTag(traccia)

  useEffect(() => {
    if (!aperto) return undefined
    const prima = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    chiudiRef.current?.focus()
    return () => { document.body.style.overflow = prima }
  }, [aperto])

  useEffect(() => {
    if (info) chiudiInfoRef.current?.focus()
    else if (aperto) chiudiRef.current?.focus()
  }, [info, aperto])

  useEffect(() => {
    if (!aperto) return undefined
    function tasto(e) {
      if (e.key !== 'Escape') return
      if (info) setInfo(false)
      else chiudi()
    }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  }, [aperto, info])

  // Chiudendo il player l'ascolto si ferma: non c'è un mini player che continua in pagina.
  function chiudi() {
    if (statoRef.current?.inPlay) statoRef.current.alterna()
    setInfo(false)
    setAperto(false)
    window.requestAnimationFrame(() => playRef.current?.focus())
  }

  function apri(stato) {
    setAperto(true)
    if (!stato.inPlay) stato.alterna()
  }

  // Arrivando da «Sorprendimi» a schermo intero il player nuovo si apre subito e parte.
  useEffect(() => {
    if (apriSubito && statoRef.current) apri(statoRef.current)
  }, [])

  // La meditazione che suona si ferma prima di passare alla prossima.
  function sorprendi() {
    if (statoRef.current?.inPlay) statoRef.current.alterna()
    onSorprendi(true)
  }

  function vista(stato) {
    statoRef.current = stato
    const { posizione, durata, inPlay } = stato
    const restante = Math.max(0, durata - posizione)
    const etichettaPlay = inPlay ? 'Metti in pausa' : 'Riproduci'

    return (
      <>
        {stato.audio}
        <section className="ascolta-palco">
          <Sfondo sfondo={sfondo} conVideo={!aperto} />
          <div className="ascolta-palco-testo">
            {inEvidenza && <p className="ascolta-sopracciglio">Spunto per una pausa</p>}
            <h2>{traccia.titolo}</h2>
            <div className="ascolta-palco-piede">
              <p className="ascolta-meta">
                {[minuti, autore, voce].filter(Boolean).join(' · ')}
              </p>
              <button
                ref={playRef}
                type="button"
                className="ascolta-tondo"
                aria-label={inPlay ? `Apri il player di «${traccia.titolo}»` : `Ascolta «${traccia.titolo}»`}
                onClick={() => apri(stato)}
              >
                <IconaPlay />
              </button>
            </div>
          </div>
        </section>

        {aperto && createPortal(
          <div className="ascolta-player" role="dialog" aria-modal="true" aria-labelledby={idTitolo}>
            <Sfondo sfondo={sfondo} />
            <div className="ascolta-player-corpo" aria-hidden={info || undefined}>
              <div className="ascolta-player-testa">
                <button
                  ref={chiudiRef}
                  type="button"
                  className="ascolta-player-icona"
                  aria-label="Chiudi il player"
                  onClick={chiudi}
                >
                  <IconaIndietro />
                </button>
                <p className="ascolta-player-occhiello">
                  {inEvidenza ? 'Spunto per una pausa' : ''}
                </p>
                {onCondividi ? (
                  <button
                    type="button"
                    className="ascolta-player-icona"
                    aria-label="Condividi"
                    onClick={() => onCondividi(false)}
                  >
                    <IconaCondividi />
                  </button>
                ) : <span className="ascolta-player-icona is-vuota" aria-hidden="true" />}
              </div>

              <div className="ascolta-player-fondo">
                {(etichette.length > 0 || minuti) && (
                  <ul className="ascolta-player-etichette">
                    {etichette.map(testo => <li key={testo}>{testo}</li>)}
                    {minuti && <li>{minuti}</li>}
                  </ul>
                )}
                <h2 id={idTitolo} className="ascolta-player-titolo">{traccia.titolo}</h2>
                {(autore || voce) && (
                  <p className="ascolta-player-meta">
                    {[autore && `Testo di ${autore}`, voce].filter(Boolean).join(' · ')}
                  </p>
                )}
                <Avanzamento posizione={posizione} durata={durata} vaiA={stato.vaiA} />
                <p className="ascolta-player-tempi">
                  <span>{formattaTempo(posizione)}</span>
                  <span>-{formattaTempo(restante)}</span>
                </p>
                <div className="ascolta-player-comandi">
                  <button
                    type="button"
                    className="ascolta-player-salto"
                    aria-label={`Indietro di ${SALTO} secondi`}
                    disabled={!(durata > 0)}
                    onClick={() => stato.vaiA(posizione - SALTO)}
                  >
                    <IconaSalto />
                  </button>
                  <button type="button" className="ascolta-player-play" aria-label={etichettaPlay} onClick={stato.alterna}>
                    {inPlay ? <IconaPausa /> : <IconaPlay />}
                  </button>
                  <button
                    type="button"
                    className="ascolta-player-salto"
                    aria-label={`Avanti di ${SALTO} secondi`}
                    disabled={!(durata > 0)}
                    onClick={() => stato.vaiA(posizione + SALTO)}
                  >
                    <IconaSalto avanti />
                  </button>
                </div>
                {(onSorprendi || informazioni) && (
                  <div className="ascolta-player-azioni">
                    {onSorprendi ? (
                      <button type="button" className="ascolta-player-testo" onClick={sorprendi}>
                        <IconaCaso /> Sorprendimi
                      </button>
                    ) : <span />}
                    {informazioni && (
                      <button type="button" className="ascolta-player-testo" onClick={() => setInfo(true)}>
                        <IconaInfo /> Informazioni
                      </button>
                    )}
                  </div>
                )}
                {stato.errore && <p className="ascolta-player-avviso" role="alert">{stato.errore}</p>}
                {avviso && !info && <p className="ascolta-player-avviso" role="status">{avviso}</p>}
                <Credito sfondo={sfondo} className="ascolta-player-credito" />
              </div>
            </div>

            {info && (
              <div className="ascolta-foglio-velo" onClick={() => setInfo(false)}>
                <section
                  className="ascolta-foglio"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={idInfo}
                  onClick={e => e.stopPropagation()}
                >
                  <span className="ascolta-foglio-maniglia" aria-hidden="true" />
                  <header className="ascolta-foglio-testa">
                    <div>
                      <p className="ascolta-sopracciglio">Informazioni</p>
                      <h2 id={idInfo}>{traccia.titolo}</h2>
                    </div>
                    <button
                      ref={chiudiInfoRef}
                      type="button"
                      className="ascolta-foglio-chiudi"
                      aria-label="Chiudi le informazioni"
                      onClick={() => setInfo(false)}
                    >
                      <IconaChiudi />
                    </button>
                  </header>
                  {informazioni}
                </section>
              </div>
            )}
          </div>,
          document.body
        )}
      </>
    )
  }

  return (
    <CardTracciaAudio
      src={traccia.audio_url}
      titolo={traccia.titolo}
      etichettaDurata={minuti}
      modalita="vetrina"
      sogliaCompletamento={0.9}
      onAvvio={onAvvio}
      onCompleto={fatto => { if (fatto) onCompleto?.() }}
      vista={vista}
    />
  )
}
