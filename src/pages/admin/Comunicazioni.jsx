import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { EMAIL_CONTATTO } from '../../lib/contatti.js'
import DialogConferma from '../../components/DialogConferma.jsx'
import PaginaAdmin from '../../components/admin/PaginaAdmin.jsx'
import { ElencoPannello, PannelloDettaglio } from '../../components/admin/Pannelli.jsx'
import { IconaPosta } from '../../components/admin/IconeAdmin.jsx'
import { useSnackbar } from '../../components/admin/Snackbar.jsx'

const TIPI = [
  { id: 'reminder_t3', label: 'Promemoria T3 (follow-up)' },
  { id: 'reminder_questionario', label: 'Promemoria questionari' },
  { id: 'annuncio', label: 'Annuncio di percorso' },
  { id: 'screening', label: 'Esito screening / prossimi passi' }
]

const DESTINATARI = [
  { id: 'tutti', label: 'Tutti i partecipanti' },
  { id: 'remoto', label: 'Chi segue da remoto' }
]

const ETICHETTE_INATTIVITA = {
  non_avviato: 'Onboarding non fatto',
  onboarding_senza_ascolto: 'Onboarding senza pratiche'
}

function eModificabile(c) {
  return c.stato === 'programmata' || c.stato === 'errore'
}

async function invocaInvio(body) {
  const { data, error } = await supabase.functions.invoke('invia-comunicazione', { body })
  if (data && typeof data === 'object') return { esito: data, errFn: null }
  const risposta = error?.context
  if (risposta && typeof risposta.json === 'function') {
    try {
      const parsed = await risposta.json()
      if (parsed && typeof parsed === 'object') return { esito: parsed, errFn: null }
    } catch {
      /* corpo non json */
    }
  }
  return { esito: null, errFn: error }
}

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

const FILTRI = [
  { id: 'tutte', label: 'Tutte' },
  { id: 'programmate', label: 'Da inviare' },
  { id: 'inviate', label: 'Inviate' },
  { id: 'automatiche', label: 'Automatiche' }
]

const AUTOMATICHE = [
  { id: 'inattivita', titolo: 'Inattività · da remoto', descrizione: 'Avviso dopo 15 giorni, chiusura dopo altri 15' },
  { id: 'pausa', titolo: 'Pausa di pratica', descrizione: 'Email dopo tre giorni senza ascolto' }
]

const STATO_COMUNICAZIONE = {
  programmata: { etichetta: 'Da inviare', tono: 'attesa' },
  errore: { etichetta: 'Invio non riuscito', tono: 'errore' },
  inviata: { etichetta: 'Inviata', tono: 'ok' }
}

function statoDi(c) {
  return STATO_COMUNICAZIONE[c.stato] || STATO_COMUNICAZIONE.inviata
}

function data(valore) {
  return valore ? new Date(valore).toLocaleDateString('it-IT') : ''
}

function etichettaTipo(id) {
  return TIPI.find(t => t.id === id)?.label || id || '—'
}

function formNuova(cicloId = '') {
  return {
    ciclo_id: cicloId,
    destinatari: 'tutti',
    tipo: 'reminder_t3',
    oggetto: MODELLI.reminder_t3.oggetto,
    testo: MODELLI.reminder_t3.testo,
    invia_ora: false
  }
}

function Badge({ tono, children }) {
  return (
    <span className={`controllo-stato is-${tono}`}>
      <span className="controllo-stato-punto" aria-hidden="true" />
      {children}
    </span>
  )
}

export default function Comunicazioni() {
  const [cicli, setCicli] = useState([])
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(formNuova())
  const [dialogo, setDialogo] = useState(null)
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState(null)
  const [inattivita, setInattivita] = useState([])
  const [candidati, setCandidati] = useState([])
  const [ritiri, setRitiri] = useState([])
  const [invioInattivita, setInvioInattivita] = useState(false)
  const [msgInattivita, setMsgInattivita] = useState(null)
  const [errInattivita, setErrInattivita] = useState(null)
  const [pause, setPause] = useState([])
  const [candidatiPausa, setCandidatiPausa] = useState([])
  const [invioPausa, setInvioPausa] = useState(false)
  const [msgPausa, setMsgPausa] = useState(null)
  const [errPausa, setErrPausa] = useState(null)
  const [errLetturaPausa, setErrLetturaPausa] = useState(null)
  const [caricato, setCaricato] = useState(false)
  const [errLettura, setErrLettura] = useState(null)
  const [search, setSearch] = useSearchParams()
  const { mostra } = useSnackbar()

  // La voce aperta sta nell'indirizzo: id di una comunicazione, «nuova», «inattivita» o «pausa».
  const voce = search.get('voce') || ''
  const filtro = FILTRI.some(f => f.id === search.get('filtro')) ? search.get('filtro') : 'tutte'

  function aggiornaRicerca(patch, opzioni) {
    const prossima = new URLSearchParams(search)
    for (const [chiave, valore] of Object.entries(patch)) {
      if (valore) prossima.set(chiave, valore)
      else prossima.delete(chiave)
    }
    setSearch(prossima, opzioni)
  }

  function apri(id) {
    setErrore(null)
    aggiornaRicerca({ voce: id })
  }

  async function carica() {
    const [cicliRes, comRes, notRes, candRes, ritRes, pausaRes, candPausaRes] = await Promise.all([
      supabase.from('cicli').select('id, nome_ciclo, stato').order('data_inizio', { ascending: false }),
      supabase.from('comunicazioni').select('id, tipo, destinatari, oggetto, testo, data_invio, stato, ciclo_id, cicli(nome_ciclo)').order('data_invio', { ascending: false }),
      supabase.from('notifiche_inattivita').select('id, tipo, inviata_il, utenti(codice_partecipante)').order('inviata_il', { ascending: false }),
      supabase.rpc('candidati_inattivita_remoto'),
      supabase.rpc('candidati_ritiro_inattivita'),
      supabase.from('promemoria_pausa').select('id, riferimento, inviata_il, utenti(codice_partecipante)').order('inviata_il', { ascending: false }),
      supabase.rpc('candidati_pausa_pratica')
    ])
    setCaricato(true)
    setErrLettura(cicliRes.error || comRes.error
      ? 'Non è stato possibile leggere i cicli o le comunicazioni. Ricarica la pagina.'
      : null)
    setCicli(cicliRes.data || [])
    setLista(comRes.data || [])
    setInattivita(notRes.error ? [] : (notRes.data || []))
    setCandidati(candRes.error ? [] : (candRes.data || []))
    setRitiri(ritRes.error ? [] : (ritRes.data || []))
    setPause(pausaRes.error ? [] : (pausaRes.data || []))
    setCandidatiPausa(candPausaRes.error ? [] : (candPausaRes.data || []))
    setErrLetturaPausa(pausaRes.error || candPausaRes.error
      ? 'Non è stato possibile leggere le pause di pratica.'
      : null)
    return comRes.data || []
  }

  useEffect(() => {
    carica()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // «Nuova comunicazione» è l'azione principale del guscio: ?nuova=1 apre il modulo vuoto nel dettaglio.
  useEffect(() => {
    if (search.get('nuova') !== '1') return
    setErrore(null)
    aggiornaRicerca({ nuova: '', voce: 'nuova' }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const daGestire = useMemo(() => lista.filter(eModificabile), [lista])
  const inviate = useMemo(() => lista.filter(c => !eModificabile(c)), [lista])
  const aperta = lista.find(c => c.id === voce) || null
  const inModifica = aperta && eModificabile(aperta) ? aperta : null

  // Il modulo segue la voce aperta: vuoto per «nuova», i dati della comunicazione per una da inviare.
  useEffect(() => {
    if (!caricato) return
    if (voce === 'nuova') {
      setForm(f => (f.nuova ? f : { ...formNuova(cicli[0]?.id || ''), nuova: true }))
    } else if (inModifica) {
      setForm({
        ciclo_id: inModifica.ciclo_id || '',
        destinatari: inModifica.destinatari === 'remoto' ? 'remoto' : 'tutti',
        tipo: inModifica.tipo || 'annuncio',
        oggetto: inModifica.oggetto || '',
        testo: inModifica.testo || '',
        invia_ora: false
      })
    } else {
      // Uscendo dalla bozza nuova, la prossima «Nuova comunicazione» riparte vuota.
      setForm(f => (f.nuova ? { ...f, nuova: false } : f))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voce, caricato, inModifica?.id])

  function cambiaTipo(tipo) {
    const modello = MODELLI[tipo]
    setForm(f => ({
      ...f,
      tipo,
      oggetto: modello?.oggetto || '',
      testo: modello?.testo || `${DISCLAIMER_EMAIL}`
    }))
  }

  function riusa(c) {
    setErrore(null)
    setForm({
      ciclo_id: c.ciclo_id || cicli[0]?.id || '',
      destinatari: c.destinatari === 'remoto' ? 'remoto' : 'tutti',
      tipo: c.tipo || 'annuncio',
      oggetto: c.oggetto || '',
      testo: c.testo || '',
      invia_ora: false,
      nuova: true
    })
    aggiornaRicerca({ voce: 'nuova' })
  }

  function chiediElimina(c) {
    if (!eModificabile(c)) return
    setDialogo({
      titolo: 'Cancellare questa comunicazione?',
      testo: `«${c.oggetto || c.tipo}» verrà tolta dagli invii programmati. Non è ancora partita nessuna email.`,
      etichetta: 'Cancella',
      pericolo: true,
      onOk: async () => {
        setDialogo(null)
        setErrore(null)
        const { error } = await supabase
          .from('comunicazioni')
          .delete()
          .eq('id', c.id)
          .in('stato', ['programmata', 'errore'])
        if (error) {
          setErrore('Non è stato possibile cancellare la comunicazione.')
          return
        }
        aggiornaRicerca({ voce: '' }, { replace: true })
        mostra({ testo: 'Comunicazione cancellata' })
        carica()
      }
    })
  }

  // Inviare un'email è un effetto fuori dall'app: sempre con conferma (brief navigazione, sez. 4bis).
  function testoDestinatari(cicloId, destinatari) {
    const ciclo = cicli.find(c => c.id === cicloId)?.nome_ciclo || 'questo ciclo'
    return destinatari === 'remoto'
      ? `a chi segue ${ciclo} da remoto`
      : `a tutti i partecipanti di ${ciclo}`
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.invia_ora) {
      salva()
      return
    }
    setDialogo({
      titolo: 'Inviare l’email adesso?',
      testo: `«${form.oggetto.trim() || 'Comunicazione'}» parte subito ${testoDestinatari(form.ciclo_id, form.destinatari)}. Un’email inviata non si può ritirare.`,
      etichetta: 'Salva e invia',
      onOk: () => {
        setDialogo(null)
        salva()
      }
    })
  }

  async function salva() {
    setErrore(null)
    setInvio(true)
    const modificaId = inModifica?.id || null

    const campi = {
      ciclo_id: form.ciclo_id,
      tipo: form.tipo,
      destinatari: form.destinatari,
      oggetto: form.oggetto,
      testo: form.testo,
      stato: 'programmata',
      data_invio: new Date().toISOString()
    }

    let salvata = null
    if (modificaId) {
      const { data: aggiornata, error } = await supabase
        .from('comunicazioni')
        .update(campi)
        .eq('id', modificaId)
        .in('stato', ['programmata', 'errore'])
        .select('id')
        .single()
      if (error || !aggiornata) {
        setErrore('Non è stato possibile aggiornare la comunicazione.')
        setInvio(false)
        return
      }
      salvata = aggiornata
    } else {
      const { data: creata, error } = await supabase
        .from('comunicazioni')
        .insert(campi)
        .select('id')
        .single()
      if (error || !creata) {
        setErrore('Non è stato possibile salvare la comunicazione.')
        setInvio(false)
        return
      }
      salvata = creata
    }

    if (!form.invia_ora) {
      await carica()
      aggiornaRicerca({ voce: salvata.id }, { replace: true })
      mostra({ testo: modificaId ? 'Modifiche salvate. Nessuna email inviata' : 'Comunicazione salvata. Nessuna email inviata' })
      setInvio(false)
      return
    }

    const { esito, errFn } = await invocaInvio({ comunicazione_id: salvata.id })
    let problema = null
    if (errFn) {
      problema = 'Salvata, ma l’invio email non è partito. Usa «Invia ora».'
    } else if (esito?.motivo === 'RESEND_NON_CONFIGURATO') {
      problema = `Salvata, ma non inviata: manca il servizio email sul server. Destinatari trovati: ${esito.n_destinatari ?? 0}.`
    } else if (esito?.motivo === 'DESTINATARI_NON_LEGGIBILI') {
      problema = 'Salvata, ma non è stato possibile leggere i destinatari. Riprova tra un momento.'
    } else if (esito?.motivo === 'NESSUN_DESTINATARIO') {
      problema = form.destinatari === 'remoto'
        ? 'Salvata, ma in questo ciclo non c’è nessuna email di partecipante in remoto.'
        : 'Salvata, ma in questo ciclo non c’è nessuna email di partecipante.'
    } else if (!esito?.ok) {
      problema = esito?.errore
        ? `Salvata, ma il servizio email ha rifiutato l’invio: ${esito.errore}`
        : 'Salvata, ma l’invio non è andato a buon fine.'
    }

    await carica()
    aggiornaRicerca({ voce: salvata.id }, { replace: true })
    if (problema) setErrore(problema)
    else mostra({ testo: `Inviata a ${esito.n_destinatari} indirizzi` })
    setInvio(false)
  }

  function chiediInvio(c) {
    setDialogo({
      titolo: 'Inviare l’email adesso?',
      testo: `«${c.oggetto || c.tipo}» parte subito ${testoDestinatari(c.ciclo_id, c.destinatari)}. Un’email inviata non si può ritirare.`,
      etichetta: 'Invia ora',
      onOk: () => {
        setDialogo(null)
        inviaDiNuovo(c.id)
      }
    })
  }

  async function inviaDiNuovo(id) {
    setErrore(null)
    setInvio(true)
    const { esito, errFn } = await invocaInvio({ comunicazione_id: id })
    if (errFn) setErrore('L’invio non è ripartito. Riprova tra un momento.')
    else if (esito?.ok) mostra({ testo: `Inviata a ${esito.n_destinatari} indirizzi` })
    else setErrore(esito?.errore || 'L’invio non è andato a buon fine.')
    setInvio(false)
    carica()
  }

  async function inviaProva() {
    setErrore(null)
    const oggetto = form.oggetto.trim()
    const testo = form.testo.trim()
    if (!oggetto || !testo) {
      setErrore('Per la prova servono oggetto e testo della comunicazione.')
      return
    }
    setInvio(true)
    const { esito, errFn } = await invocaInvio({ prova: true, oggetto, testo })
    if (errFn) setErrore('La prova non è partita. Riprova tra un momento.')
    else if (esito?.motivo === 'TESTO_MANCANTE') setErrore('Per la prova servono oggetto e testo della comunicazione.')
    else if (esito?.motivo === 'NESSUN_DESTINATARIO') setErrore('Non trovo l’email del tuo account: esci e rientra, poi riprova.')
    else if (esito?.motivo === 'RESEND_NON_CONFIGURATO') setErrore('Prova non inviata: manca il servizio email sul server.')
    else if (esito?.ok) mostra({ testo: 'Prova inviata alla tua email di accesso. Controlla anche lo spam' })
    else setErrore(esito?.errore || 'La prova non è andata a buon fine.')
    setInvio(false)
  }

  function chiediInattivita() {
    const parti = [
      candidati.length > 0
        ? `${candidati.length} ${candidati.length === 1 ? 'persona riceve' : 'persone ricevono'} l’avviso di inattività`
        : null,
      ritiri.length > 0
        ? `${ritiri.length} ${ritiri.length === 1 ? 'account viene chiuso' : 'account vengono chiusi'}, con l’email di chiusura`
        : null
    ].filter(Boolean)
    setDialogo({
      titolo: 'Controllare e inviare adesso?',
      testo: parti.length
        ? `Con i dati di adesso: ${parti.join('; ')}. Il controllo rilegge la situazione al momento dell’invio.`
        : 'Adesso nessuno risulta in attesa: il controllo rilegge la situazione e invia solo se trova qualcuno.',
      etichetta: 'Controlla e invia',
      onOk: () => {
        setDialogo(null)
        eseguiInattivita()
      }
    })
  }

  function chiediPausa() {
    setDialogo({
      titolo: 'Controllare e inviare adesso?',
      testo: candidatiPausa.length
        ? `Con i dati di adesso ${candidatiPausa.length === 1 ? 'una persona riceve' : `${candidatiPausa.length} persone ricevono`} l’email sulla pausa di pratica. Il controllo rilegge la situazione al momento dell’invio.`
        : 'Adesso nessuno risulta in attesa: il controllo rilegge la situazione e invia solo se trova qualcuno.',
      etichetta: 'Controlla e invia',
      onOk: () => {
        setDialogo(null)
        eseguiPausa()
      }
    })
  }

  async function eseguiInattivita() {
    setErrInattivita(null)
    setMsgInattivita(null)
    setInvioInattivita(true)
    const { data: esito, error: errFn } = await supabase.functions.invoke('notifica-inattivita', {
      body: {}
    })
    if (errFn) {
      setErrInattivita('Il controllo non è partito. Riprova tra un momento.')
    } else if (esito?.motivo === 'RESEND_NON_CONFIGURATO') {
      setMsgInattivita(`Trovati ${esito.n_previsti ?? 0} destinatari, ma manca il servizio email sul server.`)
    } else if (esito?.error === 'NON_AUTORIZZATO') {
      setErrInattivita('Non autorizzato a inviare i promemoria automatici.')
    } else if (esito?.ok) {
      const n = esito.n_inviate ?? 0
      const chiuse = esito.n_chiusure ?? 0
      mostra({
        testo: n === 0 && chiuse === 0
          ? 'Nessun nuovo avviso né chiusura'
          : `Inviati ${n} avvisi di inattività${chiuse > 0 ? `, chiuse ${chiuse} ${chiuse === 1 ? 'iscrizione' : 'iscrizioni'}` : ''}`
      })
    } else {
      setErrInattivita(esito?.errore || 'L’invio dei promemoria non è andato a buon fine.')
    }
    setInvioInattivita(false)
    carica()
  }

  async function eseguiPausa() {
    setErrPausa(null)
    setMsgPausa(null)
    setInvioPausa(true)
    const { data: esito, error: errFn } = await supabase.functions.invoke('promemoria-pausa', {
      body: {}
    })
    if (errFn) {
      setErrPausa('Il controllo non è partito. Riprova tra un momento.')
    } else if (esito?.motivo === 'RESEND_NON_CONFIGURATO') {
      setMsgPausa(`Trovate ${esito.n_previsti ?? 0} persone, ma manca il servizio email sul server.`)
    } else if (esito?.error === 'NON_AUTORIZZATO') {
      setErrPausa('Non autorizzato a inviare i promemoria automatici.')
    } else if (esito?.ok) {
      const n = esito.n_inviate ?? 0
      mostra({ testo: n === 0 ? 'Nessuna nuova email di pausa' : `Inviate ${n} email di pausa` })
    } else {
      setErrPausa(esito?.errore || 'L’invio delle email di pausa non è andato a buon fine.')
    }
    setInvioPausa(false)
    carica()
  }

  // ── Elenco ────────────────────────────────────────────────────────────────

  const attesaInattivita = candidati.length + ritiri.length
  const conteggi = {
    tutte: lista.length + AUTOMATICHE.length,
    programmate: daGestire.length,
    inviate: inviate.length,
    automatiche: AUTOMATICHE.length
  }
  const mostraGruppo = id => filtro === 'tutte' || filtro === id

  function rigaComunicazione(c) {
    const stato = statoDi(c)
    return (
      <li key={c.id}>
        <button
          type="button"
          className="riga-elenco riga-cliccabile"
          aria-current={voce === c.id ? 'true' : undefined}
          onClick={() => apri(c.id)}
        >
          <span className="riga-elenco-testi">
            <span className="riga-elenco-titolo">{c.oggetto || etichettaTipo(c.tipo)}</span>
            <span className="riga-elenco-meta">
              {[
                c.cicli?.nome_ciclo,
                data(c.data_invio),
                c.destinatari === 'remoto' ? 'da remoto' : null,
                c.tipo === 'reminder_t3' ? 'T3' : null
              ].filter(Boolean).join(' · ')}
            </span>
          </span>
          <Badge tono={stato.tono}>{stato.etichetta}</Badge>
        </button>
      </li>
    )
  }

  function rigaAutomatica(a) {
    const n = a.id === 'inattivita' ? attesaInattivita : candidatiPausa.length
    return (
      <li key={a.id}>
        <button
          type="button"
          className="riga-elenco riga-cliccabile"
          aria-current={voce === a.id ? 'true' : undefined}
          onClick={() => apri(a.id)}
        >
          <span className="riga-elenco-testi">
            <span className="riga-elenco-titolo">{a.titolo}</span>
            <span className="riga-elenco-meta">{a.descrizione}</span>
          </span>
          <Badge tono={n > 0 ? 'attenzione' : 'ok'}>{n > 0 ? `${n} in attesa` : 'Nessuno in attesa'}</Badge>
        </button>
      </li>
    )
  }

  // ── Dettaglio ─────────────────────────────────────────────────────────────

  let dettaglio = null
  if (voce === 'nuova') dettaglio = { titolo: 'Nuova comunicazione', sopratitolo: 'Da scrivere' }
  else if (inModifica) dettaglio = { titolo: inModifica.oggetto || etichettaTipo(inModifica.tipo), sopratitolo: statoDi(inModifica).etichetta }
  else if (aperta) dettaglio = { titolo: aperta.oggetto || etichettaTipo(aperta.tipo), sopratitolo: `Inviata il ${data(aperta.data_invio)}` }
  else if (voce === 'inattivita') dettaglio = { titolo: 'Inattività · da remoto', sopratitolo: 'Email automatica' }
  else if (voce === 'pausa') dettaglio = { titolo: 'Pausa di pratica', sopratitolo: 'Email automatica' }

  function modulo() {
    return (
      <form className="com-modulo" onSubmit={handleSubmit}>
        {inModifica?.stato === 'errore' && (
          <p className="avviso-errore">L’invio di questa comunicazione non è riuscito. Controlla il testo e riprova.</p>
        )}
        <div className="riga-due">
          <div className="field">
            <label htmlFor="com-ciclo">Ciclo</label>
            <select id="com-ciclo" required value={form.ciclo_id} onChange={e => setForm({ ...form, ciclo_id: e.target.value })}>
              <option value="">Scegli un ciclo</option>
              {cicli.map(c => <option key={c.id} value={c.id}>{c.nome_ciclo}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="com-destinatari">Destinatari</label>
            <select id="com-destinatari" value={form.destinatari} onChange={e => setForm({ ...form, destinatari: e.target.value })}>
              {DESTINATARI.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="com-tipo">Tipo</label>
          <select id="com-tipo" value={form.tipo} onChange={e => cambiaTipo(e.target.value)}>
            {TIPI.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          {form.tipo === 'reminder_t3' && (
            <p className="hint">Il T3 è il follow-up a distanza, il momento più facile da dimenticare.</p>
          )}
        </div>
        <div className="field">
          <label htmlFor="com-oggetto">Oggetto</label>
          <input id="com-oggetto" required value={form.oggetto} onChange={e => setForm({ ...form, oggetto: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="com-testo">Testo</label>
          <textarea id="com-testo" required rows="10" value={form.testo} onChange={e => setForm({ ...form, testo: e.target.value })} />
          <p className="hint">Ogni testo chiude con il disclaimer sul percorso. L’email serve solo al contatto: non viene unita alle risposte.</p>
        </div>
        <label className="vetrina-spunta com-invia-ora">
          <input
            type="checkbox"
            checked={form.invia_ora}
            onChange={e => setForm({ ...form, invia_ora: e.target.checked })}
          />
          <span>Invia subito via email</span>
        </label>
        {errore && <p className="avviso-errore" role="alert">{errore}</p>}
        <div className="dialogo-azioni">
          <button className="btn" type="submit" disabled={invio || !form.ciclo_id}>
            {invio
              ? 'Invio in corso…'
              : form.invia_ora
                ? 'Salva e invia'
                : inModifica
                  ? 'Salva modifiche'
                  : 'Salva da inviare'}
          </button>
          <button className="btn btn-ghost" type="button" disabled={invio} onClick={inviaProva}>
            Invia una prova a me
          </button>
          {inModifica && !form.invia_ora && (
            <button className="btn btn-ghost" type="button" disabled={invio} onClick={() => chiediInvio(inModifica)}>
              Invia ora
            </button>
          )}
        </div>
        {inModifica && (
          <div className="com-zona-pericolo">
            <button className="btn btn-ghost is-pericolo" type="button" disabled={invio} onClick={() => chiediElimina(inModifica)}>
              Cancella
            </button>
          </div>
        )}
      </form>
    )
  }

  function inviata(c) {
    return (
      <div className="com-dettaglio">
        <dl className="com-dati">
          <div><dt>Ciclo</dt><dd>{c.cicli?.nome_ciclo || '—'}</dd></div>
          <div><dt>Destinatari</dt><dd>{c.destinatari === 'remoto' ? 'Chi segue da remoto' : 'Tutti i partecipanti'}</dd></div>
          <div><dt>Tipo</dt><dd>{etichettaTipo(c.tipo)}</dd></div>
          <div><dt>Inviata il</dt><dd>{data(c.data_invio) || '—'}</dd></div>
        </dl>
        <div className="com-testo">{c.testo}</div>
        <div className="dialogo-azioni">
          <button className="btn btn-ghost" type="button" onClick={() => riusa(c)}>Riusa il testo</button>
        </div>
      </div>
    )
  }

  function elencoInviati(voci, vuoto, conTipo = false) {
    if (voci.length === 0) return <p className="hint">{vuoto}</p>
    return (
      <ul className="com-storico">
        {voci.map(n => (
          <li key={n.id}>
            <span className="com-storico-codice">{n.utenti?.codice_partecipante || '—'}</span>
            {conTipo && <span>{ETICHETTE_INATTIVITA[n.tipo] || n.tipo}</span>}
            <span className="hint">{data(n.inviata_il)}</span>
          </li>
        ))}
      </ul>
    )
  }

  function dettaglioInattivita() {
    return (
      <div className="com-dettaglio">
        <p>
          Dopo 15 giorni parte un’email a chi segue da remoto: se non ha fatto l’onboarding, o se dopo
          l’onboarding non ha ancora iniziato le pratiche. Se l’inattività continua per altri 15 giorni,
          l’account viene chiuso: potrà iscriversi di nuovo quando sarà pronto. Ogni avviso parte una sola
          volta, con una copia a {EMAIL_CONTATTO}.
        </p>
        <p className="hint">
          {attesaInattivita === 0
            ? 'Nessun iscritto remoto in attesa di avviso o chiusura.'
            : [
                candidati.length > 0
                  ? `${candidati.length} ${candidati.length === 1 ? 'persona in attesa' : 'persone in attesa'} di avviso`
                  : null,
                ritiri.length > 0 ? `${ritiri.length} account in chiusura` : null
              ].filter(Boolean).join(' · ')}
        </p>
        {msgInattivita && <p className="disclaimer">{msgInattivita}</p>}
        {errInattivita && <p className="avviso-errore" role="alert">{errInattivita}</p>}
        <div className="dialogo-azioni">
          <button className="btn" type="button" disabled={invioInattivita} onClick={chiediInattivita}>
            {invioInattivita ? 'Controllo in corso…' : 'Controlla e invia ora'}
          </button>
        </div>
        <section className="com-sezione">
          <h3>Avvisi inviati</h3>
          {elencoInviati(inattivita, 'Nessun avviso inviato finora.', true)}
        </section>
      </div>
    )
  }

  function dettaglioPausa() {
    return (
      <div className="com-dettaglio">
        <p>
          Se per tre giorni di fila non risulta una meditazione ascoltata per intero, parte un’email. Vale
          per chi è dentro un percorso aperto; il giorno in corso non conta. Ogni pausa riceve una sola
          email: se la persona riprende e si ferma di nuovo, ne arriva un’altra. Una copia con i soli codici
          va a {EMAIL_CONTATTO}.
        </p>
        {errLetturaPausa
          ? <p className="avviso-errore" role="alert">{errLetturaPausa}</p>
          : (
            <p className="hint">
              {candidatiPausa.length === 0
                ? 'Nessuna persona in attesa di questa email.'
                : `${candidatiPausa.length} ${candidatiPausa.length === 1 ? 'persona in attesa' : 'persone in attesa'}.`}
            </p>
          )}
        {msgPausa && <p className="disclaimer">{msgPausa}</p>}
        {errPausa && <p className="avviso-errore" role="alert">{errPausa}</p>}
        <div className="dialogo-azioni">
          <button className="btn" type="button" disabled={invioPausa} onClick={chiediPausa}>
            {invioPausa ? 'Controllo in corso…' : 'Controlla e invia ora'}
          </button>
        </div>
        <section className="com-sezione">
          <h3>Email inviate</h3>
          {elencoInviati(pause, 'Nessuna email di pausa inviata finora.')}
        </section>
      </div>
    )
  }

  return (
    <PaginaAdmin
      titolo="Comunicazioni"
      meta={caricato
        ? `${daGestire.length} da inviare · ${inviate.length} inviate · 2 automatiche`
        : 'Promemoria e annunci ai partecipanti di un ciclo.'}
      layout="elenco-dettaglio"
      stato={caricato ? undefined : 'attesa'}
      statoTesto="Carico le comunicazioni…"
    >
      <ElencoPannello>
        {errLettura && <p className="avviso-errore" role="alert">{errLettura}</p>}
        <section className="card is-lista elenco-comunicazioni" aria-label="Comunicazioni">
          <div className="elenco-strumenti">
            <div className="filtri-chip" role="group" aria-label="Filtra le comunicazioni">
              {FILTRI.map(f => (
                <button
                  key={f.id}
                  type="button"
                  className="chip"
                  aria-pressed={filtro === f.id}
                  onClick={() => aggiornaRicerca({ filtro: f.id === 'tutte' ? '' : f.id }, { replace: true })}
                >
                  {f.label} · {conteggi[f.id]}
                </button>
              ))}
            </div>
          </div>

          {mostraGruppo('programmate') && (
            <div className="elenco-gruppo">
              <h2 className="elenco-gruppo-titolo">Da inviare</h2>
              {daGestire.length === 0
                ? <p className="card-vuota">Nessuna comunicazione in attesa di invio.</p>
                : <ul className="elenco-righe">{daGestire.map(rigaComunicazione)}</ul>}
            </div>
          )}
          {mostraGruppo('automatiche') && (
            <div className="elenco-gruppo">
              <h2 className="elenco-gruppo-titolo">Automatiche</h2>
              <ul className="elenco-righe">{AUTOMATICHE.map(rigaAutomatica)}</ul>
            </div>
          )}
          {mostraGruppo('inviate') && (
            <div className="elenco-gruppo">
              <h2 className="elenco-gruppo-titolo">Inviate</h2>
              {inviate.length === 0
                ? <p className="card-vuota">Nessuna comunicazione inviata finora.</p>
                : <ul className="elenco-righe">{inviate.map(rigaComunicazione)}</ul>}
            </div>
          )}
        </section>
      </ElencoPannello>

      <PannelloDettaglio
        aperto={Boolean(dettaglio)}
        onChiudi={() => aggiornaRicerca({ voce: '' })}
        titolo={dettaglio?.titolo}
        sopratitolo={dettaglio?.sopratitolo}
        vuoto="Scegli una comunicazione"
        vuotoTesto="Aprila dall’elenco per rileggerla o modificarla. Per scriverne una nuova usa «Nuova comunicazione»."
        vuotoIcona={IconaPosta}
      >
        {(voce === 'nuova' || inModifica) && modulo()}
        {aperta && !inModifica && inviata(aperta)}
        {voce === 'inattivita' && dettaglioInattivita()}
        {voce === 'pausa' && dettaglioPausa()}
      </PannelloDettaglio>

      <DialogConferma
        aperto={!!dialogo}
        titolo={dialogo?.titolo || ''}
        confermaEtichetta={dialogo?.etichetta || 'Conferma'}
        pericolo={Boolean(dialogo?.pericolo)}
        onConferma={() => dialogo?.onOk?.()}
        onAnnulla={() => setDialogo(null)}
      >
        {dialogo?.testo}
      </DialogConferma>
    </PaginaAdmin>
  )
}
