import { supabase, supabaseConfigurato } from './supabaseClient'

function chiave(id) {
  return `mbsr_ascolto:${id}`
}

const CHIAVE_REGISTRO = 'mbsr_ascolto_registro'
const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

export function chiaveAscoltoEsercizio(codice, esercizioId, data) {
  if (!codice || !esercizioId || !data) return ''
  return `${String(codice).trim()}:${esercizioId}:${String(data).slice(0, 10)}`
}

function codiceDaChiave(id) {
  if (!id) return ''
  return String(id).split(':')[0]
}

/** Estrae esercizioId + data da una chiave `codice:uuid:YYYY-MM-DD`. */
export function partiChiaveAscolto(id, codice) {
  if (!id || !codice) return null
  const pref = `${String(codice).trim()}:`
  if (!String(id).startsWith(pref)) return null
  const resto = String(id).slice(pref.length)
  const m = resto.match(new RegExp(`^(${UUID_RE}):(\\d{4}-\\d{2}-\\d{2})$`, 'i'))
  if (!m) return null
  return { esercizioId: m[1], data: m[2] }
}

function leggiRegistro() {
  try {
    const raw = localStorage.getItem(CHIAVE_REGISTRO)
    if (!raw) return {}
    const dati = JSON.parse(raw)
    return dati && typeof dati === 'object' && !Array.isArray(dati) ? dati : {}
  } catch {
    return {}
  }
}

function scriviRegistro(dati) {
  try {
    localStorage.setItem(CHIAVE_REGISTRO, JSON.stringify(dati))
  } catch {
    /* storage non disponibile */
  }
}

function eventiDi(codice) {
  if (!codice) return []
  const lista = leggiRegistro()[codice]
  return Array.isArray(lista) ? lista : []
}

export function ascoltoCompletato(id) {
  if (!id) return false
  try {
    return localStorage.getItem(chiave(id)) === '1'
  } catch {
    return false
  }
}

export function memorizzaAscolto(id) {
  if (!id) return
  try {
    localStorage.setItem(chiave(id), '1')
  } catch {
    /* storage non disponibile */
  }
}

export function registraAscoltoCompleto(id, secondi) {
  memorizzaAscolto(id)
  if (!id || !Number.isFinite(secondi) || secondi <= 0) return false
  const codice = codiceDaChiave(id)
  if (!codice) return false
  const tutto = leggiRegistro()
  const lista = Array.isArray(tutto[codice]) ? tutto[codice] : []
  if (!lista.some(e => e.id === id)) {
    lista.push({ id, secondi: Math.round(secondi), il: Date.now() })
    tutto[codice] = lista
    scriviRegistro(tutto)
  }
  return true
}

export function recuperaAscoltoSeManca(id, secondi) {
  if (!ascoltoCompletato(id) || !Number.isFinite(secondi) || secondi <= 0) return false
  const codice = codiceDaChiave(id)
  if (eventiDi(codice).some(e => e.id === id)) return false
  return registraAscoltoCompleto(id, secondi)
}

/** Elenco degli id di ascolto completati che iniziano con prefisso (es. codice:esercizioId). */
export function idAscoltoConPrefisso(prefisso) {
  if (!prefisso) return []
  const test = `mbsr_ascolto:${prefisso}`
  const trovati = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(test)) continue
      if (localStorage.getItem(k) === '1') {
        trovati.push(k.slice('mbsr_ascolto:'.length))
      }
    }
  } catch {
    return []
  }
  return trovati
}

export function ascoltoNeiLog(esercizio, data) {
  const giorno = String(data).slice(0, 10)
  return (esercizio?.log || []).some(r =>
    String(r.data).slice(0, 10) === giorno && r.tipo === 'ascolto'
  )
}

export function esercizioAscoltatoNelGiorno(esercizio, codice, data) {
  if (ascoltoNeiLog(esercizio, data)) return true
  if (!esercizio?.traccia_audio) return true
  return ascoltoCompletato(chiaveAscoltoEsercizio(codice, esercizio.id, data))
}

export function formaliAscoltatiNelGiorno(esercizi, codice, data) {
  const formali = (esercizi || []).filter(e => {
    const tipo = (e.tipo || '').toLowerCase()
    return tipo === 'formale' || tipo === 'a_casa'
  })
  const conTraccia = formali.filter(e => Boolean(e.traccia_audio))
  if (conTraccia.length === 0) return true
  return conTraccia.every(e => esercizioAscoltatoNelGiorno(e, codice, data))
}

/** Rimuove cache di ascolto di un codice (uscita dal dispositivo). */
export function pulisciAscoltoLocale(codice) {
  const pulito = (codice || '').trim()
  if (!pulito) return
  try {
    const pref = `mbsr_ascolto:${pulito}`
    const daRimuovere = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(pref)) daRimuovere.push(k)
    }
    daRimuovere.forEach(k => localStorage.removeItem(k))
    const registro = leggiRegistro()
    if (registro[pulito]) {
      delete registro[pulito]
      scriviRegistro(registro)
    }
  } catch {
    /* storage non disponibile */
  }
}

export function sommaMinutiAscoltati(codice) {
  if (!codice) return 0
  const secondi = eventiDi(codice).reduce((tot, e) => tot + (Number(e.secondi) || 0), 0)
  return Math.max(0, Math.round(secondi / 60))
}

function minutiDaSecondi(secondi) {
  if (!Number.isFinite(secondi) || secondi <= 0) return null
  return Math.max(1, Math.round(secondi / 60))
}

/** Cache locale + salvataggio su Supabase. */
export async function salvaAscoltoFormale({ codice, esercizioId, data, secondi }) {
  const pulito = (codice || '').trim()
  const giorno = String(data || '').slice(0, 10)
  const id = chiaveAscoltoEsercizio(pulito, esercizioId, giorno)
  if (!id) return false

  registraAscoltoCompleto(id, secondi)
  if (!supabaseConfigurato) return true

  const { error } = await supabase.rpc('registra_ascolto_formale', {
    p_codice: pulito,
    p_esercizio_id: esercizioId,
    p_data: giorno,
    p_durata_minuti: minutiDaSecondi(secondi)
  })
  return !error
}

/** Porta sul server gli ascolti già presenti solo in localStorage. */
export async function sincronizzaAscoltiLocaliVersoServer(codice) {
  const pulito = (codice || '').trim()
  if (!pulito || !supabaseConfigurato) return

  const ids = idAscoltoConPrefisso(pulito)
  const eventi = eventiDi(pulito)
  await Promise.all(ids.map(async id => {
    const parti = partiChiaveAscolto(id, pulito)
    if (!parti) return
    const evento = eventi.find(e => e.id === id)
    const secondi = Number(evento?.secondi) || 0
    await supabase.rpc('registra_ascolto_formale', {
      p_codice: pulito,
      p_esercizio_id: parti.esercizioId,
      p_data: parti.data,
      p_durata_minuti: minutiDaSecondi(secondi)
    })
  }))
}

/** Applica i log server alla cache locale (per UI istantanea offline-ish). */
export function memorizzaAscoltiDaProgramma(codice, lezioni) {
  const pulito = (codice || '').trim()
  if (!pulito) return
  for (const lezione of lezioni || []) {
    for (const ex of lezione.esercizi || []) {
      for (const r of ex.log || []) {
        if (r.tipo !== 'ascolto') continue
        const giorno = String(r.data).slice(0, 10)
        const id = chiaveAscoltoEsercizio(pulito, ex.id, giorno)
        memorizzaAscolto(id)
        if (Number.isFinite(r.durata_minuti) && r.durata_minuti > 0) {
          recuperaAscoltoSeManca(id, r.durata_minuti * 60)
        }
      }
    }
  }
}
