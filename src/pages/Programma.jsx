import { useState } from 'react'
import { supabase, supabaseConfigurato, leggiCodice, memorizzaCodice } from '../lib/supabaseClient'
import Disclaimer from '../components/Disclaimer.jsx'

function oggiISO() {
  return new Date().toISOString().slice(0, 10)
}

function etichettaTipo(tipo) {
  if (tipo === 'informale') return 'Informale'
  if (tipo === 'formale') return 'Formale'
  if (tipo === 'a_casa') return 'A casa'
  return tipo || 'Pratica'
}

function LogSottoEsercizio({ codice, esercizio, onSalvato }) {
  const informale = (esercizio.tipo || '').includes('informale')
  const [data, setData] = useState(oggiISO())
  const [minuti, setMinuti] = useState(informale ? 5 : 20)
  const [note, setNote] = useState('')
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState(null)
  const log = esercizio.log || []

  async function registra(e) {
    e.preventDefault()
    setErrore(null)
    setInvio(true)
    const { error } = await supabase.rpc('salva_log_pratica', {
      p_codice: codice.trim(),
      p_data: data,
      p_durata: Number(minuti),
      p_note: note.trim() || null,
      p_tipo: esercizio.tipo || null,
      p_esercizio_id: esercizio.id
    })
    if (error) {
      setErrore(error.message?.includes('CODICE_NON_TROVATO')
        ? 'Codice non riconosciuto.'
        : error.message?.includes('ESERCIZIO_NON_VALIDO')
          ? 'Questa pratica non appartiene al tuo ciclo.'
          : 'Non è stato possibile registrare la pratica.')
      setInvio(false)
      return
    }
    setNote('')
    setInvio(false)
    onSalvato()
  }

  return (
    <div className="pratica-blocco">
      <h4>
        <span className="badge">{etichettaTipo(esercizio.tipo)}</span>
        {' '}{esercizio.descrizione}
      </h4>
      {log.length === 0 && <p className="hint">Nessuna sessione ancora registrata per questa pratica.</p>}
      {log.map(riga => (
        <p className="log-riga" key={riga.id}>
          {new Date(riga.data).toLocaleDateString('it-IT')} · {riga.durata_minuti} min
          {riga.note ? ` — ${riga.note}` : ''}
        </p>
      ))}
      <form onSubmit={registra}>
        <div className="riga-due">
          <div className="field">
            <label>Data</label>
            <input type="date" required value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div className="field">
            <label>Minuti</label>
            <input
              type="number"
              min="1"
              max="240"
              required
              value={minuti}
              onChange={e => setMinuti(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label>{informale ? 'Cosa hai notato (facoltativo)' : 'Nota (facoltativa)'}</label>
          <textarea
            rows="2"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={informale ? 'Situazione, prima, dopo — se vuoi' : 'Cosa è sorto, come ti senti dopo — se vuoi'}
          />
        </div>
        <button className="btn" type="submit" disabled={invio}>
          {invio ? 'Salvataggio…' : 'Registra questa sessione'}
        </button>
        {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
      </form>
    </div>
  )
}

export default function Programma() {
  const [codice, setCodice] = useState(leggiCodice)
  const [lezioni, setLezioni] = useState([])
  const [settimana, setSettimana] = useState(null)
  const [errore, setErrore] = useState(null)
  const [invio, setInvio] = useState(false)
  const [aperto, setAperto] = useState(false)

  async function caricaProgramma(codicePulito) {
    const { data, error } = await supabase.rpc('programma_del_partecipante', {
      p_codice: codicePulito
    })
    if (error || !data) {
      setErrore(error?.message?.includes('CODICE_NON_TROVATO')
        ? 'Codice non riconosciuto.'
        : 'Non è stato possibile caricare il programma.')
      return false
    }
    const payload = typeof data === 'string' ? JSON.parse(data) : data
    setLezioni(payload.lezioni || [])
    setSettimana(prev => prev ?? payload.settimana_corrente)
    memorizzaCodice(codicePulito)
    setAperto(true)
    return true
  }

  async function handleCodice(e) {
    e.preventDefault()
    setErrore(null)
    setInvio(true)
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      setInvio(false)
      return
    }
    await caricaProgramma(codice.trim())
    setInvio(false)
  }

  const corrente = lezioni.find(l => l.numero_settimana === settimana) || lezioni[0]

  return (
    <div>
      <h2>Questa settimana</h2>
      <p className="lead">
        Tema e pratiche della settimana. Sotto ogni pratica registri la singola sessione:
        una riga per volta, solo con il codice.
      </p>
      <Disclaimer />

      <form className="card" onSubmit={handleCodice}>
        <div className="field">
          <label htmlFor="codice">Codice partecipante</label>
          <input
            id="codice"
            required
            value={codice}
            onChange={e => setCodice(e.target.value)}
            placeholder="es. MBSR-7K2Q"
            autoComplete="off"
          />
        </div>
        <button className="btn" type="submit" disabled={invio}>
          {invio ? 'Caricamento…' : aperto ? 'Aggiorna' : 'Mostra il programma'}
        </button>
        {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
      </form>

      {aperto && lezioni.length === 0 && (
        <p>Il programma di questa edizione non è ancora stato caricato.</p>
      )}

      {lezioni.length > 0 && (
        <>
          <div className="chip-riga">
            {lezioni.map(l => (
              <button
                key={l.id || l.numero_settimana}
                type="button"
                className={`chip${(corrente && l.numero_settimana === corrente.numero_settimana) ? ' is-on' : ''}`}
                onClick={() => setSettimana(l.numero_settimana)}
              >
                {l.numero_settimana === 9 ? 'Intensiva' : `Sett. ${l.numero_settimana}`}
              </button>
            ))}
          </div>
          {corrente && (
            <div className="card">
              <h3>
                {corrente.numero_settimana === 9 ? 'Giornata intensiva' : `Settimana ${corrente.numero_settimana}`}
                {corrente.tema ? ` — ${corrente.tema}` : ''}
              </h3>
              {corrente.pratiche_formali && <p><strong>Formali.</strong> {corrente.pratiche_formali}</p>}
              {corrente.pratiche_informali && <p><strong>Informali.</strong> {corrente.pratiche_informali}</p>}
              {corrente.materiali && <p><strong>Materiali.</strong> {corrente.materiali}</p>}
              {(corrente.esercizi || []).length === 0 && (
                <p className="hint">Nessuna pratica assegnata a questa settimana.</p>
              )}
              {(corrente.esercizi || []).map((ex, i) => (
                <LogSottoEsercizio
                  key={ex.id || i}
                  codice={codice}
                  esercizio={ex}
                  onSalvato={() => caricaProgramma(codice.trim())}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
