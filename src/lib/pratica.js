import { addDays, formatISODate, oggiLocaleISO, parseISODate } from './date.js'

const GIORNO_MS = 24 * 60 * 60 * 1000
const MESI_CORTI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

export const TONI_GRAFICO = [
  { id: 'piacevole', label: 'Piacevole' },
  { id: 'neutro', label: 'Neutro' },
  { id: 'spiacevole', label: 'Spiacevole' },
  { id: 'nd', label: 'Senza tono' }
]

export const FASCE_MINUTI = [
  { id: 'zero', label: '0' },
  { id: 'poco', label: '1–10 min' },
  { id: 'medio', label: '11–20' },
  { id: 'molto', label: 'oltre 20' }
]

export function etichettaDataBreve(data) {
  return `${data.getDate()} ${MESI_CORTI[data.getMonth()]}`
}

export function fasciaMinuti(minuti) {
  if (!(minuti > 0)) return 'zero'
  if (minuti <= 10) return 'poco'
  if (minuti <= 20) return 'medio'
  return 'molto'
}

export function mediana(valori) {
  if (!valori.length) return 0
  const ordinati = [...valori].sort((a, b) => a - b)
  const meta = Math.floor(ordinati.length / 2)
  return ordinati.length % 2
    ? ordinati[meta]
    : Math.round((ordinati[meta - 1] + ordinati[meta]) / 2)
}

function giorniTra(da, a) {
  return Math.round((a - da) / GIORNO_MS)
}

/** Durata dal primo all'ultimo giorno compresi; senza data di fine, inizio + 62. */
export function periodoCiclo(ciclo) {
  const inizio = parseISODate(ciclo?.data_inizio)
  if (!inizio) return null
  const fine = parseISODate(ciclo.data_fine) || addDays(inizio, 62)
  const oggi = parseISODate(oggiLocaleISO())
  const durata = Math.max(1, giorniTra(inizio, fine) + 1)
  const trascorsi = Math.max(0, Math.min(durata, giorniTra(inizio, oggi) + 1))
  return {
    inizio,
    fine,
    durata,
    trascorsi,
    inCorso: trascorsi > 0 && oggi <= fine,
    concluso: oggi > fine,
    inizioIso: formatISODate(inizio),
    ultimoIso: formatISODate(addDays(inizio, Math.max(0, trascorsi - 1)))
  }
}

function tonoGiornata(riga) {
  const tono = riga.tono_dopo || riga.tono_prima || null
  return tono === 'piacevole' || tono === 'neutro' || tono === 'spiacevole' ? tono : null
}

/**
 * Dati della scheda Pratica per un ciclo. `codici` sono gli iscritti al ciclo:
 * servono solo a raggruppare, nessun valore restituito li contiene.
 */
export function datiPraticaCiclo(ciclo, codici, righe) {
  const periodo = periodoCiclo(ciclo)
  const persone = new Map(codici.map(c => [c, new Map()]))
  const informali = new Map()
  let spunte = 0

  if (periodo && periodo.trascorsi > 0) {
    for (const riga of righe || []) {
      const giorniPersona = persone.get(riga.codice_partecipante)
      if (!giorniPersona) continue
      const iso = String(riga.data || '').slice(0, 10)
      if (!iso || iso < periodo.inizioIso || iso > periodo.ultimoIso) continue
      const tipo = String(riga.tipo || '').toLowerCase()

      if (tipo === 'informale') {
        spunte += 1
        const nome = String(riga.esercizio || '').trim() || 'Pratica informale'
        const settimana = riga.numero_settimana ?? null
        const chiave = `${settimana ?? ''}|${nome}`
        const voce = informali.get(chiave) || { nome, settimana, volte: 0, persone: new Set() }
        voce.volte += 1
        voce.persone.add(riga.codice_partecipante)
        informali.set(chiave, voce)
        continue
      }

      const giorno = giorniPersona.get(iso) || { minuti: 0, ascolti: 0, tono: null }
      if (tipo === 'ascolto') {
        giorno.ascolti += 1
        giorno.minuti += Number(riga.durata_minuti) || 0
      } else if (tipo === 'giorno' && !giorno.tono) {
        giorno.tono = tonoGiornata(riga)
      }
      giorniPersona.set(iso, giorno)
    }
  }

  const durata = periodo?.durata || 0
  const trascorsi = periodo?.trascorsi || 0
  const giorni = []
  for (let i = 0; i < durata; i += 1) {
    const data = addDays(periodo.inizio, i)
    giorni.push({
      indice: i,
      iso: formatISODate(data),
      data,
      futuro: i >= trascorsi,
      praticanti: 0,
      toni: { piacevole: 0, neutro: 0, spiacevole: 0, nd: 0 }
    })
  }

  const listaPersone = [...persone.values()].map(giorniPersona => {
    const celle = giorni.map(g => giorniPersona.get(g.iso)?.minuti || 0)
    let minuti = 0
    let giorniPratica = 0
    for (const g of giorni) {
      const voce = giorniPersona.get(g.iso)
      if (!voce || voce.ascolti === 0) continue
      giorniPratica += 1
      minuti += voce.minuti
      g.praticanti += 1
      g.toni[voce.tono || 'nd'] += 1
    }
    return { minuti, giorni: giorniPratica, celle }
  }).sort((a, b) => b.minuti - a.minuti || b.giorni - a.giorni)

  const settimane = []
  for (let s = 0; s * 7 < durata; s += 1) {
    const slot = []
    for (let j = 0; j < 7; j += 1) slot.push(giorni[s * 7 + j] || null)
    const presenti = slot.filter(Boolean)
    const primo = presenti[0]
    const ultimo = presenti[presenti.length - 1]
    settimane.push({
      numero: s + 1,
      giorni: slot,
      etichetta: primo === ultimo
        ? etichettaDataBreve(primo.data)
        : `${etichettaDataBreve(primo.data)} – ${etichettaDataBreve(ultimo.data)}`,
      corrente: Boolean(periodo.inCorso) && presenti.some(g => g.indice === trascorsi - 1)
    })
  }

  return {
    periodo,
    iscritti: codici.length,
    giorni,
    settimane,
    persone: listaPersone,
    giornatePratica: listaPersone.reduce((acc, p) => acc + p.giorni, 0),
    giornatePossibili: codici.length * trascorsi,
    minuti: listaPersone.reduce((acc, p) => acc + p.minuti, 0),
    spunte,
    informali: [...informali.values()]
      .map(v => ({ nome: v.nome, settimana: v.settimana, volte: v.volte, persone: v.persone.size }))
      .sort((a, b) => b.volte - a.volte || b.persone - a.persone || a.nome.localeCompare(b.nome))
  }
}

/** I quattro numeri: di un ciclo o sommati su più cicli. */
export function numeriPratica(modelli) {
  const iscritti = modelli.reduce((acc, m) => acc + m.iscritti, 0)
  const giornatePratica = modelli.reduce((acc, m) => acc + m.giornatePratica, 0)
  const giornatePossibili = modelli.reduce((acc, m) => acc + m.giornatePossibili, 0)
  const minuti = modelli.reduce((acc, m) => acc + m.minuti, 0)
  const totali = modelli.flatMap(m => m.persone.map(p => p.minuti))
  return {
    iscritti,
    giornatePratica,
    giornatePossibili,
    aderenza: giornatePossibili > 0 ? Math.round((giornatePratica / giornatePossibili) * 100) : null,
    minuti,
    media: iscritti > 0 ? Math.round(minuti / iscritti) : 0,
    mediana: mediana(totali),
    spunte: modelli.reduce((acc, m) => acc + m.spunte, 0)
  }
}

/** Tacche pari da 0 al numero di iscritti. */
export function taccheIscritti(n) {
  if (n <= 0) return [0]
  const passo = n <= 10 ? 2 : 2 * Math.ceil(n / 10)
  const tacche = []
  for (let t = 0; t <= n; t += passo) tacche.push(t)
  return tacche
}
