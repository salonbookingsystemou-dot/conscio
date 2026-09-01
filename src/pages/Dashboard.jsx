import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { punteggioFfmq, punteggioPss10 } from '../lib/scoring'

const ESITI = [
  { id: 'in_attesa', label: 'in attesa' },
  { id: 'in_valutazione', label: 'in valutazione' },
  { id: 'idoneo', label: 'idoneo' },
  { id: 'da_ricontattare', label: 'da ricontattare' }
]

function aggregaPunteggi(righe) {
  const gruppi = {}
  for (const r of righe || []) {
    const chiave = `${r.codice_partecipante}|${r.timepoint}|${r.questionario}`
    if (!gruppi[chiave]) {
      gruppi[chiave] = {
        codice: r.codice_partecipante,
        timepoint: r.timepoint,
        questionario: r.questionario,
        item: []
      }
    }
    gruppi[chiave].item.push({ ordine: r.ordine, valore: r.valore })
  }
  return Object.values(gruppi).map(g => {
    const punteggio = g.questionario === 'PSS-10'
      ? punteggioPss10(g.item)
      : g.questionario === 'FFMQ-I'
        ? punteggioFfmq(g.item)
        : null
    return { ...g, punteggio }
  }).sort((a, b) => a.codice.localeCompare(b.codice) || a.timepoint.localeCompare(b.timepoint))
}

export default function Dashboard() {
  const [cicli, setCicli] = useState([])
  const [iscritti, setIscritti] = useState([])
  const [punteggi, setPunteggi] = useState([])
  const [log, setLog] = useState([])
  const [aperto, setAperto] = useState(null)
  const [mostraForm, setMostraForm] = useState(false)
  const [errore, setErrore] = useState(null)
  const [form, setForm] = useState({
    nome_ciclo: '',
    data_inizio: '',
    data_fine: '',
    posti_totali: 8,
    stato: 'reclutamento'
  })

  async function carica() {
    const [{ data: listaCicli }, { data: listaIscrizioni }, { data: risposte }, { data: pratica }] = await Promise.all([
      supabase.from('cicli').select('id, nome_ciclo, data_inizio, data_fine, stato, posti_totali, iscrizioni(count)').order('data_inizio', { ascending: false }),
      supabase.from('iscrizioni').select('id, esito_screening, ciclo_id, utenti(codice_partecipante, email, stato_screening)'),
      supabase.rpc('risposte_pseudonime'),
      supabase.rpc('log_pratica_pseudonimi')
    ])
    setCicli(listaCicli || [])
    setIscritti(listaIscrizioni || [])
    setPunteggi(aggregaPunteggi(risposte))
    setLog(pratica || [])
  }

  useEffect(() => { carica() }, [])

  async function creaCiclo(e) {
    e.preventDefault()
    setErrore(null)
    const { error } = await supabase.from('cicli').insert({
      nome_ciclo: form.nome_ciclo,
      data_inizio: form.data_inizio,
      data_fine: form.data_fine || null,
      posti_totali: Number(form.posti_totali) || 8,
      stato: form.stato
    })
    if (error) { setErrore('Non è stato possibile creare il ciclo.'); return }
    setForm({ nome_ciclo: '', data_inizio: '', data_fine: '', posti_totali: 8, stato: 'reclutamento' })
    setMostraForm(false)
    carica()
  }

  async function aggiornaEsito(iscrizione, esito) {
    await supabase.from('iscrizioni').update({ esito_screening: esito }).eq('id', iscrizione.id)
    if (iscrizione.utenti) {
      await supabase.from('utenti').update({ stato_screening: esito }).eq('codice_partecipante', iscrizione.utenti.codice_partecipante)
    }
    carica()
  }

  const cicloAperto = cicli.find(c => c.id === aperto)

  return (
    <div>
      <h2>Cicli</h2>
      <p className="lead">Stato delle edizioni, posti e accesso al dettaglio. Screening in linguaggio non clinico.</p>

      <div className="azioni" style={{ marginBottom: 16 }}>
        <button className="btn" type="button" onClick={() => setMostraForm(v => !v)}>
          {mostraForm ? 'Chiudi' : 'Nuovo ciclo'}
        </button>
      </div>

      {mostraForm && (
        <div className="card">
          <h3>Nuovo ciclo</h3>
          <form onSubmit={creaCiclo}>
            <div className="field">
              <label>Nome del ciclo</label>
              <input required value={form.nome_ciclo} onChange={e => setForm({ ...form, nome_ciclo: e.target.value })} />
            </div>
            <div className="riga-due">
              <div className="field">
                <label>Data di inizio</label>
                <input type="date" required value={form.data_inizio} onChange={e => setForm({ ...form, data_inizio: e.target.value })} />
              </div>
              <div className="field">
                <label>Data di fine</label>
                <input type="date" value={form.data_fine} onChange={e => setForm({ ...form, data_fine: e.target.value })} />
              </div>
            </div>
            <div className="riga-due">
              <div className="field">
                <label>Posti</label>
                <input type="number" min="1" max="8" value={form.posti_totali} onChange={e => setForm({ ...form, posti_totali: e.target.value })} />
              </div>
              <div className="field">
                <label>Stato</label>
                <select value={form.stato} onChange={e => setForm({ ...form, stato: e.target.value })}>
                  <option value="reclutamento">reclutamento</option>
                  <option value="attivo">attivo</option>
                  <option value="concluso">concluso</option>
                </select>
              </div>
            </div>
            <button className="btn" type="submit">Crea ciclo</button>
            {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
          </form>
        </div>
      )}

      <div className="griglia-cicli">
        {cicli.map(c => {
          const n = c.iscrizioni?.[0]?.count ?? 0
          return (
            <button
              key={c.id}
              type="button"
              className={`card card-click${aperto === c.id ? ' is-on' : ''}`}
              onClick={() => setAperto(aperto === c.id ? null : c.id)}
            >
              <h3>{c.nome_ciclo} <span className="badge">{c.stato}</span></h3>
              <p>Inizio {new Date(c.data_inizio).toLocaleDateString('it-IT')}</p>
              <p className="posti">{n} / {c.posti_totali} posti</p>
            </button>
          )
        })}
      </div>
      {cicli.length === 0 && <p>Nessun ciclo ancora creato.</p>}

      {cicloAperto && (
        <div className="card">
          <h3>Contatto operativo — {cicloAperto.nome_ciclo}</h3>
          {iscritti.filter(i => i.ciclo_id === cicloAperto.id).map(i => (
            <p key={i.id} className="riga-iscritto">
              <span>{i.utenti?.email}</span>
              <span className="badge">{i.utenti?.codice_partecipante}</span>
              <select value={i.esito_screening || 'in_attesa'} onChange={e => aggiornaEsito(i, e.target.value)}>
                {ESITI.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </p>
          ))}
          {iscritti.filter(i => i.ciclo_id === cicloAperto.id).length === 0 && <p>Nessuna iscrizione.</p>}
        </div>
      )}

      <div className="card">
        <h3>Dati di ricerca (solo codice)</h3>
        <p className="disclaimer">Questa sezione non mostra l’email. Numeri grezzi, senza interpretazione clinica.</p>
        {punteggi.length === 0 && <p>Nessuna compilazione ancora registrata.</p>}
        {punteggi.map(p => (
          <p key={`${p.codice}-${p.timepoint}-${p.questionario}`}>
            <span className="badge">{p.codice}</span>{' '}
            {p.timepoint} · {p.questionario}
            {p.punteggio?.totale != null && <> · totale {p.punteggio.totale}</>}
          </p>
        ))}
      </div>

      <div className="card">
        <h3>Log di pratica (solo codice)</h3>
        {log.length === 0 && <p>Nessun log ancora registrato.</p>}
        {log.map((l, idx) => (
          <p key={`${l.codice_partecipante}-${l.data}-${idx}`}>
            <span className="badge">{l.codice_partecipante}</span>{' '}
            {new Date(l.data).toLocaleDateString('it-IT')} · {l.durata_minuti} min
            {l.tipo ? ` · ${l.tipo}` : ''}
            {l.note ? ` — ${l.note}` : ''}
          </p>
        ))}
      </div>
    </div>
  )
}
