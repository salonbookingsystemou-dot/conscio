import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, supabaseConfigurato } from '../lib/supabaseClient'
import { usePartecipante } from '../lib/partecipante.jsx'
import ChiediCodice from '../components/ChiediCodice.jsx'
import Disclaimer from '../components/Disclaimer.jsx'
import CampoNota from '../components/CampoNota.jsx'
import CalendarioPratica from '../components/CalendarioPratica.jsx'
import TracciaGuidata from '../components/TracciaGuidata.jsx'
import TonoEsperienza from '../components/TonoEsperienza.jsx'
import VoceLog from '../components/VoceLog.jsx'
import { addDays, formatISODate, oggiLocaleISO, parseISODate } from '../lib/date.js'
import {
  ascoltoCompletato,
  chiaveAscoltoEsercizio,
  formaliAscoltatiNelGiorno
} from '../lib/ascolto.js'

function etichettaSettimana(numero) {
  return numero === 9 ? 'Intensiva' : `Settimana ${numero}`
}

function eFormale(esercizio) {
  const tipo = (esercizio.tipo || '').toLowerCase()
  return tipo === 'formale' || tipo === 'a_casa'
}

function eInformale(esercizio) {
  return (esercizio.tipo || '').toLowerCase() === 'informale'
}

function etichettaDurataMinuti(minuti, secondiTraccia) {
  if (Number.isFinite(minuti) && minuti > 0) {
    return minuti === 1 ? '1 minuto' : `${minuti} minuti`
  }
  if (Number.isFinite(secondiTraccia) && secondiTraccia > 0) {
    const m = Math.max(1, Math.round(secondiTraccia / 60))
    return m === 1 ? '1 minuto' : `${m} minuti`
  }
  return null
}

function spuntatoNelGiorno(esercizio, data) {
  const giorno = String(data).slice(0, 10)
  return (esercizio.log || []).some(r =>
    String(r.data).slice(0, 10) === giorno && r.tipo === 'informale'
  )
}

function AnnotazioniGiorno({
  codice,
  data,
  durataMinuti,
  annotazioni,
  puoRegistrare,
  onSalvato
}) {
  const [note, setNote] = useState('')
  const [tonoDopo, setTonoDopo] = useState('')
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState(null)
  const delGiorno = (annotazioni || []).filter(a => String(a.data).slice(0, 10) === String(data).slice(0, 10))

  const notaPronta = note.trim().length > 0

  async function registra(e) {
    e.preventDefault()
    if (!puoRegistrare || !notaPronta) return
    setErrore(null)
    setInvio(true)
    const { error } = await supabase.rpc('salva_annotazione_giorno', {
      p_codice: codice.trim(),
      p_data: data,
      p_note: note.trim(),
      p_durata: durataMinuti > 0 ? durataMinuti : null,
      p_tono_dopo: tonoDopo || null
    })
    if (error) {
      setErrore(error.message?.includes('CODICE_NON_TROVATO')
        ? 'Codice non riconosciuto.'
        : error.message?.includes('NOTA_MANCANTE')
          ? 'La nota è necessaria per chiudere la sessione.'
          : 'Non è stato possibile salvare l’annotazione.')
      setInvio(false)
      return
    }
    setNote('')
    setTonoDopo('')
    setInvio(false)
    onSalvato()
  }

  if (!puoRegistrare) {
    return (
      <div className="annotazioni-giorno is-bloccato">
        <h3>Annotazioni del giorno</h3>
        <p className="hint">
          Ascolta prima le tracce delle pratiche formali di oggi. Poi si apre questo spazio.
        </p>
      </div>
    )
  }

  return (
    <div className="annotazioni-giorno">
      <h3>Annotazioni del giorno</h3>
      {delGiorno.length > 0 && (
        <div className="elenco-log">
          {delGiorno.map(riga => (
            <VoceLog key={riga.id} riga={riga} />
          ))}
        </div>
      )}
      <form onSubmit={registra}>
        <TonoEsperienza
          label="Come ti senti dopo"
          value={tonoDopo}
          onChange={setTonoDopo}
          hint="Un tocco: piacevole, neutro o spiacevole. Non è un voto."
        />
        <CampoNota
          required
          label="Nota"
          value={note}
          onChange={setNote}
          placeholder="Cosa è sorto, come ti senti dopo"
        />
        <button className="btn" type="submit" disabled={invio || !notaPronta}>
          {invio ? 'Salvataggio…' : 'Registra la pratica di oggi'}
        </button>
        {!notaPronta && <p className="hint">La nota è necessaria per chiudere la sessione.</p>}
        {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
      </form>
    </div>
  )
}

function TaskFormale({
  esercizio,
  codice,
  data,
  onAscolto,
  onCompletoGiorno,
  aggiornaAscolto
}) {
  const chiave = chiaveAscoltoEsercizio(codice, esercizio.id, data)
  const [ascoltata, setAscoltata] = useState(() => ascoltoCompletato(chiave))
  const [durataSec, setDurataSec] = useState(0)
  const haTraccia = Boolean(esercizio.traccia_audio)

  useEffect(() => {
    setAscoltata(ascoltoCompletato(chiave))
    setDurataSec(0)
  }, [chiave])

  function suCompleto(ok) {
    setAscoltata(Boolean(ok))
    onCompletoGiorno?.()
  }

  const durataLabel = etichettaDurataMinuti(esercizio.durata_minuti, durataSec)

  return (
    <article className={`task-pratica${ascoltata ? ' is-fatta' : ''}`}>
      <div className="task-pratica-testa">
        <span className={`task-punto${ascoltata ? ' is-fatto' : ''}`} aria-hidden="true" />
        <div className="task-pratica-testi">
          <h4>{esercizio.descrizione}</h4>
          <p className="hint">
            {[durataLabel, haTraccia ? 'traccia audio' : null, ascoltata ? 'ascoltata oggi' : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>
      {haTraccia ? (
        <TracciaGuidata
          key={chiave}
          src={esercizio.traccia_audio}
          persistenzaKey={chiave}
          onCompleto={suCompleto}
          onDurata={setDurataSec}
          onAscolto={() => {
            aggiornaAscolto?.()
            onAscolto?.()
          }}
        />
      ) : (
        <p className="hint">Nessuna traccia ancora collegata a questa pratica.</p>
      )}
    </article>
  )
}

export default function Programma() {
  const { codice, registrato, aggiornaAscolto } = usePartecipante()
  const [lezioni, setLezioni] = useState([])
  const [ciclo, setCiclo] = useState(null)
  const [tutteSessioni, setTutteSessioni] = useState([])
  const [dataScelta, setDataScelta] = useState(() => oggiLocaleISO())
  const [settimana, setSettimana] = useState(null)
  const [limite, setLimite] = useState(1)
  const [errore, setErrore] = useState(null)
  const [invio, setInvio] = useState(false)
  const [aperto, setAperto] = useState(false)
  const [tickAscolto, setTickAscolto] = useState(0)
  const pillsRef = useRef(null)

  async function caricaProgramma(codicePulito) {
    const [{ data, error }, { data: cicloData }, { data: log }] = await Promise.all([
      supabase.rpc('programma_del_partecipante', { p_codice: codicePulito }),
      supabase.rpc('ciclo_del_partecipante', { p_codice: codicePulito }),
      supabase.rpc('log_pratica_del_partecipante', { p_codice: codicePulito })
    ])
    if (error || !data) {
      setErrore(error?.message?.includes('CODICE_NON_TROVATO')
        ? 'Codice non riconosciuto.'
        : 'Non è stato possibile caricare il programma.')
      return false
    }
    const payload = typeof data === 'string' ? JSON.parse(data) : data
    const apertaFino = Math.max(1, Math.min(9, payload.settimana_corrente || 1))
    setLezioni(payload.lezioni || [])
    setCiclo(cicloData || null)
    setTutteSessioni(log || [])
    setLimite(apertaFino)
    setSettimana(prev => {
      const scelta = prev ?? apertaFino
      return scelta > apertaFino ? apertaFino : scelta
    })
    setAperto(true)
    return true
  }

  useEffect(() => {
    if (!registrato || !codice) return undefined
    setErrore(null)
    setInvio(true)
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      setInvio(false)
      return undefined
    }
    caricaProgramma(codice).finally(() => setInvio(false))
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrato, codice])

  const corrente = lezioni.find(l => l.numero_settimana === settimana && l.numero_settimana <= limite)
    || lezioni.find(l => l.numero_settimana === limite)
    || lezioni[0]

  useEffect(() => {
    const attiva = pillsRef.current?.querySelector('.settimana-pill.is-on')
    attiva?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [settimana, aperto])

  const inizioCiclo = parseISODate(ciclo?.data_inizio)
  const inizioSettimana = inizioCiclo && corrente
    ? addDays(inizioCiclo, (Math.max(1, corrente.numero_settimana) - 1) * 7)
    : null
  const fineSettimana = inizioSettimana ? addDays(inizioSettimana, 6) : null

  useEffect(() => {
    if (!inizioSettimana || !fineSettimana) return
    const inizio = formatISODate(inizioSettimana)
    const fine = formatISODate(fineSettimana)
    const oggi = oggiLocaleISO()
    setDataScelta(prev => {
      if (prev >= inizio && prev <= fine) return prev
      if (oggi >= inizio && oggi <= fine) return oggi
      return inizio
    })
  }, [inizioSettimana, fineSettimana, settimana])

  const esercizi = useMemo(() => {
    const lista = [...(corrente?.esercizi || [])]
    lista.sort((a, b) => (a.ordine || 0) - (b.ordine || 0) || String(a.id).localeCompare(String(b.id)))
    return lista
  }, [corrente])

  const formali = esercizi.filter(eFormale)
  const informali = esercizi.filter(eInformale)

  const ascoltoOk = useMemo(() => {
    if (!codice || !corrente) return false
    return formaliAscoltatiNelGiorno(formali, codice.trim(), dataScelta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codice, corrente, dataScelta, formali, tickAscolto])

  const durataGiorno = useMemo(() => {
    return formali.reduce((tot, ex) => {
      if (Number.isFinite(ex.durata_minuti) && ex.durata_minuti > 0) return tot + ex.durata_minuti
      return tot
    }, 0)
  }, [formali])

  async function toggleInformale(esercizio, fatto) {
    setErrore(null)
    const { error } = await supabase.rpc('spunta_informale', {
      p_codice: codice.trim(),
      p_esercizio_id: esercizio.id,
      p_data: dataScelta,
      p_fatto: fatto
    })
    if (error) {
      setErrore('Non è stato possibile aggiornare la pratica informale.')
      return
    }
    caricaProgramma(codice.trim())
  }

  const badgeSettimana = corrente
    ? corrente.numero_settimana === 9
      ? 'Giornata intensiva'
      : `Questa settimana · ${corrente.numero_settimana} di 8`
    : null

  return (
    <div>
      {!registrato && (
        <>
          <h2>Questa settimana</h2>
          <p className="lead">
            Tema e pratiche della settimana in corso. Ogni giorno ascolti le tracce formali,
            spunti le informali e poi apri le annotazioni.
          </p>
          <Disclaimer />
          <ChiediCodice titolo="Per vedere la settimana di un partecipante, inserisci il codice." />
        </>
      )}
      {registrato && invio && !aperto && <p>Caricamento del programma…</p>}
      {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}

      {aperto && lezioni.length === 0 && (
        <p>Il programma di questa edizione non è ancora stato caricato.</p>
      )}

      {lezioni.length > 0 && (
        <>
          <div className="settimane-pills" ref={pillsRef}>
            {lezioni.map(l => {
              const n = l.numero_settimana
              const inCorso = n === limite
              const bloccata = n > limite
              const attiva = corrente && n === corrente.numero_settimana
              const etichetta = etichettaSettimana(n)
              return (
                <button
                  key={l.id || n}
                  type="button"
                  disabled={bloccata}
                  aria-disabled={bloccata}
                  aria-current={inCorso ? 'true' : undefined}
                  aria-label={
                    `${etichetta}${l.tema ? `, ${l.tema}` : ''}${bloccata ? ', non ancora aperta' : inCorso ? ', in corso' : ''}`
                  }
                  className={`settimana-pill${attiva ? ' is-on' : ''}${inCorso ? ' is-ora' : ''}${bloccata ? ' is-bloccata' : ''}`}
                  onClick={() => { if (!bloccata) setSettimana(n) }}
                >
                  <span className="sett-riga">
                    <span className="sett-etichetta">{etichetta}</span>
                    {inCorso && <span className="sett-ora">in corso</span>}
                    {bloccata && <span className="sett-lock">chiusa</span>}
                  </span>
                  <span className="sett-tema">{l.tema || (n === 9 ? 'Giornata intensiva' : `Settimana ${n}`)}</span>
                </button>
              )
            })}
          </div>

          {corrente && (
            <div className="card settimana-vista">
              {badgeSettimana && <p className="badge badge-settimana">{badgeSettimana}</p>}
              <h2 className="settimana-titolo">{corrente.tema || `Settimana ${corrente.numero_settimana}`}</h2>
              {corrente.sottotitolo && <p className="lead settimana-sottotitolo">{corrente.sottotitolo}</p>}
              <Disclaimer />

              {inizioSettimana && (
                <CalendarioPratica
                  titolo="Questa settimana"
                  inizio={formatISODate(inizioSettimana)}
                  fine={formatISODate(fineSettimana)}
                  sessioni={tutteSessioni.filter(s => s.tipo === 'giorno')}
                  giornoAttivo={dataScelta}
                  onGiorno={setDataScelta}
                  soloIntervallo
                />
              )}

              <section className="blocco-giorno" aria-labelledby="da-fare-titolo">
                <h3 id="da-fare-titolo">Da fare ogni giorno</h3>
                {formali.length === 0 && (
                  <p className="hint">Nessuna pratica formale assegnata a questa settimana.</p>
                )}
                <div className="lista-task">
                  {formali.map(ex => (
                    <TaskFormale
                      key={`${ex.id}-${dataScelta}`}
                      esercizio={ex}
                      codice={codice.trim()}
                      data={dataScelta}
                      aggiornaAscolto={aggiornaAscolto}
                      onCompletoGiorno={() => setTickAscolto(t => t + 1)}
                      onAscolto={() => setTickAscolto(t => t + 1)}
                    />
                  ))}
                </div>
              </section>

              {informali.length > 0 && (
                <section className="blocco-informali" aria-labelledby="informali-titolo">
                  <h3 id="informali-titolo">Pratiche informali</h3>
                  <p className="hint">Tocca per spuntare quelle fatte oggi.</p>
                  <div className="chip-riga chip-informali">
                    {informali.map(ex => {
                      const fatta = spuntatoNelGiorno(ex, dataScelta)
                      return (
                        <button
                          key={ex.id}
                          type="button"
                          className={`chip chip-spunta${fatta ? ' is-on' : ''}`}
                          aria-pressed={fatta}
                          onClick={() => toggleInformale(ex, !fatta)}
                        >
                          <span className={`chip-check${fatta ? ' is-fatto' : ''}`} aria-hidden="true">
                            {fatta ? '✓' : ''}
                          </span>
                          <span className="chip-testo">{ex.descrizione}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              <AnnotazioniGiorno
                codice={codice}
                data={dataScelta}
                durataMinuti={durataGiorno}
                annotazioni={corrente.annotazioni_giorno || []}
                puoRegistrare={ascoltoOk}
                onSalvato={() => {
                  caricaProgramma(codice.trim())
                  aggiornaAscolto()
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
