import { useEffect, useState } from 'react'
import { supabase, supabaseConfigurato } from '../lib/supabaseClient'
import { useAuth } from '../lib/auth.jsx'
import { usePartecipante } from '../lib/partecipante.jsx'
import Disclaimer from '../components/Disclaimer.jsx'
import ChiediCodice from '../components/ChiediCodice.jsx'

const TIPI = [
  { id: 'reminder_t3', label: 'Promemoria T3 (follow-up)' },
  { id: 'reminder_questionario', label: 'Promemoria questionari' },
  { id: 'annuncio', label: 'Annuncio di percorso' },
  { id: 'screening', label: 'Esito screening / prossimi passi' }
]

const DISCLAIMER_EMAIL = `Questo percorso è una pratica di consapevolezza (mindfulness) a scopo di ricerca e non sostituisce un percorso terapeutico o una presa in carico psicologica.`

const MODELLI = {
  reminder_t3: {
    oggetto: 'Promemoria: questionari di follow-up (T3)',
    testo: `Ciao,

ti scriviamo per ricordarti i questionari di follow-up (T3) del percorso MBSR. È il momento più facile da dimenticare, e per il percorso è importante quanto gli altri.

Compila i questionari con il tuo codice partecipante — mai il nome — dalla pagina Questionari dell’app.

${DISCLAIMER_EMAIL}`
  },
  reminder_questionario: {
    oggetto: 'Promemoria: questionari del percorso MBSR',
    testo: `Ciao,

è il momento di compilare i questionari del percorso (PSS-10 e FFMQ-I). Usa il tuo codice partecipante, non il nome.

${DISCLAIMER_EMAIL}`
  }
}

function AvvisiPartecipante() {
  const { codice, registrato } = usePartecipante()
  const [lista, setLista] = useState([])
  const [errore, setErrore] = useState(null)
  const [invio, setInvio] = useState(false)

  useEffect(() => {
    if (!registrato || !codice) return undefined
    setErrore(null)
    setInvio(true)
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      setInvio(false)
      return undefined
    }
    supabase.rpc('comunicazioni_del_partecipante', { p_codice: codice }).then(({ data, error }) => {
      if (error) {
        setErrore(error.message?.includes('CODICE_NON_TROVATO')
          ? 'Codice non riconosciuto.'
          : 'Non è stato possibile caricare gli avvisi.')
      } else {
        setLista(data || [])
      }
      setInvio(false)
    })
    return undefined
  }, [registrato, codice])

  return (
    <div>
      <h2>Avvisi</h2>
      <p className="lead">Promemoria e annunci del tuo ciclo, in ordine di tempo. Il follow-up T3 è segnalato.</p>
      <Disclaimer />
      {!registrato && (
        <ChiediCodice titolo="Per vedere gli avvisi di un partecipante, inserisci il codice." />
      )}
      {invio && <p>Caricamento…</p>}
      {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
      {registrato && !invio && lista.length === 0 && !errore && (
        <p>Nessun avviso per il tuo ciclo, per ora.</p>
      )}
      {lista.map(c => (
        <div className="card" key={c.id || `${c.oggetto}-${c.data_invio}`}>
          <h3>
            {c.oggetto || c.tipo}{' '}
            {c.tipo === 'reminder_t3' && <span className="badge">T3</span>}
          </h3>
          <p className="hint">{c.data_invio ? new Date(c.data_invio).toLocaleDateString('it-IT') : ''}</p>
          {c.testo && <p style={{ whiteSpace: 'pre-wrap' }}>{c.testo}</p>}
        </div>
      ))}
    </div>
  )
}

export default function Comunicazioni() {
  const { facilitatore, caricamento } = useAuth()
  const [cicli, setCicli] = useState([])
  const [lista, setLista] = useState([])
  const [form, setForm] = useState({
    ciclo_id: '',
    tipo: 'reminder_t3',
    oggetto: MODELLI.reminder_t3.oggetto,
    testo: MODELLI.reminder_t3.testo,
    invia_ora: true
  })
  const [invio, setInvio] = useState(false)
  const [messaggio, setMessaggio] = useState(null)
  const [errore, setErrore] = useState(null)

  async function carica() {
    const [{ data: c }, { data: com }] = await Promise.all([
      supabase.from('cicli').select('id, nome_ciclo, stato').order('data_inizio', { ascending: false }),
      supabase.from('comunicazioni').select('id, tipo, oggetto, testo, data_invio, stato, ciclo_id, cicli(nome_ciclo)').order('data_invio', { ascending: false })
    ])
    setCicli(c || [])
    setLista(com || [])
    if (c?.[0] && !form.ciclo_id) setForm(f => ({ ...f, ciclo_id: c[0].id }))
  }

  useEffect(() => {
    if (facilitatore) carica()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilitatore])

  function cambiaTipo(tipo) {
    const modello = MODELLI[tipo]
    setForm(f => ({
      ...f,
      tipo,
      oggetto: modello?.oggetto || '',
      testo: modello?.testo || `${DISCLAIMER_EMAIL}`,
      invia_ora: tipo === 'reminder_t3' ? true : f.invia_ora
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrore(null)
    setMessaggio(null)
    setInvio(true)

    const { data, error } = await supabase.from('comunicazioni').insert({
      ciclo_id: form.ciclo_id,
      tipo: form.tipo,
      oggetto: form.oggetto,
      testo: form.testo,
      stato: 'programmata',
      data_invio: new Date().toISOString()
    }).select('id').single()

    if (error || !data) {
      setErrore('Non è stato possibile salvare la comunicazione.')
      setInvio(false)
      return
    }

    if (!form.invia_ora) {
      setMessaggio('Comunicazione salvata come programmata.')
      setInvio(false)
      carica()
      return
    }

    const { data: esito, error: errFn } = await supabase.functions.invoke('invia-comunicazione', {
      body: { comunicazione_id: data.id }
    })

    if (errFn) {
      setErrore('Salvata, ma la funzione di invio non ha risposto. Riprova tra un momento.')
    } else if (esito?.motivo === 'RESEND_NON_CONFIGURATO') {
      setMessaggio(`Salvata come programmata. Destinatari trovati: ${esito.n_destinatari ?? 0}. Manca il secret RESEND_API_KEY.`)
    } else if (esito?.motivo === 'NESSUN_DESTINATARIO') {
      setErrore('Salvata, ma in questo ciclo non c’è nessuna email di partecipante.')
    } else if (esito?.ok) {
      setMessaggio(`Inviata a ${esito.n_destinatari} indirizzi.`)
    } else {
      setErrore(esito?.errore
        ? `Salvata, ma Resend ha rifiutato l’invio: ${esito.errore}`
        : 'Salvata, ma l’invio non è andato a buon fine.')
    }

    setInvio(false)
    carica()
  }

  async function inviaDiNuovo(id) {
    setErrore(null)
    setMessaggio(null)
    setInvio(true)
    const { data: esito, error: errFn } = await supabase.functions.invoke('invia-comunicazione', {
      body: { comunicazione_id: id }
    })
    if (errFn) setErrore('L’invio non è ripartito. Riprova tra un momento.')
    else if (esito?.ok) setMessaggio(`Inviata a ${esito.n_destinatari} indirizzi.`)
    else setErrore(esito?.errore || 'L’invio non è andato a buon fine.')
    setInvio(false)
    carica()
  }

  async function inviaProva() {
    setErrore(null)
    setMessaggio(null)
    setInvio(true)
    const { data: esito, error: errFn } = await supabase.functions.invoke('invia-comunicazione', {
      body: { prova: true }
    })
    if (errFn) setErrore('La prova non è partita. Riprova tra un momento.')
    else if (esito?.ok) setMessaggio('Prova inviata alla tua email di accesso. Controlla anche lo spam.')
    else setErrore(esito?.errore || 'La prova non è andata a buon fine.')
    setInvio(false)
  }

  if (caricamento) return <p>Caricamento…</p>
  if (!facilitatore) return <AvvisiPartecipante />

  return (
    <div>
      <h2>Comunicazioni</h2>
      <p className="disclaimer">
        Promemoria e annunci ai partecipanti di un ciclo. Il reminder T3 è in cima: è il momento
        più a rischio di essere dimenticato. Ogni testo include il disclaimer sul percorso.
        L’email serve solo al contatto operativo, non viene unita alle risposte dei questionari.
      </p>

      <div className="card">
        <h3>Nuova comunicazione</h3>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Ciclo</label>
            <select required value={form.ciclo_id} onChange={e => setForm({ ...form, ciclo_id: e.target.value })}>
              <option value="">Seleziona un ciclo</option>
              {cicli.map(c => <option key={c.id} value={c.id}>{c.nome_ciclo}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Tipo</label>
            <select value={form.tipo} onChange={e => cambiaTipo(e.target.value)}>
              {TIPI.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          {form.tipo === 'reminder_t3' && (
            <p className="disclaimer">
              T3 è il follow-up a distanza. Questo promemoria è prioritario rispetto agli altri.
            </p>
          )}
          <div className="field">
            <label>Oggetto</label>
            <input required value={form.oggetto} onChange={e => setForm({ ...form, oggetto: e.target.value })} />
          </div>
          <div className="field">
            <label>Testo</label>
            <textarea required rows="8" value={form.testo} onChange={e => setForm({ ...form, testo: e.target.value })} />
          </div>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={form.invia_ora}
                onChange={e => setForm({ ...form, invia_ora: e.target.checked })}
              /> Invia ora via email (Resend)
            </label>
          </div>
          <div className="azioni">
            <button className="btn" type="submit" disabled={invio || !form.ciclo_id}>
              {invio ? 'Invio in corso…' : form.invia_ora ? 'Salva e invia' : 'Salva come programmata'}
            </button>
            <button className="btn btn-ghost" type="button" disabled={invio} onClick={inviaProva}>
              Invia una prova a me
            </button>
          </div>
          {messaggio && <p>{messaggio}</p>}
          {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
        </form>
      </div>

      {lista.map(c => (
        <div className="card" key={c.id}>
          <h3>
            {c.oggetto || c.tipo}{' '}
            <span className="badge">{c.stato}</span>
            {c.tipo === 'reminder_t3' && <span className="badge">T3</span>}
          </h3>
          <p>{c.cicli?.nome_ciclo} — {new Date(c.data_invio).toLocaleDateString('it-IT')}</p>
          {(c.stato === 'errore' || c.stato === 'programmata') && (
            <button className="btn btn-ghost" type="button" disabled={invio} onClick={() => inviaDiNuovo(c.id)}>
              Riprova invio
            </button>
          )}
        </div>
      ))}
      {lista.length === 0 && <p>Nessuna comunicazione ancora registrata.</p>}
    </div>
  )
}
