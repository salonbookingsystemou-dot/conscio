import { useEffect, useState } from 'react'
import DialogConferma from '../DialogConferma.jsx'
import { useSnackbar } from './Snackbar.jsx'
import BozzaLettera from './BozzaLettera.jsx'
import { esitoInvio, inviaLettera, leggiConteggiLettera, leggiLettereInviate } from '../../lib/lettera.js'

function data(valore) {
  return valore ? new Date(valore).toLocaleDateString('it-IT') : ''
}

/** Numeri di «Restiamo in contatto»: solo conteggi, mai le email. */
export function ConteggiLettera({ conteggi }) {
  if (!conteggi) return null
  return (
    <dl className="com-dati">
      <div><dt>Lettera settimanale</dt><dd>{conteggi.lettera} confermati</dd></div>
      <div><dt>Avviso del ciclo</dt><dd>{conteggi.avviso_ciclo} confermati</dd></div>
      <div><dt>In attesa di conferma</dt><dd>{conteggi.in_attesa}</dd></div>
      <div><dt>Usciti negli ultimi 30 giorni</dt><dd>{conteggi.cancellati_30_giorni}</dd></div>
    </dl>
  )
}

// Dettaglio «Lettera settimanale» in Comunicazioni. Gli iscritti non sono partecipanti.
export default function LetteraSettimanale({ onCambio }) {
  const { mostra } = useSnackbar()
  const [conteggi, setConteggi] = useState(null)
  const [storico, setStorico] = useState([])
  const [errLettura, setErrLettura] = useState(null)
  const [form, setForm] = useState({ oggetto: '', corpo: '' })
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState(null)
  const [conferma, setConferma] = useState(false)

  async function carica() {
    try {
      const [n, voci] = await Promise.all([leggiConteggiLettera(), leggiLettereInviate('lettera')])
      setConteggi(n)
      setStorico(voci)
      setErrLettura(null)
      onCambio?.(n)
    } catch {
      setErrLettura('Non è stato possibile leggere gli iscritti alla lettera.')
    }
  }

  useEffect(() => {
    carica()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const n = conteggi?.lettera ?? 0
  const pronto = form.oggetto.trim() && form.corpo.trim()

  async function invia(prova) {
    setErrore(null)
    if (!pronto) {
      setErrore('Servono oggetto e testo.')
      return
    }
    setInvio(true)
    try {
      const esito = await inviaLettera({ oggetto: form.oggetto.trim(), corpo: form.corpo.trim(), prova, tipo: 'lettera' })
      const { testo, errore: problema } = esitoInvio(esito, prova)
      if (testo) mostra({ testo })
      if (problema) setErrore(problema)
      if (!prova && esito?.ok) {
        setForm({ oggetto: '', corpo: '' })
        carica()
      }
    } catch {
      setErrore(prova ? 'La prova non è partita. Riprova tra un momento.' : 'L’invio non è partito. Riprova tra un momento.')
    }
    setInvio(false)
  }

  return (
    <div className="com-dettaglio">
      <p>
        Chi la riceve si è iscritto da Ascolta e ha confermato l’indirizzo. Non sono partecipanti: qui ci sono
        solo i numeri, mai le email. Ogni lettera parte una per persona, con il link per uscire con un clic.
      </p>
      {errLettura
        ? <p className="avviso-errore" role="alert">{errLettura}</p>
        : <ConteggiLettera conteggi={conteggi} />}

      <BozzaLettera />

      <section className="com-sezione">
        <h3>Scrivi una lettera a mano</h3>
        <p className="hint">Per un messaggio fuori dal giovedì. Non sostituisce la lettera della settimana.</p>
      </section>
      <form className="com-modulo" onSubmit={e => { e.preventDefault(); if (pronto) setConferma(true); else setErrore('Servono oggetto e testo.') }}>
        <div className="field">
          <label htmlFor="lettera-oggetto">Oggetto</label>
          <input
            id="lettera-oggetto"
            required
            maxLength={200}
            value={form.oggetto}
            onChange={e => setForm({ ...form, oggetto: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="lettera-corpo">Testo</label>
          <textarea
            id="lettera-corpo"
            required
            rows="12"
            value={form.corpo}
            onChange={e => setForm({ ...form, corpo: e.target.value })}
          />
          <p className="hint">
            Testo semplice: una riga vuota separa i paragrafi, i link che iniziano con https:// diventano
            cliccabili. In fondo si aggiungono da soli il link per uscire e la firma.
          </p>
        </div>
        {errore && <p className="avviso-errore" role="alert">{errore}</p>}
        <div className="dialogo-azioni">
          <button className="btn" type="submit" disabled={invio || n === 0}>
            {invio ? 'Invio in corso…' : `Invia a ${n} ${n === 1 ? 'iscritto' : 'iscritti'}`}
          </button>
          <button className="btn btn-ghost" type="button" disabled={invio} onClick={() => invia(true)}>
            Invia una prova a me
          </button>
        </div>
      </form>

      <section className="com-sezione">
        <h3>Lettere inviate</h3>
        {storico.length === 0
          ? <p className="hint">Nessuna lettera inviata finora.</p>
          : (
            <ul className="com-storico">
              {storico.map(v => (
                <li key={v.id}>
                  <span className="hint">{data(v.inviata_il)}</span>
                  <span>{v.oggetto}</span>
                  <span className="hint">
                    {v.destinatari} {v.destinatari === 1 ? 'destinatario' : 'destinatari'}
                    {v.falliti > 0 ? ` · ${v.falliti} non riusciti` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
      </section>

      <DialogConferma
        aperto={conferma}
        titolo="Inviare la lettera adesso?"
        confermaEtichetta={`Invia a ${n}`}
        occupato={invio}
        onConferma={() => { setConferma(false); invia(false) }}
        onAnnulla={() => setConferma(false)}
      >
        «{form.oggetto.trim()}» parte subito a {n} {n === 1 ? 'iscritto confermato' : 'iscritti confermati'} alla
        lettera settimanale, un’email per persona. Un’email inviata non si può ritirare.
      </DialogConferma>
    </div>
  )
}
