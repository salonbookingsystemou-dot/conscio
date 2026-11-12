import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigurato } from '../lib/supabaseClient'
import { usePartecipante } from '../lib/partecipante.jsx'
import { costruisciStorico } from '../lib/storico.js'
import { oggiLocaleISO } from '../lib/date.js'
import CampoNota from '../components/CampoNota.jsx'
import StatoAttesa from '../components/StatoAttesa.jsx'

// Sequenza di fine percorso: dal giorno 56 (ultimo giorno della settimana 8).
// Ordine deciso da Dimitri il 12/11/2026: congratulazioni, T2, valutazione, condivisione.
const PASSI = ['congratulazioni', 't2', 'valutazione', 'condividi']

const CONSIGLI = [
  { valore: 'si', etichetta: 'Sì' },
  { valore: 'forse', etichetta: 'Forse' },
  { valore: 'no', etichetta: 'No' }
]

const ETICHETTE_STELLE = ['Per niente utile', 'Poco utile', 'Abbastanza utile', 'Utile', 'Molto utile']

// L'app usa HashRouter: l'iscrizione è su /#/iscrizione.
function urlIscrizione() {
  if (typeof window === 'undefined') return '/#/iscrizione'
  return `${window.location.origin}/#/iscrizione`
}

function testoWhatsApp() {
  return 'Ho appena concluso un percorso di mindfulness di otto settimane con Conscio. '
    + 'Ho pensato a te: se ti va, qui trovi come iscriverti al prossimo ciclo. '
    + urlIscrizione()
}

// Primo passo ancora da fare. Il T2 conta come fatto anche se non è compilabile (chiuso o non ancora aperto).
function primoPassoDaFare(stato) {
  if (stato.completata && stato.t2 !== 'aperto') return 4
  if (!stato.congratulazioni) return 0
  if (stato.t2 === 'aperto') return 1
  if (!stato.valutazione) return 2
  if (!stato.condivisione) return 3
  return 4
}

function Stelle({ valore, onChange }) {
  return (
    <div className="stelle" role="radiogroup" aria-label="Valutazione da 1 a 5 stelle">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={valore === n}
          aria-label={`${n} ${n === 1 ? 'stella' : 'stelle'} · ${ETICHETTE_STELLE[n - 1]}`}
          className={`stella${valore >= n ? ' is-on' : ''}`}
          onClick={() => onChange(n)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" />
          </svg>
        </button>
      ))}
    </div>
  )
}

// Solo in sviluppo (/anteprima/conclusione): dati finti, niente viene salvato.
const STATO_ANTEPRIMA = {
  giorno: null,
  disponibile: true,
  t2: 'aperto',
  t2_chiude_il: null,
  congratulazioni: false,
  valutazione: false,
  condivisione: false,
  completata: false
}
const NUMERI_ANTEPRIMA = { giorniPratica: 47, minutiTotali: 1260 }

export default function Conclusione({ anteprima = false }) {
  const { codice, registrato, caricamento, percorsoPronto, aggiornaPercorso } = usePartecipante()
  const navigate = useNavigate()
  const [stato, setStato] = useState(null)
  const [storico, setStorico] = useState([])
  const [ciclo, setCiclo] = useState(null)
  const [passo, setPasso] = useState(null)
  const [stelle, setStelle] = useState(0)
  const [consiglio, setConsiglio] = useState('')
  const [portoACasa, setPortoACasa] = useState('')
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState(null)
  const [avviso, setAvviso] = useState('')

  async function carica() {
    setErrore(null)
    if (anteprima) {
      setStato(STATO_ANTEPRIMA)
      setPasso(0)
      return
    }
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      return
    }
    const [conclusione, log, cicloRes] = await Promise.all([
      supabase.rpc('stato_conclusione_del_partecipante', { p_codice: codice }),
      supabase.rpc('log_pratica_del_partecipante', { p_codice: codice }),
      supabase.rpc('ciclo_del_partecipante', { p_codice: codice })
    ])
    if (conclusione.error || !conclusione.data) {
      setErrore('Non è stato possibile caricare la conclusione del percorso.')
      return
    }
    const s = typeof conclusione.data === 'string' ? JSON.parse(conclusione.data) : conclusione.data
    setStato(s)
    setStorico(log.data || [])
    setCiclo(cicloRes.data || null)
    setStelle(s.stelle || 0)
    setConsiglio(s.consiglieresti || '')
    setPortoACasa(s.porto_a_casa || '')
    setPasso(p => (p == null ? primoPassoDaFare(s) : p))
  }

  useEffect(() => {
    if (anteprima || (registrato && codice)) carica()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrato, codice])

  const calcolati = useMemo(() => costruisciStorico(storico, ciclo), [storico, ciclo])
  const numeri = anteprima ? NUMERI_ANTEPRIMA : calcolati

  if (!anteprima && caricamento) return <StatoAttesa />
  if (!anteprima && !registrato) return <Navigate to="/entra" replace state={{ da: '/conclusione' }} />
  if (!anteprima && !percorsoPronto) return <Navigate to="/programma" replace />
  if (errore && !stato) return <p className="campo-errore" role="alert">{errore}</p>
  if (!stato || passo == null) return <StatoAttesa etichetta="Caricamento…" />
  if (!stato.disponibile) return <Navigate to="/programma" replace />

  // Il giorno 56 il T2 non blocca ancora la pratica: si può rimandare.
  const puoRimandare = anteprima || (stato.giorno && oggiLocaleISO() <= String(stato.giorno).slice(0, 10))

  async function salvaPasso(nome) {
    if (anteprima) return true
    const { error } = await supabase.rpc('salva_passo_conclusione', { p_codice: codice, p_passo: nome })
    return !error
  }

  async function avanti(nome) {
    setErrore(null)
    setInvio(true)
    if (nome && !(await salvaPasso(nome))) {
      setErrore('Non è stato possibile salvare. Riprova.')
      setInvio(false)
      return
    }
    const aggiornato = { ...stato, [nome]: true }
    setStato(aggiornato)
    setPasso(primoPassoDaFare(aggiornato))
    setInvio(false)
  }

  async function inviaValutazione(e) {
    e.preventDefault()
    if (!stelle || !consiglio) {
      setErrore('Scegli le stelle e rispondi a «Lo consiglieresti?».')
      return
    }
    setErrore(null)
    setInvio(true)
    const { error } = anteprima ? { error: null } : await supabase.rpc('salva_valutazione_percorso', {
      p_codice: codice,
      p_stelle: stelle,
      p_consiglieresti: consiglio,
      p_porto_a_casa: portoACasa.trim() || null
    })
    if (error) {
      setErrore('Non è stato possibile salvare la valutazione. Riprova.')
      setInvio(false)
      return
    }
    const aggiornato = { ...stato, valutazione: true }
    setStato(aggiornato)
    setPasso(primoPassoDaFare(aggiornato))
    setInvio(false)
  }

  async function condividi() {
    if (anteprima) {
      setAvviso(`In anteprima non si apre WhatsApp. Messaggio: «${testoWhatsApp()}»`)
      setStato(s => ({ ...s, condivisione: true }))
      return
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(testoWhatsApp())}`, '_blank', 'noopener')
    await salvaPasso('condivisione')
    setStato(s => ({ ...s, condivisione: true }))
  }

  // La valutazione è facoltativa: si può passare oltre senza lasciare dati.
  // Il passo resta da fare finché la sequenza non è conclusa (riaprendo la pagina si ripropone).
  function saltaValutazione() {
    setErrore(null)
    setStelle(0)
    setConsiglio('')
    setPortoACasa('')
    const aggiornato = { ...stato, valutazione: true }
    setStato(aggiornato)
    setPasso(primoPassoDaFare(aggiornato))
  }

  async function copiaLink() {
    try {
      await navigator.clipboard.writeText(urlIscrizione())
      setAvviso('Link copiato.')
    } catch {
      setAvviso(`Link: ${urlIscrizione()}`)
    }
  }

  async function concludi() {
    setInvio(true)
    await salvaPasso('completata')
    if (!anteprima) await aggiornaPercorso(codice)
    setStato(s => ({ ...s, completata: true, condivisione: true }))
    setPasso(4)
    setInvio(false)
  }

  const idPasso = PASSI[passo]
  const avanzamento = Math.round((Math.min(passo, PASSI.length) / PASSI.length) * 100)

  const rimanda = puoRimandare && passo < PASSI.length && (
    <Link className="btn btn-ghost" to="/programma">Più tardi</Link>
  )

  return (
    <div className="onboarding conclusione">
      {anteprima && (
        <p className="questionari-avviso is-azione">
          Anteprima con dati finti: niente viene salvato.{' '}
          <button className="btn btn-ghost" type="button" onClick={() => { setStato(STATO_ANTEPRIMA); setPasso(0); setAvviso('') }}>
            Ricomincia
          </button>
        </p>
      )}
      {passo < PASSI.length && (
        <>
          <p className="meta-riga">
            <span className="badge">Fine percorso</span>
            <span>Passo {passo + 1} di {PASSI.length}</span>
          </p>
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${Math.max(avanzamento, 6)}%` }} />
          </div>
        </>
      )}

      {idPasso === 'congratulazioni' && (
        <div className="card">
          <h2>Congratulati con te stesso</h2>
          <p className="lead">
            Hai attraversato le otto settimane del percorso. Fermati un momento a riconoscere
            il tempo e l’attenzione che ti sei dedicato.
          </p>
          <div className="storico-contatori">
            <div className="storico-contatore">
              <p className="storico-contatore-valore">
                {numeri.giorniPratica} <span>{numeri.giorniPratica === 1 ? 'giorno' : 'giorni'}</span>
              </p>
              <p className="hint">di pratica</p>
            </div>
            <div className="storico-contatore">
              <p className="storico-contatore-valore">
                {numeri.minutiTotali} <span>min</span>
              </p>
              <p className="hint">di pratica formale</p>
            </div>
          </div>
          <p>
            Non conta quanto sia stato regolare: ogni volta che sei tornato a sederti, a respirare,
            ad ascoltare, hai praticato. Quello che hai coltivato resta con te.
          </p>
          {errore && <p className="campo-errore" role="alert">{errore}</p>}
          <div className="azioni">
            {rimanda}
            <button className="btn btn-avanti" type="button" disabled={invio} onClick={() => avanti('congratulazioni')}>
              Continua
            </button>
          </div>
        </div>
      )}

      {idPasso === 't2' && (
        <div className="card">
          <h2>Compila il questionario T2</h2>
          <p className="lead">
            Sono le stesse domande dell’inizio. Confrontando le risposte vediamo come è cambiato
            il tuo benessere nelle otto settimane.
          </p>
          <p>
            Trova un momento tranquillo: servono circa dieci minuti. Non ci sono risposte giuste o sbagliate.
          </p>
          {stato.t2_chiude_il && (
            <p className="hint">
              Aperto fino al {new Date(`${String(stato.t2_chiude_il).slice(0, 10)}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}.
            </p>
          )}
          <div className="azioni">
            {rimanda}
            <button
              className="btn btn-avanti"
              type="button"
              onClick={() => {
                if (!anteprima) {
                  navigate('/questionari', { state: { daConclusione: true } })
                  return
                }
                // In anteprima il T2 si dà per compilato.
                const aggiornato = { ...stato, t2: 'completato' }
                setStato(aggiornato)
                setPasso(primoPassoDaFare({ ...aggiornato, congratulazioni: true }))
              }}
            >
              Compila il T2
            </button>
          </div>
        </div>
      )}

      {idPasso === 'valutazione' && (
        <form className="card conclusione-valutazione" onSubmit={inviaValutazione}>
          <h2>Valuta l’esperienza</h2>
          <p className="hint">
            È facoltativa. Le risposte restano legate al tuo codice, come il resto del percorso.
          </p>

          <fieldset className="item-block">
            <legend>Come valuti l’esperienza del percorso MBSR?</legend>
            <Stelle valore={stelle} onChange={setStelle} />
            <p className="hint stelle-etichetta" aria-live="polite">
              {stelle ? ETICHETTE_STELLE[stelle - 1] : 'Tocca una stella'}
            </p>
          </fieldset>

          <fieldset className="item-block">
            <legend>Lo consiglieresti?</legend>
            <div className="chip-riga" role="radiogroup" aria-label="Lo consiglieresti?">
              {CONSIGLI.map(c => (
                <button
                  key={c.valore}
                  type="button"
                  role="radio"
                  aria-checked={consiglio === c.valore}
                  className={`chip${consiglio === c.valore ? ' is-on' : ''}`}
                  onClick={() => setConsiglio(c.valore)}
                >
                  {c.etichetta}
                </button>
              ))}
            </div>
          </fieldset>

          <CampoNota
            label="Cosa ti porti a casa di questa esperienza?"
            value={portoACasa}
            onChange={setPortoACasa}
            placeholder="Facoltativo: una scoperta, un’abitudine, una frase"
            rows={4}
          />

          {errore && <p className="campo-errore" role="alert">{errore}</p>}
          <div className="azioni">
            {rimanda}
            <button className="btn btn-ghost" type="button" disabled={invio} onClick={saltaValutazione}>
              Preferisco non rispondere
            </button>
            <button className="btn btn-avanti" type="submit" disabled={invio || !stelle || !consiglio}>
              {invio ? 'Salvataggio…' : 'Invia la valutazione'}
            </button>
          </div>
        </form>
      )}

      {idPasso === 'condividi' && (
        <div className="card">
          <h2>Condividi con un amico</h2>
          <p className="lead">
            Pensi a qualcuno che potrebbe beneficiarne? Mandagli il link per iscriversi al prossimo ciclo.
          </p>
          <p className="hint">
            Il messaggio contiene solo il link all’iscrizione: nessun dato del tuo percorso.
          </p>
          <div className="azioni conclusione-condividi">
            <button className="btn btn-avanti" type="button" onClick={condividi}>
              Condividi su WhatsApp
            </button>
            <button className="btn btn-ghost" type="button" onClick={copiaLink}>
              Copia il link
            </button>
          </div>
          {avviso && <p className="hint" role="status">{avviso}</p>}
          <div className="azioni">
            <button className={stato.condivisione ? 'btn btn-avanti' : 'btn btn-ghost'} type="button" disabled={invio} onClick={concludi}>
              {stato.condivisione ? 'Concludi' : 'Concludi senza condividere'}
            </button>
          </div>
        </div>
      )}

      {passo >= PASSI.length && (
        <div className="card">
          <p className="badge">Percorso concluso</p>
          <h2>Grazie</h2>
          <p className="lead">
            Il percorso è concluso. Le pratiche restano a tua disposizione in Settimana:
            puoi continuare ad ascoltarle quando vuoi.
          </p>
          <p>Tra quattro settimane ti chiederemo un ultimo questionario, il follow-up T3.</p>
          <div className="azioni">
            <Link className="btn btn-avanti" to="/programma">Torna alla pratica</Link>
          </div>
        </div>
      )}
    </div>
  )
}
