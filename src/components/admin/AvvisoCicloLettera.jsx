import { useEffect, useState } from 'react'
import DialogConferma from '../DialogConferma.jsx'
import { useSnackbar } from './Snackbar.jsx'
import { esitoInvio, inviaLettera, leggiConteggiLettera, leggiLettereInviate } from '../../lib/lettera.js'

function giorno(valore) {
  if (!valore) return ''
  return new Date(`${String(valore).slice(0, 10)}T12:00:00`).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

function testoIniziale(ciclo) {
  const date = ciclo.data_fine
    ? `dal ${giorno(ciclo.data_inizio)} al ${giorno(ciclo.data_fine)}`
    : `dal ${giorno(ciclo.data_inizio)}`
  return {
    oggetto: `Si aprono le iscrizioni: ${ciclo.nome_ciclo}`,
    corpo: [
      'Ciao,',
      '',
      `si sono aperte le iscrizioni a «${ciclo.nome_ciclo}», il nuovo ciclo del percorso di mindfulness di Conscio, ${date}.`,
      '',
      'Per iscriverti: https://conscio.mnesti.it/#/iscrizione',
      '',
      'Ti abbiamo scritto perché avevi chiesto di essere avvisato. Per questo ciclo è l’unica email che ricevi.'
    ].join('\n')
  }
}

// Nel ciclo in reclutamento: avviso agli iscritti di «Restiamo in contatto» che l'hanno chiesto.
// Ognuno lo riceve una volta per ciclo (ultimo_ciclo_avvisato).
export default function AvvisoCicloLettera({ ciclo }) {
  const { mostra } = useSnackbar()
  const [n, setN] = useState(null)
  const [inviati, setInviati] = useState([])
  const [aperto, setAperto] = useState(false)
  const [form, setForm] = useState(() => testoIniziale(ciclo))
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState(null)
  const [conferma, setConferma] = useState(false)

  async function carica() {
    try {
      const [conteggi, storico] = await Promise.all([
        leggiConteggiLettera(ciclo.id),
        leggiLettereInviate('avviso_ciclo')
      ])
      setN(conteggi?.avviso_da_inviare ?? 0)
      setInviati(storico.filter(v => v.ciclo_id === ciclo.id))
    } catch {
      setN(null)
    }
  }

  useEffect(() => {
    setForm(testoIniziale(ciclo))
    setAperto(false)
    carica()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciclo.id])

  async function invia(prova) {
    setErrore(null)
    if (!form.oggetto.trim() || !form.corpo.trim()) {
      setErrore('Servono oggetto e testo.')
      return
    }
    setInvio(true)
    try {
      const esito = await inviaLettera({
        oggetto: form.oggetto.trim(),
        corpo: form.corpo.trim(),
        prova,
        tipo: 'avviso_ciclo',
        ciclo_id: ciclo.id
      })
      const { testo, errore: problema } = esitoInvio(esito, prova)
      if (testo) mostra({ testo: prova ? testo : `Avviso inviato a ${esito.inviate} ${esito.inviate === 1 ? 'iscritto' : 'iscritti'}` })
      if (problema) setErrore(problema)
      if (!prova && esito?.ok) {
        setAperto(false)
        carica()
      }
    } catch {
      setErrore('L’invio non è partito. Riprova tra un momento.')
    }
    setInvio(false)
  }

  if (ciclo.stato !== 'reclutamento') return null

  return (
    <section className="dash-ciclo-sezione" aria-labelledby="ciclo-avviso-titolo">
      <header className="dash-ciclo-sezione-testa">
        <div>
          <h2 id="ciclo-avviso-titolo">Avviso del prossimo ciclo</h2>
          <p className="hint">
            Un’email a chi ha chiesto da Ascolta di sapere quando si apre un nuovo ciclo. Non sono partecipanti:
            vedi solo quanti sono. Chi ha già ricevuto l’avviso di questo ciclo non lo riceve di nuovo.
            {inviati.length > 0 && ` Già inviato il ${inviati.map(v => new Date(v.inviata_il).toLocaleDateString('it-IT')).join(', ')}.`}
          </p>
        </div>
        {!aperto && (
          <button type="button" className="btn btn-tonal" disabled={!n} onClick={() => setAperto(true)}>
            Avvisa gli iscritti ({n ?? '…'})
          </button>
        )}
      </header>

      {aperto && (
        <form className="com-modulo" onSubmit={e => { e.preventDefault(); setConferma(true) }}>
          <div className="field">
            <label htmlFor="avviso-oggetto">Oggetto</label>
            <input
              id="avviso-oggetto"
              required
              maxLength={200}
              value={form.oggetto}
              onChange={e => setForm({ ...form, oggetto: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="avviso-corpo">Testo</label>
            <textarea
              id="avviso-corpo"
              required
              rows="9"
              value={form.corpo}
              onChange={e => setForm({ ...form, corpo: e.target.value })}
            />
            <p className="hint">In fondo si aggiungono da soli il link per non ricevere più l’avviso e la firma.</p>
          </div>
          {errore && <p className="avviso-errore" role="alert">{errore}</p>}
          <div className="dialogo-azioni">
            <button className="btn" type="submit" disabled={invio || !n}>
              {invio ? 'Invio in corso…' : `Invia a ${n} ${n === 1 ? 'iscritto' : 'iscritti'}`}
            </button>
            <button className="btn btn-ghost" type="button" disabled={invio} onClick={() => invia(true)}>
              Invia una prova a me
            </button>
            <button className="btn btn-text" type="button" disabled={invio} onClick={() => setAperto(false)}>
              Annulla
            </button>
          </div>
        </form>
      )}

      <DialogConferma
        aperto={conferma}
        titolo="Inviare l’avviso adesso?"
        confermaEtichetta={`Invia a ${n}`}
        occupato={invio}
        onConferma={() => { setConferma(false); invia(false) }}
        onAnnulla={() => setConferma(false)}
      >
        «{form.oggetto.trim()}» parte subito a {n} {n === 1 ? 'persona che ha' : 'persone che hanno'} chiesto
        l’avviso del prossimo ciclo, un’email per persona. Un’email inviata non si può ritirare.
      </DialogConferma>
    </section>
  )
}
