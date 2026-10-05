// Correzioni di pronuncia applicate al testo prima dell'invio a ElevenLabs.
// I tag fonetici (IPA) funzionano solo per l'inglese: per l'italiano si indica
// l'accento tonico con l'accento grafico sulla sillaba giusta.
//
// Caso tipico negli script di meditazione: l'imperativo riflessivo
// («rilàssati») letto come participio («rilassàti»).
// Aggiungi qui le parole che senti sbagliate. Le maiuscole iniziali sono
// rispettate; si sostituiscono solo parole intere.

const CORREZIONI: Record<string, string> = {
  rilassati: 'rilàssati',
  appoggiati: 'appòggiati',
  abbandonati: 'abbandònati',
  lasciati: 'làsciati',
  sistemati: 'sistèmati',
  accomodati: 'accòmodati',
  ascoltati: 'ascòltati',
  osservati: 'ossèrvati'
}

const LETTERA = 'A-Za-zÀ-ÖØ-öø-ÿ'
const parole = Object.keys(CORREZIONI).sort((a, b) => b.length - a.length)
const MODELLO = parole.length
  ? new RegExp(`(?<![${LETTERA}])(${parole.join('|')})(?![${LETTERA}])`, 'gi')
  : null

export function correggiPronuncia(testo: string): string {
  if (!MODELLO) return testo
  return testo.replace(MODELLO, (trovata) => {
    const corretta = CORREZIONI[trovata.toLowerCase()]
    if (!corretta) return trovata
    if (trovata === trovata.toUpperCase() && trovata.length > 1) return corretta.toUpperCase()
    if (trovata[0] === trovata[0].toUpperCase()) return corretta[0].toUpperCase() + corretta.slice(1)
    return corretta
  })
}
