import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import StatoAttesa from './StatoAttesa.jsx'
import imgCerchio from '../assets/cerchio-persone.webp'
import { emailValida, iscriviLettera } from '../lib/lettera.js'

// «Restiamo in contatto» in Ascolta. Un solo consenso per le due liste (avviso del ciclo e lettera),
// descritte nel testo del box e nell'email di conferma; ognuna ha poi il suo link per uscire.
export default function IscrizioneLettera() {
  const id = useId()
  const [email, setEmail] = useState('')
  const [errore, setErrore] = useState('')
  const [stato, setStato] = useState('modulo')
  const [erroreRete, setErroreRete] = useState('')
  const [inviataA, setInviataA] = useState('')
  const campoEmail = useRef(null)


  async function invia(e) {
    e.preventDefault()
    setErroreRete('')
    const indirizzo = email.trim()
    if (!emailValida(indirizzo)) {
      setErrore('Controlla l’indirizzo email.')
      campoEmail.current?.focus()
      return
    }
    setErrore('')

    setStato('invio')
    try {
      await iscriviLettera({ email: indirizzo, avviso_ciclo: true, lettera: true })
      setInviataA(indirizzo)
      setStato('inviata')
    } catch (err) {
      setStato('modulo')
      if (err?.code === 'EMAIL_NON_VALIDA') setErrore('Controlla l’indirizzo email.')
      else if (err?.code === 'TROPPI_TENTATIVI') setErroreRete('Hai fatto molte richieste in poco tempo. Riprova tra un’ora.')
      else setErroreRete('Non è stato possibile completare l’iscrizione. Riprova.')
    }
  }

  function altraEmail() {
    setEmail('')
    setErrore('')
    setStato('modulo')
    window.setTimeout(() => campoEmail.current?.focus(), 0)
  }

  const titoloId = `${id}-titolo`
  const invio = stato === 'invio'

  return (
    <section className="card ascolta-lettera" aria-labelledby={titoloId}>
      {/* Tratto trasparente usato come maschera: prende il colore dal tema */}
      <div className="ascolta-lettera-illustrazione" style={{ '--img': `url(${imgCerchio})` }} aria-hidden="true" />
      <p className="ascolta-sopracciglio">Restiamo in contatto</p>
      <h2 id={titoloId}>Mindfulness, dal mondo. Ogni settimana</h2>
      <p className="ascolta-lettera-testo">
        Ti avvisiamo quando si aprono le iscrizioni al prossimo ciclo e ti raccontiamo cosa succede nel mondo
        della mindfulness, in Italia e nel resto del mondo, selezionando le fonti più autorevoli del settore.
      </p>

      {stato === 'inviata' ? (
        <div className="ascolta-lettera-inviata" role="status">
          <p className="ascolta-lettera-inviata-titolo">Controlla la tua casella.</p>
          <p>
            Ti abbiamo scritto a <strong>{inviataA}</strong>. Apri il messaggio e conferma:
            senza conferma non ti scriviamo.
          </p>
          <button type="button" className="btn btn-text ascolta-lettera-altra" onClick={altraEmail}>
            Usa un’altra email
          </button>
        </div>
      ) : (
        <form className="ascolta-lettera-modulo" onSubmit={invia} noValidate>
          <div className="field ascolta-lettera-campo">
            <label htmlFor={`${id}-email`}>La tua email</label>
            <input
              ref={campoEmail}
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="nome@esempio.it"
              value={email}
              disabled={invio}
              aria-invalid={errore ? 'true' : undefined}
              aria-describedby={errore ? `${id}-email-errore` : undefined}
              onChange={e => { setEmail(e.target.value); setErrore('') }}
            />
            {errore && <p className="campo-errore" id={`${id}-email-errore`}>{errore}</p>}
          </div>

          {erroreRete && <p className="avviso-errore" role="alert">{erroreRete}</p>}

          <button type="submit" className="btn" disabled={invio}>
            {invio ? <StatoAttesa inline etichetta="Invio in corso…" /> : 'Iscrivimi'}
          </button>
          <p className="ascolta-lettera-nota">
            Ti mandiamo un’email per confermare. Puoi cancellarti in qualsiasi momento con un clic.{' '}
            <Link to="/documenti/lettera">Come usiamo la tua email</Link>
          </p>
        </form>
      )}
    </section>
  )
}
