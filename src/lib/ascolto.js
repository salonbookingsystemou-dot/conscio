function chiave(id) {
  return `mbsr_ascolto:${id}`
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
