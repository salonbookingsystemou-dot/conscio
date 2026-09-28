import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabaseConfigurato } from '../lib/supabaseClient'
import { usePartecipante } from '../lib/partecipante.jsx'
import { EMAIL_CONTATTO } from '../lib/contatti.js'
import {
  daiConsensoCheckin,
  leggiCheckin,
  messaggioErroreCheckin,
  NOTA_MAX,
  OSTACOLI,
  PRESENZA,
  salvaCheckin
} from '../lib/checkin.js'
import ChiediCodice from '../components/ChiediCodice.jsx'
import StatoAttesa from '../components/StatoAttesa.jsx'

function etichettaSettimana(n) {
  return n === 9 ? 'Settimana intensiva' : `Settimana ${n}`
}

function Cursore({ titolo, valore, onChange, minimo, massimo, disabilitato }) {
  const id = useId()
  const vuoto = valore == null
  return (
    <div className="checkin-domanda">
      <label className="checkin-domanda-titolo" htmlFor={id}>{titolo}</label>
      <div className={`checkin-cursore${vuoto ? ' is-vuoto' : ''}`}>
        <input
          id={id}
          type="range"
          min="0"
          max="10"
          step="1"
          value={vuoto ? 5 : valore}
          disabled={disabilitato}
          aria-valuetext={vuoto ? 'nessuna risposta' : `${valore} su 10`}
          onChange={e => onChange(Number(e.target.value))}
          onClick={e => onChange(Number(e.currentTarget.value))}
        />
        <div className="checkin-cursore-estremi" aria-hidden="true">
          <span>{minimo}</span>
          <strong>{vuoto ? '—' : valore}</strong>
          <span>{massimo}</span>
        </div>
      </div>
      {vuoto && <p className="hint">Tocca o sposta il cursore.</p>}
    </div>
  )
}

function Consenso({ codice, onDato }) {
  const [spuntato, setSpuntato] = useState(false)
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState(null)
  const casellaId = useId()

  async function conferma() {
    if (!spuntato || invio) return
    setErrore(null)
    setInvio(true)
    const { error } = await daiConsensoCheckin(codice)
    setInvio(false)
    if (error) {
      setErrore(messaggioErroreCheckin(error))
      return
    }
    onDato()
  }

  return (
    <div className="checkin">
      <h2>Il check-in della settimana</h2>
      <p className="lead">
        Una volta a settimana, un minuto per dire com’è andata. Prima della prima volta
        ti chiediamo un consenso a parte.
      </p>
      <div className="card checkin-card">
        <h3>Cosa raccogliamo</h3>
        <ul>
          <li>quanto stress hai sentito e come hai dormito;</li>
          <li>quanto spesso ti sei accorto di essere presente durante la giornata;</li>
          <li>cosa ti ha reso difficile praticare;</li>
          <li>
            se hai vissuto momenti difficili durante la pratica ed eventuale nota: la legge
            solo Dimitri, per poterti contattare, e non entra in nessuna pubblicazione.
          </li>
        </ul>
        <p>
          Alcune risposte descrivono come stai: sono dati sulla salute. Restano legate al tuo
          codice partecipante, non al nome, e servono al percorso e allo studio pilota.
        </p>
        <p className="hint">
          Il check-in è facoltativo e non cambia nulla nella tua partecipazione. Puoi revocare
          il consenso scrivendo a {EMAIL_CONTATTO} e cancellare i check-in da{' '}
          <Link to="/dati">I tuoi dati</Link>. Dettagli nell’
          <Link to="/documenti/informativa">informativa</Link>.
        </p>
        <label className="checkin-consenso" htmlFor={casellaId}>
          <input
            id={casellaId}
            type="checkbox"
            checked={spuntato}
            disabled={invio}
            onChange={e => setSpuntato(e.target.checked)}
          />
          <span>
            Acconsento al trattamento delle risposte del check-in settimanale, comprese quelle
            sul mio stato di salute, per il percorso e lo studio pilota.
          </span>
        </label>
        {errore && <p className="campo-errore" role="alert">{errore}</p>}
        <div className="azioni">
          <button className="btn btn-avanti" type="button" disabled={!spuntato || invio} onClick={conferma}>
            {invio ? 'Salvataggio…' : 'Acconsento e continua'}
          </button>
          <Link className="btn btn-ghost" to="/programma">Non ora</Link>
        </div>
      </div>
    </div>
  )
}

function Grazie({ segnalazione, settimana }) {
  return (
    <div className="checkin">
      <p className="badge badge-settimana">{etichettaSettimana(settimana)}</p>
      <h2>Check-in salvato</h2>
      {segnalazione ? (
        <div className="checkin-segnalazione" role="status">
          <p>Grazie per averlo condiviso. Dimitri ti contatterà nei prossimi giorni.</p>
          <p>
            Nel frattempo, se una pratica ti mette a disagio puoi fermarti, aprire gli occhi
            o passare a una versione più breve.
          </p>
          <p>
            Se ti senti in difficoltà adesso, parlane con il tuo medico. In caso di emergenza
            chiama il 112.
          </p>
        </div>
      ) : (
        <p className="lead">
          Grazie. Puoi modificarlo fino alla fine della settimana.
        </p>
      )}
      <div className="azioni">
        <Link className="btn btn-avanti" to="/programma">Torna alla settimana</Link>
      </div>
    </div>
  )
}

export default function Checkin() {
  const { codice, registrato } = usePartecipante()
  const [stato, setStato] = useState(null)
  const [caricamento, setCaricamento] = useState(true)
  const [stress, setStress] = useState(null)
  const [sonno, setSonno] = useState(null)
  const [presenza, setPresenza] = useState(null)
  const [ostacoli, setOstacoli] = useState([])
  const [difficile, setDifficile] = useState(null)
  const [nota, setNota] = useState('')
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState(null)
  const [salvato, setSalvato] = useState(null)
  const notaId = useId()
  const difficileId = useId()
  const presenzaId = useId()
  const ostacoliId = useId()

  useEffect(() => {
    if (!registrato || !codice) return undefined
    let attivo = true
    setCaricamento(true)
    setErrore(null)
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      setCaricamento(false)
      return undefined
    }
    leggiCheckin(codice).then(({ stato: letto, error }) => {
      if (!attivo) return
      if (error || !letto) {
        setErrore(messaggioErroreCheckin(error))
      } else {
        setStato(letto)
        const k = letto.checkin
        if (k) {
          setStress(k.stress ?? null)
          setSonno(k.sonno ?? null)
          setPresenza(k.presenza_quotidiana ?? null)
          setOstacoli(k.ostacoli || [])
          setDifficile(k.esperienza_difficile ?? null)
          setNota(k.nota_difficile || '')
        }
      }
      setCaricamento(false)
    })
    return () => { attivo = false }
  }, [registrato, codice])

  function toggleOstacolo(id) {
    setOstacoli(prev => (prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]))
  }

  const completo = stress != null && sonno != null && presenza != null && difficile != null

  async function invia(e) {
    e.preventDefault()
    if (!completo || invio) return
    setErrore(null)
    setInvio(true)
    const { esito, error } = await salvaCheckin(codice, {
      stress,
      sonno,
      presenza,
      ostacoli,
      difficile,
      nota: nota.trim()
    })
    setInvio(false)
    if (error || !esito?.ok) {
      setErrore(messaggioErroreCheckin(error))
      return
    }
    setSalvato({ segnalazione: Boolean(esito.segnalazione), settimana: esito.settimana })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!registrato) {
    return (
      <div>
        <h2>Il check-in della settimana</h2>
        <ChiediCodice titolo="Per compilare il check-in, inserisci il codice partecipante." />
      </div>
    )
  }

  if (caricamento) return <StatoAttesa etichetta="Caricamento del check-in…" />

  if (salvato) return <Grazie segnalazione={salvato.segnalazione} settimana={salvato.settimana} />

  if (!stato?.aperto) {
    return (
      <div className="checkin">
        <h2>Il check-in della settimana</h2>
        {errore
          ? <p className="campo-errore" role="alert">{errore}</p>
          : (
            <p className="lead">
              Il check-in si apre con la settimana 1 del percorso e resta disponibile fino
              a una settimana dopo la fine.
            </p>
          )}
        <div className="azioni">
          <Link className="btn btn-ghost" to="/programma">Torna alla settimana</Link>
        </div>
      </div>
    )
  }

  if (!stato.consenso) {
    return <Consenso codice={codice} onDato={() => setStato(s => ({ ...s, consenso: true }))} />
  }

  return (
    <form className="checkin" onSubmit={invia}>
      <p className="badge badge-settimana">{etichettaSettimana(stato.settimana)}</p>
      <h2>Il check-in della settimana</h2>
      <p className="lead">
        Un minuto per guardare com’è andata. Non ci sono risposte giuste.
        {stato.compilato ? ' L’hai già compilato: puoi modificarlo fino alla fine della settimana.' : ''}
      </p>

      <div className="card checkin-card">
        <Cursore
          titolo="Quanto stress hai sentito questa settimana?"
          valore={stress}
          onChange={setStress}
          minimo="per niente"
          massimo="moltissimo"
          disabilitato={invio}
        />

        <Cursore
          titolo="Come hai dormito questa settimana?"
          valore={sonno}
          onChange={setSonno}
          minimo="molto male"
          massimo="molto bene"
          disabilitato={invio}
        />

        <div className="checkin-domanda">
          <p className="checkin-domanda-titolo" id={presenzaId}>
            Quante volte ti sei accorto di essere presente durante la giornata, fuori dalle pratiche?
          </p>
          <div className="checkin-scelte" role="radiogroup" aria-labelledby={presenzaId}>
            {PRESENZA.map(o => (
              <button
                key={o.valore}
                type="button"
                role="radio"
                aria-checked={presenza === o.valore}
                className={`likert-btn${presenza === o.valore ? ' is-on' : ''}`}
                disabled={invio}
                onClick={() => setPresenza(o.valore)}
              >
                <span className="likert-lab">{o.etichetta}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="checkin-domanda">
          <p className="checkin-domanda-titolo" id={ostacoliId}>Cosa ti ha reso difficile praticare?</p>
          <p className="hint">Facoltativo. Puoi scegliere più risposte.</p>
          <div className="chip-riga" role="group" aria-labelledby={ostacoliId}>
            {OSTACOLI.map(o => {
              const on = ostacoli.includes(o.id)
              return (
                <button
                  key={o.id}
                  type="button"
                  className={`chip${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  disabled={invio}
                  onClick={() => toggleOstacolo(o.id)}
                >
                  {o.etichetta}
                </button>
              )
            })}
          </div>
        </div>

        <div className="checkin-domanda">
          <p className="checkin-domanda-titolo" id={difficileId}>
            Durante la pratica hai vissuto momenti particolarmente difficili o che ti hanno turbato?
          </p>
          <div className="checkin-scelte is-due" role="radiogroup" aria-labelledby={difficileId}>
            {[{ v: true, l: 'Sì' }, { v: false, l: 'No' }].map(o => (
              <button
                key={o.l}
                type="button"
                role="radio"
                aria-checked={difficile === o.v}
                className={`likert-btn${difficile === o.v ? ' is-on' : ''}`}
                disabled={invio}
                onClick={() => setDifficile(o.v)}
              >
                <span className="likert-lab">{o.l}</span>
              </button>
            ))}
          </div>
          {difficile && (
            <div className="field checkin-nota">
              <label htmlFor={notaId}>
                Se vuoi, racconta brevemente cosa è successo. Lo leggerà solo Dimitri.
              </label>
              <textarea
                id={notaId}
                rows={4}
                maxLength={NOTA_MAX}
                value={nota}
                disabled={invio}
                onChange={e => setNota(e.target.value)}
              />
              <p className="hint">{nota.length} / {NOTA_MAX}</p>
            </div>
          )}
        </div>

        {errore && <p className="campo-errore" role="alert">{errore}</p>}
        <div className="azioni">
          <button className="btn btn-avanti" type="submit" disabled={!completo || invio}>
            {invio ? 'Salvataggio…' : stato.compilato ? 'Aggiorna il check-in' : 'Salva il check-in'}
          </button>
          <Link className="btn btn-ghost" to="/programma">Annulla</Link>
        </div>
        {!completo && (
          <p className="hint">Rispondi a stress, sonno, presenza e all’ultima domanda per salvare.</p>
        )}
      </div>
    </form>
  )
}
