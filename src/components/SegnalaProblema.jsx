import { useState } from 'react'
import { inviaSegnalazione } from '../lib/segnalazione.js'
import { leggiCodice } from '../lib/supabaseClient.js'

function testoErrore(err) {
  const codice = err?.code || err?.message
  if (codice === 'TROPPI_TENTATIVI') return 'Hai inviato diverse segnalazioni in poco tempo. Riprova tra un’ora.'
  if (codice === 'CONFIG_MANCANTE') return 'Connessione non configurata. Riprova più tardi.'
  return 'Non è stato possibile inviare la segnalazione. Riprova tra qualche minuto.'
}

export default function SegnalaProblema({ errore = '' }) {
  const [messaggio, setMessaggio] = useState('')
  const [sitoWeb, setSitoWeb] = useState('')
  const [invio, setInvio] = useState(false)
  const [inviata, setInviata] = useState(false)
  const [esito, setEsito] = useState(null)

  const pronta = messaggio.trim().length >= 3 || Boolean(errore)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!pronta) return
    setEsito(null)
    setInvio(true)
    try {
      await inviaSegnalazione({ messaggio: messaggio.trim(), errore, sitoWeb })
      setInviata(true)
    } catch (err) {
      setEsito(testoErrore(err))
    } finally {
      setInvio(false)
    }
  }

  if (inviata) {
    return (
      <div className="segnala-ok" role="status">
        <p><strong>Grazie, segnalazione inviata.</strong></p>
        <p className="hint">
          {leggiCodice()
            ? 'Se la correzione è pronta, ti scriviamo all’email dell’iscrizione.'
            : 'La leggiamo e, se serve, correggiamo l’app nei prossimi aggiornamenti.'}
        </p>
      </div>
    )
  }

  return (
    <form className="segnala-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="segnala-messaggio">
          {errore ? 'Cosa stavi facendo? (facoltativo)' : 'Cosa non ha funzionato?'}
        </label>
        <textarea
          id="segnala-messaggio"
          rows={5}
          maxLength={3000}
          value={messaggio}
          onChange={e => setMessaggio(e.target.value)}
          placeholder="Es. ho premuto «Salva» nella pratica di oggi e la pagina è rimasta ferma."
          required={!errore}
        />
      </div>
      <div className="campo-trappola" aria-hidden="true">
        <label htmlFor="segnala-sito">Sito web</label>
        <input
          id="segnala-sito"
          name="sito_web"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={sitoWeb}
          onChange={e => setSitoWeb(e.target.value)}
        />
      </div>
      <p className="hint">
        Se entri con il codice, ti scriviamo quando la correzione è online.
        Chi analizza il problema non riceve né il codice né l’email.
        Insieme al testo inviamo la pagina, il tipo di browser e{' '}
        {errore
          ? 'le dimensioni dello schermo, più il messaggio tecnico dell’errore.'
          : 'le dimensioni dello schermo.'}{' '}
        Evita di scrivere dati personali.
      </p>
      <button className="btn btn-avanti" type="submit" disabled={!pronta || invio}>
        {invio ? 'Invio in corso…' : 'Invia segnalazione'}
      </button>
      {esito && <p className="campo-errore" role="alert">{esito}</p>}
    </form>
  )
}
