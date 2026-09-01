import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigurato, leggiCodice, memorizzaCodice } from '../lib/supabaseClient'
import Disclaimer from '../components/Disclaimer.jsx'

const TIPI = [
  { id: 'body_scan', label: 'Body scan' },
  { id: 'seduta', label: 'Meditazione seduta' },
  { id: 'yoga', label: 'Yoga consapevole' },
  { id: 'informale', label: 'Pratica informale' },
  { id: 'altro', label: 'Altro' }
]

function oggiISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function LogPratica() {
  const [codice, setCodice] = useState(leggiCodice)
  const [form, setForm] = useState({
    data: oggiISO(),
    durata_minuti: 20,
    tipo: 'seduta',
    note: ''
  })
  const [storico, setStorico] = useState([])
  const [stato, setStato] = useState(null)
  const [errore, setErrore] = useState(null)
  const [caricato, setCaricato] = useState(false)

  async function caricaStorico(codicePulito) {
    const { data, error } = await supabase.rpc('log_pratica_del_partecipante', {
      p_codice: codicePulito
    })
    if (error) return false
    setStorico(data || [])
    setCaricato(true)
    memorizzaCodice(codicePulito)
    return true
  }

  async function handleStorico(e) {
    e.preventDefault()
    setErrore(null)
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      return
    }
    const ok = await caricaStorico(codice.trim())
    if (!ok) setErrore('Codice non riconosciuto, oppure non è stato possibile caricare lo storico.')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrore(null)
    setStato('invio')
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      setStato(null)
      return
    }
    const { error } = await supabase.rpc('salva_log_pratica', {
      p_codice: codice.trim(),
      p_data: form.data,
      p_durata: Number(form.durata_minuti),
      p_note: form.note.trim() || null,
      p_tipo: form.tipo
    })
    if (error) {
      setErrore(error.message?.includes('CODICE_NON_TROVATO')
        ? 'Codice non riconosciuto. Controlla e riprova.'
        : 'Non è stato possibile registrare la pratica. Riprova.')
      setStato(null)
      return
    }
    setForm({ ...form, note: '' })
    setStato('ok')
    await caricaStorico(codice.trim())
  }

  return (
    <div className="layout-due">
      <div>
        <h2>Storico di pratica</h2>
        <p className="lead">
          Il diario della settimana sta in{' '}
          <Link to="/programma">Settimana</Link>, sotto ogni pratica.
          Qui vedi tutte le sessioni e puoi registrare qualcosa fuori programma.
        </p>
        <Disclaimer />

        <form className="card" onSubmit={handleStorico}>
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
          <button className="btn" type="submit">Mostra lo storico</button>
          {errore && !stato && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
        </form>

        {caricato && (
          <div className="card">
            <h3>Le tue sessioni</h3>
            {storico.length === 0 && <p>Nessuna sessione ancora registrata.</p>}
            {storico.map(riga => (
              <p className="log-riga" key={riga.id}>
                {new Date(riga.data).toLocaleDateString('it-IT')} · {riga.durata_minuti} min
                {riga.numero_settimana ? ` · sett. ${riga.numero_settimana}` : ''}
                {riga.esercizio ? ` — ${riga.esercizio}` : riga.tipo ? ` · ${riga.tipo}` : ''}
                {riga.note ? ` — ${riga.note}` : ''}
              </p>
            ))}
          </div>
        )}

        <div className="card">
          <h3>Fuori programma</h3>
          <p className="hint">Solo se la pratica non corrisponde a un esercizio della settimana.</p>
          <form onSubmit={handleSubmit}>
            <div className="riga-due">
              <div className="field">
                <label htmlFor="data">Data</label>
                <input id="data" type="date" required value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="durata">Minuti</label>
                <input
                  id="durata"
                  type="number"
                  min="1"
                  max="240"
                  required
                  value={form.durata_minuti}
                  onChange={e => setForm({ ...form, durata_minuti: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>Tipo di pratica</label>
              <div className="chip-riga">
                {TIPI.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`chip${form.tipo === t.id ? ' is-on' : ''}`}
                    onClick={() => setForm({ ...form, tipo: t.id })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="note">Nota (facoltativa)</label>
              <textarea id="note" rows="2" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
            <button className="btn" type="submit" disabled={stato === 'invio' || !codice.trim()}>
              {stato === 'invio' ? 'Salvataggio…' : 'Registra'}
            </button>
            {stato === 'ok' && <p>Sessione registrata.</p>}
            {errore && stato && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
          </form>
        </div>
      </div>
      <aside>
        <div className="card card-lato">
          <h3>Come funziona il codice</h3>
          <p>Il log non porta il tuo nome. Solo il codice.</p>
          <p className="codice-esempio">MBSR-7K2Q</p>
        </div>
      </aside>
    </div>
  )
}
