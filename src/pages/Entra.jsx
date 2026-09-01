import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePartecipante } from '../lib/partecipante.jsx'
import { supabaseConfigurato } from '../lib/supabaseClient'
import Disclaimer from '../components/Disclaimer.jsx'

export default function Entra() {
  const { facilitatore, caricamento: authLoad } = useAuth()
  const { registrato, caricamento, entra } = usePartecipante()
  const location = useLocation()
  const destinazione = location.state?.da && location.state.da !== '/entra'
    ? location.state.da
    : '/programma'
  const [codice, setCodice] = useState('')
  const [errore, setErrore] = useState(null)
  const [invio, setInvio] = useState(false)

  if (authLoad || caricamento) return <p>Caricamento…</p>
  if (facilitatore) return <Navigate to="/dashboard" replace />
  if (registrato) return <Navigate to={destinazione} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setErrore(null)
    setInvio(true)
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      setInvio(false)
      return
    }
    try {
      await entra(codice)
    } catch {
      setErrore('Codice non riconosciuto. Controlla e riprova, oppure iscriviti.')
    } finally {
      setInvio(false)
    }
  }

  return (
    <div className="layout-due">
      <div>
        <h2>Entra nel percorso</h2>
        <Disclaimer />
        <div className="card">
          <p>
            Le sezioni del percorso si aprono solo con il codice ricevuto all’iscrizione.
            Non serve un account: il codice è il tuo accesso.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="codice">Codice partecipante</label>
              <input
                id="codice"
                value={codice}
                onChange={e => setCodice(e.target.value)}
                placeholder="es. MBSR-7K2Q"
                autoComplete="off"
                required
              />
            </div>
            <button className="btn" type="submit" disabled={!codice.trim() || invio}>
              {invio ? 'Verifica in corso…' : 'Entra'}
            </button>
            {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
          </form>
        </div>
      </div>
      <aside>
        <div className="card card-lato">
          <h3>Non hai ancora il codice?</h3>
          <p>Prima iscriviti: riceverai un codice personale da conservare.</p>
          <p><Link to="/">Vai all’iscrizione</Link></p>
        </div>
      </aside>
    </div>
  )
}
