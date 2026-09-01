import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigurato, generaCodicePartecipante } from '../lib/supabaseClient'
import { usePartecipante } from '../lib/partecipante.jsx'
import Disclaimer from '../components/Disclaimer.jsx'

export default function Iscrizione() {
  const { dopoIscrizione } = usePartecipante()
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
        setCodiceGenerato(assegnato)
        dopoIscrizione(assegnato)
        setStato('ok')
        return
      }
      if (testo.includes('CODICE_DUPLICATO') && tentativo < 2) continue
      if (testo.includes('CICLO_PIENO')) setErrore('Questo ciclo ha già raggiunto gli 8 posti.')
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
        <p>Conserva questo codice: è l’unico modo in cui ti riconosceremo nei questionari e nel log di pratica. Non useremo il tuo nome.</p>
        <p className="codice-enfasi">{codiceGenerato}</p>
        <p>Riceverai una comunicazione con l’esito dello screening e i prossimi passi.</p>
        <div className="azioni">
          <Link className="btn" to="/questionari">Vai ai questionari</Link>
          <Link className="btn btn-ghost" to="/programma">Vai alla settimana</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="layout-due">
      <div>
        <h2>Iscriviti al percorso</h2>
        <p className="lead">
          Otto settimane di pratica guidata in gruppo, con una giornata intensiva.
          Compila i campi qui sotto: riceverai un codice personale da conservare.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Ciclo</label>
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
                  <span>
                    <strong>{c.nome_ciclo}</strong>
                    <span className="ciclo-meta">
                      Inizio {new Date(c.data_inizio).toLocaleDateString('it-IT')}
                      {c.posti_totali ? ` · ${c.posti_totali} posti` : ''}
                    </span>
                  </span>
                  <span className="badge">{c.stato}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
            <p className="hint">Serve solo per inviarti il codice e le comunicazioni del gruppo.</p>
          </div>

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

          <button className="btn" type="submit" disabled={stato === 'invio' || !form.letto_informativa || !form.consenso_modulo_a || !form.ciclo_id}>
            {stato === 'invio' ? 'Invio in corso…' : 'Invia richiesta'}
          </button>
          {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
        </form>
      </div>

      <aside>
        <div className="card card-lato">
          <h3>Da sapere</h3>
          <Disclaimer />
        </div>
        <div className="card card-lato">
          <h3>Documenti</h3>
          <ul className="lista-documenti">
            <li>
              <a href="#/documenti/informativa" target="_blank" rel="noopener noreferrer">
                Informativa privacy
              </a>
            </li>
            <li>
              <a href="#/documenti/modulo-a" target="_blank" rel="noopener noreferrer">
                Modulo A — partecipazione
              </a>
            </li>
            <li>
              <a href="#/documenti/modulo-b" target="_blank" rel="noopener noreferrer">
                Modulo B — social (facoltativo)
              </a>
            </li>
          </ul>
        </div>
        <div className="card card-lato">
          <h3>Come funziona il codice</h3>
          <p>
            Nei questionari e nel log di pratica non compare il tuo nome.
            Ti riconosci solo con un codice, ad esempio:
          </p>
          <p className="codice-esempio">MBSR-7K2Q</p>
          <p>Solo tu sai a chi appartiene. Conservalo.</p>
        </div>
        <div className="card card-lato">
          <h3>Il percorso</h3>
          <ul>
            <li>8 incontri settimanali</li>
            <li>eventuale giornata intensiva</li>
            <li>pratiche da fare a casa</li>
            <li>questionari a T0, T1, T2 e T3, ciascuno nella sua settimana</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
