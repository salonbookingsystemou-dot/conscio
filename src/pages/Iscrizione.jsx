import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigurato, generaCodicePartecipante, memorizzaCodiceRicordato } from '../lib/supabaseClient'
import Disclaimer from '../components/Disclaimer.jsx'

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
            fontFamily="Fraunces, Georgia, serif"
            fontSize="10"
            fontWeight="600"
          >
            2
          </text>
        </>
      )}
    </svg>
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
    titolo: 'In presenza',
    testo: 'Un appuntamento a settimana di pratica condivisa.'
  },
  {
    id: 'casa',
    titolo: 'A casa',
    testo: '45 minuti al giorno di pratica domestica individuale.'
  },
  {
    id: 'questionari',
    titolo: 'Due questionari',
    testo: 'Prima, durante, alla fine e a tre mesi dalla fine del ciclo.'
  }
]

export default function Iscrizione() {
  const [cicli, setCicli] = useState([])
  const [form, setForm] = useState({
    email: '',
    ciclo_id: '',
    letto_informativa: false,
    consenso_modulo_a: false,
    consenso_modulo_b: false
  })
  const [stato, setStato] = useState(null)
  const [errore, setErrore] = useState(null)
  const [codiceGenerato, setCodiceGenerato] = useState(null)

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

    for (let tentativo = 0; tentativo < 3; tentativo++) {
      const codice = generaCodicePartecipante()
      const { data, error } = await supabase.rpc('iscrivi_partecipante', {
        p_email: form.email,
        p_ciclo_id: form.ciclo_id,
        p_codice: codice,
        p_consenso_a: form.consenso_modulo_a,
        p_consenso_b: form.consenso_modulo_b
      })
      const testo = error?.message || ''
      if (!error && data?.ok) {
        const assegnato = data.codice || codice
        memorizzaCodiceRicordato(assegnato)
        setCodiceGenerato(assegnato)
        setStato('ok')
        return
      }
      if (testo.includes('CODICE_DUPLICATO') && tentativo < 2) continue
      if (testo.includes('CICLO_PIENO')) setErrore('I posti idonei di questo ciclo sono già al completo.')
      else if (testo.includes('EMAIL_GIA_ISCRITTA')) setErrore('Questa email è già iscritta a questo ciclo.')
      else if (testo.includes('CICLO_NON_DISPONIBILE')) setErrore('Il ciclo non è più in reclutamento.')
      else setErrore('Si è verificato un errore. Riprova.')
      setStato(null)
      return
    }
  }

  if (stato === 'ok') {
    return (
      <div className="card card-conferma">
        <h2>Iscrizione ricevuta</h2>
        <p>Conserva questo codice. Lo userai per entrare dopo l’esito dello screening, se l’esito è idoneo. Non useremo il tuo nome.</p>
        <p className="codice-enfasi">{codiceGenerato}</p>
        <p>Riceverai una comunicazione con l’esito e i prossimi passi. Le altre sezioni si aprono solo a chi è idoneo.</p>
        <div className="azioni">
          <Link className="btn" to="/">Torna all’inizio</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="iscrizione-pagina">
    <section className="percorso-blocco" aria-labelledby="percorso-titolo">
      <h2 id="percorso-titolo">Il percorso</h2>
      <p className="lead">
        Otto settimane di pratica guidata, con un appuntamento a settimana in presenza.
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
            Compila i campi qui sotto: riceverai un codice personale da conservare.
          </p>
        </header>
        <form className="iscrizione-form" onSubmit={handleSubmit}>
          <div className="iscrizione-sezione">
            <p className="iscrizione-sezione-titolo">Ciclo</p>
            {cicli.length === 0 && <p>Nessun ciclo in reclutamento al momento.</p>}
            <div className="ciclo-scelte">
              {cicli.map(c => (
                <label key={c.id} className={`ciclo-card${form.ciclo_id === c.id ? ' is-on' : ''}`}>
                  <input
                    type="radio"
                    name="ciclo"
                    required
                    checked={form.ciclo_id === c.id}
                    onChange={() => setForm({ ...form, ciclo_id: c.id })}
                  />
                  <span className="ciclo-card-corpo">
                    <span className="ciclo-card-testata">
                      <strong>{c.nome_ciclo}</strong>
                      <span className="badge">{c.stato}</span>
                    </span>
                    <span className="ciclo-meta">
                      <span>Inizio {new Date(c.data_inizio).toLocaleDateString('it-IT')}</span>
                      {c.posti_totali ? <span>{c.posti_totali} posti</span> : null}
                    </span>
                  </span>
                </label>
              ))}
            </div>
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
              Serve solo per inviarti il codice e le comunicazioni del gruppo.
            </p>
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
            <button className="btn" type="submit" disabled={stato === 'invio' || !form.letto_informativa || !form.consenso_modulo_a || !form.ciclo_id}>
              {stato === 'invio' ? 'Invio in corso…' : 'Invia richiesta'}
            </button>
            {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
          </div>
        </form>
      </section>

      <aside>
        <div className="card card-lato">
          <h3>Come funziona il codice</h3>
          <p>
            Nei questionari e nel log di pratica non compare il tuo nome.
            Ti riconosci solo con un codice, ad esempio:
          </p>
          <p className="codice-esempio">MBSR-7K2Q8N3P</p>
          <p>Solo tu sai a chi appartiene. Conservalo.</p>
        </div>
      </aside>
    </div>
    </div>
  )
}
