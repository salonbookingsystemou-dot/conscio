import { addDays, formatISODate, parseISODate } from './date.js'

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

export const COLORE_TONO = {
  piacevole: '#4B6B57',
  neutro: '#8A8F88',
  spiacevole: '#A8763E',
  sconosciuto: '#C5C2B6'
}

export function coloreTono(tono) {
  return COLORE_TONO[tono] || COLORE_TONO.sconosciuto
}

function tonoSessione(riga) {
  return riga?.tono_dopo || riga?.tono_prima || null
}

/** Minuti per codice e giorno, con tono dell’ultima sessione e media giornaliera. */
export function serieMinutiGiornalieri(righe) {
  const perGiorno = new Map()
  const codiciVisti = new Set()
  const ordinate = [...(righe || [])].sort((a, b) => {
    const da = String(a.data || '').slice(0, 10)
    const db = String(b.data || '').slice(0, 10)
    if (da !== db) return da.localeCompare(db)
    return String(a.id || '').localeCompare(String(b.id || ''))
  })

  for (const riga of ordinate) {
    const iso = String(riga.data || '').slice(0, 10)
    const codice = riga.codice_partecipante
    if (!iso || !codice) continue
    const tipo = String(riga.tipo || '').toLowerCase()
    if (!perGiorno.has(iso)) perGiorno.set(iso, new Map())
    const utenti = perGiorno.get(iso)
    const prev = utenti.get(codice) || { minuti: 0, tono: null, informali: [] }

    if (tipo === 'informale') {
      const nome = String(riga.esercizio || '').trim() || 'pratica informale'
      if (!prev.informali.includes(nome)) prev.informali.push(nome)
      utenti.set(codice, prev)
      continue
    }

    const minuti = Number(riga.durata_minuti)
    const aggiunta = tipo !== 'giorno' && Number.isFinite(minuti) && minuti > 0 ? minuti : 0
    const tono = tonoSessione(riga)
    if (aggiunta <= 0 && !tono) continue
    prev.minuti += aggiunta
    if (tono) prev.tono = tono
    utenti.set(codice, prev)
    if (prev.minuti > 0) codiciVisti.add(codice)
  }

  const isos = [...perGiorno.keys()].sort()
  if (isos.length === 0) return { giorni: [], codici: [] }

  const inizio = parseISODate(isos[0])
  const fine = parseISODate(isos[isos.length - 1])
  const listaCodici = [...codiciVisti].sort((a, b) => a.localeCompare(b))
  if (!inizio || !fine) return { giorni: [], codici: listaCodici }

  const giorni = []
  for (let d = inizio; d <= fine; d = addDays(d, 1)) {
    const iso = formatISODate(d)
    const utenti = perGiorno.get(iso) || new Map()
    const riga = { iso, data: etichettaDataCorta(iso), media: null, toni: {}, informali: {} }
    const valori = []
    for (const codice of listaCodici) {
      const voce = utenti.get(codice)
      if (!voce || !(voce.minuti > 0)) continue
      riga[codice] = voce.minuti
      riga.toni[codice] = voce.tono
      riga.informali[codice] = voce.informali || []
      valori.push(voce.minuti)
    }
    if (valori.length > 0) {
      riga.media = Math.round((valori.reduce((acc, n) => acc + n, 0) / valori.length) * 10) / 10
    }
    giorni.push(riga)
  }

  return { giorni, codici: listaCodici }
}

export function etichettaVolte(n) {
  return n === 1 ? '1 volta' : `${n} volte`
}

/** Quante volte ogni codice ha spuntato ciascuna pratica informale. */
export function conteggioInformali(righe) {
  const perCodice = new Map()
  for (const riga of righe || []) {
    if (String(riga.tipo || '').toLowerCase() !== 'informale') continue
    const codice = riga.codice_partecipante
    if (!codice) continue
    const nome = String(riga.esercizio || '').trim() || 'pratica informale'
    if (!perCodice.has(codice)) perCodice.set(codice, new Map())
    const pratiche = perCodice.get(codice)
    pratiche.set(nome, (pratiche.get(nome) || 0) + 1)
  }
  return [...perCodice.entries()]
    .map(([codice, pratiche]) => ({
      codice,
      pratiche: [...pratiche.entries()]
        .map(([nome, n]) => ({ nome, n }))
        .sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome)),
      totale: [...pratiche.values()].reduce((acc, n) => acc + n, 0)
    }))
    .sort((a, b) => a.codice.localeCompare(b.codice))
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
