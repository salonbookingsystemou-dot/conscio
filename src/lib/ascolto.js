function chiave(id) {
  return `mbsr_ascolto:${id}`
}

const CHIAVE_REGISTRO = 'mbsr_ascolto_registro'

export function chiaveAscoltoEsercizio(codice, esercizioId, data) {
  if (!codice || !esercizioId || !data) return ''
  return `${String(codice).trim()}:${esercizioId}:${String(data).slice(0, 10)}`
}

function codiceDaChiave(id) {
  if (!id) return ''
  return String(id).split(':')[0]
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
  lista.push({ id, secondi: Math.round(secondi), il: Date.now() })
  tutto[codice] = lista
  scriviRegistro(tutto)
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

export function formaliAscoltatiNelGiorno(esercizi, codice, data) {
  const formali = (esercizi || []).filter(e => {
    const tipo = (e.tipo || '').toLowerCase()
    return tipo === 'formale' || tipo === 'a_casa'
  })
  const conTraccia = formali.filter(e => Boolean(e.traccia_audio))
  if (conTraccia.length === 0) return true
  return conTraccia.every(e =>
    ascoltoCompletato(chiaveAscoltoEsercizio(codice, e.id, data))
  )
}

export function sommaMinutiAscoltati(codice) {
  if (!codice) return 0
  const secondi = eventiDi(codice).reduce((tot, e) => tot + (Number(e.secondi) || 0), 0)
  return Math.max(0, Math.round(secondi / 60))
}
