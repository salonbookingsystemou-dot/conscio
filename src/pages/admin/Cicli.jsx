import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import DialogConferma from '../../components/DialogConferma.jsx'
import PaginaAdmin from '../../components/admin/PaginaAdmin.jsx'
import { useSnackbar } from '../../components/admin/Snackbar.jsx'
import RigaIscrizione, { IntestazioneIscrizioni } from '../../components/RigaIscrizione.jsx'
import {
  ESITO_PROBLEMA,
  archiviaProblema,
  assegnaACiclo,
  avvisaDaFare,
  calcolaKpi,
  dialogoRitiro,
  eIdoneo,
  eRemoto,
  esitoProblema,
  esportaAggregati,
  etichettaAvanzamento,
  etichettaPeriodo,
  etichettaStato,
  impostaEsito,
  inAttesaDiEsito,
  leggiDatiCicli,
  ritira,
  timepointsPerCodice
} from '../../lib/cicli.js'
import { contaSessioni } from '../../lib/tono.js'

const FORM_VUOTO = { nome_ciclo: '', data_inizio: '', data_fine: '', posti_totali: 8, stato: 'reclutamento' }

export default function Cicli() {
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const { mostra } = useSnackbar()
  const [dati, setDati] = useState(null)
  const [errore, setErrore] = useState(null)
  const [gestendo, setGestendo] = useState(null)
  // «Nuovo ciclo» è l'azione principale del guscio: apre il modulo con ?nuovo=1.
  const mostraForm = search.get('nuovo') === '1'
  const [form, setForm] = useState(FORM_VUOTO)
  const [dialogo, setDialogo] = useState(null)

  async function carica() {
    try {
      await supabase.rpc('separa_email_cicli_conclusi')
      const letti = await leggiDatiCicli({ notifiche: true, segnalazioni: true, problemi: true })
      setDati(letti)
      if (letti.errori.has('cicli')) setErrore('Non è stato possibile caricare i cicli.')
    } catch {
      setErrore('Non è stato possibile caricare i cicli.')
    }
  }

  useEffect(() => { carica() }, [])

  const cicli = dati?.cicli || []
  const iscrizioni = dati?.iscrizioni || []
  const punteggi = dati?.punteggi || []
  const segnalazioni = dati?.segnalazioni || []
  const problemi = dati?.problemi || []

  const kpi = useMemo(() => calcolaKpi(iscrizioni, cicli, punteggi), [iscrizioni, cicli, punteggi])
  const sessioni = useMemo(() => contaSessioni(dati?.log || []), [dati])
  const timepoints = useMemo(() => timepointsPerCodice(punteggi), [punteggi])
  const cicloPerId = useMemo(() => new Map(cicli.map(c => [c.id, c])), [cicli])
  const remotiLiberi = useMemo(() => iscrizioni.filter(i => !i.ciclo_id), [iscrizioni])
  const cicloPerCodice = useMemo(() => {
    const mappa = new Map()
    for (const i of iscrizioni) {
      const codice = i.utenti?.codice_partecipante
      if (codice && i.ciclo_id) mappa.set(codice, i.ciclo_id)
    }
    return mappa
  }, [iscrizioni])
  // Solo per contattare chi ha segnalato un momento difficile (decisione del 14/10/2026, docs/progetto.md).
  const emailPerCodice = useMemo(() => {
    const mappa = new Map()
    for (const i of iscrizioni) {
      const codice = i.utenti?.codice_partecipante
      if (codice && i.utenti?.email) mappa.set(codice, i.utenti.email)
    }
    return mappa
  }, [iscrizioni])
  const notifichePerCodice = useMemo(() => {
    const m = new Map()
    for (const n of dati?.notifiche || []) {
      const codice = n.utenti?.codice_partecipante
      if (!codice) continue
      m.set(codice, [...(m.get(codice) || []), n])
    }
    return m
  }, [dati])

  // Iscrizioni in attesa raggruppate per ciclo: una riga per ciclo, con il link alla scheda Iscritti.
  const attesePerCiclo = useMemo(() => {
    const gruppi = new Map()
    for (const i of iscrizioni.filter(inAttesaDiEsito)) {
      const chiave = i.ciclo_id || ''
      gruppi.set(chiave, (gruppi.get(chiave) || 0) + 1)
    }
    return [...gruppi.entries()].map(([cicloId, n]) => ({ ciclo: cicloPerId.get(cicloId) || null, n }))
  }, [iscrizioni, cicloPerId])

  function contaIdonei(cicloId, remoto) {
    return iscrizioni.filter(i => i.ciclo_id === cicloId && eIdoneo(i) && eRemoto(i) === remoto).length
  }

  async function creaCiclo(e) {
    e.preventDefault()
    setErrore(null)
    const { data, error } = await supabase.from('cicli').insert({
      nome_ciclo: form.nome_ciclo.trim(),
      data_inizio: form.data_inizio,
      data_fine: form.data_fine || null,
      posti_totali: Number(form.posti_totali) || 8,
      stato: form.stato
    }).select('id').single()
    if (error || !data) {
      setErrore('Non è stato possibile creare il ciclo.')
      return
    }
    setForm(FORM_VUOTO)
    navigate(`/admin/cicli/${data.id}/panoramica`)
  }

  function chiudiForm() {
    const prossima = new URLSearchParams(search)
    prossima.delete('nuovo')
    setSearch(prossima, { replace: true })
  }

  // Nessuna funzione riapre una segnalazione: la snackbar conferma senza «Annulla».
  async function segnaGestita(checkinId) {
    setErrore(null)
    setGestendo(checkinId)
    const { error } = await supabase.rpc('segna_segnalazione_gestita', { p_checkin_id: checkinId })
    setGestendo(null)
    if (error) {
      setErrore('Non è stato possibile segnare la segnalazione come gestita.')
      return
    }
    setDati(d => ({ ...d, segnalazioni: d.segnalazioni.filter(s => s.checkin_id !== checkinId) }))
    avvisaDaFare()
    mostra({ testo: 'Segnalazione segnata come gestita' })
  }

  async function archivia(problema) {
    setErrore(null)
    setGestendo(problema.id)
    const messaggio = await archiviaProblema(problema.id)
    setGestendo(null)
    if (messaggio) {
      setErrore(messaggio)
      return
    }
    setDati(d => ({ ...d, problemi: d.problemi.filter(p => p.id !== problema.id) }))
    mostra({
      testo: 'Segnalazione archiviata',
      annulla: async () => {
        const errore = await archiviaProblema(problema.id, false)
        if (errore) setErrore(errore)
        else carica()
      }
    })
  }

  async function esegui(azione) {
    setErrore(null)
    const messaggio = await azione()
    if (messaggio) setErrore(messaggio)
    else carica()
  }

  function chiediRitiro(iscrizione) {
    setDialogo({
      ...dialogoRitiro(iscrizione),
      onOk: async () => {
        setDialogo(null)
        await esegui(() => ritira(iscrizione))
      }
    })
  }

  const niente = segnalazioni.length === 0 && attesePerCiclo.length === 0 && problemi.length === 0

  return (
    <PaginaAdmin
      titolo="Cicli"
      meta="Edizioni del percorso, iscrizioni e cose da fare."
      azione={dati && (
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => esportaAggregati({ ciclo: null, kpi, punteggi, logN: dati?.log.length || 0 })}
        >
          Esporta dati aggregati
        </button>
      )}
      stato={!dati && !errore ? 'attesa' : undefined}
      statoTesto="Carico i cicli…"
    >
      <div className="dash">
        {errore && <p className="avviso-errore" role="alert">{errore}</p>}

        {mostraForm && (
          <div className="card">
            <h3>Nuovo ciclo</h3>
            <form onSubmit={creaCiclo}>
              <div className="field">
                <label htmlFor="nuovo-ciclo-nome">Nome del ciclo</label>
                <input id="nuovo-ciclo-nome" required autoFocus value={form.nome_ciclo} onChange={e => setForm({ ...form, nome_ciclo: e.target.value })} />
              </div>
              <div className="riga-due">
                <div className="field">
                  <label htmlFor="nuovo-ciclo-inizio">Data di inizio</label>
                  <input id="nuovo-ciclo-inizio" type="date" required value={form.data_inizio} onChange={e => setForm({ ...form, data_inizio: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="nuovo-ciclo-fine">Data di fine</label>
                  <input id="nuovo-ciclo-fine" type="date" value={form.data_fine} onChange={e => setForm({ ...form, data_fine: e.target.value })} />
                </div>
              </div>
              <div className="riga-due">
                <div className="field">
                  <label htmlFor="nuovo-ciclo-posti">Posti in presenza</label>
                  <input id="nuovo-ciclo-posti" type="number" min="1" max="8" value={form.posti_totali} onChange={e => setForm({ ...form, posti_totali: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="nuovo-ciclo-stato">Stato</label>
                  <select id="nuovo-ciclo-stato" value={form.stato} onChange={e => setForm({ ...form, stato: e.target.value })}>
                    <option value="reclutamento">reclutamento</option>
                    <option value="attivo">attivo</option>
                    <option value="concluso">concluso</option>
                  </select>
                </div>
              </div>
              <div className="dialogo-azioni">
                <button className="btn btn-ghost" type="button" onClick={chiudiForm}>Annulla</button>
                <button className="btn" type="submit">Crea ciclo</button>
              </div>
            </form>
          </div>
        )}

        <section className="dash-ciclo-sezione dash-segnalazioni" aria-labelledby="da-fare-titolo">
          <header className="dash-ciclo-sezione-testa">
            <div>
              <h2 id="da-fare-titolo">
                Da fare
                {!niente && (
                  <span className="dash-ciclo-conteggio">{segnalazioni.length + kpi.inAttesa + problemi.length}</span>
                )}
              </h2>
              {segnalazioni.length > 0 && (
                <p className="hint">
                  Segnalazioni dal check-in settimanale: la persona ha vissuto un momento difficile durante la pratica.
                  Contattala, poi segna la segnalazione come gestita. La nota resta solo qui.
                </p>
              )}
              {problemi.length > 0 && (
                <p className="hint">
                  Segnalazioni di problemi dell’app, anonime: l’agente le esamina e scrive qui se le ha risolte.
                  Archiviale quando le hai lette.
                </p>
              )}
            </div>
          </header>
          {niente ? (
            <p className="hint">Niente da fare.</p>
          ) : (
            <ul className="dash-segnalazioni-lista">
              {segnalazioni.map(s => {
                const cicloId = cicloPerCodice.get(s.codice_partecipante)
                return (
                  <li key={s.checkin_id} className="dash-segnalazione">
                    <div className="dash-segnalazione-testi">
                      <div className="dash-segnalazione-meta">
                        <span className="badge" title={emailPerCodice.get(s.codice_partecipante) || 'Nessuna email registrata'}>
                          {s.codice_partecipante}
                        </span>
                        <span>{s.settimana === 9 ? 'Settimana intensiva' : `Settimana ${s.settimana}`}</span>
                        {s.creato_il && (
                          <span>· {new Date(s.creato_il).toLocaleDateString('it-IT')}</span>
                        )}
                        {cicloId && (
                          <Link to={`/admin/cicli/${cicloId}/iscritti`}>
                            · {cicloPerId.get(cicloId)?.nome_ciclo || 'Apri il ciclo'}
                          </Link>
                        )}
                      </div>
                      <p className="dash-segnalazione-nota">
                        {s.nota || <span className="hint">Nessuna nota.</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={gestendo === s.checkin_id}
                      onClick={() => segnaGestita(s.checkin_id)}
                    >
                      {gestendo === s.checkin_id ? 'Salvataggio…' : 'Segna come gestita'}
                    </button>
                  </li>
                )
              })}
              {problemi.map(p => {
                const esito = esitoProblema(p)
                const info = ESITO_PROBLEMA[esito]
                return (
                  <li key={p.id} className="dash-segnalazione is-problema">
                    <div className="dash-segnalazione-testi">
                      <div className="dash-segnalazione-meta">
                        <span className={`controllo-stato is-${info.tono}`}>
                          <span className="controllo-stato-punto" aria-hidden="true" />
                          {info.etichetta}
                        </span>
                        <span>Problema dell’app</span>
                        {p.pagina && <span>· {p.pagina}</span>}
                        {p.creata_il && <span>· {new Date(p.creata_il).toLocaleDateString('it-IT')}</span>}
                      </div>
                      <p className="dash-segnalazione-nota">{p.messaggio}</p>
                      {esito === 'aperta' ? (
                        <p className="hint">L’agente non ha ancora chiuso la segnalazione.</p>
                      ) : (
                        <div className="problema-esito">
                          <p>
                            <strong>{esito === 'risolta' ? 'Cosa è stato corretto' : 'Perché non è risolta'}</strong>
                            {p.chiusa_il && <span className="hint"> · {new Date(p.chiusa_il).toLocaleDateString('it-IT')}</span>}
                          </p>
                          <p>{p.riepilogo}</p>
                          {p.pr_url && (
                            <a href={p.pr_url} target="_blank" rel="noopener noreferrer">
                              Apri la pull request
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={gestendo === p.id}
                      onClick={() => archivia(p)}
                    >
                      {gestendo === p.id ? 'Salvataggio…' : 'Archivia'}
                    </button>
                  </li>
                )
              })}
              {attesePerCiclo.map(({ ciclo, n }) => (
                <li key={ciclo?.id || 'remoti'} className="dash-segnalazione">
                  <div className="dash-segnalazione-testi">
                    <p className="dash-segnalazione-nota">
                      {n === 1 ? '1 iscrizione in attesa di esito' : `${n} iscrizioni in attesa di esito`}
                      {' · '}
                      {ciclo ? ciclo.nome_ciclo : 'percorsi individuali da remoto'}
                    </p>
                  </div>
                  {ciclo ? (
                    <Link className="btn btn-ghost" to={`/admin/cicli/${ciclo.id}/iscritti`}>Apri le iscrizioni</Link>
                  ) : (
                    <a className="btn btn-ghost" href="#remoti-liberi" onClick={e => {
                      e.preventDefault()
                      document.getElementById('remoti-liberi')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    >
                      Vai all’elenco
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

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
            <p className="dash-kpi-label">
              {kpi.tpFocus ? `Questionari ${kpi.tpFocus}` : 'Questionari'}
            </p>
            <p className="dash-kpi-valore">
              {kpi.tpFocus ? `${kpi.qFatti} su ${kpi.qAttesi}` : '—'}
            </p>
          </article>
          <article className="dash-kpi-card">
            <p className="dash-kpi-label">Sessioni di pratica</p>
            <p className="dash-kpi-valore">
              {sessioni === 0 ? '0' : `${sessioni} session${sessioni === 1 ? 'e' : 'i'}`}
            </p>
          </article>
        </div>

        <section aria-labelledby="elenco-cicli-titolo">
          <h2 id="elenco-cicli-titolo" className="visually-hidden">Elenco dei cicli</h2>
          <div className="dash-tabella card">
            <div className="dash-tabella-testata" aria-hidden="true">
              <span>Ciclo</span>
              <span>Stato</span>
              <span>Iscritti</span>
              <span>Avanzamento</span>
              <span />
            </div>
            {cicli.length === 0 && (
              <p className="dash-tabella-vuoto">Nessun ciclo ancora creato. Inizia da «Nuovo ciclo».</p>
            )}
            {cicli.map(c => {
              const presenza = contaIdonei(c.id, false)
              const remoti = contaIdonei(c.id, true)
              const posti = c.posti_totali || 8
              const pctPosti = Math.min(100, Math.round((presenza / posti) * 100))
              const avanzamento = etichettaAvanzamento(c)
              return (
                <article key={c.id} className="dash-riga-ciclo">
                  <div className="dash-riga-ciclo-nome">
                    <strong>{c.nome_ciclo}</strong>
                    <span className="hint">{etichettaPeriodo(c.data_inizio, c.data_fine)}</span>
                  </div>
                  <div>
                    <span className={`badge badge-stato is-${c.stato}`}>{etichettaStato(c.stato)}</span>
                  </div>
                  <div className="dash-riga-progresso">
                    <span>
                      {presenza} / {posti} in presenza
                      {remoti > 0 ? ` · ${remoti} remot${remoti === 1 ? 'o' : 'i'}` : ''}
                    </span>
                    <span className="dash-barra" aria-hidden="true">
                      <span className="dash-barra-fill is-posti" style={{ width: `${pctPosti}%` }} />
                    </span>
                  </div>
                  <div className="dash-riga-progresso">
                    <span>{avanzamento.testo}</span>
                    <span className="dash-barra" aria-hidden="true">
                      <span className={`dash-barra-fill is-${avanzamento.tono}`} style={{ width: `${avanzamento.pct}%` }} />
                    </span>
                  </div>
                  <div className="dash-riga-azioni">
                    <Link
                      className={`btn${c.stato === 'reclutamento' ? '' : ' btn-ghost'}`}
                      to={`/admin/cicli/${c.id}/panoramica`}
                      aria-label={`Apri ${c.nome_ciclo}`}
                    >
                      Apri
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="dash-ciclo-sezione" id="remoti-liberi" aria-labelledby="remoti-liberi-titolo">
          <header className="dash-ciclo-sezione-testa">
            <div>
              <h2 id="remoti-liberi-titolo">
                Percorsi individuali da remoto
                <span className="dash-ciclo-conteggio">{remotiLiberi.length}</span>
              </h2>
              <p className="hint">
                Usano le stesse settimane del ciclo in presenza, con un orologio personale:
                dopo il T0 si apre la settimana 1, le successive partono dal primo ascolto.
                Non occupano posti in aula. Se dopo 15 giorni non hanno fatto
                l’onboarding o non hanno iniziato le pratiche, parte un’email:
                se restano inattivi l’account viene chiuso (Comunicazioni).
              </p>
            </div>
          </header>
          {remotiLiberi.length === 0 ? (
            <div className="dash-ciclo-vuoto" role="status">
              <p>Nessuna iscrizione solo remota.</p>
            </div>
          ) : (
            <ul className="dash-iscrizioni">
              <IntestazioneIscrizioni libera />
              {remotiLiberi.map(i => (
                <RigaIscrizione
                  key={i.id}
                  iscrizione={i}
                  timepoints={timepoints.get(i.utenti?.codice_partecipante)}
                  ciclo={null}
                  cicli={cicli}
                  notifiche={notifichePerCodice.get(i.utenti?.codice_partecipante) || []}
                  onEsito={(isc, esito) => esegui(() => impostaEsito(isc, esito))}
                  onAssegna={(isc, cicloId) => esegui(() => assegnaACiclo(isc, cicloId))}
                  onRitira={chiediRitiro}
                />
              ))}
            </ul>
          )}
        </section>

        {cicli.length > 0 && (
          <section className="dash-ciclo-sezione" aria-labelledby="questionari-tutti-titolo">
            <header className="dash-ciclo-sezione-testa">
              <div>
                <h2 id="questionari-tutti-titolo">Questionari · tutti i cicli</h2>
                <p className="hint">Totali grezzi per codice e andamento del gruppo, con tutti i cicli insieme.</p>
              </div>
            </header>
            <Link className="btn btn-ghost" to={`/admin/cicli/${cicli[0].id}/questionari?tutti=1`}>
              Apri la vista di tutti i cicli
            </Link>
          </section>
        )}

        <p className="dash-nota-privacy">
          Le risposte ai questionari sono consultabili solo in forma aggregata e per codice
          partecipante. L’email compare solo passando sopra un codice, nelle iscrizioni e nelle
          segnalazioni difficili, per contattare la persona.
        </p>

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
    </PaginaAdmin>
  )
}
