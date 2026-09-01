import { useEffect, useRef, useState } from 'react'
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
import { ascoltoCompletato } from '../lib/ascolto.js'

function etichettaTipo(tipo) {
  if (tipo === 'informale') return 'Informale'
  if (tipo === 'formale') return 'Formale'
  if (tipo === 'a_casa') return 'A casa'
  return tipo || 'Pratica'
}

function etichettaPill(lezione) {
  if (lezione.tema) return lezione.tema
  return lezione.numero_settimana === 9 ? 'Intensiva' : 'Settimana'
}

function minutiDaSecondi(secondi) {
  if (!Number.isFinite(secondi) || secondi <= 0) return null
  return Math.max(1, Math.round(secondi / 60))
}

function etichettaDurata(secondi) {
  if (!Number.isFinite(secondi) || secondi <= 0) return null
  const m = Math.floor(secondi / 60)
  const s = Math.floor(secondi % 60)
  return s === 0 ? `${m} min` : `${m} min ${s} s`
}

function LogSottoEsercizio({ codice, esercizio, onSalvato, dataScelta, puoRegistrare, haTraccia, durataTraccia }) {
  const informale = (esercizio.tipo || '').includes('informale')
  const [data, setData] = useState(dataScelta || oggiLocaleISO())
  const [minuti, setMinuti] = useState(informale ? 5 : 20)
  const minutiTraccia = minutiDaSecondi(durataTraccia)
  const durataPronta = haTraccia ? minutiTraccia != null : Number(minuti) > 0

  useEffect(() => {
    if (dataScelta) setData(dataScelta)
  }, [dataScelta])
  const [note, setNote] = useState('')
  const [tonoPrima, setTonoPrima] = useState('')
  const [tonoDopo, setTonoDopo] = useState('')
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState(null)
  const log = esercizio.log || []

  const notaPronta = note.trim().length > 0

  async function registra(e) {
    e.preventDefault()
    const durata = haTraccia ? minutiTraccia : Number(minuti)
    if (!puoRegistrare || !notaPronta || !durata) return
    setErrore(null)
    setInvio(true)
    const { error } = await supabase.rpc('salva_log_pratica', {
      p_codice: codice.trim(),
      p_data: data,
      p_durata: durata,
      p_note: note.trim() || null,
      p_tipo: esercizio.tipo || null,
      p_esercizio_id: esercizio.id,
      p_tono_dopo: tonoDopo || null,
      p_tono_prima: informale ? (tonoPrima || null) : null
    })
    if (error) {
      setErrore(error.message?.includes('CODICE_NON_TROVATO')
        ? 'Codice non riconosciuto.'
        : error.message?.includes('ESERCIZIO_NON_VALIDO')
          ? 'Questa pratica non appartiene al tuo ciclo.'
          : error.message?.includes('NOTA_MANCANTE')
            ? 'La nota è necessaria per chiudere la sessione.'
            : 'Non è stato possibile registrare la pratica.')
      setInvio(false)
      return
    }
    setNote('')
    setTonoPrima('')
    setTonoDopo('')
    setInvio(false)
    onSalvato()
  }

  return (
    <div className="pratica-blocco">
      <h4>
        <span className="badge">{etichettaTipo(esercizio.tipo)}</span>
        {' '}{esercizio.descrizione}
      </h4>
      {!puoRegistrare ? (
        <p className="hint">
          Ascolta prima la traccia guidata fino alla fine: è il materiale della sessione.
          Poi potrai scrivere la nota e registrare.
        </p>
      ) : (
        <>
          {log.length === 0 && <p className="hint">Nessuna sessione ancora registrata per questa pratica.</p>}
          <div className="elenco-log">
            {log.map(riga => (
              <VoceLog key={riga.id} riga={riga} />
            ))}
          </div>
          <form onSubmit={registra}>
            {haTraccia ? (
              <div className="field">
                <label>Data</label>
                <input type="date" required value={data} onChange={e => setData(e.target.value)} />
                <p className="hint">
                  {etichettaDurata(durataTraccia)
                    ? `Durata della sessione: ${etichettaDurata(durataTraccia)}, dalla traccia guidata.`
                    : 'La durata della sessione è quella della traccia guidata.'}
                </p>
              </div>
            ) : (
              <div className="riga-due">
                <div className="field">
                  <label>Data</label>
                  <input type="date" required value={data} onChange={e => setData(e.target.value)} />
                </div>
                <div className="field">
                  <label>Minuti</label>
                  <input
                    type="number"
                    min="1"
                    max="240"
                    required
                    value={minuti}
                    onChange={e => setMinuti(e.target.value)}
                  />
                </div>
              </div>
            )}
            {informale && (
              <TonoEsperienza
                label="All’inizio"
                value={tonoPrima}
                onChange={setTonoPrima}
                hint="Il tono di ciò che c’era, prima."
              />
            )}
            <TonoEsperienza
              label="Come ti senti dopo"
              value={tonoDopo}
              onChange={setTonoDopo}
              hint="Un tocco: piacevole, neutro o spiacevole. Non è un voto."
            />
            <CampoNota
              required
              label={informale ? 'Cosa hai notato' : 'Nota'}
              value={note}
              onChange={setNote}
              placeholder={informale ? 'Situazione, prima, dopo' : 'Cosa è sorto, come ti senti dopo'}
            />
            <button className="btn" type="submit" disabled={invio || !notaPronta || !durataPronta}>
              {invio ? 'Salvataggio…' : 'Registra questa sessione'}
            </button>
            {!notaPronta && <p className="hint">La nota è necessaria per chiudere la sessione.</p>}
            {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
          </form>
        </>
      )}
    </div>
  )
}

export default function Programma() {
  const { codice, registrato, aggiornaAscolto } = usePartecipante()
  const [lezioni, setLezioni] = useState([])
  const [ciclo, setCiclo] = useState(null)
  const [tutteSessioni, setTutteSessioni] = useState([])
  const [dataScelta, setDataScelta] = useState(oggiLocaleISO)
  const [settimana, setSettimana] = useState(null)
  const [limite, setLimite] = useState(1)
  const [errore, setErrore] = useState(null)
  const [invio, setInvio] = useState(false)
  const [aperto, setAperto] = useState(false)
  const [ascoltoOk, setAscoltoOk] = useState(false)
  const [durataTraccia, setDurataTraccia] = useState(0)
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
  const srcTraccia = corrente?.traccia_audio || null
  const chiaveAscolto = corrente && codice
    ? `${codice.trim()}:${corrente.id || corrente.numero_settimana}`
    : null

  useEffect(() => {
    setDurataTraccia(0)
    if (!srcTraccia || !chiaveAscolto) {
      setAscoltoOk(false)
      return
    }
    setAscoltoOk(ascoltoCompletato(chiaveAscolto))
  }, [chiaveAscolto, srcTraccia])

  return (
    <div>
      <h2>Questa settimana</h2>
      <p className="lead">
        Tema e pratiche della settimana in corso. La traccia guidata è il materiale della sessione:
        va ascoltata per intero, poi si apre il log con una nota. Le settimane successive si sbloccano quando tocca.
      </p>
      <Disclaimer />

      {!registrato && (
        <ChiediCodice titolo="Per vedere la settimana di un partecipante, inserisci il codice." />
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
              return (
                <button
                  key={l.id || n}
                  type="button"
                  disabled={bloccata}
                  aria-disabled={bloccata}
                  aria-current={inCorso ? 'true' : undefined}
                  aria-label={
                    n === 9
                      ? `${etichettaPill(l)}${bloccata ? ', non ancora aperta' : inCorso ? ', in corso' : ''}`
                      : `Settimana ${n}${l.tema ? `, ${l.tema}` : ''}${bloccata ? ', non ancora aperta' : inCorso ? ', in corso' : ''}`
                  }
                  className={`settimana-pill${attiva ? ' is-on' : ''}${inCorso ? ' is-ora' : ''}${bloccata ? ' is-bloccata' : ''}`}
                  onClick={() => { if (!bloccata) setSettimana(n) }}
                >
                  <span className="sett-num" aria-hidden="true">{n === 9 ? 'Int.' : n}</span>
                  <span className="sett-stato">{etichettaPill(l)}</span>
                </button>
              )
            })}
          </div>
          {corrente && (
            <div className="card">
              <h3>
                {corrente.numero_settimana === 9 ? 'Giornata intensiva' : `Settimana ${corrente.numero_settimana}`}
                {corrente.tema ? ` — ${corrente.tema}` : ''}
              </h3>
              {inizioSettimana && (
                <CalendarioPratica
                  titolo="Questa settimana"
                  inizio={formatISODate(inizioSettimana)}
                  fine={formatISODate(fineSettimana)}
                  sessioni={tutteSessioni}
                  giornoAttivo={dataScelta}
                  onGiorno={setDataScelta}
                  soloIntervallo
                />
              )}
              {corrente.pratiche_formali && <p><strong>Formali.</strong> {corrente.pratiche_formali}</p>}
              {corrente.pratiche_informali && <p><strong>Informali.</strong> {corrente.pratiche_informali}</p>}
              {corrente.materiali && <p><strong>Materiali.</strong> {corrente.materiali}</p>}
              {srcTraccia ? (
                <TracciaGuidata
                  key={corrente.id || corrente.numero_settimana}
                  src={srcTraccia}
                  persistenzaKey={`${codice.trim()}:${corrente.id || corrente.numero_settimana}`}
                  onCompleto={setAscoltoOk}
                  onDurata={setDurataTraccia}
                />
              ) : (
                <p className="hint">
                  La traccia guidata di questa settimana non è ancora disponibile.
                  Senza traccia puoi comunque registrare la sessione, con una nota.
                </p>
              )}
              {(corrente.esercizi || []).length === 0 && (
                <p className="hint">Nessuna pratica assegnata a questa settimana.</p>
              )}
              {(corrente.esercizi || []).map((ex, i) => (
                <LogSottoEsercizio
                  key={ex.id || i}
                  codice={codice}
                  esercizio={ex}
                  dataScelta={dataScelta}
                  puoRegistrare={!srcTraccia || ascoltoOk}
                  haTraccia={!!srcTraccia}
                  durataTraccia={durataTraccia}
                  onSalvato={() => {
                    caricaProgramma(codice.trim())
                    aggiornaAscolto()
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
