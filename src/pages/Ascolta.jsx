import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PlayerVetrina, { Credito } from '../components/PlayerVetrina.jsx'
import StatoAttesa from '../components/StatoAttesa.jsx'
import StatoVuoto from '../components/StatoVuoto.jsx'
import {
  etichettaLicenza,
  etichettaVoce,
  eventoVetrina,
  leggiElenco,
  leggiEvidenza,
  leggiImpostazioniPubbliche,
  leggiTracciaPubblica,
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


function Invito({ impostazioni, slug }) {
  if (!impostazioni) return null
  const aperte = impostazioni.iscrizioni_aperte === true
  return (
    <section className="card ascolta-invito">
      <p className="ascolta-sopracciglio">Il percorso</p>
      <h2>{impostazioni.cta_titolo}</h2>
      <p>{aperte ? impostazioni.cta_testo : impostazioni.cta_testo_senza_ciclo}</p>
      <Link className="btn" to="/iscrizione" onClick={() => eventoVetrina(slug, 'cta')}>
        Iscriviti al prossimo ciclo
      </Link>
    </section>
  )
}

function Scheda({ traccia, onCondiviso, avviso, conDescrizione = true }) {
  const licenza = etichettaLicenza(traccia.licenza)
  const voce = etichettaVoce(traccia.voce)
  return (
    <section className="ascolta-scheda-pubblica">
      {conDescrizione && traccia.descrizione && <p className="ascolta-descrizione">{traccia.descrizione}</p>}
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
  const [stato, setStato] = useState('attesa')
  const [impostazioni, setImpostazioni] = useState(null)
  const [elenco, setElenco] = useState([])
  const [evidenza, setEvidenza] = useState(null)
  const [audioEvidenza, setAudioEvidenza] = useState(null)
  const [traccia, setTraccia] = useState(null)
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

  function sorprendi() {
    const scelte = elenco.filter(voce => voce.slug && voce.slug !== slug)
    if (!scelte.length) return
    const prossima = scelte[Math.floor(Math.random() * scelte.length)]
    navigate(`/ascolta/${prossima.slug}`)
  }

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
        traccia={voce}
        inEvidenza={inEvidenza}
        onAvvio={() => eventoVetrina(voce.slug, 'avvio')}
        onCompleto={() => eventoVetrina(voce.slug, 'completamento')}
        onSorprendi={elenco.some(item => item.slug && item.slug !== voce.slug) ? sorprendi : undefined}
        onCondividi={condividiVoce}
        avviso={avviso}
        informazioni={(
          <>
            <Scheda traccia={voce} onCondiviso={condividiVoce} avviso={avviso} conDescrizione={false} />
            <Invito impostazioni={impostazioni} slug={voce.slug} />
          </>
        )}
      />
    )
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
          {audioEvidenza?.audio_url && player(audioEvidenza, true)}
          {elenco.length > 1 && (
            <button type="button" className="btn btn-tonal" onClick={sorprendi}>Sorprendimi</button>
          )}
          {elenco.length === 0 && (
            <StatoVuoto titolo="Non ci sono ancora meditazioni pubblicate" />
          )}
          <Invito impostazioni={impostazioni} slug={slugInvito} />
        </>
      )}

      {stato === 'pronta' && slug && traccia && (
        <>
          <p className="ascolta-torna"><Link to="/ascolta">Tutte le meditazioni</Link></p>
          {traccia.audio_url ? player(traccia) : <h1>{traccia.titolo}</h1>}
          <Scheda traccia={traccia} onCondiviso={soloCopia => condividi(traccia, soloCopia)} avviso={avviso} />
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
