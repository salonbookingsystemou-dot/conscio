import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import PlayerVetrina, { Credito, IconaCaso } from '../components/PlayerVetrina.jsx'
import { useAuth } from '../lib/auth.jsx'
import StatoAttesa from '../components/StatoAttesa.jsx'
import StatoVuoto from '../components/StatoVuoto.jsx'
import IscrizioneLettera from '../components/IscrizioneLettera.jsx'
import {
  caricaCitazione,
  etichettaLicenza,
  etichettaVoce,
  eventoVetrina,
  leggiElenco,
  leggiEvidenza,
  leggiImpostazioniPubbliche,
  leggiTracciaPubblica,
  salvaSfondoVetrina,
  urlAscolta
} from '../lib/vetrina.js'

function etichettaFonte(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('youtube') || host === 'youtu.be') return 'YouTube'
    return host
  } catch {
    return 'Fonte'
  }
}


function classeCitazione(testo) {
  if (testo.length <= 45) return 'is-breve'
  if (testo.length <= 70) return 'is-media'
  return 'is-lunga'
}

function Citazione({ citazione }) {
  const testo = citazione.quote_text.trim()
  const conCaporali = /^«[\s\S]*»$/.test(testo) ? testo : `«${testo}»`
  return (
    <figure className={`ascolta-citazione ${classeCitazione(testo)}`}>
      <svg className="ascolta-citazione-segno" viewBox="0 0 28 22" width="28" height="22" aria-hidden="true" focusable="false">
        <path d="M0 22V13.2C0 5.6 4.2 1.2 11 0l1.3 3.1C8.3 4.4 6.3 7 6.1 10.6H12V22H0Zm16 0V13.2C16 5.6 20.2 1.2 27 0l1 3.1c-4 1.3-6 3.9-6.2 7.5H28V22H16Z" />
      </svg>
      <blockquote><p>{conCaporali}</p></blockquote>
      <figcaption>
        <span className="ascolta-citazione-autore">{citazione.author}</span>
        <cite>{citazione.book_title}</cite>
      </figcaption>
    </figure>
  )
}

function Scheda({ traccia, onCondiviso, avviso }) {
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
      {avviso && <p className="hint" role="status">{avviso}</p>}
    </section>
  )
}

export default function Ascolta() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { facilitatore } = useAuth()
  const location = useLocation()
  // Vero quando si arriva da «Sorprendimi» premuto nel player a schermo intero.
  const schermoIntero = Boolean(location.state?.schermoIntero)
  const [stato, setStato] = useState('attesa')
  const [elenco, setElenco] = useState([])
  const [evidenza, setEvidenza] = useState(null)
  const [audioEvidenza, setAudioEvidenza] = useState(null)
  const [traccia, setTraccia] = useState(null)
  const [avviso, setAvviso] = useState('')
  const [tentativo, setTentativo] = useState(0)
  const [citazione, setCitazione] = useState(null)

  // Solo nella vista elenco; finché non arriva resta l'intestazione di sempre.
  useEffect(() => {
    if (slug) return undefined
    let vivo = true
    caricaCitazione().then(dati => {
      if (vivo) setCitazione(dati?.quote_text ? dati : null)
    })
    return () => { vivo = false }
  }, [slug])

  useEffect(() => {
    let vivo = true
    // Da schermo intero il player resta aperto mentre arriva la meditazione nuova.
    if (!schermoIntero) setStato('attesa')
    setAvviso('')
    leggiImpostazioniPubbliche()
      .then(async dati => {
        if (!vivo) return
        if (!dati?.vetrina_attiva) {
          setStato('chiusa')
          return
        }
        if (slug) {
          const [scheda, lista, inEvidenza] = await Promise.all([
            leggiTracciaPubblica(slug),
            leggiElenco(),
            leggiEvidenza().catch(() => null)
          ])
          if (!vivo) return
          setTraccia(scheda)
          setElenco(lista)
          setEvidenza(inEvidenza)
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

  function sorprendi(daSchermoIntero = false) {
    // Senza slug esclude la meditazione in evidenza, che è già davanti.
    const attuale = slug || audioEvidenza?.slug
    const scelte = elenco.filter(voce => voce.slug && voce.slug !== attuale)
    if (!scelte.length) return
    const prossima = scelte[Math.floor(Math.random() * scelte.length)]
    navigate(`/ascolta/${prossima.slug}`, daSchermoIntero ? { state: { schermoIntero: true } } : undefined)
  }

  // Aperto il player nuovo, lo stato si toglie: ricaricando la pagina non si riapre da solo.
  useEffect(() => {
    if (schermoIntero && traccia?.slug === slug) navigate(location.pathname, { replace: true })
  }, [schermoIntero, traccia, slug])

  useEffect(() => {
    if (!avviso || avviso.startsWith('Link:')) return undefined
    const timer = window.setTimeout(() => setAvviso(''), 4000)
    return () => window.clearTimeout(timer)
  }, [avviso])

  async function condividi(voce, soloCopia) {
    if (!voce?.slug) return
    const url = urlAscolta(voce.slug)
    try {
      if (!soloCopia && navigator.share) {
        // Solo il link: titolo e descrizione arrivano dalla card di anteprima,
        // un `text` comparirebbe come secondo messaggio.
        await navigator.share({ title: voce.titolo, url })
      } else {
        await navigator.clipboard.writeText(url)
        setAvviso('Link copiato.')
      }
      eventoVetrina(voce.slug, 'condivisione')
    } catch (err) {
      if (err?.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(url)
        setAvviso('Link copiato.')
        eventoVetrina(voce.slug, 'condivisione')
      } catch {
        setAvviso(`Link: ${url}`)
      }
    }
  }

  function player(voce, inEvidenza = false) {
    const condividiVoce = soloCopia => condividi(voce, soloCopia)
    return (
      <PlayerVetrina
        key={voce.slug}
        traccia={voce}
        apriSubito={schermoIntero && voce.slug === slug}
        inEvidenza={inEvidenza}
        onAvvio={() => eventoVetrina(voce.slug, 'avvio')}
        onCompleto={() => eventoVetrina(voce.slug, 'completamento')}
        onSorprendi={elenco.some(item => item.slug && item.slug !== voce.slug) ? sorprendi : undefined}
        onCondividi={condividiVoce}
        avviso={avviso}
        onCambiaSfondo={facilitatore ? async campi => {
          const sfondo = await salvaSfondoVetrina(voce.slug, campi)
          setAvviso('Sfondo aggiornato.')
          return sfondo
        } : undefined}
        informazioni={<Scheda traccia={voce} onCondiviso={condividiVoce} avviso={avviso} />}
      />
    )
  }

  // Con o senza slug la pagina ha lo stesso impianto: intestazione, una meditazione (con Sorprendimi nell'anteprima), lettera.
  // Mentre arriva la meditazione scelta da «Sorprendimi» resta quella di prima, così il player non si chiude.
  const voceMostrata = slug ? (traccia || audioEvidenza) : audioEvidenza
  // Fuori dall'anteprima solo per una scheda senza audio, che non ha il player.
  const mostraSorprendi = slug && traccia && !traccia.audio_url
    && elenco.some(voce => voce.slug && voce.slug !== slug)

  return (
    <main className="ascolta">
      {stato === 'attesa' && <StatoAttesa etichetta="Caricamento delle meditazioni…" />}
      {stato === 'errore' && (
        <>
          <p className="avviso-errore" role="alert">Non è stato possibile aprire «E se ti fermassi un momento?».</p>
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

      {stato === 'pronta' && (!slug || voceMostrata) && (
        <>
          <header className="ascolta-testa">
            {!slug && citazione ? (
              <>
                <h1 className="visually-hidden">Ascolta</h1>
                <Citazione citazione={citazione} />
              </>
            ) : (
              <>
                <h1>E se ti fermassi un momento?</h1>
                <p>
                  Dedica del tempo alla meditazione tutte le volte che senti il bisogno di tornare in contatto con te stessə.
                </p>
              </>
            )}
          </header>
          {voceMostrata?.audio_url && player(voceMostrata, voceMostrata.slug === evidenza?.slug)}
          {slug && traccia && !traccia.audio_url && (
            <>
              <h2>{traccia.titolo}</h2>
              <Scheda traccia={traccia} onCondiviso={soloCopia => condividi(traccia, soloCopia)} avviso={avviso} />
            </>
          )}
          {mostraSorprendi && (
            <button type="button" className="btn btn-tonal ascolta-sorprendi" onClick={() => sorprendi()}>
              <IconaCaso />
              Sorprendimi
            </button>
          )}
          {!slug && elenco.length === 0 && (
            <StatoVuoto titolo="Non ci sono ancora meditazioni pubblicate" />
          )}
          {!slug && <IscrizioneLettera />}
        </>
      )}
    </main>
  )
}
