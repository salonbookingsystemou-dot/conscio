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
const COLONNE_ISCRIZIONE = 'id, esito_screening, modalita_fruizione, ciclo_id, data_inizio_pratica, utenti(codice_partecipante, email, stato_screening, onboarding_completato, email_confermata_il)'

// Un'iscrizione conta solo dopo il primo ingresso con il codice ricevuto per email.
// Finché non è confermata resta fuori da posti, numeri chiave, badge e filtro «Idonei».
export function eConfermata(iscrizione) {
  return Boolean(iscrizione.utenti?.email_confermata_il)
}

export function eIdoneo(iscrizione) {
  if (!eConfermata(iscrizione)) return false
  return iscrizione.esito_screening === 'idoneo' || iscrizione.utenti?.stato_screening === 'idoneo'
}

export function eRemoto(iscrizione) {
  return (iscrizione.modalita_fruizione || 'presenza') === 'remoto'
}

export function eRitirato(iscrizione) {
  return iscrizione.esito_screening === 'ritirato' || iscrizione.utenti?.stato_screening === 'ritirato'
}

export function inAttesaDiEsito(iscrizione) {
  return eConfermata(iscrizione) && !eIdoneo(iscrizione) && !eRitirato(iscrizione)
}

// Giorno di conclusione del ciclo, come fine_ciclo / apertura_t2 nel database:
// il più tardi tra il giorno 56 e la data di fine.
export function fineCiclo(ciclo) {
  const inizio = parseISODate(ciclo?.data_inizio)
  const fine = parseISODate(ciclo?.data_fine)
  if (!inizio) return fine
  const giorno56 = addDays(inizio, 55)
  return fine && fine > giorno56 ? fine : giorno56
}

// Stato da mostrare: dal giorno dopo la fine il ciclo è «concluso» anche se il
// database non è ancora stato allineato (lo fa chiudi_cicli_terminati ogni mattina).
export function statoCiclo(ciclo) {
  if (!ciclo) return null
  if (ciclo.stato === 'concluso') return 'concluso'
  const fine = fineCiclo(ciclo)
  const oggi = parseISODate(oggiLocaleISO())
  return fine && oggi && oggi > fine ? 'concluso' : ciclo.stato
}

function giornoBreve(iso) {
  const d = parseISODate(iso)
  return d ? `${d.getDate()} ${MESI_CORTI[d.getMonth()]}` : ''
}

// «il 9 nov» ma «l'11 nov», «dal 9 nov» ma «dall'8 nov»: 8 e 11 iniziano per vocale.
function conArticolo(preposizione, iso) {
  const giorno = parseISODate(iso)?.getDate()
  const vocale = giorno === 8 || giorno === 11
  const forme = { il: vocale ? 'l’' : 'il ', dal: vocale ? 'dall’' : 'dal ' }
  return `${forme[preposizione]}${giornoBreve(iso)}`
}

// Questionario più avanti compilato, per i dettagli della riga.
function avanzamentoQuestionari(iscrizione, tp) {
  if (tp.has('T3')) return 'follow-up (T3) compilato'
  if (tp.has('T2')) return 'T2 compilato'
  if (tp.has('T1')) return 'T1 compilato'
  if (tp.has('T0')) return 'T0 compilato'
  if (iscrizione.utenti?.onboarding_completato) return 'primo accesso fatto, T0 da compilare'
  return 'primo accesso non ancora fatto'
}

const FASI = {
  completato: { etichetta: 'Percorso completato', tono: 'avanzato' },
  da_chiudere: { etichetta: 'Da chiudere', tono: 'ambra' },
  partenza: { etichetta: 'In partenza', tono: 'attesa' },
  in_percorso: { etichetta: 'In percorso', tono: 'attivo' },
  inattivi: { etichetta: 'Inattivo', tono: 'attesa' }
}

// Stato del percorso di un idoneo: lo stesso della card «Partecipanti»
// (gruppoPercorso), con il questionario più avanti e l'ultima pratica nei dettagli.
export function faseIdoneo(iscrizione, timepoints, { gruppo, ultimaPratica = '', inizio = null } = {}) {
  const tp = timepoints || new Set()
  const fase = FASI[gruppo] || FASI.inattivi
  const questionari = avanzamentoQuestionari(iscrizione, tp)
  const pratica = ultimaPratica ? `ultima pratica ${conArticolo('il', ultimaPratica)}` : 'nessuna pratica registrata'
  let dettaglio
  if (gruppo === 'completato') dettaglio = `Sequenza finale chiusa · ${questionari}`
  else if (gruppo === 'da_chiudere') {
    dettaglio = `8 settimane finite, sequenza finale aperta · ${tp.has('T2') ? 'T2 compilato' : 'T2 da compilare'} · ${pratica}`
  } else if (gruppo === 'partenza') dettaglio = `Inizia ${conArticolo('il', inizio)} · ${questionari}`
  else if (gruppo === 'in_percorso') dettaglio = `${questionari} · ${pratica}`
  else dettaglio = `${questionari} · ${ultimaPratica ? `nessuna pratica ${conArticolo('dal', ultimaPratica)}` : 'nessuna pratica registrata'}`
  return { ...fase, dettaglio }
}

export function linkIncontroValido(valore) {
  const pulito = String(valore || '').trim()
  if (!pulito) return null
  return /^https:\/\//i.test(pulito) ? pulito : false
}

export function etichettaPeriodo(inizioIso, fineIso) {
  const inizio = parseISODate(inizioIso)
  if (!inizio) return '—'
  const fine = parseISODate(fineIso) || addDays(inizio, 55)
  const a = `${inizio.getDate()} ${MESI_CORTI[inizio.getMonth()]}`
  const b = `${fine.getDate()} ${MESI_CORTI[fine.getMonth()]} ${fine.getFullYear()}`
  return `${a} — ${b}`
}

function settimanaCiclo(inizioIso) {
  const inizio = parseISODate(inizioIso)
  if (!inizio) return 0
  const oggi = parseISODate(oggiLocaleISO())
  if (oggi < inizio) return 0
  return Math.max(1, Math.min(8, Math.floor((oggi - inizio) / (7 * 24 * 60 * 60 * 1000)) + 1))
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
  if (statoCiclo(ciclo) === 'concluso') return { testo: 'Completato', pct: 100, tono: 'chiuso' }
  if (sett === 0) {
    return {
      testo: etichettaAttesaInizio(ciclo.data_inizio),
      pct: 4,
      tono: 'attesa'
    }
  }
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
// T2 dal giorno 56 (o dall'ultimo giorno del ciclo, se arriva dopo) a 14 giorni dopo la fine, T3 da 4 a 8 settimane dopo la fine.
// Il T0 resta nel conteggio dopo la settimana 1.
export function timepointRaggiunti(ciclo) {
  if (!ciclo) return ['T0']
  const oggi = parseISODate(oggiLocaleISO())
  const inizio = parseISODate(ciclo.data_inizio)
  const fine = parseISODate(ciclo.data_fine) || (inizio ? addDays(inizio, 55) : null)
  const dopoFine = statoCiclo(ciclo) === 'concluso' || (fine && oggi && oggi > fine)
  const sett = settimanaCiclo(ciclo.data_inizio)
  const lista = ['T0']
  if (dopoFine || sett >= 4) lista.push('T1')
  // Come apertura_t2 nel database: giorno 56, o l'ultimo giorno del ciclo se arriva dopo.
  const apreT2 = inizio ? (fine && fine > addDays(inizio, 55) ? fine : addDays(inizio, 55)) : fine
  if (dopoFine || (apreT2 && oggi && oggi >= apreT2)) lista.push('T2')
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

// Percorso da remoto senza ciclo: stesse finestre del ciclo, a partire dalla data
// di inizio della pratica (come periodo_del_partecipante: fine = inizio + 55).
// Senza data di inizio il percorso non è partito e conta solo il T0.
function orologioPersonale(iscrizione) {
  if (!iscrizione?.data_inizio_pratica) return null
  return { data_inizio: iscrizione.data_inizio_pratica, data_fine: null, stato: 'attivo' }
}

// ── Partecipanti per stato del percorso ─────────────────────────────────────
// Ogni idoneo sta in un solo gruppo, così la somma dà il totale:
// completato (sequenza finale chiusa) → da chiudere (8 settimane finite) →
// in partenza (prima dell'inizio) → in percorso / inattivi (settimane in corso,
// con o senza pratica negli ultimi GIORNI_INATTIVITA giorni; senza data di inizio
// il percorso da remoto non è partito e conta come inattivo).
export const GIORNI_INATTIVITA = 7

export const GRUPPI_PARTECIPANTI = [
  { id: 'completato', etichetta: 'Percorso completato', nota: 'sequenza finale chiusa' },
  { id: 'da_chiudere', etichetta: 'Da chiudere', nota: '8 settimane finite, chiusura aperta' },
  { id: 'partenza', etichetta: 'In partenza', nota: 'il percorso non è ancora iniziato' },
  { id: 'in_percorso', etichetta: 'In percorso', nota: `settimane in corso, pratica negli ultimi ${GIORNI_INATTIVITA} giorni` },
  { id: 'inattivi', etichetta: 'Inattivi', nota: `settimane in corso, nessuna pratica da ${GIORNI_INATTIVITA} giorni` },
  { id: 'ritirati', etichetta: 'Ritirati', nota: 'usciti dal percorso, restano solo dati anonimi' }
]

/** Ultimo giorno con una riga di pratica, per codice. */
export function ultimePratiche(log) {
  const mappa = new Map()
  for (const r of log || []) {
    const iso = String(r.data || '').slice(0, 10)
    const cod = r.codice_partecipante
    if (cod && iso && iso > (mappa.get(cod) || '')) mappa.set(cod, iso)
  }
  return mappa
}

/** Codici con la sequenza di fine percorso chiusa. */
export function codiciConclusi(valutazioni) {
  return new Set((valutazioni || []).filter(v => v.completata).map(v => v.codice_partecipante))
}

/**
 * Gruppo del percorso di un idoneo (vedi GRUPPI_PARTECIPANTI). `ciclo` è il ciclo
 * dell'iscrizione; senza ciclo vale l'orologio personale del percorso da remoto.
 */
export function gruppoPercorso({ iscrizione, ciclo, conclusa, ultimaPratica }) {
  const periodo = iscrizione?.ciclo_id ? ciclo : orologioPersonale(iscrizione)
  const inizio = parseISODate(periodo?.data_inizio)
  const fine = periodo ? fineCiclo(periodo) : null
  const oggi = parseISODate(oggiLocaleISO())
  const sogliaIso = formatISODate(addDays(oggi, -(GIORNI_INATTIVITA - 1)))
  if (conclusa) return 'completato'
  if (fine && oggi > fine) return 'da_chiudere'
  if (inizio && oggi < inizio) return 'partenza'
  if (inizio && (ultimaPratica || '') >= sogliaIso) return 'in_percorso'
  return 'inattivi'
}

/** Inizio del percorso dell'iscrizione (ciclo o orologio personale), per «In partenza». */
export function inizioPercorso(iscrizione, ciclo) {
  return (iscrizione?.ciclo_id ? ciclo : orologioPersonale(iscrizione))?.data_inizio || null
}

export function statiPartecipanti(iscrizioni, cicli, log, valutazioni, punteggi) {
  const cicloById = new Map((cicli || []).map(c => [c.id, c]))
  const conclusi = codiciConclusi(valutazioni)
  const conT2 = new Set((punteggi || []).filter(p => p.timepoint === 'T2').map(p => p.codice))
  const ultima = ultimePratiche(log)

  const gruppi = Object.fromEntries(GRUPPI_PARTECIPANTI.map(g => [g.id, []]))
  let senzaT2 = 0
  for (const i of iscrizioni || []) {
    const codice = i.utenti?.codice_partecipante
    if (!codice) continue
    if (eRitirato(i)) {
      gruppi.ritirati.push(codice)
      continue
    }
    if (!eIdoneo(i)) continue
    const gruppo = gruppoPercorso({
      iscrizione: i,
      ciclo: i.ciclo_id ? cicloById.get(i.ciclo_id) : null,
      conclusa: conclusi.has(codice),
      ultimaPratica: ultima.get(codice)
    })
    if (gruppo === 'da_chiudere' && !conT2.has(codice)) senzaT2 += 1
    gruppi[gruppo].push(codice)
  }
  const totale = Object.values(gruppi).reduce((n, g) => n + g.length, 0)
  const idonei = totale - gruppi.ritirati.length
  return { totale, idonei, gruppi, senzaT2 }
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
    const raggiunti = timepointRaggiunti(i.ciclo_id ? cicloById.get(i.ciclo_id) : orologioPersonale(i))
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

export function esportaAggregati({ ciclo, kpi, punteggi, logN, valutazioni = null }) {
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
    log_n: logN,
    // Solo numeri della valutazione di fine percorso: mai le frasi.
    valutazione_percorso: valutazioni
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `conscio-aggregati-${formatISODate(new Date())}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Supabase restituisce al massimo 1000 righe per richiesta: oltre, le righe in
// più spariscono senza errore (a novembre 2026 i T2 restavano fuori dai conteggi).
// Legge a pagine con un ordine stabile su tutte le colonne usate.
const PAGINA = 1000

async function leggiRpcIntera(nome, ordine) {
  const righe = []
  for (let da = 0; ; da += PAGINA) {
    let q = supabase.rpc(nome)
    for (const colonna of ordine) q = q.order(colonna, { ascending: true, nullsFirst: true })
    const { data, error } = await q.range(da, da + PAGINA - 1)
    if (error) return { data: null, error }
    righe.push(...(data || []))
    if (!data || data.length < PAGINA) return { data: righe, error: null }
  }
}

/**
 * Letture dell'area facilitatore. Ogni voce può mancare senza bloccare le
 * altre: `errori` dice quali non sono arrivate.
 */
export async function leggiDatiCicli({ notifiche = false, segnalazioni = false, problemi = false } = {}) {
  const richieste = [
    supabase.from('cicli').select(COLONNE_CICLO).order('data_inizio', { ascending: false }),
    supabase.from('iscrizioni').select(COLONNE_ISCRIZIONE),
    leggiRpcIntera('risposte_pseudonime', ['codice_partecipante', 'timepoint', 'questionario', 'ordine']),
    leggiRpcIntera('log_pratica_pseudonimi', [
      'codice_partecipante', 'data', 'tipo', 'numero_settimana', 'esercizio',
      'durata_minuti', 'tono_prima', 'tono_dopo', 'note'
    ]),
    notifiche
      ? supabase.from('notifiche_inattivita').select('tipo, inviata_il, utenti(codice_partecipante)')
      : Promise.resolve({ data: [] }),
    segnalazioni ? supabase.rpc('segnalazioni_difficili_aperte') : Promise.resolve({ data: [] }),
    problemi ? supabase.rpc('segnalazioni_problema_da_vedere') : Promise.resolve({ data: [] }),
    supabase.rpc('valutazioni_percorso_pseudonime')
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
    problemi: dato(6, 'problemi'),
    valutazioni: dato(7, 'valutazioni'),
    errori
  }
}

// ── Da fare: segnalazioni aperte, segnalazioni di problemi non archiviate,
// iscrizioni in attesa (badge del menu) ──────────────────────────────────────

const EVENTO_DA_FARE = 'conscio:da-fare'

export async function contaDaFare() {
  const [seg, iscr, prob] = await Promise.all([
    supabase.rpc('segnalazioni_difficili_aperte'),
    supabase.from('iscrizioni').select('esito_screening, utenti(stato_screening, email_confermata_il)'),
    supabase.rpc('segnalazioni_problema_da_vedere')
  ])
  const segnalazioni = seg.error ? 0 : (seg.data || []).length
  const attesa = iscr.error ? 0 : (iscr.data || []).filter(inAttesaDiEsito).length
  const problemi = prob.error ? 0 : (prob.data || []).length
  return segnalazioni + attesa + problemi
}

// ── Segnalazioni di problemi dell'app (agente Cursor) ───────────────────────

export const ESITO_PROBLEMA = {
  aperta: { etichetta: 'In lavorazione', tono: 'attesa' },
  risolta: { etichetta: 'Risolta', tono: 'ok' },
  non_risolta: { etichetta: 'Non risolta', tono: 'attenzione' }
}

export function esitoProblema(segnalazione) {
  if (!segnalazione?.chiusa_il) return 'aperta'
  return segnalazione.esito === 'non_risolta' ? 'non_risolta' : 'risolta'
}

/** Archivia (o, con false, rimette in «Da fare») una segnalazione di problema. Ritorna un messaggio d'errore o null. */
export async function archiviaProblema(id, archivia = true) {
  const { error } = await supabase.rpc('archivia_segnalazione_problema', { p_id: id, p_archivia: archivia })
  if (error) return archivia
    ? 'Non è stato possibile archiviare la segnalazione.'
    : 'Non è stato possibile rimettere la segnalazione in «Da fare».'
  avvisaDaFare()
  return null
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
