import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import StatoAttesa from '../components/StatoAttesa.jsx'
import { confermaLettera, esciLettera, LISTE } from '../lib/lettera.js'

// /lettera/conferma?t=<token>: doppia conferma dell'iscrizione.
function Conferma() {
  const [search] = useSearchParams()
  const token = search.get('t') || ''
  const [stato, setStato] = useState('attesa')
  const [liste, setListe] = useState([])
  const avviata = useRef(false)

  useEffect(() => {
    // In sviluppo StrictMode monta due volte: il token si usa una volta sola.
    if (avviata.current) return
    avviata.current = true
    if (!token) {
      setStato('scaduto')
      return
    }
    confermaLettera(token)
      .then(esito => {
        if (esito?.ok) {
          setListe(esito.liste || [])
          setStato('fatto')
        } else {
          setStato('scaduto')
        }
      })
      .catch(() => setStato('errore'))
  }, [token])

  if (stato === 'attesa') return <StatoAttesa etichetta="Confermo l’iscrizione…" />

  if (stato === 'fatto') {
    return (
      <section className="card lettera-pagina" role="status">
        <p className="ascolta-sopracciglio">Restiamo in contatto</p>
        <h1>Fatto, ti scriveremo</h1>
        <p>Da adesso ricevi:</p>
        <ul className="lettera-liste">
          {liste.map(l => (
            <li key={l}><strong>{LISTE[l].titolo}</strong> — {LISTE[l].riga}</li>
          ))}
        </ul>
        <p className="hint">In fondo a ogni email trovi il link per non riceverla più.</p>
        <Link className="btn" to="/ascolta">Vai ad Ascolta</Link>
      </section>
    )
  }

  if (stato === 'scaduto') {
    return (
      <section className="card lettera-pagina">
        <p className="ascolta-sopracciglio">Restiamo in contatto</p>
        <h1>Il link è scaduto</h1>
        <p>
          Il link di conferma vale 7 giorni e si usa una volta sola. Se vuoi ricevere le nostre email,
          iscriviti di nuovo: ti mandiamo un link nuovo.
        </p>
        <Link className="btn" to="/ascolta">Iscriviti da Ascolta</Link>
      </section>
    )
  }

  return (
    <section className="card lettera-pagina">
      <p className="ascolta-sopracciglio">Restiamo in contatto</p>
      <h1>Non è stato possibile confermare</h1>
      <p className="avviso-errore" role="alert">La conferma non è arrivata al server. Controlla la connessione e riprova.</p>
      <button type="button" className="btn" onClick={() => window.location.reload()}>Riprova</button>
    </section>
  )
}

// /lettera/esci?u=<token_uscita>&lista=…: serve un clic, così i prefetch dei client di posta non cancellano nulla.
function Esci() {
  const [search] = useSearchParams()
  const token = search.get('u') || ''
  const lista = LISTE[search.get('lista')] ? search.get('lista') : null
  const [stato, setStato] = useState(token ? 'scelta' : 'link_non_valido')
  const cosa = lista ? LISTE[lista].nome : 'le email di Conscio: l’avviso del prossimo ciclo e la lettera settimanale'

  async function esci() {
    setStato('invio')
    try {
      const esito = await esciLettera(token, lista)
      setStato(esito?.ok ? 'fatto' : 'link_non_valido')
    } catch {
      setStato('errore')
    }
  }

  if (stato === 'link_non_valido') {
    return (
      <section className="card lettera-pagina">
        <p className="ascolta-sopracciglio">Restiamo in contatto</p>
        <h1>Il link non è completo</h1>
        <p>
          Apri di nuovo il link in fondo all’email che hai ricevuto. Se non funziona, rispondi a quell’email
          scrivendo «Cancellami»: ti togliamo a mano.
        </p>
        <Link className="btn btn-ghost" to="/ascolta">Torna ad Ascolta</Link>
      </section>
    )
  }

  if (stato === 'fatto') {
    return (
      <section className="card lettera-pagina" role="status">
        <p className="ascolta-sopracciglio">Restiamo in contatto</p>
        <h1>Non riceverai più {cosa}</h1>
        <p>Non serve fare altro. Se cambi idea, puoi iscriverti di nuovo da Ascolta.</p>
        <Link className="btn btn-ghost" to="/ascolta">Torna ad Ascolta</Link>
      </section>
    )
  }

  return (
    <section className="card lettera-pagina">
      <p className="ascolta-sopracciglio">Restiamo in contatto</p>
      <h1>Vuoi smettere di ricevere {lista ? LISTE[lista].nome : 'le nostre email'}?</h1>
      <p>
        {lista
          ? `Disattivi solo ${LISTE[lista].nome}. Se ricevi anche l’altra, quella resta.`
          : 'Disattivi l’avviso del prossimo ciclo e la lettera settimanale.'}
      </p>
      {stato === 'errore' && (
        <p className="avviso-errore" role="alert">Non è stato possibile completare l’operazione. Riprova.</p>
      )}
      <button type="button" className="btn" disabled={stato === 'invio'} onClick={esci}>
        {stato === 'invio' ? <StatoAttesa inline etichetta="Un momento…" /> : 'Non voglio più riceverla'}
      </button>
    </section>
  )
}

export default function Lettera({ passo }) {
  return (
    <main className="ascolta lettera">
      {passo === 'conferma' ? <Conferma /> : <Esci />}
    </main>
  )
}
