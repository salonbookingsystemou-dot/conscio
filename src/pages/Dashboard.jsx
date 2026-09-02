import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { punteggioFfmq, punteggioPss10 } from '../lib/scoring'
import GraficiTono from '../components/GraficiTono.jsx'
import { ElencoLog } from '../components/VoceLog.jsx'
import EditorSplash from '../components/EditorSplash.jsx'

const ESITI = [
  { id: 'in_attesa', label: 'In attesa' },
  { id: 'in_valutazione', label: 'In valutazione' },
  { id: 'idoneo', label: 'Idoneo' },
  { id: 'da_ricontattare', label: 'Da ricontattare' }
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
    const [, { data: listaCicli }, { data: listaIscrizioni }, { data: risposte }, { data: pratica }] = await Promise.all([
      supabase.rpc('separa_email_cicli_conclusi').catch(() => ({ data: null })),
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

  function eIdoneo(iscrizione) {
    return iscrizione.esito_screening === 'idoneo' || iscrizione.utenti?.stato_screening === 'idoneo'
  }

  function contaIdonei(cicloId) {
    return iscritti.filter(i => i.ciclo_id === cicloId && eIdoneo(i)).length
  }

  async function aggiornaEsito(iscrizione, esito) {
    setErrore(null)
    const { error } = await supabase.rpc('imposta_esito_screening', {
      p_iscrizione_id: iscrizione.id,
      p_esito: esito
    })
    if (error?.message?.includes('POSTI_IDONEI_PIENI')) {
      setErrore('I posti idonei di questo ciclo sono già al completo.')
      return
    }
    if (error) {
      setErrore('Non è stato possibile aggiornare l’esito.')
      return
    }
    carica()
  }

  async function eliminaIscritto(iscrizione) {
    const codice = iscrizione.utenti?.codice_partecipante
    if (!codice) return
    const ok = window.confirm(
      `Rimuovere ${iscrizione.utenti?.email || codice} dal ciclo? Se era idonea, il posto si libera.`
    )
    if (!ok) return
    setErrore(null)
    const { error } = await supabase.rpc('elimina_partecipante', { p_codice: codice })
    if (error) {
      setErrore('Non è stato possibile rimuovere questa persona.')
      return
    }
    carica()
  }

  const cicloAperto = cicli.find(c => c.id === aperto)
  const logVista = useMemo(() => {
    if (!aperto) return log
    const codici = new Set(
      iscritti
        .filter(i => i.ciclo_id === aperto)
        .map(i => i.utenti?.codice_partecipante)
        .filter(Boolean)
    )
    return log.filter(l => codici.has(l.codice_partecipante))
  }, [log, aperto, iscritti])

  return (
    <div>
      <EditorSplash />

      <h2>Cicli</h2>
      <p className="lead">
        Stato delle edizioni e accesso al dettaglio. Occupano un posto solo le persone
        idonee; le altre restano in screening. Screening in linguaggio non clinico.
      </p>
      {errore && <p className="hint hint-errore">{errore}</p>}

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
          const idonei = contaIdonei(c.id)
          const inScreening = iscritti.filter(i => i.ciclo_id === c.id && !eIdoneo(i)).length
          return (
            <button
              key={c.id}
              type="button"
              className={`card card-click${aperto === c.id ? ' is-on' : ''}`}
              onClick={() => setAperto(aperto === c.id ? null : c.id)}
            >
              <h3>{c.nome_ciclo} <span className="badge">{c.stato}</span></h3>
              <p>Inizio {new Date(c.data_inizio).toLocaleDateString('it-IT')}</p>
              <p className="posti">{idonei} / {c.posti_totali} posti idonei</p>
              {inScreening > 0 && (
                <p className="hint">{inScreening} in screening, non occupano un posto</p>
              )}
            </button>
          )
        })}
      </div>
      {cicli.length === 0 && <p>Nessun ciclo ancora creato.</p>}

      {cicloAperto && (
        <div className="card">
          <h3>Contatto operativo</h3>
          <p className="voce-log-settimana">{cicloAperto.nome_ciclo}</p>
          <p className="hint">L’email serve solo al contatto. Nei dati di ricerca resta il codice.</p>
          {iscritti.filter(i => i.ciclo_id === cicloAperto.id).length === 0 && <p>Nessuna iscrizione.</p>}
          <div className="elenco-iscritti">
            {iscritti.filter(i => i.ciclo_id === cicloAperto.id).map(i => (
              <article key={i.id} className="voce-iscritto">
                <header className="voce-iscritto-testata">
                  <span className="badge">{i.utenti?.codice_partecipante || '—'}</span>
                </header>
                <p className="voce-iscritto-email">{i.utenti?.email || 'Nessuna email'}</p>
                <div className="voce-iscritto-azioni">
                  <label className="voce-iscritto-esito">
                    <span>Screening</span>
                    <select
                      value={i.esito_screening || 'in_attesa'}
                      onChange={e => aggiornaEsito(i, e.target.value)}
                    >
                      {ESITI.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn-elimina"
                    onClick={() => eliminaIscritto(i)}
                  >
                    Rimuovi
                  </button>
                </div>
              </article>
            ))}
          </div>
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

      <GraficiTono sessioni={logVista} ambito={cicloAperto?.nome_ciclo} />

      <div className="card">
        <h3>Log di pratica (solo codice)</h3>
        {logVista.length === 0 && <p>Nessun log ancora registrato.</p>}
        <ElencoLog righe={logVista} raggruppaCodice />
      </div>
    </div>
  )
}
