import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { punteggioFfmq, punteggioPss10 } from '../lib/scoring'
import GraficiTono from '../components/GraficiTono.jsx'
import { ElencoLog } from '../components/VoceLog.jsx'
import EditorSplash from '../components/EditorSplash.jsx'
import { EMAIL_CONTATTO, STRUMENTI } from '../lib/contatti.js'

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
    try {
      const risultati = await Promise.allSettled([
        supabase.rpc('separa_email_cicli_conclusi'),
        supabase
          .from('cicli')
          .select('id, nome_ciclo, data_inizio, data_fine, stato, posti_totali, iscrizioni(count)')
          .order('data_inizio', { ascending: false }),
        supabase
          .from('iscrizioni')
          .select('id, esito_screening, ciclo_id, utenti(codice_partecipante, email, stato_screening)'),
        supabase.rpc('risposte_pseudonime'),
        supabase.rpc('log_pratica_pseudonimi')
      ])

      const cicliRes = risultati[1]
      if (cicliRes.status === 'fulfilled') {
        const { data, error } = cicliRes.value
        if (error) {
          setErrore('Non è stato possibile caricare i cicli.')
        } else {
          setCicli(data || [])
          setAperto(prev => {
            if (prev && (data || []).some(c => c.id === prev)) return prev
            return (data && data[0]?.id) || null
          })
        }
      } else {
        setErrore('Non è stato possibile caricare i cicli.')
      }

      const iscrRes = risultati[2]
      if (iscrRes.status === 'fulfilled' && !iscrRes.value.error) {
        setIscritti(iscrRes.value.data || [])
      }

      const rispRes = risultati[3]
      if (rispRes.status === 'fulfilled' && !rispRes.value.error) {
        setPunteggi(aggregaPunteggi(rispRes.value.data))
      }

      const logRes = risultati[4]
      if (logRes.status === 'fulfilled' && !logRes.value.error) {
        setLog(logRes.value.data || [])
      }
    } catch {
      setErrore('Non è stato possibile aggiornare la dashboard.')
    }
  }

  useEffect(() => { carica() }, [])

  async function creaCiclo(e) {
    e.preventDefault()
    setErrore(null)
    const { data, error } = await supabase.from('cicli').insert({
      nome_ciclo: form.nome_ciclo.trim(),
      data_inizio: form.data_inizio,
      data_fine: form.data_fine || null,
      posti_totali: Number(form.posti_totali) || 8,
      stato: form.stato
    }).select('id, nome_ciclo, data_inizio, data_fine, stato, posti_totali').single()

    if (error || !data) {
      setErrore('Non è stato possibile creare il ciclo.')
      return
    }

    const nuovo = { ...data, iscrizioni: [{ count: 0 }] }
    setCicli(lista => {
      const senza = lista.filter(c => c.id !== nuovo.id)
      return [nuovo, ...senza].sort((a, b) => String(b.data_inizio).localeCompare(String(a.data_inizio)))
    })
    setAperto(nuovo.id)
    setForm({ nome_ciclo: '', data_inizio: '', data_fine: '', posti_totali: 8, stato: 'reclutamento' })
    setMostraForm(false)
    carica()
  }

  async function aggiornaCiclo(id, patch) {
    setErrore(null)
    const { error } = await supabase.from('cicli').update(patch).eq('id', id)
    if (error) {
      setErrore('Non è stato possibile aggiornare il ciclo.')
      return
    }
    await carica()
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
      `Cancellare ${iscrizione.utenti?.email || codice} (diritto all’oblio / uscita dal percorso)? ` +
      `Si cancellano anche risposte e log. Se era idonea, il posto si libera.`
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

      <div className="card">
        <h3>Uso dei dati e dei punteggi</h3>
        <p>
          I totali PSS-10 e FFMQ-I sono numeri grezzi sul range dello strumento.
          Non sono una valutazione clinica. Non usarli per triage, esclusione,
          «rischio» o consiglio terapeutico. Lo screening resta idoneo / in
          valutazione / da ricontattare.
        </p>
        <p className="hint">
          Richieste di accesso, correzione o cancellazione: {EMAIL_CONTATTO}, con il
          codice. Per cancellare un record usa «Rimuovi» qui sotto. Fonti:{' '}
          {STRUMENTI.map(s => s.nome).join(', ')}.
        </p>
        <p className="hint">
          <a href="#/documenti/uso-punteggi">Protocollo uso punteggi</a>
          {' · '}
          <a href="#/documenti/diritti">Procedura diritti</a>
        </p>
      </div>

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
          <h3>Stato del ciclo</h3>
          <p className="voce-log-settimana">{cicloAperto.nome_ciclo}</p>
          <div className="riga-due">
            <div className="field">
              <label htmlFor="ciclo-stato">Stato</label>
              <select
                id="ciclo-stato"
                value={cicloAperto.stato}
                onChange={e => aggiornaCiclo(cicloAperto.id, { stato: e.target.value })}
              >
                <option value="reclutamento">reclutamento</option>
                <option value="attivo">attivo</option>
                <option value="concluso">concluso</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="ciclo-inizio">Data di inizio</label>
              <input
                id="ciclo-inizio"
                type="date"
                value={String(cicloAperto.data_inizio).slice(0, 10)}
                onChange={e => aggiornaCiclo(cicloAperto.id, { data_inizio: e.target.value })}
              />
            </div>
          </div>
          <p className="hint">
            Prima della data di inizio i questionari mostrano che il ciclo non è partito;
            T0 resta comunque disponibile.
          </p>
        </div>
      )}

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
        <p className="disclaimer">
          Questa sezione non mostra l’email. Numeri grezzi sul range dello strumento,
          senza interpretazione clinica e senza uso per triage.
        </p>
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
