import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { punteggioFfmq, punteggioPss10 } from '../lib/scoring'
import GraficiTono from '../components/GraficiTono.jsx'
import { ElencoLog } from '../components/VoceLog.jsx'
import EditorSplash from '../components/EditorSplash.jsx'
import { EMAIL_CONTATTO, STRUMENTI } from '../lib/contatti.js'
import { addDays, formatISODate, oggiLocaleISO, parseISODate } from '../lib/date.js'

const ESITI = [
  { id: 'in_attesa', label: 'In attesa' },
  { id: 'in_valutazione', label: 'In valutazione' },
  { id: 'idoneo', label: 'Idoneo' },
  { id: 'da_ricontattare', label: 'Da ricontattare' }
]

const TAB = [
  { id: 'cicli', label: 'Cicli' },
  { id: 'questionari', label: 'Questionari' },
  { id: 'pratica', label: 'Pratica' },
  { id: 'sito', label: 'Sito' }
]

const MESI_CORTI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

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

function eIdoneo(iscrizione) {
  return iscrizione.esito_screening === 'idoneo' || iscrizione.utenti?.stato_screening === 'idoneo'
}

function etichettaPeriodo(inizioIso, fineIso) {
  const inizio = parseISODate(inizioIso)
  if (!inizio) return '—'
  const fine = parseISODate(fineIso) || addDays(inizio, 62)
  const a = `${inizio.getDate()} ${MESI_CORTI[inizio.getMonth()]}`
  const b = `${fine.getDate()} ${MESI_CORTI[fine.getMonth()]} ${fine.getFullYear()}`
  return `${a} — ${b}`
}

function settimanaCiclo(inizioIso) {
  const inizio = parseISODate(inizioIso)
  if (!inizio) return 0
  const oggi = parseISODate(oggiLocaleISO())
  if (oggi < inizio) return 0
  return Math.max(1, Math.min(9, Math.floor((oggi - inizio) / (7 * 24 * 60 * 60 * 1000)) + 1))
}

function etichettaAvanzamento(ciclo) {
  const sett = settimanaCiclo(ciclo.data_inizio)
  if (ciclo.stato === 'concluso') return { testo: 'Completato', pct: 100, tono: 'chiuso' }
  if (sett === 0) {
    const inizio = parseISODate(ciclo.data_inizio)
    const oggi = parseISODate(oggiLocaleISO())
    const giorni = inizio && oggi ? Math.ceil((inizio - oggi) / (24 * 60 * 60 * 1000)) : null
    const settimane = giorni != null ? Math.max(1, Math.ceil(giorni / 7)) : null
    return {
      testo: settimane != null ? `Inizio tra ${settimane} settiman${settimane === 1 ? 'a' : 'e'}` : 'In partenza',
      pct: 4,
      tono: 'attesa'
    }
  }
  if (sett >= 9) return { testo: 'Settimana intensiva / fine', pct: 95, tono: 'attivo' }
  return {
    testo: `Settimana ${sett} di 8`,
    pct: Math.round((sett / 8) * 100),
    tono: 'attivo'
  }
}

function etichettaStato(stato) {
  if (stato === 'reclutamento') return 'in reclutamento'
  return stato
}

export default function Dashboard() {
  const tabsId = useId()
  const [tab, setTab] = useState('cicli')
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
            return null
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
    setTab('cicli')
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

  async function eliminaCiclo(ciclo) {
    const nome = ciclo?.nome_ciclo || 'questo ciclo'
    const iscrittiCiclo = iscritti.filter(i => i.ciclo_id === ciclo.id).length
    const avvisoIscritti = iscrittiCiclo > 0
      ? ` Ci sono ${iscrittiCiclo} iscrizioni collegate: verranno eliminate insieme al ciclo.`
      : ''
    if (!confirm(
      `Eliminare «${nome}»?`
      + ' Si cancellano anche settimane, pratiche, comunicazioni e iscrizioni di questa edizione.'
      + avvisoIscritti
      + ' I questionari e i log restano legati al codice partecipante.'
    )) return

    setErrore(null)
    const { error } = await supabase.from('cicli').delete().eq('id', ciclo.id)
    if (error) {
      setErrore('Non è stato possibile eliminare il ciclo.')
      return
    }
    setAperto(prev => (prev === ciclo.id ? null : prev))
    setCicli(lista => lista.filter(c => c.id !== ciclo.id))
    await carica()
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

  const kpi = useMemo(() => {
    const attivi = iscritti.filter(i => eIdoneo(i)).length
    const inAttesa = iscritti.filter(i => !eIdoneo(i)).length
    const idoneiCodici = new Set(
      iscritti.filter(eIdoneo).map(i => i.utenti?.codice_partecipante).filter(Boolean)
    )
    const conT2 = new Set(
      punteggi.filter(p => p.timepoint === 'T2').map(p => p.codice)
    )
    const t2Fatti = [...idoneiCodici].filter(c => conT2.has(c)).length
    const t2Attesi = idoneiCodici.size
    const soglia = addDays(parseISODate(oggiLocaleISO()), -7)
    const log7 = log.filter(l => {
      const d = parseISODate(l.data)
      return d && soglia && d >= soglia
    }).length
    return { attivi, inAttesa, t2Fatti, t2Attesi, log7 }
  }, [iscritti, punteggi, log])

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

  const punteggiVista = useMemo(() => {
    if (!aperto) return punteggi
    const codici = new Set(
      iscritti
        .filter(i => i.ciclo_id === aperto)
        .map(i => i.utenti?.codice_partecipante)
        .filter(Boolean)
    )
    if (codici.size === 0) return punteggi
    return punteggi.filter(p => codici.has(p.codice))
  }, [punteggi, aperto, iscritti])

  function esportaAggregati() {
    const payload = {
      esportato_il: new Date().toISOString(),
      ciclo: cicloAperto?.nome_ciclo || null,
      kpi,
      punteggi: punteggiVista.map(p => ({
        codice: p.codice,
        timepoint: p.timepoint,
        questionario: p.questionario,
        totale: p.punteggio?.totale ?? null
      })),
      log_n: logVista.length
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conscio-aggregati-${formatISODate(new Date())}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="dash">
      <div
        className="dash-tabs"
        role="tablist"
        aria-label="Sezioni area facilitatore"
      >
        {TAB.map(t => {
          const selezionata = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${tabsId}-${t.id}`}
              aria-selected={selezionata}
              aria-controls={`${tabsId}-panel-${t.id}`}
              tabIndex={selezionata ? 0 : -1}
              className={`dash-tab${selezionata ? ' is-on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {errore && <p className="hint hint-errore">{errore}</p>}

      {tab === 'cicli' && (
        <div
          className="dash-panel"
          role="tabpanel"
          id={`${tabsId}-panel-cicli`}
          aria-labelledby={`${tabsId}-cicli`}
        >
          {!cicloAperto && (
            <>
              <header className="dash-panel-testa">
                <div>
                  <h2>Cicli</h2>
                  <p className="lead">
                    Edizioni del percorso, iscrizioni e avanzamento delle settimane.
                  </p>
                </div>
                <div className="dash-panel-azioni">
                  <button className="btn btn-ghost" type="button" onClick={esportaAggregati}>
                    Esporta dati aggregati
                  </button>
                  <button className="btn" type="button" onClick={() => setMostraForm(v => !v)}>
                    {mostraForm ? 'Chiudi' : 'Nuovo ciclo'}
                  </button>
                </div>
              </header>

              <div className="dash-kpi">
                <article className="dash-kpi-card">
                  <p className="dash-kpi-label">Partecipanti attivi</p>
                  <p className="dash-kpi-valore">{kpi.attivi}</p>
                </article>
                <article className="dash-kpi-card">
                  <p className="dash-kpi-label">Iscrizioni in attesa</p>
                  <p className="dash-kpi-valore is-attenzione">{kpi.inAttesa}</p>
                </article>
                <article className="dash-kpi-card">
                  <p className="dash-kpi-label">Questionari T2</p>
                  <p className="dash-kpi-valore">
                    {kpi.t2Attesi === 0 ? '—' : `${kpi.t2Fatti} su ${kpi.t2Attesi}`}
                  </p>
                </article>
                <article className="dash-kpi-card">
                  <p className="dash-kpi-label">Log pratica · 7 gg</p>
                  <p className="dash-kpi-valore">
                    {kpi.log7 === 0 ? '0' : `${kpi.log7} session${kpi.log7 === 1 ? 'e' : 'i'}`}
                  </p>
                </article>
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
                  </form>
                </div>
              )}

              <div className="dash-tabella card">
                <div className="dash-tabella-testata" aria-hidden="true">
                  <span>Ciclo</span>
                  <span>Stato</span>
                  <span>Iscritti</span>
                  <span>Avanzamento</span>
                  <span />
                </div>
                {cicli.length === 0 && (
                  <p className="dash-tabella-vuoto">Nessun ciclo ancora creato.</p>
                )}
                {cicli.map(c => {
                  const idonei = contaIdonei(c.id)
                  const posti = c.posti_totali || 8
                  const pctPosti = Math.min(100, Math.round((idonei / posti) * 100))
                  const avanzamento = etichettaAvanzamento(c)
                  return (
                    <article key={c.id} className="dash-riga-ciclo">
                      <div className="dash-riga-ciclo-nome">
                        <strong>{c.nome_ciclo}</strong>
                        <span className="hint">{etichettaPeriodo(c.data_inizio, c.data_fine)}</span>
                      </div>
                      <div>
                        <span className={`badge badge-stato is-${c.stato}`}>
                          {etichettaStato(c.stato)}
                        </span>
                      </div>
                      <div className="dash-riga-progresso">
                        <span>{idonei} / {posti} posti</span>
                        <span className="dash-barra" aria-hidden="true">
                          <span className="dash-barra-fill is-posti" style={{ width: `${pctPosti}%` }} />
                        </span>
                      </div>
                      <div className="dash-riga-progresso">
                        <span>{avanzamento.testo}</span>
                        <span className="dash-barra" aria-hidden="true">
                          <span
                            className={`dash-barra-fill is-${avanzamento.tono}`}
                            style={{ width: `${avanzamento.pct}%` }}
                          />
                        </span>
                      </div>
                      <div className="dash-riga-azioni">
                        <button
                          type="button"
                          className={`btn${c.stato === 'reclutamento' ? '' : ' btn-ghost'}`}
                          onClick={() => setAperto(c.id)}
                        >
                          Apri
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>

              <p className="dash-nota-privacy">
                Le risposte ai questionari sono consultabili solo in forma aggregata e per codice
                partecipante. Nessuna schermata associa un codice a un nome.
              </p>
            </>
          )}

          {cicloAperto && (
            <>
              <header className="dash-panel-testa">
                <div>
                  <button
                    type="button"
                    className="link-testuale dash-indietro"
                    onClick={() => setAperto(null)}
                  >
                    ← Tutti i cicli
                  </button>
                  <h2>{cicloAperto.nome_ciclo}</h2>
                  <p className="lead">
                    {etichettaPeriodo(cicloAperto.data_inizio, cicloAperto.data_fine)}
                    {' · '}
                    <span className={`badge badge-stato is-${cicloAperto.stato}`}>
                      {etichettaStato(cicloAperto.stato)}
                    </span>
                  </p>
                </div>
                <div className="dash-panel-azioni">
                  <Link className="btn btn-ghost" to="/lezioni">Lezioni</Link>
                  <button
                    type="button"
                    className="btn btn-ghost btn-ciclo-elimina"
                    onClick={() => eliminaCiclo(cicloAperto)}
                  >
                    Elimina ciclo
                  </button>
                </div>
              </header>

              <div className="card">
                <h3>Stato del ciclo</h3>
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

              <div className="card">
                <h3>Iscrizioni e screening</h3>
                <p className="hint">L’email serve solo al contatto. Nei dati di ricerca resta il codice.</p>
                {iscritti.filter(i => i.ciclo_id === cicloAperto.id).length === 0 && (
                  <p>Nessuna iscrizione.</p>
                )}
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
            </>
          )}
        </div>
      )}

      {tab === 'questionari' && (
        <div
          className="dash-panel"
          role="tabpanel"
          id={`${tabsId}-panel-questionari`}
          aria-labelledby={`${tabsId}-questionari`}
        >
          <header className="dash-panel-testa">
            <div>
              <h2>Questionari</h2>
              <p className="lead">
                Totali grezzi per codice, senza interpretazione clinica.
                {cicloAperto ? ` Filtro: «${cicloAperto.nome_ciclo}».` : ' Tutti i cicli.'}
              </p>
            </div>
            <div className="dash-panel-azioni">
              <button className="btn btn-ghost" type="button" onClick={esportaAggregati}>
                Esporta aggregati
              </button>
            </div>
          </header>
          <div className="card">
            {punteggiVista.length === 0 && <p>Nessuna compilazione ancora registrata.</p>}
            {punteggiVista.map(p => (
              <p key={`${p.codice}-${p.timepoint}-${p.questionario}`}>
                <span className="badge">{p.codice}</span>{' '}
                {p.timepoint} · {p.questionario}
                {p.punteggio?.totale != null && <> · totale {p.punteggio.totale}</>}
              </p>
            ))}
          </div>
          <p className="dash-nota-privacy">
            Le risposte ai questionari sono consultabili solo in forma aggregata e per codice
            partecipante. Nessuna schermata associa un codice a un nome.
          </p>
        </div>
      )}

      {tab === 'pratica' && (
        <div
          className="dash-panel"
          role="tabpanel"
          id={`${tabsId}-panel-pratica`}
          aria-labelledby={`${tabsId}-pratica`}
        >
          <header className="dash-panel-testa">
            <div>
              <h2>Pratica</h2>
              <p className="lead">
                Tono e log
                {cicloAperto ? ` per «${cicloAperto.nome_ciclo}»` : ' di tutti i cicli'}
                , solo per codice.
              </p>
            </div>
          </header>
          {!cicloAperto && cicli.length > 0 && (
            <p className="hint">
              Per filtrare un’edizione, apri un ciclo dalla scheda Cicli.
            </p>
          )}
          <GraficiTono sessioni={logVista} ambito={cicloAperto?.nome_ciclo} />
          <div className="card">
            <h3>Log di pratica</h3>
            {logVista.length === 0 && <p>Nessun log ancora registrato.</p>}
            <ElencoLog righe={logVista} raggruppaCodice />
          </div>
        </div>
      )}

      {tab === 'sito' && (
        <div
          className="dash-panel"
          role="tabpanel"
          id={`${tabsId}-panel-sito`}
          aria-labelledby={`${tabsId}-sito`}
        >
          <header className="dash-panel-testa">
            <div>
              <h2>Sito</h2>
              <p className="lead">Frase di apertura e limiti d’uso dei dati.</p>
            </div>
          </header>
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
              codice. Per cancellare un record usa «Rimuovi» nel dettaglio del ciclo. Fonti:{' '}
              {STRUMENTI.map(s => s.nome).join(', ')}.
            </p>
            <p className="hint">
              <a href="#/documenti/uso-punteggi">Protocollo uso punteggi</a>
              {' · '}
              <a href="#/documenti/diritti">Procedura diritti</a>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
