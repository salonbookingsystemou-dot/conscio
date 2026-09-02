import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const LEZIONE_VUOTA = {
  numero_settimana: 1,
  tema: '',
  sottotitolo: '',
  pratiche_formali: '',
  pratiche_informali: '',
  materiali: '',
  traccia_audio: ''
}

const AUDIO_MAX = 50 * 1024 * 1024

function estensioneAudio(nome) {
  const pezzo = (nome || '').split('.').pop()
  return (pezzo || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3'
}

export default function Lezioni() {
  const [cicli, setCicli] = useState([])
  const [cicloId, setCicloId] = useState('')
  const [lezioni, setLezioni] = useState([])
  const [form, setForm] = useState(LEZIONE_VUOTA)
  const [modificaId, setModificaId] = useState(null)
  const [esercizio, setEsercizio] = useState({ lezione_id: '', tipo: 'a_casa', descrizione: '' })
  const [fileAudio, setFileAudio] = useState(null)
  const [caricamentoAudio, setCaricamentoAudio] = useState(false)
  const [caricamentoEsercizioId, setCaricamentoEsercizioId] = useState(null)
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
      .select('id, numero_settimana, tema, sottotitolo, pratiche_formali, pratiche_informali, materiali, traccia_audio, esercizi(id, tipo, descrizione, traccia_audio, ordine, durata_minuti)')
      .eq('ciclo_id', id)
      .order('numero_settimana', { ascending: true })
    setLezioni((data || []).map(l => ({
      ...l,
      esercizi: [...(l.esercizi || [])].sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
    })))
  }

  useEffect(() => { caricaLezioni(cicloId) }, [cicloId])

  async function caricaTraccia(file, chiavePath) {
    if (file.size > AUDIO_MAX) {
      throw new Error('AUDIO_TROPPO_GRANDE')
    }
    const path = `${cicloId}/${chiavePath}-${Date.now()}.${estensioneAudio(file.name)}`
    const { error } = await supabase.storage.from('tracce-audio').upload(path, file, {
      upsert: false,
      contentType: file.type || 'audio/mpeg'
    })
    if (error) throw error
    const { data } = supabase.storage.from('tracce-audio').getPublicUrl(path)
    return data.publicUrl
  }

  async function salvaLezione(e) {
    e.preventDefault()
    setErrore(null)
    if (!cicloId) return
    setCaricamentoAudio(Boolean(fileAudio))
    let traccia = form.traccia_audio || null
    try {
      if (fileAudio) {
        traccia = await caricaTraccia(fileAudio, `s${form.numero_settimana}`)
      }
    } catch (err) {
      setCaricamentoAudio(false)
      setErrore(err?.message === 'AUDIO_TROPPO_GRANDE'
        ? 'La traccia deve pesare al massimo 50 MB.'
        : 'Non è stato possibile caricare la traccia audio.')
      return
    }
    const payload = {
      ciclo_id: cicloId,
      numero_settimana: Number(form.numero_settimana),
      tema: form.tema,
      sottotitolo: form.sottotitolo || null,
      pratiche_formali: form.pratiche_formali,
      pratiche_informali: form.pratiche_informali,
      materiali: form.materiali,
      traccia_audio: traccia
    }
    const { error } = modificaId
      ? await supabase.from('lezioni').update(payload).eq('id', modificaId)
      : await supabase.from('lezioni').insert(payload)
    setCaricamentoAudio(false)
    if (error) { setErrore('Non è stato possibile salvare la lezione. Controlla che il numero settimana non sia già usato.'); return }
    setForm(LEZIONE_VUOTA)
    setFileAudio(null)
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

  async function caricaTracciaEsercizio(esercizioId, settimana, file) {
    if (!file) return
    setErrore(null)
    setCaricamentoEsercizioId(esercizioId)
    try {
      const url = await caricaTraccia(file, `s${settimana}-ex-${esercizioId.slice(0, 8)}`)
      const { error } = await supabase.from('esercizi').update({ traccia_audio: url }).eq('id', esercizioId)
      if (error) throw error
      await caricaLezioni(cicloId)
    } catch (err) {
      setErrore(err?.message === 'AUDIO_TROPPO_GRANDE'
        ? 'La traccia deve pesare al massimo 50 MB.'
        : 'Non è stato possibile caricare la traccia sull’esercizio.')
    } finally {
      setCaricamentoEsercizioId(null)
    }
  }

  async function rimuoviTracciaEsercizio(esercizioId) {
    await supabase.from('esercizi').update({ traccia_audio: null }).eq('id', esercizioId)
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
            <label>Sottotitolo (facoltativo)</label>
            <input
              value={form.sottotitolo}
              onChange={e => setForm({ ...form, sottotitolo: e.target.value })}
              placeholder="Breve riga sotto il tema"
            />
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
          <div className="field">
            <label htmlFor="traccia">Traccia audio (facoltativa)</label>
            <input
              id="traccia"
              type="file"
              accept="audio/*"
              onChange={e => setFileAudio(e.target.files?.[0] || null)}
            />
            <p className="hint">MP3, WAV o M4A, massimo 50 MB. Serve per la pratica guidata di questa settimana.</p>
            {fileAudio && <p className="hint">Nuovo file: {fileAudio.name}</p>}
            {!fileAudio && form.traccia_audio && (
              <p>
                <audio className="player-audio" controls src={form.traccia_audio} preload="metadata">
                  Il browser non riproduce questa traccia.
                </audio>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setForm({ ...form, traccia_audio: '' })}
                >
                  Rimuovi traccia
                </button>
              </p>
            )}
          </div>
          <div className="azioni">
            <button className="btn" type="submit" disabled={caricamentoAudio}>
              {caricamentoAudio ? 'Caricamento audio…' : modificaId ? 'Salva modifiche' : 'Aggiungi lezione'}
            </button>
            {modificaId && (
              <button className="btn btn-ghost" type="button" onClick={() => { setModificaId(null); setForm(LEZIONE_VUOTA); setFileAudio(null) }}>
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
          {l.traccia_audio && (
            <p>
              <strong>Traccia audio</strong>
              <audio className="player-audio" controls src={l.traccia_audio} preload="metadata">
                Il browser non riproduce questa traccia.
              </audio>
            </p>
          )}
          <div className="azioni">
            <button className="btn btn-ghost" type="button" onClick={() => { setModificaId(l.id); setFileAudio(null); setForm({
              numero_settimana: l.numero_settimana,
              tema: l.tema || '',
              sottotitolo: l.sottotitolo || '',
              pratiche_formali: l.pratiche_formali || '',
              pratiche_informali: l.pratiche_informali || '',
              materiali: l.materiali || '',
              traccia_audio: l.traccia_audio || ''
            }) }}>Modifica</button>
            <button className="btn btn-ghost" type="button" onClick={() => eliminaLezione(l.id)}>Elimina</button>
          </div>
          <h3>Pratiche a casa</h3>
          {(l.esercizi || []).map(ex => (
            <div className="esercizio-riga" key={ex.id}>
              <p>
                <span className="badge">{ex.tipo}</span> {ex.descrizione}{' '}
                <button className="btn btn-ghost" type="button" onClick={() => eliminaEsercizio(ex.id)}>Rimuovi</button>
              </p>
              {(ex.tipo === 'formale' || ex.tipo === 'a_casa') && (
                <div className="field">
                  <label htmlFor={`audio-ex-${ex.id}`}>Traccia audio di questa pratica</label>
                  <input
                    id={`audio-ex-${ex.id}`}
                    type="file"
                    accept="audio/*"
                    disabled={caricamentoEsercizioId === ex.id}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      caricaTracciaEsercizio(ex.id, l.numero_settimana, file)
                    }}
                  />
                  {caricamentoEsercizioId === ex.id && <p className="hint">Caricamento…</p>}
                  {ex.traccia_audio && (
                    <p>
                      <audio className="player-audio" controls src={ex.traccia_audio} preload="metadata">
                        Il browser non riproduce questa traccia.
                      </audio>
                      <button className="btn btn-ghost" type="button" onClick={() => rimuoviTracciaEsercizio(ex.id)}>
                        Rimuovi traccia
                      </button>
                    </p>
                  )}
                </div>
              )}
            </div>
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
