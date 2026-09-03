import { parseISODate } from './date.js'

export const TONI = [
  { id: 'spiacevole', label: 'Spiacevole' },
  { id: 'neutro', label: 'Neutro' },
  { id: 'piacevole', label: 'Piacevole' }
]

export const VALORE_TONO = {
  spiacevole: -1,
  neutro: 0,
  piacevole: 1
}

export function etichettaTono(tono) {
  return TONI.find(t => t.id === tono)?.label || null
}

export function testoTonoRiga(riga) {
  const prima = etichettaTono(riga.tono_prima)
  const dopo = etichettaTono(riga.tono_dopo)
  if (prima && dopo) return `${prima.toLowerCase()} → ${dopo.toLowerCase()}`
  if (dopo) return dopo.toLowerCase()
  if (prima) return prima.toLowerCase()
  return ''
}

export function valoreTono(tono) {
  if (tono == null) return null
  return Object.prototype.hasOwnProperty.call(VALORE_TONO, tono) ? VALORE_TONO[tono] : null
}

function etichettaDataCorta(iso) {
  const data = parseISODate(iso)
  if (!data) return iso
  return data.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

function etichettaTipoPratica(tipo) {
  if (tipo === 'informale') return 'Informale'
  if (tipo === 'formale') return 'Formale'
  if (tipo === 'a_casa') return 'A casa'
  if (tipo === 'body_scan') return 'Body scan'
  if (tipo === 'seduta') return 'Meditazione seduta'
  if (tipo === 'yoga') return 'Yoga consapevole'
  if (tipo === 'ascolto') return 'Ascolto'
  if (tipo === 'altro') return 'Altro'
  return tipo || 'Pratica'
}

/** Una sessione = un punto, per l’andamento personale (nota al tap). */
export function serieSessioniTono(righe) {
  const punti = []
  const contaGiorno = new Map()
  const ordinate = [...(righe || [])].sort((a, b) => {
    const da = String(a.data || '').slice(0, 10)
    const db = String(b.data || '').slice(0, 10)
    if (da !== db) return da.localeCompare(db)
    return String(a.id || '').localeCompare(String(b.id || ''))
  })

  for (const riga of ordinate) {
    const campo = riga.tono_dopo ? 'tono_dopo' : (riga.tono_prima ? 'tono_prima' : null)
    if (!campo) continue
    const valore = valoreTono(riga[campo])
    if (valore == null) continue
    const iso = String(riga.data || '').slice(0, 10)
    if (!iso) continue
    const n = (contaGiorno.get(iso) || 0) + 1
    contaGiorno.set(iso, n)
    punti.push({
      id: riga.id || `${iso}-${n}`,
      iso,
      data: etichettaDataCorta(iso),
      etichetta: n > 1 ? `${etichettaDataCorta(iso)} · ${n}` : etichettaDataCorta(iso),
      valore,
      tono: riga[campo],
      momento: campo === 'tono_prima' ? 'All’inizio' : 'Dopo la pratica',
      nota: (riga.note || '').trim(),
      tipo: etichettaTipoPratica(riga.esercizio || riga.tipo),
      minuti: riga.durata_minuti || null,
      settimana: riga.numero_settimana || null
    })
  }
  return punti
}

export function serieTonoGiornaliera(righe, campo = 'tono_dopo') {
  const perGiorno = new Map()
  for (const riga of righe || []) {
    const tono = riga[campo]
    const valore = valoreTono(tono)
    if (valore == null) continue
    const iso = String(riga.data || '').slice(0, 10)
    if (!iso) continue
    const prev = perGiorno.get(iso) || {
      iso,
      data: etichettaDataCorta(iso),
      somma: 0,
      n: 0,
      piacevole: 0,
      neutro: 0,
      spiacevole: 0
    }
    prev.somma += valore
    prev.n += 1
    prev[tono] += 1
    perGiorno.set(iso, prev)
  }
  return [...perGiorno.values()]
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .map(g => ({
      ...g,
      media: Math.round((g.somma / g.n) * 100) / 100
    }))
}

export function riepilogoTonoPerCodice(righe, campo = 'tono_dopo') {
  const perCodice = new Map()
  for (const riga of righe || []) {
    const valore = valoreTono(riga[campo])
    if (valore == null) continue
    const codice = riga.codice_partecipante
    if (!codice) continue
    const prev = perCodice.get(codice) || { codice, somma: 0, n: 0 }
    prev.somma += valore
    prev.n += 1
    perCodice.set(codice, prev)
  }
  return [...perCodice.values()]
    .map(g => ({ ...g, media: Math.round((g.somma / g.n) * 100) / 100 }))
    .sort((a, b) => a.codice.localeCompare(b.codice))
}
