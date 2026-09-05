import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { punteggioFfmq, punteggioPss10 } from '../lib/scoring'
import GraficiTono from '../components/GraficiTono.jsx'
import EditorSplash from '../components/EditorSplash.jsx'
import DialogConferma from '../components/DialogConferma.jsx'
import { EMAIL_CONTATTO, STRUMENTI } from '../lib/contatti.js'
import { addDays, formatISODate, oggiLocaleISO, parseISODate } from '../lib/date.js'

const ESITI = [
  { id: 'in_attesa', label: 'In attesa' },
  { id: 'in_valutazione', label: 'In valutazione' },
  { id: 'idoneo', label: 'Idoneo' },
  { id: 'da_ricontattare', label: 'Da ricontattare' }
]

const MODALITA = [
  { id: 'presenza', label: 'In presenza' },
  { id: 'remoto', label: 'Da remoto' }
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

function eRemoto(iscrizione) {
  return (iscrizione.modalita_fruizione || 'presenza') === 'remoto'
}

function linkIncontroValido(valore) {
  const pulito = String(valore || '').trim()
  if (!pulito) return null
  return /^https:\/\//i.test(pulito) ? pulito : false
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
  const [dialogo, setDialogo] = useState(null)
  const [form, setForm] = useState({
    nome_ciclo: '',
    data_inizio: '',
    data_fine: '',
    posti_totali: 8,
    stato: 'reclutamento'
  })
  const [linkIncontro, setLinkIncontro] = useState('')

  async function carica() {
    try {
      const risultati = await Promise.allSettled([
        supabase.rpc('separa_email_cicli_conclusi'),
        supabase
          .from('cicli')
          .select('id, nome_ciclo, data_inizio, data_fine, stato, posti_totali, link_incontro, iscrizioni(count)')
          .order('data_inizio', { ascending: false }),
        supabase
          .from('iscrizioni')
          .select('id, esito_screening, modalita_fruizione, ciclo_id, utenti(codice_partecipante, email, stato_screening)'),
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
    }).select('id, nome_ciclo, data_inizio, data_fine, stato, posti_totali, link_incontro').single()

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

  function eliminaCiclo(ciclo) {
    const nome = ciclo?.nome_ciclo || 'questo ciclo'
    const iscrittiCiclo = iscritti.filter(i => i.ciclo_id === ciclo.id).length
    const avvisoIscritti = iscrittiCiclo > 0
      ? ` Ci sono ${iscrittiCiclo} iscrizioni collegate: verranno eliminate insieme al ciclo.`
      : ''
    setDialogo({
      titolo: `Eliminare «${nome}»?`,
      testo: 'Si cancellano anche settimane, pratiche, comunicazioni e iscrizioni di questa edizione.'
        + avvisoIscritti
        + ' I questionari e i log restano legati al codice partecipante.',
      etichetta: 'Elimina ciclo',
      onOk: async () => {
        setErrore(null)
        const { error } = await supabase.from('cicli').delete().eq('id', ciclo.id)
        setDialogo(null)
        if (error) {
          setErrore('Non è stato possibile eliminare il ciclo.')
          return
        }
        setAperto(prev => (prev === ciclo.id ? null : prev))
        setCicli(lista => lista.filter(c => c.id !== ciclo.id))
        await carica()
      }
    })
  }

  function contaIdoneiPresenza(cicloId) {
    return iscritti.filter(i => i.ciclo_id === cicloId && eIdoneo(i) && !eRemoto(i)).length
  }

  function contaIdoneiRemoti(cicloId) {
    return iscritti.filter(i => i.ciclo_id === cicloId && eIdoneo(i) && eRemoto(i)).length
  }

  function messaggioPostiPieni() {
    return 'I posti in presenza di questo ciclo sono già al completo. Puoi ancora segnare la persona come da remoto.'
  }

  async function aggiornaEsito(iscrizione, esito) {
    setErrore(null)
    const { error } = await supabase.rpc('imposta_esito_screening', {
      p_iscrizione_id: iscrizione.id,
      p_esito: esito
    })
    if (error?.message?.includes('POSTI_IDONEI_PIENI')) {
      setErrore(messaggioPostiPieni())
      return
    }
    if (error) {
      setErrore('Non è stato possibile aggiornare l’esito.')
      return
    }
    carica()
  }

  async function aggiornaModalita(iscrizione, modalita) {
    setErrore(null)
    const { error } = await supabase.rpc('imposta_modalita_fruizione', {
      p_iscrizione_id: iscrizione.id,
      p_modalita: modalita
    })
    if (error?.message?.includes('POSTI_IDONEI_PIENI')) {
      setErrore(messaggioPostiPieni())
      return
    }
    if (error?.message?.includes('CICLO_MANCANTE')) {
      setErrore('Per passare in presenza collega prima questa iscrizione a un ciclo.')
      return
    }
    if (error) {
      setErrore('Non è stato possibile aggiornare la modalità di fruizione.')
      return
    }
    carica()
  }

  async function assegnaACiclo(iscrizione, cicloId) {
    if (!cicloId) return
    setErrore(null)
    const { error } = await supabase.rpc('assegna_iscrizione_a_ciclo', {
      p_iscrizione_id: iscrizione.id,
      p_ciclo_id: cicloId
    })
    if (error) {
      setErrore('Non è stato possibile collegare questa iscrizione a un ciclo.')
      return
    }
    carica()
  }

  async function salvaLinkIncontro() {
    if (!cicloAperto) return
    const valido = linkIncontroValido(linkIncontro)
    if (valido === false) {
      setErrore('Il link dell’incontro deve iniziare con https://')
      return
    }
    setErrore(null)
    await aggiornaCiclo(cicloAperto.id, { link_incontro: valido })
  }

  function eliminaIscritto(iscrizione) {
    const codice = iscrizione.utenti?.codice_partecipante
    if (!codice) return
    setDialogo({
      titolo: 'Cancellare questa persona?',
      testo: `Cancellare ${iscrizione.utenti?.email || codice} (diritto all’oblio / uscita dal percorso)? `
        + 'Si cancellano anche risposte e log. Se era idonea, il posto si libera.',
      etichetta: 'Rimuovi dal percorso',
      onOk: async () => {
        setErrore(null)
        const { error } = await supabase.rpc('elimina_partecipante', { p_codice: codice })
        setDialogo(null)
        if (error) {
          setErrore('Non è stato possibile rimuovere questa persona.')
          return
        }
        carica()
      }
    })
  }

  const cicloAperto = cicli.find(c => c.id === aperto)

  useEffect(() => {
    setLinkIncontro(cicloAperto?.link_incontro || '')
  }, [cicloAperto?.id, cicloAperto?.link_incontro])

  const iscrittiCiclo = useMemo(
    () => (aperto ? iscritti.filter(i => i.ciclo_id === aperto) : []),
    [iscritti, aperto]
  )
  const iscrittiRemotiLiberi = useMemo(
    () => iscritti.filter(i => !i.ciclo_id),
    [iscritti]
  )
  const sintesiCiclo = useMemo(() => {
    if (!cicloAperto) return null
    const idoneiPresenza = iscrittiCiclo.filter(i => eIdoneo(i) && !eRemoto(i)).length
    const idoneiRemoti = iscrittiCiclo.filter(i => eIdoneo(i) && eRemoto(i)).length
    const idonei = idoneiPresenza + idoneiRemoti
    const inAttesa = iscrittiCiclo.length - idonei
    const posti = cicloAperto.posti_totali || 8
    const avanzamento = etichettaAvanzamento(cicloAperto)
    return {
      idonei,
      idoneiPresenza,
      idoneiRemoti,
      inAttesa,
      posti,
      pctPosti: Math.min(100, Math.round((idoneiPresenza / posti) * 100)),
      avanzamento
    }
  }, [cicloAperto, iscrittiCiclo])

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
                        <label>Posti in presenza</label>
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
                  const idoneiPresenza = contaIdoneiPresenza(c.id)
                  const remoti = contaIdoneiRemoti(c.id)
                  const posti = c.posti_totali || 8
                  const pctPosti = Math.min(100, Math.round((idoneiPresenza / posti) * 100))
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
                        <span>
                          {idoneiPresenza} / {posti} in presenza
                          {remoti > 0 ? ` · ${remoti} remot${remoti === 1 ? 'o' : 'i'}` : ''}
                        </span>
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

              <section className="dash-ciclo-sezione" aria-labelledby="remoti-liberi-titolo">
                <header className="dash-ciclo-sezione-testa">
                  <div>
                    <h3 id="remoti-liberi-titolo">
                      Solo da remoto
                      <span className="dash-ciclo-conteggio">{iscrittiRemotiLiberi.length}</span>
                    </h3>
                    <p className="hint">
                      Usano le stesse settimane del ciclo in presenza, con un orologio personale:
                      dopo il T0 si apre la settimana 1, le successive partono dal primo ascolto.
                      Non occupano posti in aula.
                    </p>
                  </div>
                </header>
                {iscrittiRemotiLiberi.length === 0 ? (
                  <div className="dash-ciclo-vuoto" role="status">
                    <p>Nessuna iscrizione solo remota.</p>
                  </div>
                ) : (
                  <ul className="dash-iscrizioni">
                    {iscrittiRemotiLiberi.map(i => (
                      <li key={i.id} className="dash-iscrizione is-libera">
                        <div className="dash-iscrizione-persona">
                          <span className="badge">{i.utenti?.codice_partecipante || '—'}</span>
                          <span className="badge badge-modalita is-remoto">remoto</span>
                          <span className="dash-iscrizione-email">
                            {i.utenti?.email || 'Nessuna email'}
                          </span>
                        </div>
                        <label className="dash-iscrizione-esito">
                          <select
                            value={i.esito_screening || 'in_attesa'}
                            onChange={e => aggiornaEsito(i, e.target.value)}
                            aria-label={`Screening ${i.utenti?.codice_partecipante || ''}`}
                          >
                            {ESITI.map(e => (
                              <option key={e.id} value={e.id}>{e.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="dash-iscrizione-esito">
                          <select
                            defaultValue=""
                            onChange={e => assegnaACiclo(i, e.target.value)}
                            aria-label={`Collega ${i.utenti?.codice_partecipante || ''} a un ciclo`}
                          >
                            <option value="">Collega a un ciclo…</option>
                            {cicli.map(c => (
                              <option key={c.id} value={c.id}>{c.nome_ciclo}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="btn-elimina"
                          onClick={() => eliminaIscritto(i)}
                        >
                          Rimuovi
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <p className="dash-nota-privacy">
                Le risposte ai questionari sono consultabili solo in forma aggregata e per codice
                partecipante. Nessuna schermata associa un codice a un nome.
              </p>
            </>
          )}

          {cicloAperto && sintesiCiclo && (
              <div className="dash-ciclo">
                <button
                  type="button"
                  className="link-testuale dash-ciclo-indietro"
                  onClick={() => setAperto(null)}
                >
                  ← Tutti i cicli
                </button>

                <header className="dash-ciclo-hero">
                  <div className="dash-ciclo-hero-testo">
                    <div className="dash-ciclo-titolo">
                      <h2>{cicloAperto.nome_ciclo}</h2>
                      <span className={`badge badge-stato is-${cicloAperto.stato}`}>
                        {etichettaStato(cicloAperto.stato)}
                      </span>
                    </div>
                    <p className="dash-ciclo-meta">
                      {etichettaPeriodo(cicloAperto.data_inizio, cicloAperto.data_fine)}
                      <span aria-hidden="true"> · </span>
                      {sintesiCiclo.avanzamento.testo}
                    </p>
                  </div>
                  <Link className="btn btn-avanti" to="/lezioni">Apri Lezioni</Link>
                </header>

                <div className="dash-ciclo-stats" aria-label="Sintesi del ciclo">
                  <div className="dash-ciclo-stat">
                    <span className="dash-ciclo-stat-label">In presenza</span>
                    <strong className="dash-ciclo-stat-valore">
                      {sintesiCiclo.idoneiPresenza} / {sintesiCiclo.posti}
                    </strong>
                    <span className="dash-barra" aria-hidden="true">
                      <span
                        className="dash-barra-fill is-posti"
                        style={{ width: `${sintesiCiclo.pctPosti}%` }}
                      />
                    </span>
                  </div>
                  <div className="dash-ciclo-stat">
                    <span className="dash-ciclo-stat-label">Da remoto</span>
                    <strong className="dash-ciclo-stat-valore">
                      {sintesiCiclo.idoneiRemoti}
                    </strong>
                  </div>
                  <div className="dash-ciclo-stat">
                    <span className="dash-ciclo-stat-label">In attesa</span>
                    <strong className={`dash-ciclo-stat-valore${sintesiCiclo.inAttesa > 0 ? ' is-attenzione' : ''}`}>
                      {sintesiCiclo.inAttesa}
                    </strong>
                  </div>
                  <div className="dash-ciclo-stat">
                    <span className="dash-ciclo-stat-label">Avanzamento</span>
                    <strong className="dash-ciclo-stat-valore dash-ciclo-stat-valore-sm">
                      {sintesiCiclo.avanzamento.testo}
                    </strong>
                    <span className="dash-barra" aria-hidden="true">
                      <span
                        className={`dash-barra-fill is-${sintesiCiclo.avanzamento.tono}`}
                        style={{ width: `${sintesiCiclo.avanzamento.pct}%` }}
                      />
                    </span>
                  </div>
                </div>

                <section className="dash-ciclo-sezione" aria-labelledby="ciclo-impostazioni-titolo">
                  <header className="dash-ciclo-sezione-testa">
                    <div>
                      <h3 id="ciclo-impostazioni-titolo">Date e stato</h3>
                      <p className="hint">
                        Prima dell’inizio i questionari segnalano che il ciclo non è partito; T0 resta disponibile.
                        Senza data di fine si usano circa 9 settimane dall’inizio.
                        Il link dell’incontro è visibile solo a chi fruisce da remoto.
                      </p>
                    </div>
                  </header>
                  <div className="dash-ciclo-campi">
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
                    <div className="field">
                      <label htmlFor="ciclo-fine">Data di fine</label>
                      <input
                        id="ciclo-fine"
                        type="date"
                        value={cicloAperto.data_fine ? String(cicloAperto.data_fine).slice(0, 10) : ''}
                        min={String(cicloAperto.data_inizio).slice(0, 10)}
                        onChange={e => aggiornaCiclo(cicloAperto.id, {
                          data_fine: e.target.value || null
                        })}
                      />
                    </div>
                    <div className="field dash-ciclo-campo-largo">
                      <label htmlFor="ciclo-link">Link incontro remoto</label>
                      <div className="dash-ciclo-link">
                        <input
                          id="ciclo-link"
                          type="url"
                          inputMode="url"
                          placeholder="https://…"
                          value={linkIncontro}
                          onChange={e => setLinkIncontro(e.target.value)}
                          onBlur={salvaLinkIncontro}
                        />
                        <button type="button" className="btn btn-ghost" onClick={salvaLinkIncontro}>
                          Salva
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="dash-ciclo-sezione" aria-labelledby="ciclo-iscrizioni-titolo">
                  <header className="dash-ciclo-sezione-testa">
                    <div>
                      <h3 id="ciclo-iscrizioni-titolo">
                        Iscrizioni
                        <span className="dash-ciclo-conteggio">{iscrittiCiclo.length}</span>
                      </h3>
                      <p className="hint">
                        L’email serve solo al contatto. Nei dati di ricerca resta il codice.
                        I posti in presenza valgono solo per chi è idoneo e in stanza:
                        da remoto non occupano un posto.
                      </p>
                    </div>
                  </header>

                  {iscrittiCiclo.length === 0 ? (
                    <div className="dash-ciclo-vuoto" role="status">
                      <p>Nessuna iscrizione in questo ciclo.</p>
                      <p className="hint">
                        Quando qualcuno si iscrive, qui gestisci screening, modalità e posti in presenza.
                      </p>
                    </div>
                  ) : (
                    <ul className="dash-iscrizioni">
                      {iscrittiCiclo.map(i => (
                        <li key={i.id} className="dash-iscrizione">
                          <div className="dash-iscrizione-persona">
                            <span className="badge">{i.utenti?.codice_partecipante || '—'}</span>
                            {eRemoto(i) && (
                              <span className="badge badge-modalita is-remoto">remoto</span>
                            )}
                            <span className="dash-iscrizione-email">
                              {i.utenti?.email || 'Nessuna email'}
                            </span>
                          </div>
                          <label className="dash-iscrizione-esito">
                            <select
                              value={i.esito_screening || 'in_attesa'}
                              onChange={e => aggiornaEsito(i, e.target.value)}
                              aria-label={`Screening ${i.utenti?.codice_partecipante || ''}`}
                            >
                              {ESITI.map(e => (
                                <option key={e.id} value={e.id}>{e.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="dash-iscrizione-esito">
                            <select
                              value={i.modalita_fruizione || 'presenza'}
                              onChange={e => aggiornaModalita(i, e.target.value)}
                              aria-label={`Modalità ${i.utenti?.codice_partecipante || ''}`}
                            >
                              {MODALITA.map(m => (
                                <option key={m.id} value={m.id}>{m.label}</option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="btn-elimina"
                            onClick={() => eliminaIscritto(i)}
                          >
                            Rimuovi
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <footer className="dash-ciclo-pericolo">
                  <div>
                    <p className="dash-ciclo-pericolo-titolo">Zona delicata</p>
                    <p className="hint">
                      Elimina l’edizione e i dati collegati (settimane, pratiche, iscrizioni).
                      Questionari e log restano sul codice partecipante.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-ciclo-elimina"
                    onClick={() => eliminaCiclo(cicloAperto)}
                  >
                    Elimina ciclo
                  </button>
                </footer>
              </div>
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
                Tono
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
      <DialogConferma
        aperto={!!dialogo}
        titolo={dialogo?.titolo || ''}
        confermaEtichetta={dialogo?.etichetta || 'Conferma'}
        pericolo
        onConferma={() => dialogo?.onOk?.()}
        onAnnulla={() => setDialogo(null)}
      >
        {dialogo?.testo}
      </DialogConferma>
    </div>
  )
}
