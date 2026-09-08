const CHIAVE = 'conscio-guida-meditazione'

function chiave(codice) {
  const id = String(codice || '').trim().toUpperCase()
  return id ? `${CHIAVE}:${id}` : CHIAVE
}

export function guidaGiaVista(codice) {
  try {
    return localStorage.getItem(chiave(codice)) === '1'
  } catch {
    return false
  }
}

export function memorizzaGuidaVista(codice) {
  try {
    localStorage.setItem(chiave(codice), '1')
  } catch {
    /* storage non disponibile */
  }
}

export function pulisciGuidaVista(codice) {
  try {
    localStorage.removeItem(chiave(codice))
  } catch {
    /* storage non disponibile */
  }
}
