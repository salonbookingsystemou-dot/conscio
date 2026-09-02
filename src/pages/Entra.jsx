import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { destinazionePartecipante, usePartecipante } from '../lib/partecipante.jsx'
import {
  dimenticaCodiceRicordato,
  leggiCodiceRicordato,
  memorizzaCodiceRicordato,
  supabaseConfigurato
} from '../lib/supabaseClient'
import Disclaimer from '../components/Disclaimer.jsx'

export default function Entra() {
  const { facilitatore, caricamento: authLoad } = useAuth()
  const {
    registrato,
    caricamento,
    entra,
    onboardingCompleto,
    t0Completo,
    percorsoPronto
  } = usePartecipante()
  const location = useLocation()
  const destinazione = destinazionePartecipante(
    { onboarding: onboardingCompleto, t0: t0Completo, pronto: percorsoPronto },
    location.state?.da
  )
  const [codice, setCodice] = useState(() => leggiCodiceRicordato())
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
    } catch (err) {
      if (err?.message === 'SCREENING_IN_ATTESA') {
        memorizzaCodiceRicordato(codice)
        setErrore('Il codice è riconosciuto. L’accesso alle altre sezioni si apre dopo l’esito idoneo dello screening.')
      } else {
        setErrore('Codice non riconosciuto. Controlla e riprova, oppure iscriviti.')
      }
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
            Le sezioni del percorso si aprono solo con il codice ricevuto all’iscrizione,
            e solo dopo l’esito idoneo dello screening. Non serve un account.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="codice">Codice partecipante</label>
              <input
                id="codice"
                name="username"
                value={codice}
                onChange={e => setCodice(e.target.value)}
                placeholder="es. MBSR-7K2Q"
                autoComplete="username"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                required
              />
              <p className="hint">
                Su questo dispositivo il codice resta compilato per i prossimi accessi.
              </p>
              {leggiCodiceRicordato() && (
                <p className="hint">
                  <button
                    type="button"
                    className="link-testuale"
                    onClick={() => {
                      dimenticaCodiceRicordato()
                      setCodice('')
                    }}
                  >
                    Dimentica il codice su questo dispositivo
                  </button>
                </p>
              )}
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
          <p><Link to="/iscrizione">Vai all’iscrizione</Link></p>
        </div>
      </aside>
    </div>
  )
}
