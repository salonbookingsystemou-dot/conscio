// Cicli e iscrizioni nell'area facilitatore: letture e regole condivise fra la
// pagina Cicli e lo spazio del ciclo.

import { supabase } from './supabaseClient'
import { punteggioFfmq, punteggioPss10 } from './scoring'
import { addDays, formatISODate, oggiLocaleISO, parseISODate } from './date.js'

export const ESITI = [
  { id: 'in_attesa', label: 'In attesa' },
  { id: 'in_valutazione', label: 'In valutazione' },
  { id: 'idoneo', label: 'Idoneo' },
  { id: 'da_ricontattare', label: 'Da ricontattare' }
]

export const MODALITA = [
  { id: 'presenza', label: 'In presenza' },
  { id: 'remoto', label: 'Da remoto' }
]

const MESI_CORTI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

const COLONNE_CICLO = 'id, nome_ciclo, data_inizio, data_fine, stato, posti_totali, link_incontro'
const COLONNE_ISCRIZIONE = 'id, esito_screening, modalita_fruizione, ciclo_id, utenti(codice_partecipante, email, stato_screening, onboarding_completato)'

export function eIdoneo(iscrizione) {
  return iscrizione.esito_screening === 'idoneo' || iscrizione.utenti?.stato_screening === 'idoneo'
}

export function eRemoto(iscrizione) {
  return (iscrizione.modalita_fruizione || 'presenza') === 'remoto'
}

export function eRitirato(iscrizione) {
  return iscrizione.esito_screening === 'ritirato' || iscrizione.utenti?.stato_screening === 'ritirato'
}

export function inAttesaDiEsito(iscrizione) {
  return !eIdoneo(iscrizione) && !eRitirato(iscrizione)
}

// Fase più avanzata raggiunta da un idoneo lungo il percorso.
// Ordine reale: Idoneo → Primo accesso → T0 → (settimane) → T1 → T2 → T3 → Concluso.
export function faseIdoneo(iscrizione, timepoints, ciclo) {
  const tp = timepoints || new Set()
  const onboarding = Boolean(iscrizione.utenti?.onboarding_completato)
  if (ciclo?.stato === 'concluso') {
    return { etichetta: 'Concluso', tono: 'chiuso', dettaglio: 'Ciclo concluso.' }
  }
  if (tp.has('T3')) {
    return { etichetta: 'Follow-up (T3)', tono: 'avanzato', dettaglio: 'Questionario di follow-up (T3) compilato.' }
  }
  if (tp.has('T2')) {
    return { etichetta: 'A fine percorso (T2)', tono: 'avanti', dettaglio: 'Questionario di fine percorso (T2) compilato.' }
  }
  if (tp.has('T1')) {
    return { etichetta: 'A metà (T1)', tono: 'avanti', dettaglio: 'Questionario di metà percorso (T1) compilato.' }
  }
  if (tp.has('T0')) {
    return { etichetta: 'In percorso', tono: 'attivo', dettaglio: 'Questionario iniziale (T0) compilato: sta seguendo le settimane.' }
  }
  if (onboarding) {
    return { etichetta: 'Primo accesso', tono: 'ambra', dettaglio: 'Primo accesso completato · questionario T0 ancora da compilare.' }
  }
  return { etichetta: 'Da avviare', tono: 'attesa', dettaglio: 'Idoneo · primo accesso non ancora fatto.' }
}

export function linkIncontroValido(valore) {
  const pulito = String(valore || '').trim()
  if (!pulito) return null
  return /^https:\/\//i.test(pulito) ? pulito : false
}

export function etichettaPeriodo(inizioIso, fineIso) {
  const inizio = parseISODate(inizioIso)
  if (!inizio) return '—'
  const fine = parseISODate(fineIso) || addDays(inizio, 62)
  const a = `${inizio.getDate()} ${MESI_CORTI[inizio.getMonth()]}`
  const b = `${fine.getDate()} ${MESI_CORTI[fine.getMonth()]} ${fine.getFullYear()}`
  return `${a} — ${b}`
}

function settimanaCiclo(inizioIso) {
  const inizio = parseISODate(inizioIso)
  if (!inizio) return 0
  const oggi = parseISODate(oggiLocaleISO())
  if (oggi < inizio) return 0
  return Math.max(1, Math.min(9, Math.floor((oggi - inizio) / (7 * 24 * 60 * 60 * 1000)) + 1))
}

function etichettaAttesaInizio(inizioIso) {
  const inizio = parseISODate(inizioIso)
  const oggi = parseISODate(oggiLocaleISO())
  if (!inizio || !oggi) return 'In partenza'
  const giorni = Math.round((inizio - oggi) / (24 * 60 * 60 * 1000))
  if (giorni <= 0) return 'Inizia oggi'
  if (giorni === 1) return 'Inizio domani'
  if (giorni < 14) return `Inizio tra ${giorni} giorni`
  const settimane = Math.round(giorni / 7)
  return `Inizio tra ${settimane} settiman${settimane === 1 ? 'a' : 'e'}`
}

export function etichettaAvanzamento(ciclo) {
  const sett = settimanaCiclo(ciclo.data_inizio)
  if (ciclo.stato === 'concluso') return { testo: 'Completato', pct: 100, tono: 'chiuso' }
  if (sett === 0) {
    return {
      testo: etichettaAttesaInizio(ciclo.data_inizio),
      pct: 4,
      tono: 'attesa'
    }
  }
  if (sett >= 9) return { testo: 'Settimana intensiva / fine', pct: 95, tono: 'attivo' }
  return {
    testo: `Settimana ${sett} di 8`,
    pct: Math.round((sett / 8) * 100),
    tono: 'attivo'
  }
}

export function etichettaStato(stato) {
  if (stato === 'reclutamento') return 'in reclutamento'
  return stato
}

// Timepoint che la persona ha già potuto compilare, anche a finestra chiusa.
// Finestre dello schema: T0 fino alla settimana 1, T1 nelle 4-5,
// T2 dalla settimana 8 a 14 giorni dopo la fine, T3 da 4 a 8 settimane dopo la fine.
// Il T0 resta nel conteggio dopo la settimana 1.
export function timepointRaggiunti(ciclo) {
  if (!ciclo) return ['T0']
  const oggi = parseISODate(oggiLocaleISO())
  const inizio = parseISODate(ciclo.data_inizio)
  const fine = parseISODate(ciclo.data_fine) || (inizio ? addDays(inizio, 62) : null)
  const dopoFine = ciclo.stato === 'concluso' || (fine && oggi && oggi > fine)
  const sett = settimanaCiclo(ciclo.data_inizio)
  const lista = ['T0']
  if (dopoFine || sett >= 4) lista.push('T1')
  if (dopoFine || sett >= 8) lista.push('T2')
  if (fine && oggi && oggi >= addDays(fine, 28)) lista.push('T3')
  return lista
}

function aggregaPunteggi(righe) {
  const gruppi = {}
  for (const r of righe || []) {
    const chiave = `${r.codice_partecipante}|${r.timepoint}|${r.questionario}`
    if (!gruppi[chiave]) {
      gruppi[chiave] = {
        codice: r.codice_partecipante,
        timepoint: r.timepoint,
        questionario: r.questionario,
        item: []
      }
    }
    gruppi[chiave].item.push({ ordine: r.ordine, valore: r.valore })
  }
  return Object.values(gruppi).map(g => {
    const punteggio = g.questionario === 'PSS-10'
      ? punteggioPss10(g.item)
      : g.questionario === 'FFMQ-I'
        ? punteggioFfmq(g.item)
        : null
    return { ...g, punteggio }
  }).sort((a, b) => a.codice.localeCompare(b.codice) || a.timepoint.localeCompare(b.timepoint))
}

export function timepointsPerCodice(punteggi) {
  const mappa = new Map()
  for (const p of punteggi) {
    if (!p.codice || !p.timepoint) continue
    if (!mappa.has(p.codice)) mappa.set(p.codice, new Set())
    mappa.get(p.codice).add(p.timepoint)
  }
  return mappa
}

// Chi segue un percorso individuale da remoto (senza ciclo) ha un calendario suo: resta fuori.
export function codiciPerCiclo(iscrizioni) {
  const mappa = new Map()
  for (const i of iscrizioni) {
    const codice = i.utenti?.codice_partecipante
    if (!i.ciclo_id || !codice || !eIdoneo(i)) continue
    if (!mappa.has(i.ciclo_id)) mappa.set(i.ciclo_id, [])
    mappa.get(i.ciclo_id).push(codice)
  }
  return mappa
}

export function calcolaKpi(iscrizioni, cicli, punteggi) {
  const attivi = iscrizioni.filter(eIdoneo).length
  const inAttesa = iscrizioni.filter(inAttesaDiEsito).length

  // Quanti idonei hanno compilato ciascun questionario tra chi l'ha già raggiunto.
  // Non solo chi ha la finestra aperta oggi: in settimana 2 il T0 è chiuso,
  // ma i compilati del gruppo restano nel conteggio.
  const cicloById = new Map(cicli.map(c => [c.id, c]))
  const compilato = { T0: new Set(), T1: new Set(), T2: new Set(), T3: new Set() }
  for (const p of punteggi) {
    if (compilato[p.timepoint]) compilato[p.timepoint].add(p.codice)
  }
  const conteggi = {
    T0: { att: 0, fatti: 0 }, T1: { att: 0, fatti: 0 },
    T2: { att: 0, fatti: 0 }, T3: { att: 0, fatti: 0 }
  }
  for (const i of iscrizioni) {
    if (!eIdoneo(i)) continue
    const codice = i.utenti?.codice_partecipante
    if (!codice) continue
    const raggiunti = timepointRaggiunti(i.ciclo_id ? cicloById.get(i.ciclo_id) : null)
    for (const tp of raggiunti) {
      conteggi[tp].att += 1
      if (compilato[tp].has(codice)) conteggi[tp].fatti += 1
    }
  }
  // Il questionario più avanti che qualcuno ha già potuto compilare.
  let tpFocus = null
  for (const tp of ['T0', 'T1', 'T2', 'T3']) {
    if (conteggi[tp].att === 0) continue
    tpFocus = tp
  }

  return {
    attivi,
    inAttesa,
    tpFocus,
    qFatti: tpFocus ? conteggi[tpFocus].fatti : 0,
    qAttesi: tpFocus ? conteggi[tpFocus].att : 0
  }
}

export function esportaAggregati({ ciclo, kpi, punteggi, logN }) {
  const payload = {
    esportato_il: new Date().toISOString(),
    ciclo: ciclo?.nome_ciclo || null,
    kpi,
    punteggi: punteggi.map(p => ({
      codice: p.codice,
      timepoint: p.timepoint,
      questionario: p.questionario,
      totale: p.punteggio?.totale ?? null
    })),
    log_n: logN
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `conscio-aggregati-${formatISODate(new Date())}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Letture dell'area facilitatore. Ogni voce può mancare senza bloccare le
 * altre: `errori` dice quali non sono arrivate.
 */
export async function leggiDatiCicli({ notifiche = false, segnalazioni = false } = {}) {
  const richieste = [
    supabase.from('cicli').select(COLONNE_CICLO).order('data_inizio', { ascending: false }),
    supabase.from('iscrizioni').select(COLONNE_ISCRIZIONE),
    supabase.rpc('risposte_pseudonime'),
    supabase.rpc('log_pratica_pseudonimi'),
    notifiche
      ? supabase.from('notifiche_inattivita').select('tipo, inviata_il, utenti(codice_partecipante)')
      : Promise.resolve({ data: [] }),
    segnalazioni ? supabase.rpc('segnalazioni_difficili_aperte') : Promise.resolve({ data: [] })
  ]
  const risultati = await Promise.allSettled(richieste)
  const errori = new Set()
  const dato = (indice, nome) => {
    const r = risultati[indice]
    if (r.status !== 'fulfilled' || r.value.error) {
      errori.add(nome)
      return []
    }
    return r.value.data || []
  }
  return {
    cicli: dato(0, 'cicli'),
    iscrizioni: dato(1, 'iscrizioni'),
    punteggi: aggregaPunteggi(dato(2, 'punteggi')),
    log: dato(3, 'log'),
    notifiche: dato(4, 'notifiche'),
    segnalazioni: dato(5, 'segnalazioni'),
    errori
  }
}

// ── Da fare: segnalazioni aperte + iscrizioni in attesa (badge del menu) ─────

const EVENTO_DA_FARE = 'conscio:da-fare'

export async function contaDaFare() {
  const [seg, iscr] = await Promise.all([
    supabase.rpc('segnalazioni_difficili_aperte'),
    supabase.from('iscrizioni').select('esito_screening, utenti(stato_screening)')
  ])
  const segnalazioni = seg.error ? 0 : (seg.data || []).length
  const attesa = iscr.error ? 0 : (iscr.data || []).filter(inAttesaDiEsito).length
  return segnalazioni + attesa
}

export function avvisaDaFare() {
  window.dispatchEvent(new Event(EVENTO_DA_FARE))
}

export function osservaDaFare(fn) {
  window.addEventListener(EVENTO_DA_FARE, fn)
  return () => window.removeEventListener(EVENTO_DA_FARE, fn)
}

// ── Azioni sulle iscrizioni ──────────────────────────────────────────────────

const POSTI_PIENI = 'I posti in presenza di questo ciclo sono già al completo. Puoi ancora segnare la persona come da remoto.'

/** Restituisce un messaggio d'errore, o null se è andata bene. */
export async function impostaEsito(iscrizione, esito) {
  const appenaIdoneo = esito === 'idoneo' && !eIdoneo(iscrizione)
  const { error } = await supabase.rpc('imposta_esito_screening', {
    p_iscrizione_id: iscrizione.id,
    p_esito: esito
  })
  if (error?.message?.includes('POSTI_IDONEI_PIENI')) return POSTI_PIENI
  if (error) return 'Non è stato possibile aggiornare l’esito.'
  if (appenaIdoneo) {
    try {
      await supabase.functions.invoke('porta', {
        body: { azione: 'notifica_idoneita', iscrizione_id: iscrizione.id }
      })
    } catch {
      /* L’esito è già salvato: l’email è un invio best effort. */
    }
  }
  avvisaDaFare()
  return null
}

export async function impostaModalita(iscrizione, modalita) {
  const { error } = await supabase.rpc('imposta_modalita_fruizione', {
    p_iscrizione_id: iscrizione.id,
    p_modalita: modalita
  })
  if (error?.message?.includes('POSTI_IDONEI_PIENI')) return POSTI_PIENI
  if (error?.message?.includes('CICLO_MANCANTE')) {
    return 'Per passare in presenza collega prima questa iscrizione a un ciclo.'
  }
  if (error) return 'Non è stato possibile aggiornare la modalità di fruizione.'
  return null
}

export async function assegnaACiclo(iscrizione, cicloId) {
  const { error } = await supabase.rpc('assegna_iscrizione_a_ciclo', {
    p_iscrizione_id: iscrizione.id,
    p_ciclo_id: cicloId
  })
  if (error) return 'Non è stato possibile collegare questa iscrizione a un ciclo.'
  return null
}

export async function ritira(iscrizione) {
  const codice = iscrizione.utenti?.codice_partecipante
  if (!codice) return 'Questa iscrizione non ha un codice.'
  const { error } = await supabase.rpc('ritira_partecipante', { p_codice: codice })
  if (error) return 'Non è stato possibile ritirare questa persona.'
  avvisaDaFare()
  return null
}

export function dialogoRitiro(iscrizione) {
  const codice = iscrizione.utenti?.codice_partecipante
  return {
    titolo: 'Ritirare questa persona dal percorso?',
    testo: `${iscrizione.utenti?.email || codice} verrà ritirato: azzeriamo i dati personali `
      + '(email e risposte libere di onboarding) e il posto si libera. '
      + 'Restano, in forma anonima e a fini statistici, i questionari e il tono per sessione legati al codice.',
    etichetta: 'Ritira dal percorso'
  }
}
