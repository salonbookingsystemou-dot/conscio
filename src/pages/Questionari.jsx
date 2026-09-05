import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { supabase, supabaseConfigurato } from '../lib/supabaseClient'
import { usePartecipante } from '../lib/partecipante.jsx'
import { calcolaPunteggi } from '../lib/scoring'
import ScalaLikert from '../components/ScalaLikert.jsx'
import Disclaimer from '../components/Disclaimer.jsx'
import ChiediCodice from '../components/ChiediCodice.jsx'
import IndicatoreOrientamento from '../components/IndicatoreOrientamento.jsx'
import StatoAttesa from '../components/StatoAttesa.jsx'

const ETICHETTE = {
  T0: { titolo: 'T0 — Inizio', sottotitolo: 'Prima di partire e durante la settimana 1' },
  T1: { titolo: 'T1 — Metà percorso', sottotitolo: 'Settimane 4 e 5' },
  T2: { titolo: 'T2 — Fine percorso', sottotitolo: 'Settimane 8 e 9' },
  T3: { titolo: 'T3 — Follow-up', sottotitolo: 'Dopo la fine del ciclo' }
}

const STATO_BADGE = {
  aperto: 'Aperto',
  in_attesa: 'In attesa',
  chiuso: 'Concluso',
  completato: 'Compilato'
}

const SOTTOSCALE_ETICHETTE = {
  osservare: 'Osservare',
  descrivere: 'Descrivere',
  agire_con_consapevolezza: 'Agire con consapevolezza',
  non_giudicare: 'Non giudicare',
  non_reagire: 'Non reagire'
}

function messaggioErrore(error) {
  const testo = error?.message || ''
  if (testo.includes('CODICE_NON_TROVATO')) return 'Codice non riconosciuto. Controlla e riprova.'
  if (testo.includes('COMPILAZIONE_GIA_PRESENTE')) return 'Hai già compilato i questionari per questo momento.'
  if (testo.includes('TIMEPOINT_NON_APERTO')) {
    return 'Questo questionario non è aperto in questa settimana del ciclo.'
  }
  if (testo.includes('RISPOSTE_NON_VALIDE') || testo.includes('RISPOSTE_MANCANTI')) {
    return 'Alcune risposte non sono state registrate. Controlla di aver risposto a tutte le domande.'
  }
  return 'Si è verificato un errore. Riprova.'
}

function ordinaItem(righe) {
  const pss = righe.filter(i => i.scala === 'likert_0_4').sort((a, b) => a.ordine - b.ordine)
  const ffmq = righe.filter(i => i.scala === 'likert_1_5').sort((a, b) => a.ordine - b.ordine)
  return [...pss, ...ffmq]
}

function etichettaSettimana(n, dataInizio) {
  if (n == null) return ''
  if (n === 0) {
    if (dataInizio) {
      const quando = new Date(`${String(dataInizio).slice(0, 10)}T12:00:00`).toLocaleDateString('it-IT')
      return `Ciclo in partenza il ${quando}. T0 è già disponibile.`
    }
    return 'Il ciclo non è ancora iniziato.'
  }
  if (n === 9) return 'Sei nella settimana intensiva (9).'
  return `Sei nella settimana ${n} del ciclo.`
}

export default function Questionari() {
  const {
    codice,
    registrato,
    onboardingCompleto,
    t0Completo,
    percorsoPronto,
    aggiornaPercorso
  } = usePartecipante()
  const location = useLocation()
  const daOnboarding = Boolean(location.state?.daOnboarding)
  const forzatoT0 = daOnboarding || (onboardingCompleto && !t0Completo)
  const autoAvvioRef = useRef(false)

  const [passo, setPasso] = useState('scelta')
  const [piano, setPiano] = useState(null)
  const [timepoint, setTimepoint] = useState(null)
  const [item, setItem] = useState([])
  const [indice, setIndice] = useState(0)
  const [risposte, setRisposte] = useState({})
  const [punteggi, setPunteggi] = useState(null)
  const [errore, setErrore] = useState(null)
  const [invio, setInvio] = useState(false)

  const corrente = item[indice]
  const nomeStrumento = corrente?.scala === 'likert_0_4' ? 'PSS-10' : 'FFMQ-I'
  const avanzamento = item.length ? Math.round(((indice + (risposte[corrente?.id] != null ? 1 : 0)) / item.length) * 100) : 0

  async function caricaPiano() {
    setErrore(null)
    setInvio(true)

    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      setInvio(false)
      return null
    }

    const { data, error } = await supabase.rpc('stato_questionari_del_partecipante', {
      p_codice: codice
    })

    if (error) {
      setErrore(messaggioErrore(error))
      setInvio(false)
      return null
    }

    setPiano(data)
    setPasso('scelta')
    setInvio(false)
    return data
  }

  async function avviaTimepoint(tp) {
    setErrore(null)
    if (tp.stato !== 'aperto') return
    setInvio(true)

    const { data: righe, error: errItem } = await supabase
      .from('item')
      .select('id, questionario_id, ordine, testo, scala, inverso, sottoscala, questionari(nome)')
      .order('ordine', { ascending: true })

    if (errItem || !righe?.length) {
      setErrore('I questionari non sono ancora disponibili. Riprova più tardi.')
      setInvio(false)
      return
    }

    setTimepoint(tp.id)
    setItem(ordinaItem(righe))
    setRisposte({})
    setIndice(0)
    setPasso('domanda')
    setInvio(false)
  }

  async function mostraEsito(tpId) {
    setErrore(null)
    setInvio(true)
    const [{ data: righe, error: errItem }, { data: salvate, error: errRisposte }] = await Promise.all([
      supabase
        .from('item')
        .select('id, questionario_id, ordine, testo, scala, inverso, sottoscala, questionari(nome)')
        .order('ordine', { ascending: true }),
      supabase.rpc('risposte_questionario_del_partecipante', {
        p_codice: codice,
        p_timepoint: tpId
      })
    ])

    if (errItem || !righe?.length) {
      setErrore('I questionari non sono ancora disponibili. Riprova più tardi.')
      setInvio(false)
      return
    }
    if (errRisposte || !salvate) {
      setErrore(errRisposte?.message?.includes('COMPILAZIONE_ASSENTE')
        ? 'Non risultano risposte salvate per questo momento.'
        : messaggioErrore(errRisposte) || 'Non è stato possibile caricare l’esito.')
      setInvio(false)
      return
    }

    const lista = typeof salvate === 'string' ? JSON.parse(salvate) : salvate
    const mappa = {}
    for (const r of lista || []) {
      if (r.item_id != null) mappa[r.item_id] = r.valore
    }
    const ordinati = ordinaItem(righe)
    setTimepoint(tpId)
    setItem(ordinati)
    setRisposte(mappa)
    setPunteggi(calcolaPunteggi(ordinati, mappa))
    setPasso('esito')
    setInvio(false)
  }

  useEffect(() => {
    if (!registrato || !codice) return undefined
    if (!onboardingCompleto) return undefined
    autoAvvioRef.current = false
    caricaPiano()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrato, codice, onboardingCompleto])

  useEffect(() => {
    if (!piano || !forzatoT0 || autoAvvioRef.current || passo !== 'scelta') return
    const t0 = (piano.timepoints || []).find(tp => tp.id === 'T0')
    if (!t0) return
    if (t0.stato === 'completato') {
      autoAvvioRef.current = true
      aggiornaPercorso(codice).then(() => mostraEsito('T0'))
      return
    }
    if (t0.stato === 'aperto') {
      autoAvvioRef.current = true
      avviaTimepoint(t0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piano, forzatoT0, passo])

  function rispondi(id, valore) {
    setRisposte(prev => ({ ...prev, [id]: valore }))
  }

  async function inviaTutto() {
    if (item.some(i => risposte[i.id] == null)) {
      setErrore('Rispondi a tutte le domande prima di inviare.')
      return
    }
    setErrore(null)
    setInvio(true)
    const payload = item.map(i => ({ item_id: i.id, valore: risposte[i.id] }))
    const { error } = await supabase.rpc('salva_risposte_questionario', {
      p_codice: codice,
      p_timepoint: timepoint,
      p_risposte: payload
    })
    if (error) {
      setErrore(messaggioErrore(error))
      setInvio(false)
      return
    }
    setPunteggi(calcolaPunteggi(item, risposte))
    setPasso('esito')
    setInvio(false)
    await aggiornaPercorso(codice)
  }

  if (registrato && !onboardingCompleto) {
    return <Navigate to="/onboarding" replace />
  }

  if (passo === 'esito') {
    return (
      <div className="esito-compilazione">
        <header className="esito-testa">
          <p className="badge">Registrato</p>
          <h2>Compilazione completata</h2>
          <p className="lead esito-lead">
            Le risposte di questo momento sono state salvate e collegate al tuo codice partecipante.
          </p>
          <div className="esito-meta">
            <span className="esito-meta-chip">{timepoint}</span>
            <span className="esito-meta-codice">{codice.toUpperCase()}</span>
          </div>
        </header>

        {(punteggi?.pss10 || punteggi?.ffmq) && (
          <section className="esito-punteggi" aria-label="Punteggi">
            <h3 className="esito-sezione-titolo">I tuoi punteggi</h3>
            <p className="hint esito-punteggi-hint">
              L’indicatore mostra dove si colloca il punteggio nel range dello strumento.
              Non è una diagnosi né una valutazione clinica.
            </p>
            <div className="esito-griglia">
              {punteggi?.pss10 && (
                <article className={`esito-strumento is-${punteggi.pss10.orientamento?.id || 'intermedio'}`}>
                  <p className="esito-strumento-nome">PSS-10 · stress percepito</p>
                  <p className="esito-strumento-valore">{punteggi.pss10.totale}</p>
                  <p className="esito-strumento-range">
                    Totale · range {punteggi.pss10.min}–{punteggi.pss10.max}
                  </p>
                  <IndicatoreOrientamento orientamento={punteggi.pss10.orientamento} />
                </article>
              )}
              {punteggi?.ffmq && (
                <article className={`esito-strumento is-${punteggi.ffmq.orientamento?.id || 'intermedio'}`}>
                  <p className="esito-strumento-nome">FFMQ-I · consapevolezza</p>
                  <p className="esito-strumento-valore">{punteggi.ffmq.totale}</p>
                  <p className="esito-strumento-range">
                    Totale · range {punteggi.ffmq.min}–{punteggi.ffmq.max}
                  </p>
                  <IndicatoreOrientamento orientamento={punteggi.ffmq.orientamento} />
                </article>
              )}
            </div>
            {punteggi?.ffmq && (
              <ul className="esito-sottoscale">
                {Object.keys(SOTTOSCALE_ETICHETTE).map(chiave => {
                  const ori = punteggi.ffmq.orientamentiSottoscale?.[chiave]
                  return (
                    <li key={chiave}>
                      <div className="esito-sottoscala-testo">
                        <span>{SOTTOSCALE_ETICHETTE[chiave]}</span>
                        <strong>{punteggi.ffmq[chiave]}</strong>
                      </div>
                      <IndicatoreOrientamento orientamento={ori} compatto />
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        <Disclaimer>
          Questi numeri e indicatori descrivono le tue risposte rispetto al range del questionario
          in questo momento del percorso. Non sono una valutazione clinica e il percorso non
          sostituisce una presa in carico psicologica o terapeutica professionale.
        </Disclaimer>

        {timepoint === 'T0' ? (
          <div className="azioni esito-azioni">
            <Link className="btn btn-avanti" to="/programma">
              Apri la settimana di pratica
            </Link>
            <button className="btn btn-ghost" type="button" onClick={() => caricaPiano()}>
              Torna ai questionari
            </button>
          </div>
        ) : (
          <div className="azioni esito-azioni">
            <button className="btn btn-ghost" type="button" onClick={() => caricaPiano()}>
              Torna ai questionari
            </button>
          </div>
        )}
      </div>
    )
  }

  if (passo === 'domanda' && corrente) {
    const ultima = indice === item.length - 1
    const haRisposta = risposte[corrente.id] != null
    return (
      <div>
        {forzatoT0 && timepoint === 'T0' && (
          <p className="hint">Primo accesso: completa PSS-10 e FFMQ-I (T0) per aprire le settimane.</p>
        )}
        <p className="meta-riga">
          <span className="badge">{nomeStrumento}</span>
          <span>{codice.toUpperCase()} · {timepoint}</span>
          <span>Domanda {indice + 1} di {item.length}</span>
        </p>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${Math.max(avanzamento, ((indice) / item.length) * 100)}%` }} />
        </div>
        <div className="card card-domanda">
          <ScalaLikert
            item={corrente}
            valore={risposte[corrente.id]}
            onChange={rispondi}
            disabilitato={invio}
          />
          {errore && <p className="campo-errore" role="alert">{errore}</p>}
          <div className="azioni">
            <button
              className="btn btn-ghost"
              type="button"
              disabled={invio || (forzatoT0 && timepoint === 'T0' && indice === 0)}
              onClick={() => {
                setErrore(null)
                if (indice === 0) {
                  if (forzatoT0 && timepoint === 'T0') return
                  setPasso('scelta')
                } else setIndice(i => i - 1)
              }}
            >
              Precedente
            </button>
            {ultima ? (
              <button className="btn" type="button" disabled={!haRisposta || invio} onClick={inviaTutto}>
                {invio ? 'Invio in corso…' : 'Invia i questionari'}
              </button>
            ) : (
              <button
                className="btn btn-avanti"
                type="button"
                disabled={!haRisposta || invio}
                onClick={() => { setErrore(null); setIndice(i => i + 1) }}
              >
                Successiva
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (passo === 'scelta' && piano) {
    const t3aperto = piano.timepoints?.some(tp => tp.id === 'T3' && tp.stato === 'aperto')
    const nessunoAperto = !piano.timepoints?.some(tp => tp.stato === 'aperto')
    const t0 = (piano.timepoints || []).find(tp => tp.id === 'T0')
    const aperti = (piano.timepoints || []).filter(tp => tp.stato === 'aperto')
    return (
      <div className="questionari-scelta">
        <header className="questionari-testa">
          <h2>Questionari</h2>
          <p className="lead">
            PSS-10 e FFMQ-I si aprono in quattro momenti del ciclo. Puoi compilare
            solo il momento disponibile ora.
          </p>
        </header>

        {forzatoT0 && t0?.stato === 'aperto' && (
          <p className="questionari-avviso is-azione">
            Per aprire le settimane, completa prima i questionari iniziali (T0).
          </p>
        )}
        {forzatoT0 && t0 && t0.stato !== 'aperto' && t0.stato !== 'completato' && (
          <p className="questionari-avviso is-errore">
            I questionari T0 non risultano aperti in questa finestra. Contatta il facilitatore.
          </p>
        )}
        {percorsoPronto && (
          <Link className="questionari-scorciatoia" to="/programma">
            <span>Percorso pronto</span>
            <strong>Apri la settimana di pratica</strong>
          </Link>
        )}

        <section className="questionari-momenti" aria-labelledby="momenti-titolo">
          <div className="questionari-situazione">
            <p id="momenti-titolo" className="questionari-situazione-label">Situazione attuale</p>
            <p className="questionari-situazione-testo">{etichettaSettimana(piano.settimana, piano.data_inizio)}</p>
            {aperti.length > 0 ? (
              <p className="hint">
                {aperti.length === 1
                  ? `Ora puoi compilare ${aperti[0].id}.`
                  : `Ora puoi compilare: ${aperti.map(t => t.id).join(', ')}.`}
              </p>
            ) : (
              <p className="hint">
                Nessun questionario è aperto in questa settimana. Torna quando si apre il prossimo momento.
              </p>
            )}
          </div>

          {t3aperto && (
            <p className="questionari-avviso is-azione">
              T3 è il follow-up a distanza: è il momento più facile da dimenticare, e per il
              percorso è importante quanto gli altri.
            </p>
          )}

          <ul className="tp-lista">
            {(piano.timepoints || []).map(tp => {
              const meta = ETICHETTE[tp.id]
              const bloccatoAltri = forzatoT0 && tp.id !== 'T0' && !t0Completo
              const puoIniziare = tp.stato === 'aperto' && !bloccatoAltri
              const puoVedere = tp.stato === 'completato'
              return (
                <li key={tp.id} className={`tp-card is-${tp.stato}`}>
                  <div className="tp-card-corpo">
                    <span className={`tp-stato-punto is-${tp.stato}`} aria-hidden="true" />
                    <div className="tp-card-testi">
                      <div className="tp-card-riga">
                        <strong>{meta?.titolo || tp.id}</strong>
                        <span className={`badge badge-tp is-${tp.stato}`}>
                          {STATO_BADGE[tp.stato] || tp.stato}
                        </span>
                      </div>
                      <p className="tp-card-quando">{tp.quando || meta?.sottotitolo}</p>
                    </div>
                  </div>
                  {(puoIniziare || puoVedere) && (
                    <div className="tp-card-azione">
                      {puoIniziare && (
                        <button
                          className="btn btn-avanti"
                          type="button"
                          disabled={invio}
                          onClick={() => avviaTimepoint(tp)}
                        >
                          {invio ? 'Caricamento…' : `Inizia ${tp.id}`}
                        </button>
                      )}
                      {puoVedere && (
                        <button
                          className="btn btn-esito"
                          type="button"
                          disabled={invio}
                          onClick={() => mostraEsito(tp.id)}
                        >
                          {invio ? 'Caricamento…' : 'Vedi esito'}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {errore && <p className="campo-errore" role="alert">{errore}</p>}
        </section>
      </div>
    )
  }

  return (
    <div>
      <h2>Questionari</h2>
      {registrato ? (
        <StatoAttesa etichetta="Caricamento dei momenti…" />
      ) : (
        <ChiediCodice titolo="Per vedere i questionari di un partecipante, inserisci il codice." />
      )}
      {errore && <p className="campo-errore" role="alert">{errore}</p>}
    </div>
  )
}
