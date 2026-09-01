import { useEffect, useState } from 'react'
import { supabase, supabaseConfigurato } from '../lib/supabaseClient'
import { usePartecipante } from '../lib/partecipante.jsx'
import { calcolaPunteggi } from '../lib/scoring'
import ScalaLikert from '../components/ScalaLikert.jsx'
import Disclaimer from '../components/Disclaimer.jsx'
import ChiediCodice from '../components/ChiediCodice.jsx'

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

function etichettaSettimana(n) {
  if (n == null) return ''
  if (n === 0) return 'Il ciclo non è ancora iniziato.'
  if (n === 9) return 'Sei nella settimana intensiva (9).'
  return `Sei nella settimana ${n} del ciclo.`
}

export default function Questionari() {
  const { codice, registrato } = usePartecipante()
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
      return
    }

    const { data, error } = await supabase.rpc('stato_questionari_del_partecipante', {
      p_codice: codice
    })

    if (error) {
      setErrore(messaggioErrore(error))
      setInvio(false)
      return
    }

    setPiano(data)
    setPasso('scelta')
    setInvio(false)
  }

  useEffect(() => {
    if (registrato && codice) caricaPiano()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrato, codice])

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
  }

  if (passo === 'esito') {
    return (
      <div className="card">
        <h2>Compilazione registrata</h2>
        <p>
          Le risposte per <strong>{timepoint}</strong> sono associate al codice
        </p>
        <p className="codice-enfasi">{codice.toUpperCase()}</p>
        {punteggi?.pss10 && (
          <p>PSS-10 — punteggio totale: <strong>{punteggi.pss10.totale}</strong> (range {punteggi.pss10.min}–{punteggi.pss10.max})</p>
        )}
        {punteggi?.ffmq && (
          <div>
            <p>FFMQ-I — punteggio totale: <strong>{punteggi.ffmq.totale}</strong> (range {punteggi.ffmq.min}–{punteggi.ffmq.max})</p>
            <ul>
              {Object.keys(SOTTOSCALE_ETICHETTE).map(chiave => (
                <li key={chiave}>{SOTTOSCALE_ETICHETTE[chiave]}: {punteggi.ffmq[chiave]}</li>
              ))}
            </ul>
          </div>
        )}
        <Disclaimer>
          Questi numeri descrivono le tue risposte in questo momento del percorso.
          Non sono una valutazione clinica e il percorso non sostituisce una presa in carico
          psicologica o terapeutica professionale.
        </Disclaimer>
      </div>
    )
  }

  if (passo === 'domanda' && corrente) {
    const ultima = indice === item.length - 1
    const haRisposta = risposte[corrente.id] != null
    return (
      <div>
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
          {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
          <div className="azioni">
            <button
              className="btn btn-ghost"
              type="button"
              disabled={invio}
              onClick={() => {
                setErrore(null)
                if (indice === 0) setPasso('scelta')
                else setIndice(i => i - 1)
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
                className="btn"
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
    return (
      <div className="layout-due">
        <div>
          <h2>Questionari</h2>
          <Disclaimer />
          <div className="card">
            <p>
              PSS-10 e FFMQ-I si compilano quattro volte, ciascuna nella settimana prevista.
              Non puoi scegliere un momento futuro o già chiuso.
            </p>
            <p className="ciclo-meta">{etichettaSettimana(piano.settimana)}</p>
            {nessunoAperto && (
              <p>Nessun questionario è aperto in questa settimana. Torna quando si apre il prossimo momento.</p>
            )}
            {t3aperto && (
              <Disclaimer>
                T3 è il follow-up a distanza: è il momento più facile da dimenticare, e per il
                percorso è importante quanto gli altri.
              </Disclaimer>
            )}
            <div className="tp-lista">
              {(piano.timepoints || []).map(tp => {
                const meta = ETICHETTE[tp.id]
                return (
                  <div key={tp.id} className={`tp-card is-${tp.stato}`}>
                    <div>
                      <strong>{meta?.titolo || tp.id}</strong>
                      <span className="ciclo-meta">{tp.quando || meta?.sottotitolo}</span>
                    </div>
                    <span className="badge">{STATO_BADGE[tp.stato] || tp.stato}</span>
                    {tp.stato === 'aperto' && (
                      <button
                        className="btn"
                        type="button"
                        disabled={invio}
                        onClick={() => avviaTimepoint(tp)}
                      >
                        {invio ? 'Caricamento…' : `Inizia ${tp.id}`}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
          </div>
        </div>
        <aside>
          <div className="card card-lato">
            <h3>Quando si compilano</h3>
            <ul>
              <li>T0 all’inizio (settimana 1)</li>
              <li>T1 a metà (settimane 4–5)</li>
              <li>T2 alla fine (settimane 8–9)</li>
              <li>T3 dopo la fine del ciclo</li>
            </ul>
          </div>
        </aside>
      </div>
    )
  }

  return (
    <div>
      <h2>Questionari</h2>
      <Disclaimer />
      {registrato ? (
        <p>Caricamento dei momenti…</p>
      ) : (
        <ChiediCodice titolo="Per vedere i questionari di un partecipante, inserisci il codice." />
      )}
      {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
    </div>
  )
}
