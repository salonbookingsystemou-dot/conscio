import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CardTracciaAudio from '../components/CardTracciaAudio.jsx'
import StatoAttesa from '../components/StatoAttesa.jsx'
import StatoVuoto from '../components/StatoVuoto.jsx'
import {
  etichettaLicenza,
  etichettaVoce,
  eventoVetrina,
  FASCE_DURATA,
  haTag,
  leggiElenco,
  leggiEvidenza,
  leggiImpostazioniPubbliche,
  leggiTracciaPubblica,
  rigaTag,
  tagPresenti,
  urlAscolta
} from '../lib/vetrina.js'

const FUOCO = { centro: 'center', alto: 'center top', basso: 'center bottom' }

function movimentoRidotto() {
  if (typeof window === 'undefined') return false
  const riduci = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return Boolean(riduci || navigator.connection?.saveData)
}

function etichettaFonte(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('youtube') || host === 'youtu.be') return 'YouTube'
    return host
  } catch {
    return 'Fonte'
  }
}

function Credito({ sfondo }) {
  if (!sfondo?.autore) return null
  const cosa = sfondo.tipo === 'video' ? 'Video' : 'Foto'
  const servizio = sfondo.fonte === 'unsplash'
    ? ['Unsplash', 'https://unsplash.com/?utm_source=conscio&utm_medium=referral']
    : sfondo.fonte === 'pexels'
      ? ['Pexels', 'https://www.pexels.com/']
      : null
  return (
    <p className="ascolta-credito">
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

function Palco({ traccia, audioUrl, inEvidenza, onAvvio, onCompleto }) {
  const sfondo = traccia.sfondo || {}
  const [soloPoster, setSoloPoster] = useState(movimentoRidotto)
  const [rotto, setRotto] = useState(false)
  const videoRef = useRef(null)
  const video = sfondo.tipo === 'video' && sfondo.url && !soloPoster && !rotto
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
    const esito = el.play()
    if (esito?.catch) esito.catch(() => setSoloPoster(true))
    return undefined
  }, [video, sfondo.url])

  const Titolo = inEvidenza ? 'h2' : 'h1'
  const voce = etichettaVoce(traccia.voce)
  const autore = traccia.autore?.nome

  return (
    <section className={`ascolta-palco${rotto || !immagine ? ' is-vuoto' : ''}`}>
      <div className="ascolta-sfondo" aria-hidden="true">
        {video ? (
          <video
            ref={videoRef}
            src={sfondo.url}
            poster={sfondo.poster_url || undefined}
            muted
            loop
            playsInline
            preload="metadata"
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
      <div className="ascolta-palco-testo">
        {inEvidenza && <p className="ascolta-sopracciglio">Meditazione della settimana</p>}
        <Titolo>{traccia.titolo}</Titolo>
        <p className="ascolta-meta">
          {autore && <>Testo di {traccia.autore.link
            ? <a href={traccia.autore.link} target="_blank" rel="noopener noreferrer">{autore}</a>
            : autore}</>}
          {autore && voce && ' · '}
          {voce}
          {traccia.durata_minuti ? ` · ${traccia.durata_minuti} min` : ''}
        </p>
        {audioUrl && (
          <CardTracciaAudio
            src={audioUrl}
            titolo={traccia.titolo}
            etichettaDurata={traccia.durata_minuti ? `${traccia.durata_minuti} min` : ''}
            modalita="vetrina"
            sogliaCompletamento={0.9}
            onAvvio={onAvvio}
            onCompleto={fatto => { if (fatto) onCompleto?.() }}
          />
        )}
        <Credito sfondo={sfondo} />
      </div>
    </section>
  )
}

function Invito({ impostazioni, slug }) {
  if (!impostazioni) return null
  const aperte = impostazioni.iscrizioni_aperte === true
  return (
    <section className="card ascolta-invito">
      <p className="ascolta-sopracciglio">Il percorso</p>
      <h2>{impostazioni.cta_titolo}</h2>
      <p>{aperte ? impostazioni.cta_testo : impostazioni.cta_testo_senza_ciclo}</p>
      {aperte && (
        <Link className="btn" to="/iscrizione" onClick={() => eventoVetrina(slug, 'cta')}>
          Scopri il percorso
        </Link>
      )}
    </section>
  )
}

function Scheda({ traccia, onCondiviso }) {
  const licenza = etichettaLicenza(traccia.licenza)
  const voce = etichettaVoce(traccia.voce)
  return (
    <section className="ascolta-scheda-pubblica">
      {traccia.descrizione && <p className="ascolta-descrizione">{traccia.descrizione}</p>}
      <dl>
        {traccia.autore?.nome && (
          <div>
            <dt>Testo</dt>
            <dd>
              {traccia.autore.link
                ? <a href={traccia.autore.link} target="_blank" rel="noopener noreferrer">{traccia.autore.nome}</a>
                : traccia.autore.nome}
            </dd>
          </div>
        )}
        {licenza && (
          <div>
            <dt>Licenza</dt>
            <dd>
              {licenza.url
                ? <a href={licenza.url} target="_blank" rel="noopener noreferrer">{licenza.etichetta}</a>
                : licenza.etichetta}
            </dd>
          </div>
        )}
        {traccia.fonte_url && (
          <div>
            <dt>Fonte</dt>
            <dd>
              <a href={traccia.fonte_url} target="_blank" rel="noopener noreferrer">
                {etichettaFonte(traccia.fonte_url)}
              </a>
            </dd>
          </div>
        )}
        {voce && (
          <div>
            <dt>Voce</dt>
            <dd>{voce}</dd>
          </div>
        )}
        {traccia.sfondo?.autore && (
          <div>
            <dt>Sfondo</dt>
            <dd><Credito sfondo={traccia.sfondo} /></dd>
          </div>
        )}
      </dl>
      <div className="ascolta-condividi">
        <button type="button" className="btn" onClick={() => onCondiviso(false)}>Condividi</button>
        <button type="button" className="btn btn-ghost" onClick={() => onCondiviso(true)}>Copia link</button>
      </div>
    </section>
  )
}

export default function Ascolta() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [stato, setStato] = useState('attesa')
  const [impostazioni, setImpostazioni] = useState(null)
  const [elenco, setElenco] = useState([])
  const [evidenza, setEvidenza] = useState(null)
  const [audioEvidenza, setAudioEvidenza] = useState(null)
  const [traccia, setTraccia] = useState(null)
  const [tagAttivo, setTagAttivo] = useState('')
  const [fascia, setFascia] = useState('')
  const [avviso, setAvviso] = useState('')
  const [tentativo, setTentativo] = useState(0)

  useEffect(() => {
    let vivo = true
    setStato('attesa')
    setAvviso('')
    leggiImpostazioniPubbliche()
      .then(async dati => {
        if (!vivo) return
        setImpostazioni(dati)
        if (!dati?.vetrina_attiva) {
          setStato('chiusa')
          return
        }
        if (slug) {
          const [scheda, lista] = await Promise.all([
            leggiTracciaPubblica(slug),
            leggiElenco()
          ])
          if (!vivo) return
          setTraccia(scheda)
          setElenco(lista)
          setStato(scheda ? 'pronta' : 'assente')
          return
        }
        const [lista, inEvidenza] = await Promise.all([leggiElenco(), leggiEvidenza()])
        if (!vivo) return
        setElenco(lista)
        setEvidenza(inEvidenza)
        if (inEvidenza?.slug) {
          try {
            const audio = await leggiTracciaPubblica(inEvidenza.slug)
            if (!vivo) return
            setAudioEvidenza(audio)
          } catch {
            if (!vivo) return
            setAudioEvidenza(null)
          }
        } else {
          setAudioEvidenza(null)
        }
        setStato('pronta')
      })
      .catch(() => {
        if (vivo) setStato('errore')
      })
    return () => { vivo = false }
  }, [slug, tentativo])

  const filtri = useMemo(() => tagPresenti(elenco), [elenco])
  const visibili = useMemo(() => {
    return elenco.filter(voce => {
      if (evidenza?.slug && voce.slug === evidenza.slug && !slug) return false
      if (!haTag(voce, tagAttivo)) return false
      if (!fascia) return true
      const banda = FASCE_DURATA.find(item => item.id === fascia)
      return banda ? banda.contiene(Number(voce.durata_minuti)) : true
    })
  }, [elenco, evidenza, slug, tagAttivo, fascia])

  function sorprendi() {
    const scelte = elenco.filter(voce => voce.slug && voce.slug !== slug)
    if (!scelte.length) return
    const prossima = scelte[Math.floor(Math.random() * scelte.length)]
    navigate(`/ascolta/${prossima.slug}`)
  }

  async function condividi(soloCopia) {
    if (!traccia?.slug) return
    const url = urlAscolta(traccia.slug)
    try {
      if (!soloCopia && navigator.share) {
        await navigator.share({ title: traccia.titolo, text: traccia.descrizione || '', url })
      } else {
        await navigator.clipboard.writeText(url)
        setAvviso('Link copiato.')
      }
      eventoVetrina(traccia.slug, 'condivisione')
    } catch (err) {
      if (err?.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(url)
        setAvviso('Link copiato.')
        eventoVetrina(traccia.slug, 'condivisione')
      } catch {
        setAvviso(`Link: ${url}`)
      }
    }
  }

  const slugInvito = traccia?.slug || evidenza?.slug || elenco[0]?.slug || ''

  return (
    <main className="ascolta">
      {stato === 'attesa' && <StatoAttesa etichetta="Caricamento delle meditazioni…" />}
      {stato === 'errore' && (
        <>
          <p className="avviso-errore" role="alert">Non è stato possibile aprire Ascolta.</p>
          <button type="button" className="btn" onClick={() => setTentativo(n => n + 1)}>
            Riprova
          </button>
        </>
      )}
      {stato === 'chiusa' && (
        <StatoVuoto titolo="La sezione non è ancora aperta">
          Quando sarà disponibile, qui trovi meditazioni da ascoltare.
        </StatoVuoto>
      )}
      {stato === 'assente' && (
        <StatoVuoto titolo="Questa meditazione non è disponibile">
          <Link to="/ascolta">Torna a tutte le meditazioni</Link>
        </StatoVuoto>
      )}

      {stato === 'pronta' && !slug && (
        <>
          <header className="ascolta-testa">
            <h1>Ascolta</h1>
            <p>
              Meditazioni guidate da ascoltare con calma. Se un passaggio non fa per te, puoi fermarti o sceglierne un’altra.
            </p>
          </header>
          {audioEvidenza?.audio_url && (
            <Palco
              traccia={audioEvidenza}
              audioUrl={audioEvidenza.audio_url}
              inEvidenza
              onAvvio={() => eventoVetrina(audioEvidenza.slug, 'avvio')}
              onCompleto={() => eventoVetrina(audioEvidenza.slug, 'completamento')}
            />
          )}
          {elenco.length > 1 && (
            <button type="button" className="btn btn-tonal" onClick={sorprendi}>Sorprendimi</button>
          )}
          <section aria-label="Tutte le meditazioni">
            <h2>Tutte le meditazioni</h2>
            {(filtri.length > 0 || elenco.length > 0) && (
              <div className="ascolta-filtri" role="group" aria-label="Filtri">
                <button type="button" className={!tagAttivo && !fascia ? 'btn is-piccolo' : 'btn btn-ghost is-piccolo'} onClick={() => { setTagAttivo(''); setFascia('') }}>
                  Tutte
                </button>
                {filtri.map(voce => (
                  <button
                    key={voce.slug}
                    type="button"
                    className={tagAttivo === voce.slug ? 'btn is-piccolo' : 'btn btn-ghost is-piccolo'}
                    aria-pressed={tagAttivo === voce.slug}
                    onClick={() => setTagAttivo(attuale => attuale === voce.slug ? '' : voce.slug)}
                  >
                    {voce.etichetta}
                  </button>
                ))}
                {FASCE_DURATA.map(voce => (
                  <button
                    key={voce.id}
                    type="button"
                    className={fascia === voce.id ? 'btn is-piccolo' : 'btn btn-ghost is-piccolo'}
                    aria-pressed={fascia === voce.id}
                    onClick={() => setFascia(attuale => attuale === voce.id ? '' : voce.id)}
                  >
                    {voce.etichetta}
                  </button>
                ))}
              </div>
            )}
            {elenco.length === 0 ? (
              <StatoVuoto titolo="Non ci sono ancora meditazioni pubblicate" />
            ) : visibili.length === 0 ? (
              <p className="hint">Nessuna meditazione con questi filtri.</p>
            ) : (
              <ul className="ascolta-griglia">
                {visibili.map(voce => (
                  <li key={voce.slug}>
                    <Link className="ascolta-card" to={`/ascolta/${voce.slug}`}>
                      <span className="ascolta-card-media">
                        {(voce.sfondo?.poster_url || voce.sfondo?.url) && (
                          <img
                            src={voce.sfondo.poster_url || voce.sfondo.url}
                            alt=""
                            style={{ objectPosition: FUOCO[voce.sfondo.fuoco] || 'center' }}
                          />
                        )}
                        {voce.durata_minuti ? <span className="badge">{voce.durata_minuti} min</span> : null}
                      </span>
                      <span className="ascolta-card-titolo">{voce.titolo}</span>
                      {rigaTag(voce) && <span className="ascolta-card-meta">{rigaTag(voce)}</span>}
                      <span className="ascolta-card-meta">{etichettaVoce(voce.voce)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Invito impostazioni={impostazioni} slug={slugInvito} />
        </>
      )}

      {stato === 'pronta' && slug && traccia && (
        <>
          <p className="ascolta-torna"><Link to="/ascolta">Tutte le meditazioni</Link></p>
          <Palco
            traccia={traccia}
            audioUrl={traccia.audio_url}
            onAvvio={() => eventoVetrina(traccia.slug, 'avvio')}
            onCompleto={() => eventoVetrina(traccia.slug, 'completamento')}
          />
          <Scheda traccia={traccia} onCondiviso={condividi} />
          {avviso && <p className="hint" role="status">{avviso}</p>}
          <div className="ascolta-azioni">
            {elenco.length > 1 && (
              <button type="button" className="btn btn-tonal" onClick={sorprendi}>Ascolta un’altra</button>
            )}
          </div>
          <Invito impostazioni={impostazioni} slug={traccia.slug} />
        </>
      )}
    </main>
  )
}
