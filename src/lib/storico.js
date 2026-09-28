import { addDays, formatISODate, maxDate, minDate, oggiLocaleISO, parseISODate } from './date.js'

export const SCALA_MINUTI = 45

const GIORNO_MS = 24 * 60 * 60 * 1000

function giorniTra(daIso, aIso) {
  const da = parseISODate(daIso)
  const a = parseISODate(aIso)
  if (!da || !a) return null
  return Math.round((a - da) / GIORNO_MS)
}

export function settimanaDelGiorno(iso, inizioIso) {
  const diff = giorniTra(inizioIso, iso)
  if (diff == null) return null
  return Math.floor(diff / 7) + 1
}

function aggiungiNome(lista, nome) {
  const voce = lista.find(v => v.nome === nome)
  if (voce) voce.n += 1
  else lista.push({ nome, n: 1 })
}

function aggregaRighe(righe) {
  const mappa = new Map()
  for (const riga of righe || []) {
    const iso = String(riga.data || '').slice(0, 10)
    if (!iso) continue
    const g = mappa.get(iso) || { minuti: 0, tono: null, nota: '', formali: [], informali: [], formale: false }
    const tipo = String(riga.tipo || '').toLowerCase()
    const nome = String(riga.esercizio || '').trim()
    if (tipo === 'giorno') {
      if (!g.tono) g.tono = riga.tono_dopo || riga.tono_prima || null
      if (!g.nota) g.nota = String(riga.note || '').trim()
    } else if (tipo === 'informale') {
      aggiungiNome(g.informali, nome || 'pratica informale')
    } else {
      g.formale = true
      g.minuti += Number(riga.durata_minuti) || 0
      aggiungiNome(g.formali, nome || 'pratica formale')
    }
    mappa.set(iso, g)
  }
  return mappa
}

/**
 * Giornate dello storico, dalla più recente, raggruppate per settimana del percorso.
 * Le righe arrivano da `log_pratica_del_partecipante` già ordinate dalla più recente.
 */
export function costruisciStorico(righe, ciclo, temi = {}) {
  const oggi = oggiLocaleISO()
  const inizio = ciclo?.data_inizio ? String(ciclo.data_inizio).slice(0, 10) : null
  const fine = ciclo?.data_fine ? String(ciclo.data_fine).slice(0, 10) : null
  const perGiorno = aggregaRighe(righe)
  const dateLog = [...perGiorno.keys()].map(parseISODate).filter(Boolean)

  const minutiTotali = [...perGiorno.values()].reduce((acc, g) => acc + g.minuti, 0)
  const giorniPratica = [...perGiorno.keys()]
    .filter(iso => iso <= oggi && (!inizio || iso >= inizio)).length
  const diffInizio = inizio ? giorniTra(inizio, oggi) : null
  const giorniTrascorsi = diffInizio == null ? null : Math.max(0, diffInizio + 1)

  const settimane = []
  if (!inizio && dateLog.length === 0) {
    return { settimane, minutiTotali, giorniPratica, giorniTrascorsi, inizio }
  }
  const partenza = minDate(parseISODate(inizio), ...dateLog)
  const arrivo = minDate(parseISODate(oggi), maxDate(parseISODate(fine), ...dateLog))

  if (partenza && arrivo) {
    for (let d = arrivo; d >= partenza; d = addDays(d, -1)) {
      const iso = formatISODate(d)
      const g = perGiorno.get(iso)
      const numero = inizio ? settimanaDelGiorno(iso, inizio) : null
      const chiave = numero == null ? 'senza' : numero < 1 ? 'prima' : String(numero)
      let gruppo = settimane[settimane.length - 1]
      if (!gruppo || gruppo.chiave !== chiave) {
        gruppo = {
          chiave,
          numero: numero != null && numero >= 1 ? numero : null,
          tema: numero != null && numero >= 1 ? temi[numero] || null : null,
          giorni: []
        }
        settimane.push(gruppo)
      }
      gruppo.giorni.push({
        iso,
        data: new Date(d),
        vuoto: !g,
        soloInformale: Boolean(g && !g.formale && g.informali.length > 0 && !g.tono && !g.nota),
        minuti: g?.minuti || 0,
        tono: g?.tono || null,
        nota: g?.nota || '',
        formali: g?.formali || [],
        informali: g?.informali || []
      })
    }
  }

  return { settimane, minutiTotali, giorniPratica, giorniTrascorsi, inizio }
}
