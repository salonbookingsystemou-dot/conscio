import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  chiamaPorta,
  supabase,
  supabaseConfigurato
} from '../lib/supabaseClient'
import Disclaimer from '../components/Disclaimer.jsx'
import BoxCodicePrivacy from '../components/BoxCodicePrivacy.jsx'

function IconaPercorso({ id }) {
  const comune = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  }
  return (
    <svg className="percorso-icona" viewBox="0 0 24 24" aria-hidden="true">
      {id === 'settimane' && (
        <>
          <rect x="4" y="5" width="16" height="15" rx="2" {...comune} />
          <path d="M4 9.2h16M8 3.6v3M16 3.6v3" {...comune} />
          <path d="M8 13h.1M12 13h.1M16 13h.1M8 16.4h.1M12 16.4h.1" {...comune} />
        </>
      )}
      {id === 'presenza' && (
        <>
          <circle cx="9" cy="8.2" r="2.1" {...comune} />
          <circle cx="15.2" cy="8.2" r="2.1" {...comune} />
          <path d="M4.8 18.4c.4-3.2 2.4-5 4.2-5s3.4 1.4 4.2 3.4" {...comune} />
          <path d="M12.4 16.6c.6-1.6 2.2-3.2 4-3.2 1.8 0 3.6 1.6 4.2 4.8" {...comune} />
        </>
      )}
      {id === 'remoto' && (
        <>
          <rect x="3.6" y="5.2" width="16.8" height="11.2" rx="2" {...comune} />
          <path d="M8.2 19.2h7.6M12 16.4v2.8" {...comune} />
          <circle cx="12" cy="10.4" r="1.7" {...comune} />
          <path d="M9.2 13.6c.6-1.2 1.6-1.8 2.8-1.8s2.2.6 2.8 1.8" {...comune} />
        </>
      )}
      {id === 'casa' && (
        <>
          <path d="M4.6 11.2 12 5.2l7.4 6" {...comune} />
          <path d="M6.4 10.4V19h11.2v-8.6" {...comune} />
          <path d="M10.2 19v-5.2h3.6V19" {...comune} />
        </>
      )}
      {id === 'questionari' && (
        <>
          <rect x="8.2" y="2.2" width="7.6" height="3.6" rx="1.1" {...comune} />
          <rect x="5" y="4.4" width="14" height="16.4" rx="2" {...comune} />
          <text
            x="12"
            y="16.6"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontFamily="'Source Serif 4', Georgia, serif"
            fontSize="12"
          >
            2
          </text>
        </>
      )}
    </svg>
  )
}

function IconaPosta() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3.4"
        y="5.8"
        width="17.2"
        height="12.4"
        rx="2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M4.2 7.4 12 13.2l7.8-5.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Il codice non compare a video: arriva solo per email. Entrare con quel codice
// dimostra che la casella è della persona e conferma l'iscrizione.
function ConfermaIscrizione({ email, soloRemoto }) {
  return (
    <div className="conferma-iscrizione">
      <div className="card card-conferma">
        <h2>Iscrizione ricevuta</h2>

        <div className="conferma-casella" role="status">
          <IconaPosta />
          <div>
            <p className="conferma-casella-titolo">Controlla la tua casella.</p>
            <p>
              Ti abbiamo scritto{email ? <> a <strong className="conferma-casella-email">{email}</strong></> : null} con
              il tuo codice. Non lo trovi? Guarda nello spam
              o <Link to="/entra" state={{ recupera: true }}>richiedilo di nuovo</Link>.
            </p>
          </div>
        </div>

        <ol className="conferma-flusso">
          <li className="is-ora">
            <strong>Entra con il codice</strong>
            <p>
              Aprilo dall’email ed entra: così confermi l’iscrizione.
              Se non entri entro 7 giorni l’iscrizione viene cancellata.
            </p>
          </li>
          <li>
            <strong>Attendi l’approvazione</strong>
            <p>
              Ti scriviamo con l’esito. Fino ad allora le sezioni restano chiuse.
            </p>
          </li>
          <li>
            <strong>Poi inizi</strong>
            <p>
              {soloRemoto
                ? 'Con l’idoneità entri col codice: onboarding, T0 e le settimane al tuo ritmo. Non occupi un posto in aula.'
                : 'Con l’idoneità entri col codice: onboarding, T0 e poi le settimane del percorso.'}
            </p>
          </li>
        </ol>
      </div>
      <BoxCodicePrivacy />
    </div>
  )
}

const SCHEDE_PERCORSO = [
  {
    id: 'settimane',
    titolo: '8 settimane',
    testo: 'Un ciclo di pratica guidata, dal primo incontro all’ultimo.'
  },
  {
    id: 'presenza',
    titolo: 'In gruppo',
    testo: 'Un appuntamento a settimana di pratica condivisa, di norma in presenza.'
  },
  {
    id: 'remoto',
    titolo: 'Anche da remoto',
    testo: 'Pratichi con le stesse settimane, al tuo ritmo, senza occupare un posto in aula.'
  },
  {
    id: 'casa',
    titolo: 'A casa',
    testo: '45 minuti al giorno di pratica domestica individuale.'
  },
  {
    id: 'questionari',
    titolo: 'Due questionari',
    testo: 'Prima, durante, alla fine e da 4 a 8 settimane dopo la fine del ciclo.'
  }
]

export default function Iscrizione() {
  const [cicli, setCicli] = useState([])
  const [form, setForm] = useState({
    email: '',
    ciclo_id: '',
    solo_remoto: false,
    letto_informativa: false,
    consenso_modulo_a: false,
    consenso_modulo_b: false,
    sito_web: ''
  })
  const [stato, setStato] = useState(null)
  const [errore, setErrore] = useState(null)
  // Istante di apertura del modulo: porta scarta gli invii arrivati in meno di 3 secondi.
  const [t0] = useState(() => Date.now())

  useEffect(() => {
    supabase
      .from('cicli')
      .select('id, nome_ciclo, data_inizio, stato, posti_totali')
      .eq('stato', 'reclutamento')
      .then(({ data }) => setCicli(data || []))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.letto_informativa || !form.consenso_modulo_a) return
    setErrore(null)
    setStato('invio')
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      setStato(null)
      return
    }

    try {
      const data = await chiamaPorta({
        azione: 'iscrivi',
        email: form.email,
        ciclo_id: form.solo_remoto ? null : form.ciclo_id,
        solo_remoto: form.solo_remoto,
        consenso_a: form.consenso_modulo_a,
        consenso_b: form.consenso_modulo_b,
        sito_web: form.sito_web,
        t0,
        t_invio: Date.now()
      })
      if (data?.ok) {
        setStato('ok')
        return
      }
      setErrore('Non è stato possibile completare l’iscrizione. Riprova.')
      setStato(null)
    } catch (err) {
      const testo = err?.code || err?.message || ''
      if (testo.includes('EMAIL_TEMPORANEA')) setErrore('Usa un indirizzo email personale, non temporaneo.')
      else if (testo.includes('EMAIL_NON_VALIDA')) setErrore('Controlla l’indirizzo email.')
      else if (testo.includes('TROPPI_TENTATIVI')) setErrore('Troppi tentativi. Riprova tra qualche minuto.')
      else if (testo.includes('CODA_ISCRIZIONI_PIENA')) setErrore('Le richieste in coda sono al completo. Riprova più tardi.')
      else if (testo.includes('CICLO_PIENO')) setErrore('I posti idonei di questo ciclo sono già al completo.')
      else if (testo.includes('CICLO_NON_DISPONIBILE')) setErrore('Il ciclo non è più in reclutamento.')
      else setErrore('Non è stato possibile completare l’iscrizione. Riprova.')
      setStato(null)
    }
  }

  if (stato === 'ok') {
    return (
      <ConfermaIscrizione
        email={form.email.trim()}
        soloRemoto={form.solo_remoto}
      />
    )
  }

  return (
    <div className="iscrizione-pagina">
    <section className="percorso-blocco" aria-labelledby="percorso-titolo">
      <h2 id="percorso-titolo">Il percorso</h2>
      <p className="lead">
        Otto settimane di pratica guidata, con un appuntamento a settimana di pratica
        condivisa. Chi non può seguire l’edizione in corso può iscriversi solo da remoto.
      </p>
      <div className="percorso-carosello">
        {SCHEDE_PERCORSO.map(scheda => (
          <article
            key={scheda.id}
            className="percorso-card"
          >
            <span className="percorso-icona-fondo">
              <IconaPercorso id={scheda.id} />
            </span>
            <h3>{scheda.titolo}</h3>
            <p>{scheda.testo}</p>
          </article>
        ))}
      </div>
      <Disclaimer />
    </section>
    <div className="layout-due">
      <section className="iscrizione-blocco" aria-labelledby="iscrizione-titolo">
        <header className="iscrizione-testata">
          <h2 id="iscrizione-titolo">Iscriviti</h2>
          <p className="lead">
            Compila i campi qui sotto: riceverai per email un codice personale da conservare.
          </p>
        </header>
        <form className="iscrizione-form" onSubmit={handleSubmit}>
          <div className="iscrizione-sezione">
            <p className="iscrizione-sezione-titolo">Ciclo</p>
            <div className="ciclo-scelte">
              <label className={`ciclo-card${form.solo_remoto ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="ciclo"
                  checked={form.solo_remoto}
                  onChange={() => setForm({ ...form, solo_remoto: true, ciclo_id: '' })}
                />
                <span className="ciclo-card-corpo">
                  <span className="ciclo-card-testata">
                    <strong>Solo da remoto</strong>
                  </span>
                  <span className="ciclo-meta">
                    <span>Stesse settimane, al tuo ritmo</span>
                  </span>
                </span>
              </label>
              {cicli.map(c => (
                <label key={c.id} className={`ciclo-card${form.ciclo_id === c.id ? ' is-on' : ''}`}>
                  <input
                    type="radio"
                    name="ciclo"
                    required={!form.solo_remoto}
                    checked={form.ciclo_id === c.id}
                    onChange={() => setForm({ ...form, ciclo_id: c.id, solo_remoto: false })}
                  />
                  <span className="ciclo-card-corpo">
                    <span className="ciclo-card-testata">
                      <strong>{c.nome_ciclo}</strong>
                      <span className="badge">{c.stato}</span>
                    </span>
                    <span className="ciclo-meta">
                      <span>Inizio {new Date(c.data_inizio).toLocaleDateString('it-IT')}</span>
                      {c.posti_totali ? <span>{c.posti_totali} posti in presenza</span> : null}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {cicli.length === 0 && !form.solo_remoto && (
              <p>Nessun ciclo in reclutamento al momento. Puoi comunque iscriverti solo da remoto.</p>
            )}
          </div>

          <div className="iscrizione-sezione iscrizione-email">
            <label className="iscrizione-email-label" htmlFor="email">Email</label>
            <input
              id="email"
              className="iscrizione-email-input"
              type="email"
              required
              autoComplete="email"
              placeholder="nome@esempio.it"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
            <p className="hint">
              Serve per inviarti il codice, confermare l’iscrizione e scriverti le comunicazioni del gruppo.
            </p>
            <div className="campo-trappola" aria-hidden="true">
              <label htmlFor="sito_web">Sito web</label>
              <input
                id="sito_web"
                name="sito_web"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.sito_web}
                onChange={e => setForm({ ...form, sito_web: e.target.value })}
              />
            </div>
          </div>

          <div className="iscrizione-sezione iscrizione-consensi">
            <p className="iscrizione-sezione-titolo">Documenti e consensi</p>
            <p className="hint hint-consensi">
              Prima di inviare, apri i documenti. I due consensi sono indipendenti:
              il Modulo B non è richiesto per partecipare.
            </p>
            <div className="consenso-box">
              <label>
                <input
                  type="checkbox"
                  checked={form.letto_informativa}
                  onChange={e => setForm({ ...form, letto_informativa: e.target.checked })}
                />
                <span>
                  <strong>Informativa sul trattamento dei dati</strong>
                  <span className="hint">Obbligatoria. Non è un consenso extra: ti dice come usiamo i dati.</span>
                </span>
              </label>
              <p className="doc-apri">
                <a href="#/documenti/informativa" target="_blank" rel="noopener noreferrer">
                  Leggi l’informativa privacy
                </a>
              </p>
            </div>
            <div className="consenso-box">
              <label>
                <input
                  type="checkbox"
                  checked={form.consenso_modulo_a}
                  onChange={e => setForm({ ...form, consenso_modulo_a: e.target.checked })}
                />
                <span>
                  <strong>Modulo A — consenso alla partecipazione</strong>
                  <span className="hint">Obbligatorio per entrare nel percorso.</span>
                </span>
              </label>
              <p className="doc-apri">
                <a href="#/documenti/modulo-a" target="_blank" rel="noopener noreferrer">
                  Leggi il Modulo A
                </a>
              </p>
            </div>
            <div className="consenso-box consenso-opz">
              <label>
                <input
                  type="checkbox"
                  checked={form.consenso_modulo_b}
                  onChange={e => setForm({ ...form, consenso_modulo_b: e.target.checked })}
                />
                <span>
                  <strong>Modulo B — documentazione social (facoltativo)</strong>
                  <span className="hint">Opzionale. Non è richiesto per partecipare e non dipende dal Modulo A.</span>
                </span>
              </label>
              <p className="doc-apri">
                <a href="#/documenti/modulo-b" target="_blank" rel="noopener noreferrer">
                  Leggi il Modulo B
                </a>
              </p>
            </div>
          </div>

          <div className="iscrizione-azioni">
            <button className="btn" type="submit" disabled={stato === 'invio' || !form.letto_informativa || !form.consenso_modulo_a || (!form.solo_remoto && !form.ciclo_id)}>
              {stato === 'invio' ? 'Invio in corso…' : 'Invia richiesta'}
            </button>
            {errore && <p className="campo-errore" role="alert">{errore}</p>}
          </div>
        </form>
      </section>

      <aside>
        <BoxCodicePrivacy />
      </aside>
    </div>
    </div>
  )
}
