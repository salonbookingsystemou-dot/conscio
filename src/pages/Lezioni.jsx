import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const LEZIONE_VUOTA = {
  numero_settimana: 1,
  tema: '',
  pratiche_formali: '',
  pratiche_informali: '',
  materiali: ''
}

export default function Lezioni() {
  const [cicli, setCicli] = useState([])
  const [cicloId, setCicloId] = useState('')
  const [lezioni, setLezioni] = useState([])
  const [form, setForm] = useState(LEZIONE_VUOTA)
  const [modificaId, setModificaId] = useState(null)
  const [esercizio, setEsercizio] = useState({ lezione_id: '', tipo: 'a_casa', descrizione: '' })
  const [errore, setErrore] = useState(null)

  useEffect(() => {
    supabase.from('cicli').select('id, nome_ciclo, stato').order('data_inizio', { ascending: false })
      .then(({ data }) => {
        const lista = data || []
        setCicli(lista)
        if (lista[0] && !cicloId) setCicloId(lista[0].id)
      })
  }, [])

  async function caricaLezioni(id) {
    if (!id) { setLezioni([]); return }
    const { data } = await supabase
      .from('lezioni')
      .select('id, numero_settimana, tema, pratiche_formali, pratiche_informali, materiali, esercizi(id, tipo, descrizione)')
      .eq('ciclo_id', id)
      .order('numero_settimana', { ascending: true })
    setLezioni(data || [])
  }

  useEffect(() => { caricaLezioni(cicloId) }, [cicloId])

  async function salvaLezione(e) {
    e.preventDefault()
    setErrore(null)
    if (!cicloId) return
    const payload = { ...form, ciclo_id: cicloId, numero_settimana: Number(form.numero_settimana) }
    const { error } = modificaId
      ? await supabase.from('lezioni').update(payload).eq('id', modificaId)
      : await supabase.from('lezioni').insert(payload)
    if (error) { setErrore('Non è stato possibile salvare la lezione. Controlla che il numero settimana non sia già usato.'); return }
    setForm(LEZIONE_VUOTA)
    setModificaId(null)
    caricaLezioni(cicloId)
  }

  async function eliminaLezione(id) {
    if (!confirm('Eliminare questa lezione e i relativi esercizi?')) return
    await supabase.from('lezioni').delete().eq('id', id)
    caricaLezioni(cicloId)
  }

  async function aggiungiEsercizio(e) {
    e.preventDefault()
    if (!esercizio.lezione_id || !esercizio.descrizione.trim()) return
    await supabase.from('esercizi').insert({
      lezione_id: esercizio.lezione_id,
      tipo: esercizio.tipo,
      descrizione: esercizio.descrizione.trim()
    })
    setEsercizio({ lezione_id: esercizio.lezione_id, tipo: 'a_casa', descrizione: '' })
    caricaLezioni(cicloId)
  }

  async function eliminaEsercizio(id) {
    await supabase.from('esercizi').delete().eq('id', id)
    caricaLezioni(cicloId)
  }

  return (
    <div>
      <h2>Lezioni ed esercizi</h2>
      <p className="disclaimer">
        Ogni lezione corrisponde a una settimana del programma (1–8) o alla giornata intensiva (9).
        Qui raccogli tema, pratiche formali e informali, e le pratiche da fare a casa.
      </p>

      <div className="field">
        <label>Ciclo</label>
        <select value={cicloId} onChange={e => setCicloId(e.target.value)}>
          {cicli.length === 0 && <option value="">Nessun ciclo</option>}
          {cicli.map(c => <option key={c.id} value={c.id}>{c.nome_ciclo} ({c.stato})</option>)}
        </select>
      </div>

      <div className="card">
        <h3>{modificaId ? 'Modifica lezione' : 'Nuova lezione'}</h3>
        <form onSubmit={salvaLezione}>
          <div className="field">
            <label>Numero settimana (9 = giornata intensiva)</label>
            <input
              type="number"
              min="1"
              max="9"
              required
              value={form.numero_settimana}
              onChange={e => setForm({ ...form, numero_settimana: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Tema</label>
            <input value={form.tema} onChange={e => setForm({ ...form, tema: e.target.value })} />
          </div>
          <div className="field">
            <label>Pratiche formali</label>
            <textarea rows="3" value={form.pratiche_formali} onChange={e => setForm({ ...form, pratiche_formali: e.target.value })} />
          </div>
          <div className="field">
            <label>Pratiche informali</label>
            <textarea rows="3" value={form.pratiche_informali} onChange={e => setForm({ ...form, pratiche_informali: e.target.value })} />
          </div>
          <div className="field">
            <label>Materiali</label>
            <textarea rows="2" value={form.materiali} onChange={e => setForm({ ...form, materiali: e.target.value })} />
          </div>
          <div className="azioni">
            <button className="btn" type="submit">{modificaId ? 'Salva modifiche' : 'Aggiungi lezione'}</button>
            {modificaId && (
              <button className="btn btn-ghost" type="button" onClick={() => { setModificaId(null); setForm(LEZIONE_VUOTA) }}>
                Annulla
              </button>
            )}
          </div>
          {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
        </form>
      </div>

      {lezioni.map(l => (
        <div className="card" key={l.id}>
          <h3>
            {l.numero_settimana === 9 ? 'Giornata intensiva' : `Settimana ${l.numero_settimana}`}
            {l.tema ? ` — ${l.tema}` : ''}
          </h3>
          {l.pratiche_formali && <p><strong>Formali:</strong> {l.pratiche_formali}</p>}
          {l.pratiche_informali && <p><strong>Informali:</strong> {l.pratiche_informali}</p>}
          {l.materiali && <p><strong>Materiali:</strong> {l.materiali}</p>}
          <div className="azioni">
            <button className="btn btn-ghost" type="button" onClick={() => { setModificaId(l.id); setForm({
              numero_settimana: l.numero_settimana,
              tema: l.tema || '',
              pratiche_formali: l.pratiche_formali || '',
              pratiche_informali: l.pratiche_informali || '',
              materiali: l.materiali || ''
            }) }}>Modifica</button>
            <button className="btn btn-ghost" type="button" onClick={() => eliminaLezione(l.id)}>Elimina</button>
          </div>
          <h3>Pratiche a casa</h3>
          {(l.esercizi || []).map(ex => (
            <p key={ex.id}>
              <span className="badge">{ex.tipo}</span> {ex.descrizione}{' '}
              <button className="btn btn-ghost" type="button" onClick={() => eliminaEsercizio(ex.id)}>Rimuovi</button>
            </p>
          ))}
          <form onSubmit={aggiungiEsercizio}>
            <div className="field">
              <label>Tipo</label>
              <select
                value={esercizio.lezione_id === l.id ? esercizio.tipo : 'a_casa'}
                onChange={e => setEsercizio({ lezione_id: l.id, tipo: e.target.value, descrizione: esercizio.lezione_id === l.id ? esercizio.descrizione : '' })}
              >
                <option value="a_casa">a casa</option>
                <option value="formale">formale</option>
                <option value="informale">informale</option>
              </select>
            </div>
            <div className="field">
              <label>Descrizione della pratica</label>
              <input
                value={esercizio.lezione_id === l.id ? esercizio.descrizione : ''}
                onChange={e => setEsercizio({ lezione_id: l.id, tipo: esercizio.lezione_id === l.id ? esercizio.tipo : 'a_casa', descrizione: e.target.value })}
              />
            </div>
            <button className="btn" type="submit">Aggiungi pratica</button>
          </form>
        </div>
      ))}
      {cicloId && lezioni.length === 0 && <p>Nessuna lezione ancora configurata per questo ciclo.</p>}
    </div>
  )
}
