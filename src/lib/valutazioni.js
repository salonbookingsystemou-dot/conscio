// Valutazione di fine percorso (stelle, «lo consiglieresti?», «cosa ti porti a casa»).
// Per divulgare si usano solo questi numeri, mai le frasi.

export const CONSIGLI = [
  { valore: 'si', etichetta: 'Sì' },
  { valore: 'forse', etichetta: 'Forse' },
  { valore: 'no', etichetta: 'No' }
]

/** Numeri della valutazione su un elenco di righe di valutazioni_percorso_pseudonime. */
export function riepilogoValutazioni(righe) {
  const valutate = (righe || []).filter(r => r.stelle != null)
  const n = valutate.length
  const distribuzione = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of valutate) distribuzione[r.stelle] += 1
  const consigli = Object.fromEntries(CONSIGLI.map(c => [c.valore, valutate.filter(r => r.consiglieresti === c.valore).length]))
  const somma = valutate.reduce((a, r) => a + r.stelle, 0)
  return {
    aperte: (righe || []).length,
    valutazioni: n,
    media: n ? Math.round((somma / n) * 10) / 10 : null,
    distribuzione,
    consigli,
    condivisioni: (righe || []).filter(r => r.condivisione).length,
    concluse: (righe || []).filter(r => r.completata).length
  }
}

export function formattaMedia(media) {
  return media == null ? '—' : media.toFixed(1).replace('.', ',')
}
