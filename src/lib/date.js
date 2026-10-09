const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']
const GIORNI_CORTI = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']
const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'
]

export function parseISODate(iso) {
  if (!iso) return null
  const testo = String(iso).slice(0, 10)
  const [anno, mese, giorno] = testo.split('-').map(Number)
  if (!anno || !mese || !giorno) return null
  return new Date(anno, mese - 1, giorno)
}

export function formatISODate(data) {
  const y = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function oggiLocaleISO() {
  return formatISODate(new Date())
}

export function addDays(data, n) {
  const copia = new Date(data.getFullYear(), data.getMonth(), data.getDate())
  copia.setDate(copia.getDate() + n)
  return copia
}

export function startOfWeekMonday(data) {
  const copia = new Date(data.getFullYear(), data.getMonth(), data.getDate())
  const giorno = copia.getDay()
  const delta = giorno === 0 ? -6 : 1 - giorno
  return addDays(copia, delta)
}

export function etichettaGiornoCorto(indiceLunedi) {
  return GIORNI_CORTI[indiceLunedi]
}

export function etichettaGiorno(data) {
  const lunedi = (data.getDay() + 6) % 7
  return `${GIORNI[lunedi]} ${data.getDate()} ${MESI[data.getMonth()]}`
}

export function etichettaMese(data) {
  return `${MESI[data.getMonth()]} ${data.getFullYear()}`
}

/** Mese della riga. Se i giorni attraversano il cambio mese, li nomina entrambi. */
export function etichettaMesi(da, a) {
  if (!da) return ''
  const fine = a || da
  const stessoMese = da.getFullYear() === fine.getFullYear() && da.getMonth() === fine.getMonth()
  if (stessoMese) return etichettaMese(da)
  if (da.getFullYear() === fine.getFullYear()) {
    return `${MESI[da.getMonth()]} – ${etichettaMese(fine)}`
  }
  return `${etichettaMese(da)} – ${etichettaMese(fine)}`
}

export function minDate(...date) {
  return date.filter(Boolean).reduce((a, b) => (a < b ? a : b))
}

export function maxDate(...date) {
  return date.filter(Boolean).reduce((a, b) => (a > b ? a : b))
}
