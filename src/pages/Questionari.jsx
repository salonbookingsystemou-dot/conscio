import { useState } from 'react'
import { supabase, supabaseConfigurato } from '../lib/supabaseClient'
import { calcolaPunteggi } from '../lib/scoring'
import ScalaLikert from '../components/ScalaLikert.jsx'
import Disclaimer from '../components/Disclaimer.jsx'

const TIMEPOINTS = [
  { id: 'T0', label: 'T0 — inizio percorso' },
  { id: 'T1', label: 'T1 — metà percorso' },
  { id: 'T2', label: 'T2 — fine percorso' },
  { id: 'T3', label: 'T3 — follow-up' }
]

const SOTTOSCALE_ETICHETTE = {
  osservare: 'Osservare',
  descrivere: 'Descrivere',
  agire_con_consapevolezza: 'Agire con consapevolezza',
  non_giudicare: 'Non giudicare',
  non_reagire: 'Non reagire'
}

function messaggioErrore(error) {
  const testo = error?.message || ''
  if (testo.includes('CODICE_NON_TROVATO')) return 'Codice non riconosciuto. Controlla e riprova.'
  if (testo.includes('COMPILAZIONE_GIA_PRESENTE')) return 'Hai già compilato i questionari per questo momento.'
  if (testo.includes('RISPOSTE_NON_VALIDE') || testo.includes('RISPOSTE_MANCANTI')) {
    return 'Alcune risposte non sono state registrate. Controlla di aver risposto a tutte le domande.'
  }
  return 'Si è verificato un errore. Riprova.'
}

function ordinaItem(righe) {
  const pss = righe.filter(i => i.scala === 'likert_0_4').sort((a, b) => a.ordine - b.ordine)
  const ffmq = righe.filter(i => i.scala === 'likert_1_5').sort((a, b) => a.ordine - b.ordine)
  return [...pss, ...ffmq]
}

export default function Questionari() {
  const [passo, setPasso] = useState('accesso')
  const [codice, setCodice] = useState('')
  const [timepoint, setTimepoint] = useState('T0')
  const [item, setItem] = useState([])
  const [indice, setIndice] = useState(0)
  const [risposte, setRisposte] = useState({})
  const [punteggi, setPunteggi] = useState(null)
  const [errore, setErrore] = useState(null)
  const [invio, setInvio] = useState(false)

  const corrente = item[indice]
  const nomeStrumento = corrente?.scala === 'likert_0_4' ? 'PSS-10' : 'FFMQ-I'
  const avanzamento = item.length ? Math.round(((indice + (risposte[corrente?.id] != null ? 1 : 0)) / item.length) * 100) : 0

  async function avviaCompilazione(e) {
    e.preventDefault()
    setErrore(null)
    setInvio(true)

    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      setInvio(false)
      return
    }

    const codicePulito = codice.trim()
    const { data: valido, error: errValido } = await supabase.rpc('codice_partecipante_valido', {
      p_codice: codicePulito
    })

    if (errValido || !valido) {
      setErrore(valido === false ? 'Codice non riconosciuto. Controlla e riprova.' : messaggioErrore(errValido))
      setInvio(false)
      return
    }

    const { data: gia, error: errGia } = await supabase.rpc('ha_compilato_timepoint', {
      p_codice: codicePulito,
      p_timepoint: timepoint
    })

    if (errGia) {
      setErrore(messaggioErrore(errGia))
      setInvio(false)
      return
    }
    if (gia) {
      setErrore(`Hai già compilato i questionari per ${timepoint}.`)
      setInvio(false)
      return
    }

    const { data: righe, error: errItem } = await supabase
      .from('item')
      .select('id, questionario_id, ordine, testo, scala, inverso, sottoscala, questionari(nome)')
      .order('ordine', { ascending: true })

    if (errItem || !righe?.length) {
      setErrore('I questionari non sono ancora disponibili. Riprova più tardi.')
      setInvio(false)
      return
    }

    setItem(ordinaItem(righe))
    setRisposte({})
    setIndice(0)
    setPasso('domanda')
    setInvio(false)
  }

  function rispondi(id, valore) {
    setRisposte(prev => ({ ...prev, [id]: valore }))
  }

  async function inviaTutto() {
    if (item.some(i => risposte[i.id] == null)) {
      setErrore('Rispondi a tutte le domande prima di inviare.')
      return
    }
    setErrore(null)
    setInvio(true)
    const payload = item.map(i => ({ item_id: i.id, valore: risposte[i.id] }))
    const { error } = await supabase.rpc('salva_risposte_questionario', {
      p_codice: codice.trim(),
      p_timepoint: timepoint,
      p_risposte: payload
    })
    if (error) {
      setErrore(messaggioErrore(error))
      setInvio(false)
      return
    }
    setPunteggi(calcolaPunteggi(item, risposte))
    setPasso('esito')
    setInvio(false)
  }

  if (passo === 'esito') {
    return (
      <div className="card">
        <h2>Compilazione registrata</h2>
        <p>
          Le risposte per <strong>{timepoint}</strong> sono associate al codice
        </p>
        <p className="codice-enfasi">{codice.trim().toUpperCase()}</p>
        {punteggi?.pss10 && (
          <p>PSS-10 — punteggio totale: <strong>{punteggi.pss10.totale}</strong> (range {punteggi.pss10.min}–{punteggi.pss10.max})</p>
        )}
        {punteggi?.ffmq && (
          <div>
            <p>FFMQ-I — punteggio totale: <strong>{punteggi.ffmq.totale}</strong> (range {punteggi.ffmq.min}–{punteggi.ffmq.max})</p>
            <ul>
              {Object.keys(SOTTOSCALE_ETICHETTE).map(chiave => (
                <li key={chiave}>{SOTTOSCALE_ETICHETTE[chiave]}: {punteggi.ffmq[chiave]}</li>
              ))}
            </ul>
          </div>
        )}
        <Disclaimer>
          Questi numeri descrivono le tue risposte in questo momento del percorso.
          Non sono una valutazione clinica e il percorso non sostituisce una presa in carico
          psicologica o terapeutica professionale.
        </Disclaimer>
      </div>
    )
  }

  if (passo === 'domanda' && corrente) {
    const ultima = indice === item.length - 1
    const haRisposta = risposte[corrente.id] != null
    return (
      <div>
        <p className="meta-riga">
          <span className="badge">{nomeStrumento}</span>
          <span>{codice.trim().toUpperCase()} · {timepoint}</span>
          <span>Domanda {indice + 1} di {item.length}</span>
        </p>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${Math.max(avanzamento, ((indice) / item.length) * 100)}%` }} />
        </div>
        <div className="card card-domanda">
          <ScalaLikert
            item={corrente}
            valore={risposte[corrente.id]}
            onChange={rispondi}
            disabilitato={invio}
          />
          {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
          <div className="azioni">
            <button
              className="btn btn-ghost"
              type="button"
              disabled={invio}
              onClick={() => {
                setErrore(null)
                if (indice === 0) setPasso('accesso')
                else setIndice(i => i - 1)
              }}
            >
              Precedente
            </button>
            {ultima ? (
              <button className="btn" type="button" disabled={!haRisposta || invio} onClick={inviaTutto}>
                {invio ? 'Invio in corso…' : 'Invia i questionari'}
              </button>
            ) : (
              <button
                className="btn"
                type="button"
                disabled={!haRisposta || invio}
                onClick={() => { setErrore(null); setIndice(i => i + 1) }}
              >
                Successiva
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="layout-due">
      <div>
        <h2>Questionari</h2>
        <Disclaimer />
        <div className="card">
          <p>
            Una domanda alla volta. PSS-10 e FFMQ-I si compilano a T0, T1, T2 e T3.
            Ti identifichi solo con il codice — mai con il nome.
          </p>
          <form onSubmit={avviaCompilazione}>
            <div className="field">
              <label htmlFor="codice">Codice partecipante</label>
              <input
                id="codice"
                value={codice}
                onChange={e => setCodice(e.target.value)}
                placeholder="es. MBSR-7K2Q"
                autoComplete="off"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="timepoint">Momento di misurazione</label>
              <select id="timepoint" value={timepoint} onChange={e => setTimepoint(e.target.value)}>
                {TIMEPOINTS.map(tp => (
                  <option key={tp.id} value={tp.id}>{tp.label}</option>
                ))}
              </select>
            </div>
            {timepoint === 'T3' && (
              <Disclaimer>
                T3 è il follow-up a distanza: è il momento più facile da dimenticare, e per il
                percorso è importante quanto gli altri.
              </Disclaimer>
            )}
            <button className="btn" type="submit" disabled={!codice.trim() || invio}>
              {invio ? 'Verifica in corso…' : `Inizia ${timepoint}`}
            </button>
            {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
          </form>
        </div>
      </div>
      <aside>
        <div className="card card-lato">
          <h3>Come funziona il codice</h3>
          <p>Le risposte restano legate al codice, non al nome. Conservalo come hai fatto all’iscrizione.</p>
          <p className="codice-esempio">MBSR-7K2Q</p>
        </div>
      </aside>
    </div>
  )
}
