import { useState } from 'react'
import { supabase, supabaseConfigurato } from '../lib/supabaseClient'
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
  const [form, setForm] = useState({
    codice: '',
    data: oggiISO(),
    durata_minuti: 20,
    tipo: 'seduta',
    note: ''
  })
  const [stato, setStato] = useState(null)
  const [errore, setErrore] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setErrore(null)
    setStato('invio')
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      setStato(null)
      return
    }
    let { error } = await supabase.rpc('salva_log_pratica', {
      p_codice: form.codice.trim(),
      p_data: form.data,
      p_durata: Number(form.durata_minuti),
      p_note: form.note.trim() || null,
      p_tipo: form.tipo
    })
    if (error) {
      const nota = [form.tipo, form.note.trim()].filter(Boolean).join(' — ') || null
      ;({ error } = await supabase.rpc('salva_log_pratica', {
        p_codice: form.codice.trim(),
        p_data: form.data,
        p_durata: Number(form.durata_minuti),
        p_note: nota
      }))
    }
    if (error) {
      setErrore(error.message?.includes('CODICE_NON_TROVATO')
        ? 'Codice non riconosciuto. Controlla e riprova.'
        : 'Non è stato possibile registrare la pratica. Riprova.')
      setStato(null)
      return
    }
    setStato('ok')
  }

  if (stato === 'ok') {
    return (
      <div className="card card-conferma">
        <h2>Pratica registrata</h2>
        <p>Associata al codice</p>
        <p className="codice-enfasi">{form.codice.trim().toUpperCase()}</p>
        <button className="btn" type="button" onClick={() => {
          setForm({ ...form, data: oggiISO(), note: '' })
          setStato(null)
        }}>
          Un’altra pratica
        </button>
      </div>
    )
  }

  return (
    <div className="layout-due">
      <div>
        <h2>Log di pratica</h2>
        <p className="lead">Un minuto, senza formalità. Data, durata, tipo — e una nota solo se vuoi.</p>
        <Disclaimer />
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="codice">Codice partecipante</label>
              <input
                id="codice"
                required
                value={form.codice}
                onChange={e => setForm({ ...form, codice: e.target.value })}
                placeholder="es. MBSR-7K2Q"
                autoComplete="off"
              />
            </div>
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
            <button className="btn" type="submit" disabled={stato === 'invio'}>
              {stato === 'invio' ? 'Salvataggio…' : 'Registra'}
            </button>
            {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
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
