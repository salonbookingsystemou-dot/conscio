// Formule pubblicate: PSS-10 (Cohen; Fossati 2010 / Mondo et al. 2021)
// e FFMQ (Baer et al. 2006; Giovannini et al. 2014).
// Punteggi grezzi + orientamento rispetto al range dello strumento
// (nessuna diagnosi né fascia clinica).

const PSS_INVERSI = new Set([4, 5, 7, 8])

const FFMQ_INVERSI = new Set([
  3, 5, 8, 10, 12, 13, 14, 16, 17, 18, 22, 23, 25, 28, 30, 34, 35, 38, 39
])

export const FFMQ_SOTTOSCALE = {
  osservare: [1, 6, 11, 15, 20, 26, 31, 36],
  descrivere: [2, 7, 12, 16, 22, 27, 32, 37],
  agire_con_consapevolezza: [5, 8, 13, 18, 23, 28, 34, 38],
  non_giudicare: [3, 10, 14, 17, 25, 30, 35, 39],
  non_reagire: [4, 9, 19, 21, 24, 29, 33]
}

export const LIKERT = {
  likert_0_4: [
    { valore: 0, etichetta: 'Mai' },
    { valore: 1, etichetta: 'Quasi mai' },
    { valore: 2, etichetta: 'A volte' },
    { valore: 3, etichetta: 'Abbastanza spesso' },
    { valore: 4, etichetta: 'Molto spesso' }
  ],
  likert_1_5: [
    { valore: 1, etichetta: 'Mai o molto raramente' },
    { valore: 2, etichetta: 'Raramente' },
    { valore: 3, etichetta: 'Alcune volte' },
    { valore: 4, etichetta: 'Spesso' },
    { valore: 5, etichetta: 'Molto spesso o quasi sempre' }
  ]
}

export function invertiLikert(valore, min, max) {
  return min + max - valore
}

function mappaPerOrdine(risposte) {
  return Object.fromEntries(risposte.map(r => [r.ordine, r.valore]))
}

function percentoNelRange(valore, min, max) {
  if (!Number.isFinite(valore) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(((valore - min) / (max - min)) * 100)))
}

/** Fasce convenzionali PSS-10 (Cohen), presentate come posizione sullo strumento. */
export function orientamentoPss(totale) {
  const percento = percentoNelRange(totale, 0, 40)
  if (totale <= 13) {
    return {
      id: 'contenuto',
      etichetta: 'Più contenuto',
      dettaglio: 'Nella fascia bassa dello strumento PSS-10',
      percento
    }
  }
  if (totale <= 26) {
    return {
      id: 'intermedio',
      etichetta: 'Intermedio',
      dettaglio: 'Nella fascia intermedia dello strumento PSS-10',
      percento
    }
  }
  return {
    id: 'elevato',
    etichetta: 'Più elevato',
    dettaglio: 'Nella fascia alta dello strumento PSS-10',
    percento
  }
}

/** Posizione sul range dello strumento (terzili), senza giudizio clinico. */
export function orientamentoRange(valore, min, max, {
  basso = 'Parte bassa del range',
  medio = 'Parte intermedia del range',
  alto = 'Parte alta del range'
} = {}) {
  const percento = percentoNelRange(valore, min, max)
  if (percento < 34) {
    return { id: 'contenuto', etichetta: basso, dettaglio: `Verso ${min} su un range ${min}–${max}`, percento }
  }
  if (percento < 67) {
    return { id: 'intermedio', etichetta: medio, dettaglio: `Verso il centro del range ${min}–${max}`, percento }
  }
  return { id: 'elevato', etichetta: alto, dettaglio: `Verso ${max} su un range ${min}–${max}`, percento }
}

export function orientamentoFfmq(totale) {
  return orientamentoRange(totale, 39, 195, {
    basso: 'Meno presente nel range',
    medio: 'Intermedio nel range',
    alto: 'Più presente nel range'
  })
}

/** Range tipico sottoscala FFMQ: 8 item × 1–5. */
export function orientamentoSottoscalaFfmq(valore) {
  return orientamentoRange(valore, 8, 40)
}

export function punteggioPss10(risposte) {
  const perOrdine = mappaPerOrdine(risposte)
  let totale = 0
  for (let ordine = 1; ordine <= 10; ordine++) {
    const grezzo = perOrdine[ordine]
    if (grezzo == null) return null
    totale += PSS_INVERSI.has(ordine) ? invertiLikert(grezzo, 0, 4) : grezzo
  }
  return { totale, min: 0, max: 40, orientamento: orientamentoPss(totale) }
}

export function punteggioFfmq(risposte) {
  const perOrdine = mappaPerOrdine(risposte)
  const valoreItem = (ordine) => {
    const grezzo = perOrdine[ordine]
    if (grezzo == null) return null
    return FFMQ_INVERSI.has(ordine) ? invertiLikert(grezzo, 1, 5) : grezzo
  }

  const somma = (ordini) => {
    let tot = 0
    for (const ordine of ordini) {
      const v = valoreItem(ordine)
      if (v == null) return null
      tot += v
    }
    return tot
  }

  const osservare = somma(FFMQ_SOTTOSCALE.osservare)
  const descrivere = somma(FFMQ_SOTTOSCALE.descrivere)
  const agire_con_consapevolezza = somma(FFMQ_SOTTOSCALE.agire_con_consapevolezza)
  const non_giudicare = somma(FFMQ_SOTTOSCALE.non_giudicare)
  const non_reagire = somma(FFMQ_SOTTOSCALE.non_reagire)

  if ([osservare, descrivere, agire_con_consapevolezza, non_giudicare, non_reagire].some(v => v == null)) {
    return null
  }

  const totale = osservare + descrivere + agire_con_consapevolezza + non_giudicare + non_reagire
  return {
    totale,
    osservare,
    descrivere,
    agire_con_consapevolezza,
    non_giudicare,
    non_reagire,
    min: 39,
    max: 195,
    orientamento: orientamentoFfmq(totale),
    orientamentiSottoscale: {
      osservare: orientamentoSottoscalaFfmq(osservare),
      descrivere: orientamentoSottoscalaFfmq(descrivere),
      agire_con_consapevolezza: orientamentoSottoscalaFfmq(agire_con_consapevolezza),
      non_giudicare: orientamentoSottoscalaFfmq(non_giudicare),
      non_reagire: orientamentoSottoscalaFfmq(non_reagire)
    }
  }
}

export function calcolaPunteggi(item, rispostePerId) {
  const pssRisposte = item
    .filter(i => i.scala === 'likert_0_4')
    .map(i => ({ ordine: i.ordine, valore: rispostePerId[i.id] }))
  const ffmqRisposte = item
    .filter(i => i.scala === 'likert_1_5')
    .map(i => ({ ordine: i.ordine, valore: rispostePerId[i.id] }))
  return {
    pss10: pssRisposte.length ? punteggioPss10(pssRisposte) : null,
    ffmq: ffmqRisposte.length ? punteggioFfmq(ffmqRisposte) : null
  }
}
