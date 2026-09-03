import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { destinazionePartecipante, usePartecipante } from '../lib/partecipante.jsx'
import {
  chiamaPorta,
  dimenticaCodiceRicordato,
  leggiCodiceRicordato,
  memorizzaCodiceRicordato,
  supabaseConfigurato
} from '../lib/supabaseClient'
import Disclaimer from '../components/Disclaimer.jsx'
import BoxCodicePrivacy from '../components/BoxCodicePrivacy.jsx'
import { EMAIL_CONTATTO } from '../lib/contatti.js'

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
  const [mostraRecupero, setMostraRecupero] = useState(
    () => location.hash === '#recupera' || location.state?.recupera === true
  )
  const [emailRecupero, setEmailRecupero] = useState('')
  const [sitoWebRecupero, setSitoWebRecupero] = useState('')
  const [msgRecupero, setMsgRecupero] = useState(null)
  const [errRecupero, setErrRecupero] = useState(null)
  const [invioRecupero, setInvioRecupero] = useState(false)

  useEffect(() => {
    if (location.hash === '#recupera') setMostraRecupero(true)
  }, [location.hash])

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
      if (err?.message === 'SCREENING_IN_ATTESA' || err?.code === 'SCREENING_IN_ATTESA') {
        memorizzaCodiceRicordato(codice)
        setErrore('Il codice è riconosciuto. L’accesso alle altre sezioni si apre dopo l’esito idoneo dello screening.')
      } else if (err?.code === 'TROPPI_TENTATIVI' || err?.message === 'TROPPI_TENTATIVI') {
        setErrore('Troppi tentativi. Riprova tra qualche minuto.')
      } else {
        setErrore('Codice non riconosciuto. Controlla e riprova, oppure iscriviti.')
      }
    } finally {
      setInvio(false)
    }
  }

  async function handleRecupero(e) {
    e.preventDefault()
    setErrRecupero(null)
    setMsgRecupero(null)
    setInvioRecupero(true)
    if (!supabaseConfigurato) {
      setErrRecupero('Connessione non configurata. Riprova più tardi.')
      setInvioRecupero(false)
      return
    }
    try {
      const data = await chiamaPorta({
        azione: 'recupera',
        email: emailRecupero.trim(),
        sito_web: sitoWebRecupero
      })
      setMsgRecupero(
        data?.messaggio ||
        'Se l’indirizzo è presente in anagrafe con email ancora attiva, riceverai il codice a breve. Controlla anche lo spam.'
      )
      setEmailRecupero('')
    } catch (err) {
      if (err?.code === 'TROPPI_TENTATIVI' || err?.message === 'TROPPI_TENTATIVI') {
        setErrRecupero('Troppi tentativi. Riprova tra qualche ora.')
      } else if (err?.code === 'EMAIL_MANCANTE' || err?.message === 'EMAIL_MANCANTE') {
        setErrRecupero('Inserisci un’email valida.')
      } else {
        setErrRecupero('Non è stato possibile completare la richiesta. Riprova più tardi.')
      }
    } finally {
      setInvioRecupero(false)
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
                placeholder="es. MBSR-7K2Q8N3P"
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

          <div className="entra-recupero">
            {!mostraRecupero ? (
              <p className="hint">
                <button
                  type="button"
                  className="link-testuale"
                  onClick={() => setMostraRecupero(true)}
                >
                  Hai dimenticato il codice?
                </button>
              </p>
            ) : (
              <form className="entra-recupero-form" onSubmit={handleRecupero}>
                <h3 className="entra-recupero-titolo">Recupera il codice</h3>
                <p className="hint">
                  Inserisci l’email usata all’iscrizione. Se è ancora in anagrafe,
                  ti inviamo il codice lì — non lo mostriamo a schermo.
                  Se l’email è già stata separata a fine percorso, scrivi a{' '}
                  <a href={`mailto:${EMAIL_CONTATTO}`}>{EMAIL_CONTATTO}</a>.
                </p>
                <div className="field">
                  <label htmlFor="email-recupero">Email di iscrizione</label>
                  <input
                    id="email-recupero"
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={emailRecupero}
                    onChange={e => setEmailRecupero(e.target.value)}
                    required
                  />
                </div>
                <div className="campo-trappola" aria-hidden="true">
                  <label htmlFor="sito-web-recupero">Sito web</label>
                  <input
                    id="sito-web-recupero"
                    name="sito_web"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={sitoWebRecupero}
                    onChange={e => setSitoWebRecupero(e.target.value)}
                  />
                </div>
                <div className="entra-recupero-azioni">
                  <button
                    className="btn"
                    type="submit"
                    disabled={!emailRecupero.trim() || invioRecupero}
                  >
                    {invioRecupero ? 'Invio…' : 'Invia il codice'}
                  </button>
                  <button
                    type="button"
                    className="link-testuale"
                    onClick={() => {
                      setMostraRecupero(false)
                      setMsgRecupero(null)
                      setErrRecupero(null)
                    }}
                  >
                    Annulla
                  </button>
                </div>
                {msgRecupero && <p className="hint hint-ok" role="status">{msgRecupero}</p>}
                {errRecupero && <p style={{ color: 'var(--danger)' }}>{errRecupero}</p>}
              </form>
            )}
          </div>
        </div>
      </div>
      <aside>
        <BoxCodicePrivacy />
        <div className="card card-lato">
          <h3>Non hai ancora il codice?</h3>
          <p>Prima iscriviti: riceverai un codice personale da conservare (a schermo e via email).</p>
          <p><Link to="/iscrizione">Vai all’iscrizione</Link></p>
        </div>
      </aside>
    </div>
  )
}
