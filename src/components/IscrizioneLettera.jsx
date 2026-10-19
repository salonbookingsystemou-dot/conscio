import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import StatoAttesa from './StatoAttesa.jsx'
import imgCerchio from '../assets/cerchio-persone.webp'
import { emailValida, iscriviLettera, LISTE } from '../lib/lettera.js'

const VUOTO = { email: '', avviso_ciclo: false, lettera: false }

// «Restiamo in contatto» in Ascolta. Le due liste hanno consensi separati e partono non spuntate.
export default function IscrizioneLettera() {
  const id = useId()
  const [form, setForm] = useState(VUOTO)
  const [errori, setErrori] = useState({})
  const [stato, setStato] = useState('modulo')
  const [erroreRete, setErroreRete] = useState('')
  const [inviataA, setInviataA] = useState('')
  const campoEmail = useRef(null)
  const primaScelta = useRef(null)

  function aggiorna(patch) {
    setForm(f => ({ ...f, ...patch }))
    setErrori(e => ({
      ...e,
      ...('email' in patch ? { email: '' } : {}),
      ...('avviso_ciclo' in patch || 'lettera' in patch ? { liste: '' } : {})
    }))
  }

  async function invia(e) {
    e.preventDefault()
    setErroreRete('')
    const email = form.email.trim()
    const nuovi = {
      email: emailValida(email) ? '' : 'Controlla l’indirizzo email.',
      liste: form.avviso_ciclo || form.lettera ? '' : 'Scegli almeno una delle due opzioni.'
    }
    setErrori(nuovi)
    if (nuovi.email) { campoEmail.current?.focus(); return }
    if (nuovi.liste) { primaScelta.current?.focus(); return }

    setStato('invio')
    try {
      await iscriviLettera({ email, avviso_ciclo: form.avviso_ciclo, lettera: form.lettera })
      setInviataA(email)
      setStato('inviata')
    } catch (err) {
      setStato('modulo')
      if (err?.code === 'EMAIL_NON_VALIDA') setErrori({ email: 'Controlla l’indirizzo email.' })
      else if (err?.code === 'NESSUNA_LISTA') setErrori({ liste: 'Scegli almeno una delle due opzioni.' })
      else if (err?.code === 'TROPPI_TENTATIVI') setErroreRete('Hai fatto molte richieste in poco tempo. Riprova tra un’ora.')
      else setErroreRete('Non è stato possibile completare l’iscrizione. Riprova.')
    }
  }

  function altraEmail() {
    setForm({ ...VUOTO, avviso_ciclo: form.avviso_ciclo, lettera: form.lettera })
    setErrori({})
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
      <h2 id={titoloId}>Una lettera a settimana per non perderti le notizie che contano</h2>
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
              value={form.email}
              disabled={invio}
              aria-invalid={errori.email ? 'true' : undefined}
              aria-describedby={errori.email ? `${id}-email-errore` : undefined}
              onChange={e => aggiorna({ email: e.target.value })}
            />
            {errori.email && <p className="campo-errore" id={`${id}-email-errore`}>{errori.email}</p>}
          </div>

          <fieldset
            className="ascolta-lettera-scelte"
            aria-describedby={errori.liste ? `${id}-liste-errore` : undefined}
            disabled={invio}
          >
            <legend>Cosa vuoi ricevere</legend>
            {['avviso_ciclo', 'lettera'].map((lista, i) => (
              <div key={lista} className="ascolta-lettera-scelta">
                <label>
                  <input
                    ref={i === 0 ? primaScelta : undefined}
                    type="checkbox"
                    checked={form[lista]}
                    aria-invalid={errori.liste ? 'true' : undefined}
                    onChange={e => aggiorna({ [lista]: e.target.checked })}
                  />
                  <span>
                    <strong>{LISTE[lista].titolo}</strong>
                    <span className="ascolta-lettera-riga">{LISTE[lista].riga}</span>
                  </span>
                </label>
              </div>
            ))}
            {errori.liste && <p className="campo-errore" id={`${id}-liste-errore`}>{errori.liste}</p>}
          </fieldset>

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
