import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { supabaseConfigurato } from '../lib/supabaseClient'

export default function Accedi() {
  const { facilitatore, caricamento, accedi } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState(null)
  const [invio, setInvio] = useState(false)

  if (caricamento) return <p>Caricamento…</p>
  if (facilitatore) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setErrore(null)
    setInvio(true)
    try {
      if (!supabaseConfigurato) {
        setErrore('Questa copia del sito non è collegata al database. Apri https://conscio.mnesti.it/#/accedi e aggiorna la pagina (Cmd+Shift+R).')
        return
      }
      await accedi(email.trim(), password)
    } catch (err) {
      setErrore('Accesso non riuscito. Usa email e password del file ACCESSO-FACILITATORE.txt, senza spazi.')
    } finally {
      setInvio(false)
    }
  }

  return (
    <div className="card">
      <h2>Accesso facilitatore</h2>
      <p className="disclaimer">
        Area riservata a chi conduce il percorso. I partecipanti entrano con il
        codice ricevuto all’iscrizione — senza account.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <button className="btn" type="submit" disabled={invio}>
          {invio ? 'Accesso in corso…' : 'Entra'}
        </button>
        {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
      </form>
    </div>
  )
}
