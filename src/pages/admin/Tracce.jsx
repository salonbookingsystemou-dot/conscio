import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import AdminDialogo from '../../components/AdminDialogo.jsx'
import CardTracciaAudio from '../../components/CardTracciaAudio.jsx'
import PannelloLaterale from '../../components/PannelloLaterale.jsx'
import StatoAttesa from '../../components/StatoAttesa.jsx'
import StatoVuoto from '../../components/StatoVuoto.jsx'
import {
  collegamentiDelCiclo,
  controllaCollegamenti,
  daGuardare,
  etichettaSettimana,
  gravita,
  leggiCiclo,
  statoNelCiclo,
  statoTraccia
} from '../../lib/controlloTracce.js'
import { supabase } from '../../lib/supabaseClient'
import { collegamentiTracce, elencaTracce } from '../../lib/tracce.js'
import useControlliTracce from '../../lib/useControlliTracce.js'
import { impostaDisponibileVetrina, leggiStatiVetrina } from '../../lib/vetrina.js'
import SchedaTraccia, { BadgeStato, durataBreve, formattaQuando } from './SchedaTraccia.jsx'

const FILTRI = [
  { id: 'tutte', label: 'Tutte' },
  { id: 'da-guardare', label: 'Da guardare' },
  { id: 'vetrina', label: 'In vetrina' },
  { id: 'non-controllate', label: 'Non controllate' }
]

function perCreazione(a, b) {
  const ta = Date.parse(a.creato_il || '') || 0
  const tb = Date.parse(b.creato_il || '') || 0
  if (tb !== ta) return tb - ta
  return String(a.titolo || '').localeCompare(String(b.titolo || ''), 'it')
}

function IconaLente() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.2 15.2 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function IconaAscolto() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8.4 6.2v11.6c0 .72.78 1.16 1.4.79l9.1-5.8a.92.92 0 0 0 0-1.58l-9.1-5.8a.92.92 0 0 0-1.4.79z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconaAltro() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="18" cy="12" r="1.6" fill="currentColor" />
    </svg>
  )
}

export default function Tracce() {
  const [search, setSearch] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const tracciaId = search.get('traccia') || ''
  const cicloId = search.get('ciclo') || ''
  const filtro = FILTRI.some(f => f.id === search.get('filtro')) ? search.get('filtro') : 'tutte'

  const [tracce, setTracce] = useState(null)
  const [collegamenti, setCollegamenti] = useState({})
  const [statiVetrina, setStatiVetrina] = useState({})
  const [cicli, setCicli] = useState([])
  const [errore, setErrore] = useState(null)
  const [ricerca, setRicerca] = useState('')
  const [nelCiclo, setNelCiclo] = useState(null)
  const [erroreCiclo, setErroreCiclo] = useState(null)
  const [inVetrina, setInVetrina] = useState(null)
  const [ascolta, setAscolta] = useState(null)
  const controlli = useControlliTracce()
  const avviato = useRef(false)

  const carica = useCallback(async () => {
    try {
      const [lista, mappa, stati] = await Promise.all([
        elencaTracce(),
        collegamentiTracce(),
        leggiStatiVetrina().catch(() => ({}))
      ])
      setTracce(lista)
      setCollegamenti(mappa)
      setStatiVetrina(stati)
      setErrore(null)
    } catch {
      setTracce(t => t || [])
      setErrore('Non è stato possibile leggere la libreria tracce. Ricarica la pagina.')
    }
  }, [])

  useEffect(() => {
    carica()
    supabase
      .from('cicli')
      .select('id, nome_ciclo, stato')
      .order('data_inizio', { ascending: false })
      .then(({ data }) => setCicli(data || []))
  }, [carica])

  useEffect(() => {
    setNelCiclo(null)
    setErroreCiclo(null)
    if (!cicloId) return undefined
    let vivo = true
    leggiCiclo(cicloId)
      .then(letti => { if (vivo) setNelCiclo({ id: cicloId, ...collegamentiDelCiclo(controllaCollegamenti(letti)) }) })
      .catch(() => { if (vivo) setErroreCiclo('Non è stato possibile leggere le settimane del ciclo.') })
    return () => { vivo = false }
  }, [cicloId])

  const statoDi = useCallback(traccia => {
    if (controlli.inCorso === traccia.id || controlli.controlli === null) return 'attesa'
    const salvato = statoTraccia(traccia, controlli.controlli.get(traccia.id))
    const esiti = nelCiclo?.perTraccia.get(traccia.id)
    return esiti ? statoNelCiclo(salvato, esiti) : salvato
  }, [controlli.inCorso, controlli.controlli, nelCiclo])

  const filtrate = useMemo(() => {
    if (!tracce) return []
    const q = ricerca.trim().toLowerCase()
    const lista = tracce.filter(t => {
      if (q && !String(t.titolo || '').toLowerCase().includes(q)) return false
      if (cicloId && !nelCiclo?.perTraccia.has(t.id)) return false
      const stato = statoDi(t)
      if (filtro === 'da-guardare') return daGuardare(stato)
      if (filtro === 'vetrina') return Boolean(statiVetrina[t.id]?.pubblica)
      if (filtro === 'non-controllate') return stato === 'non-controllata' || stato === 'da-ricontrollare'
      return true
    })
    if (filtro === 'da-guardare') {
      return lista.sort((a, b) => (gravita(statoDi(a)) - gravita(statoDi(b))) || perCreazione(a, b))
    }
    return lista.sort(perCreazione)
  }, [tracce, ricerca, cicloId, nelCiclo, filtro, statiVetrina, statoDi])

  const aperta = tracciaId ? (tracce || []).find(t => t.id === tracciaId) || null : null

  useEffect(() => {
    if (avviato.current || !location.state?.controlla) return
    if (!aperta || controlli.controlli === null) return
    avviato.current = true
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
    controlli.controlla(aperta)
  }, [aperta, controlli, location, navigate])

  function aggiornaRicerca(patch, opzioni) {
    const prossima = new URLSearchParams(search)
    for (const [chiave, valore] of Object.entries(patch)) {
      if (valore) prossima.set(chiave, valore)
      else prossima.delete(chiave)
    }
    setSearch(prossima, opzioni)
  }

  async function cambiaVetrina(traccia, acceso) {
    setInVetrina(traccia.id)
    setErrore(null)
    try {
      const stato = statiVetrina[traccia.id] || {}
      const salvato = await impostaDisponibileVetrina({ id: traccia.id, titolo: traccia.titolo, slug: stato.slug }, acceso)
      setStatiVetrina(attuale => ({ ...attuale, [traccia.id]: { ...stato, ...salvato } }))
    } catch (err) {
      setErrore(err?.message || 'Non è stato possibile aggiornare la vetrina.')
    } finally {
      setInVetrina(null)
    }
  }

  const ciclo = cicli.find(c => c.id === cicloId) || null
  const conteggiFiltri = useMemo(() => {
    if (!tracce) return {}
    const base = tracce.filter(t => !cicloId || nelCiclo?.perTraccia.has(t.id))
    return {
      tutte: base.length,
      'da-guardare': base.filter(t => daGuardare(statoDi(t))).length,
      vetrina: base.filter(t => statiVetrina[t.id]?.pubblica).length,
      'non-controllate': base.filter(t => ['non-controllata', 'da-ricontrollare'].includes(statoDi(t))).length
    }
  }, [tracce, cicloId, nelCiclo, statiVetrina, statoDi])

  if (tracce === null) return <StatoAttesa etichetta="Carico la libreria tracce…" />

  const caricaCiclo = cicloId && !nelCiclo && !erroreCiclo
  const senzaLibreria = nelCiclo?.senzaLibreria || []

  return (
    <>
      <header className="dash-panel-testa">
        <div>
          <h1>Tracce</h1>
          <p className="lead">I file audio delle pratiche: crea, modifica, pubblica in vetrina e controlla che si sentano bene.</p>
        </div>
        <div className="dash-panel-azioni">
          {controlli.occupato ? (
            <button type="button" className="btn btn-ghost" onClick={controlli.interrompi}>Interrompi</button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={filtrate.length === 0 || controlli.controlli === null}
              onClick={() => controlli.controllaTutte(filtrate)}
            >
              Controlla tutte
            </button>
          )}
          <Link className="btn" to="/admin/tracce/nuova">Nuova traccia</Link>
        </div>
      </header>

      {controlli.coda && (
        <p className="controllo-avanzamento" role="status">
          {controlli.coda.fase === 'file'
            ? `Controllo i file di ${controlli.coda.totale} tracce…`
            : `Ascolto la traccia ${controlli.coda.fatto + 1} di ${controlli.coda.totale}: «${controlli.coda.titolo}». Scarico e decodifico il file intero.`}
        </p>
      )}
      {errore && <p className="avviso-errore" role="alert">{errore}</p>}
      {controlli.errore && <p className="avviso-errore" role="alert">{controlli.errore}</p>}
      {!controlli.salvabili && (
        <p className="disclaimer">
          Manca la tabella dei controlli nel database: i risultati restano visibili finché non ricarichi la pagina.
        </p>
      )}

      <div className="admin-toolbar">
        <label className="admin-cerca">
          <IconaLente />
          <span className="visually-hidden">Cerca traccia</span>
          <input
            type="search"
            value={ricerca}
            onChange={e => setRicerca(e.target.value)}
            placeholder="Cerca una traccia…"
          />
        </label>
        <div className="field vetrina-stato">
          <label htmlFor="tracce-ciclo" className="visually-hidden">Usate nel ciclo</label>
          <select
            id="tracce-ciclo"
            value={cicloId}
            disabled={controlli.occupato}
            onChange={e => aggiornaRicerca({ ciclo: e.target.value }, { replace: true })}
          >
            <option value="">Tutti i cicli</option>
            {cicli.map(c => (
              <option key={c.id} value={c.id}>Usate in {c.nome_ciclo}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="filtri-chip" role="group" aria-label="Filtra le tracce">
        {FILTRI.map(f => (
          <button
            key={f.id}
            type="button"
            className={`dash-tab${filtro === f.id ? ' is-on' : ''}`}
            aria-pressed={filtro === f.id}
            onClick={() => aggiornaRicerca({ filtro: f.id === 'tutte' ? '' : f.id }, { replace: true })}
          >
            {f.label}{Number.isFinite(conteggiFiltri[f.id]) ? ` · ${conteggiFiltri[f.id]}` : ''}
          </button>
        ))}
      </div>

      {erroreCiclo && <p className="avviso-errore" role="alert">{erroreCiclo}</p>}

      {senzaLibreria.length > 0 && (
        <section className="dash-ciclo-sezione" aria-labelledby="senza-libreria">
          <div className="dash-ciclo-sezione-testa">
            <h2 id="senza-libreria">Pratiche senza traccia in libreria</h2>
          </div>
          <p className="hint">
            In {ciclo?.nome_ciclo || 'questo ciclo'} queste pratiche non hanno una traccia della libreria: collegale dalla settimana.
          </p>
          <ul className="controllo-esiti">
            {senzaLibreria.map(p => (
              <li key={p.id} className={`controllo-esito is-${p.esiti.some(e => e.livello === 'errore') ? 'errore' : 'attenzione'}`}>
                <span>{etichettaSettimana(p.settimana)} · {p.descrizione}: {p.esiti.map(e => e.testo).join(' ')}</span>
                <Link className="btn-text" to={`/admin/cicli/${cicloId}/programma/settimana/${p.settimana}`}>
                  Apri la settimana
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card is-lista" aria-label="Elenco tracce">
        {caricaCiclo ? (
          <p className="card-vuota">Leggo le settimane del ciclo…</p>
        ) : tracce.length === 0 ? (
          <StatoVuoto titolo="Nessuna traccia ancora">
            Carica un file o generalo da uno script: sarà disponibile in tutti i cicli.
          </StatoVuoto>
        ) : filtrate.length === 0 ? (
          <p className="card-vuota">
            {filtro === 'da-guardare'
              ? 'Niente da guardare tra queste tracce.'
              : 'Nessuna traccia corrisponde alla ricerca o al filtro.'}
          </p>
        ) : (
          <ul className="admin-lista">
            {filtrate.map(t => {
              const minuti = durataBreve(t.durata_minuti)
              const creata = formattaQuando(t.creato_il)
              const modificata = formattaQuando(t.aggiornato_il)
              const vetrina = statiVetrina[t.id]
              return (
                <li key={t.id} className={`admin-riga${t.id === tracciaId ? ' is-attiva' : ''}`}>
                  <div className="admin-riga-testi">
                    <p className="admin-riga-titolo">
                      <button
                        type="button"
                        className="admin-riga-apri"
                        onClick={() => aggiornaRicerca({ traccia: t.id })}
                      >
                        {t.titolo}
                      </button>
                      {minuti && <span className="admin-riga-durata"> · {minuti}</span>}
                      {!vetrina?.pubblica && vetrina?.stato_revisione === 'in-revisione' && (
                        <span className="badge">In revisione</span>
                      )}
                      {!vetrina?.pubblica && vetrina?.stato_revisione === 'approvata' && (
                        <span className="badge">Approvata</span>
                      )}
                    </p>
                    {(creata || modificata) && (
                      <p className="admin-riga-date">
                        {creata && <time dateTime={t.creato_il}>Creata il {creata}</time>}
                        {creata && modificata && ' · '}
                        {modificata && <time dateTime={t.aggiornato_il}>modificata il {modificata}</time>}
                      </p>
                    )}
                    <label className="vetrina-spunta">
                      <input
                        type="checkbox"
                        checked={Boolean(vetrina?.pubblica)}
                        disabled={inVetrina === t.id || !t.url}
                        onChange={e => cambiaVetrina(t, e.target.checked)}
                      />
                      <span>In vetrina</span>
                    </label>
                  </div>
                  <div className="admin-riga-azioni">
                    <BadgeStato stato={statoDi(t)} />
                    <button
                      type="button"
                      className="admin-icon-btn"
                      aria-label={`Ascolta ${t.titolo}`}
                      title="Ascolta"
                      disabled={!t.url}
                      onClick={() => setAscolta(t)}
                    >
                      <IconaAscolto />
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn"
                      aria-label={`Apri la scheda di ${t.titolo}`}
                      title="Modifica, file, vetrina, controllo"
                      onClick={() => aggiornaRicerca({ traccia: t.id })}
                    >
                      <IconaAltro />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {tracciaId && !aperta && (
        <p className="avviso-errore" role="alert">
          La traccia richiesta non è più in libreria.{' '}
          <button type="button" className="btn-text" onClick={() => aggiornaRicerca({ traccia: '' }, { replace: true })}>
            Chiudi
          </button>
        </p>
      )}

      {aperta && (
        <PannelloLaterale
          sopratitolo="Traccia"
          titolo={aperta.titolo}
          onChiudi={() => aggiornaRicerca({ traccia: '' })}
        >
          <SchedaTraccia
            traccia={aperta}
            usi={collegamenti[aperta.id] || []}
            statoVetrina={statiVetrina[aperta.id]}
            controllo={controlli.controlli?.get(aperta.id) || null}
            stato={statoDi(aperta)}
            esitiCiclo={nelCiclo?.perTraccia.get(aperta.id) || null}
            nomeCiclo={nelCiclo?.perTraccia.has(aperta.id) ? ciclo?.nome_ciclo : null}
            inControllo={controlli.inCorso === aperta.id}
            occupato={controlli.occupato}
            controlliSalvabili={controlli.salvabili}
            onControlla={() => controlli.controlla(aperta)}
            onAggiornata={carica}
            onEliminata={() => {
              aggiornaRicerca({ traccia: '' }, { replace: true })
              carica()
            }}
          />
        </PannelloLaterale>
      )}

      {ascolta && (
        <AdminDialogo titolo="Ascolta" className="is-ascolto" onChiudi={() => setAscolta(null)}>
          <CardTracciaAudio
            src={ascolta.url}
            titolo={ascolta.titolo}
            descrizione={ascolta.descrizione}
            etichettaDurata={durataBreve(ascolta.durata_minuti) || 'Audio'}
            anteprima
          />
          <div className="dialogo-azioni">
            <button type="button" className="btn btn-ghost" onClick={() => setAscolta(null)}>Chiudi</button>
          </div>
        </AdminDialogo>
      )}
    </>
  )
}
