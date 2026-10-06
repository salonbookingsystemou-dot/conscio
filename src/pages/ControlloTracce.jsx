import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AdminDialogo from '../components/AdminDialogo.jsx'
import CardTracciaAudio from '../components/CardTracciaAudio.jsx'
import StatoAttesa from '../components/StatoAttesa.jsx'
import StatoVuoto from '../components/StatoVuoto.jsx'
import {
  ascoltoTecnico,
  controllaCollegamenti,
  controllaFile,
  etichettaSettimana,
  formattaTempo,
  leggiCiclo,
  peggiore,
  pulisciCacheControllo
} from '../lib/controlloTracce'
import { supabase } from '../lib/supabaseClient'

const ETICHETTE_STATO = {
  ok: 'Funziona',
  attenzione: 'Da guardare',
  errore: 'Problema',
  attesa: 'Verifico…'
}

const FILE_IN_PARALLELO = 3

export default function ControlloTracce() {
  const [search, setSearch] = useSearchParams()
  const cicloId = search.get('ciclo') || ''
  const [cicli, setCicli] = useState(null)
  const [dati, setDati] = useState(null)
  const [errore, setErrore] = useState(null)
  const [giro, setGiro] = useState(0)
  const [file, setFile] = useState({})
  const [ascolti, setAscolti] = useState({})
  const [inCoda, setInCoda] = useState(null)
  const [dialogo, setDialogo] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    void pulisciCacheControllo()
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    let vivo = true
    supabase
      .from('cicli')
      .select('id, nome_ciclo, stato')
      .order('data_inizio', { ascending: false })
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) {
          setErrore('Non è stato possibile leggere i cicli.')
          setCicli([])
          return
        }
        const lista = data || []
        setCicli(lista)
        const attuale = search.get('ciclo')
        if (attuale && lista.some(c => c.id === attuale)) return
        const preferito = lista.find(c => c.stato === 'attivo') || lista[0]
        if (preferito) setSearch({ ciclo: preferito.id }, { replace: true })
      })
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    if (!cicloId) return undefined
    let vivo = true
    abortRef.current?.abort()
    abortRef.current = null
    setInCoda(null)
    setDati(null)
    setFile({})
    setAscolti({})
    setErrore(null)
    leggiCiclo(cicloId)
      .then(async letti => {
        if (!vivo) return
        const risultato = controllaCollegamenti(letti)
        setDati(risultato)
        const daControllare = new Map()
        for (const s of risultato.settimane) {
          for (const p of s.pratiche) {
            if (p.url && !daControllare.has(p.url)) daControllare.set(p.url, p.traccia)
          }
        }
        const voci = [...daControllare.entries()]
        let prossimo = 0
        async function lavora() {
          while (vivo && prossimo < voci.length) {
            const [url, traccia] = voci[prossimo]
            prossimo += 1
            const esito = await controllaFile(url, traccia)
            if (vivo) setFile(prima => ({ ...prima, [url]: esito }))
          }
        }
        await Promise.all(Array.from({ length: FILE_IN_PARALLELO }, lavora))
      })
      .catch(() => {
        if (vivo) setErrore('Non è stato possibile leggere le settimane del ciclo.')
      })
    return () => { vivo = false }
  }, [cicloId, giro])

  const pratiche = useMemo(
    () => (dati?.settimane || []).flatMap(s => s.pratiche),
    [dati]
  )

  function statoDi(pratica) {
    const esiti = esitiDi(pratica)
    const stato = peggiore(esiti)
    if (stato === 'errore') return stato
    if (pratica.url && !file[pratica.url]) return 'attesa'
    return stato
  }

  function esitiDi(pratica) {
    return [
      ...pratica.esiti,
      ...(file[pratica.url]?.esiti || []),
      ...(ascolti[pratica.url]?.esiti || [])
    ]
  }

  const conteggi = useMemo(() => {
    const out = { ok: 0, attenzione: 0, errore: 0, attesa: 0 }
    for (const p of pratiche) out[statoDi(p)] += 1
    return out
  }, [pratiche, file, ascolti])

  const urlUniche = useMemo(
    () => [...new Set(pratiche.map(p => p.url).filter(Boolean))],
    [pratiche]
  )
  const daAscoltare = urlUniche.filter(url => !ascolti[url] || ascolti[url].stato === 'errore')

  async function analizza(url, segnale) {
    setAscolti(prima => ({ ...prima, [url]: { stato: 'in corso', esiti: [] } }))
    try {
      const risultato = await ascoltoTecnico(url, { durataFile: file[url]?.info?.durata, segnale })
      setAscolti(prima => ({ ...prima, [url]: { stato: 'fatto', ...risultato } }))
    } catch (err) {
      if (err?.name === 'AbortError') {
        setAscolti(prima => {
          const { [url]: _tolto, ...resto } = prima
          return resto
        })
        throw err
      }
      setAscolti(prima => ({
        ...prima,
        [url]: {
          stato: 'errore',
          esiti: [{ livello: 'attenzione', testo: 'Non sono riuscito a scaricare tutto il file per ascoltarlo. Riprova.' }]
        }
      }))
    }
  }

  async function analizzaUna(url) {
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await analizza(url, controller.signal)
    } catch {
      /* interrotta */
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  async function analizzaTutte() {
    const coda = daAscoltare
    if (coda.length === 0) return
    const controller = new AbortController()
    abortRef.current = controller
    try {
      for (let i = 0; i < coda.length; i += 1) {
        if (controller.signal.aborted) break
        setInCoda({ fatto: i, totale: coda.length })
        await analizza(coda[i], controller.signal)
      }
    } catch {
      /* interrotta */
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setInCoda(null)
    }
  }

  function interrompi() {
    abortRef.current?.abort()
  }

  const occupato = Boolean(inCoda) || Object.values(ascolti).some(a => a.stato === 'in corso')
  const caricamento = cicli === null || (cicloId && !dati && !errore)

  return (
    <>
      <header className="admin-page-head">
        <h1>Controllo tracce</h1>
        <p>
          Verifica le tracce delle pratiche formali di ogni settimana, così come le riceve il partecipante:
          collegamento, file sul server e, su richiesta, un ascolto tecnico dell’audio.
        </p>
      </header>

      <div className="controllo-strumenti">
        <div className="percorso-ciclo">
          <label htmlFor="controllo-ciclo">Ciclo</label>
          <select
            id="controllo-ciclo"
            value={cicloId}
            disabled={occupato}
            onChange={e => setSearch(e.target.value ? { ciclo: e.target.value } : {}, { replace: true })}
          >
            {(cicli || []).length === 0 && <option value="">Nessun ciclo</option>}
            {(cicli || []).map(c => (
              <option key={c.id} value={c.id}>{c.nome_ciclo} ({c.stato})</option>
            ))}
          </select>
        </div>
        <div className="azioni">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setGiro(n => n + 1)}
            disabled={!cicloId || occupato}
          >
            Ricontrolla
          </button>
          {occupato ? (
            <button type="button" className="btn btn-ghost" onClick={interrompi}>Interrompi</button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={analizzaTutte}
              disabled={!dati || daAscoltare.length === 0}
            >
              Ascolto tecnico di tutte
            </button>
          )}
        </div>
      </div>
      {inCoda && (
        <p className="controllo-avanzamento" role="status">
          Ascolto la traccia {inCoda.fatto + 1} di {inCoda.totale}: scarico e decodifico il file intero.
        </p>
      )}

      {errore && <p className="avviso-errore" role="alert">{errore}</p>}

      {caricamento && !errore && <StatoAttesa etichetta="Leggo le settimane…" />}

      {cicli?.length === 0 && !errore && (
        <StatoVuoto titolo="Nessun ciclo">Crea un ciclo e le sue settimane per controllarne le tracce.</StatoVuoto>
      )}

      {dati && (
        <>
          <div className="controllo-numeri">
            <NumeroStato etichetta="Funzionano" valore={conteggi.ok} stato="ok" />
            <NumeroStato etichetta="Da guardare" valore={conteggi.attenzione} stato="attenzione" />
            <NumeroStato etichetta="Problemi" valore={conteggi.errore} stato="errore" />
            <NumeroStato
              etichetta="Ascolto tecnico"
              valore={`${urlUniche.filter(u => ascolti[u]?.stato === 'fatto').length}/${urlUniche.length}`}
              nota="tracce diverse ascoltate"
            />
          </div>

          {dati.settimane.length === 0 && (
            <StatoVuoto titolo="Nessuna settimana">Questo ciclo non ha ancora settimane compilate.</StatoVuoto>
          )}

          {dati.settimane.map(settimana => (
            <section key={settimana.id} className="card is-lista controllo-settimana">
              <header className="controllo-settimana-testa">
                <div>
                  <p className="controllo-kicker">{etichettaSettimana(settimana.numero)}</p>
                  <h3>{settimana.tema || 'Senza tema'}</h3>
                </div>
                <Link className="btn btn-ghost is-piccolo" to={`/percorso/${cicloId}/settimana/${settimana.numero}`}>
                  Apri la settimana
                </Link>
              </header>
              {settimana.pratiche.length === 0 ? (
                <p className="controllo-vuota">Nessuna pratica formale in questa settimana.</p>
              ) : (
                <ul className="controllo-righe">
                  {settimana.pratiche.map(pratica => (
                    <RigaPratica
                      key={pratica.id}
                      pratica={pratica}
                      stato={statoDi(pratica)}
                      esiti={esitiDi(pratica)}
                      ascolto={ascolti[pratica.url]}
                      occupato={occupato}
                      onAscolta={inizio => setDialogo({ pratica, inizio })}
                      onAnalizza={() => analizzaUna(pratica.url)}
                    />
                  ))}
                </ul>
              )}
            </section>
          ))}

          {dati.nonUsate.length > 0 && (
            <p className="controllo-nota">
              In libreria ma non usate in questo ciclo: {dati.nonUsate.map(t => `«${t.titolo}»`).join(', ')}.
            </p>
          )}
          <p className="controllo-nota">
            L’ascolto tecnico scarica il file intero e cerca tratti molto più bassi del resto, silenzi lunghi,
            finali tagliati e durate sbagliate. Segnala dove ascoltare: non sostituisce un ascolto vero.
          </p>
        </>
      )}

      {dialogo && (
        <AdminDialogo titolo="Ascolta" className="is-ascolto" onChiudi={() => setDialogo(null)}>
          <CardTracciaAudio
            key={`${dialogo.pratica.id}-${dialogo.inizio}`}
            src={dialogo.pratica.urlCompleto}
            titolo={dialogo.pratica.traccia?.titolo || dialogo.pratica.descrizione}
            descrizione={dialogo.pratica.traccia?.descrizione}
            etichettaDurata="Audio"
            inizio={dialogo.inizio}
            anteprima
          />
          <div className="dialogo-azioni">
            <button type="button" className="btn btn-ghost" onClick={() => setDialogo(null)}>Chiudi</button>
          </div>
        </AdminDialogo>
      )}
    </>
  )
}

function NumeroStato({ etichetta, valore, stato, nota }) {
  return (
    <div className={`controllo-numero${stato && valore !== 0 ? ` is-${stato}` : ''}`}>
      <p className="controllo-numero-etichetta">{etichetta}</p>
      <p className="controllo-numero-valore">{valore}</p>
      {nota && <p className="controllo-numero-nota">{nota}</p>}
    </div>
  )
}

function RigaPratica({ pratica, stato, esiti, ascolto, occupato, onAscolta, onAnalizza }) {
  const traccia = pratica.traccia
  const meta = [
    traccia ? `Traccia «${traccia.titolo}»` : (pratica.url ? 'File fuori libreria' : null),
    traccia?.durata_minuti ? `${traccia.durata_minuti} min` : null
  ].filter(Boolean).join(' · ')
  const misure = ascolto?.stato === 'fatto' ? ascolto.misure : null
  return (
    <li className="controllo-riga">
      <div className="controllo-riga-testa">
        <div>
          <h4>{pratica.descrizione}</h4>
          {meta && <p className="controllo-meta">{meta}</p>}
          {misure?.durata > 0 && (
            <p className="controllo-meta">
              Ascolto tecnico: {formattaTempo(misure.durata)}
              {Number.isFinite(misure.integrata) ? ` · ${Math.round(misure.integrata)} LUFS` : ''}
            </p>
          )}
        </div>
        <span className={`controllo-stato is-${stato}`}>
          <span className="controllo-stato-punto" aria-hidden="true" />
          {ETICHETTE_STATO[stato]}
        </span>
      </div>
      {esiti.length > 0 && (
        <ul className="controllo-esiti">
          {esiti.map((e, i) => (
            <li key={i} className={`controllo-esito is-${e.livello}`}>
              <span>{e.testo}</span>
              {Number.isFinite(e.da) && pratica.url && (
                <button type="button" className="btn-text" onClick={() => onAscolta(e.da)}>
                  Ascolta da {formattaTempo(e.da)}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {pratica.url && (
        <div className="azioni">
          <button type="button" className="btn btn-ghost is-piccolo" onClick={() => onAscolta(0)}>
            Ascolta
          </button>
          <button
            type="button"
            className="btn btn-ghost is-piccolo"
            onClick={onAnalizza}
            disabled={occupato}
          >
            {ascolto?.stato === 'in corso'
              ? 'Ascolto…'
              : ascolto?.stato === 'fatto' ? 'Rifai l’ascolto tecnico' : 'Ascolto tecnico'}
          </button>
        </div>
      )}
    </li>
  )
}
