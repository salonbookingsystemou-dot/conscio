import { useState } from 'react'
import { usePartecipante } from '../lib/partecipante.jsx'
import { supabaseConfigurato } from '../lib/supabaseClient'

export default function ChiediCodice({
  titolo = 'Inserisci un codice partecipante per vedere questa sezione.'
}) {
  const { entra } = usePartecipante()
  const [codice, setCodice] = useState('')
  const [errore, setErrore] = useState(null)
  const [invio, setInvio] = useState(false)

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
      setErrore('Codice non riconosciuto. Controlla e riprova.')
    } finally {
      setInvio(false)
    }
  }

  return (
    <div className="card">
      <p>{titolo}</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="codice-sezione">Codice partecipante</label>
          <input
            id="codice-sezione"
            value={codice}
            onChange={e => setCodice(e.target.value)}
            placeholder="es. MBSR-7K2Q"
            autoComplete="off"
            required
          />
        </div>
        <button className="btn" type="submit" disabled={!codice.trim() || invio}>
          {invio ? 'Verifica in corso…' : 'Continua'}
        </button>
        {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
      </form>
    </div>
  )
}
