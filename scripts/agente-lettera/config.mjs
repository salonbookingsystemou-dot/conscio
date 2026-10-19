// Costanti dell'agente redazionale (docs/brief_agente_lettera.md).
// Modelli, strumenti e prezzi controllati su platform.claude.com il 18/10/2026.

export const MODELLI = {
  leggero: 'claude-haiku-5-5', // smistamento e ricerca web
  scrittura: 'claude-sonnet-5-5' // selezione, scrittura, verifica
}

// USD per milione di token. Haiku 5.5: fascia fino a 100.000 token di prompt (le nostre richieste ci stanno).
export const PREZZI = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheScrittura: 0.125, cacheLettura: 0.01 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheScrittura: 2.5, cacheLettura: 0.1 }
}
export const PREZZO_RICERCA = 10 / 1000 // USD per ricerca web

export const STRUMENTO_RICERCA = 'web_search_20250305'

// Tetti per esecuzione: superati, la lettera non parte (sez. 1 del brief).
export const MAX_RICERCHE = 8
export const MAX_CHIAMATE = 16
export const MAX_TOKEN = 400_000 // input + output, tutte le chiamate
export const MAX_COSTO_USD = 1.5

export const GIORNI_RACCOLTA = 8
export const GIORNI_VALIDITA = 10 // una voce più vecchia non passa i controlli
export const MIN_VOCI = 3
export const MAX_VOCI = 5
export const MAX_CANDIDATI_SMISTAMENTO = 80
export const MAX_CARATTERI_PAGINA = 6000

export const ORA_INVIO = { ore: 17, minuti: 0 } // ora italiana del giovedì
export const FUSO = 'Europe/Rome'

export const SITO = 'https://conscio.mnesti.it'
export const BUCKET_MINIATURE = 'sfondi-vetrina'

export const UA = 'ConscioLettera/1.0 (+https://conscio.mnesti.it)'

// Parole chiave per tenere, dai feed generici, solo ciò che riguarda il tema.
export const PAROLE_TEMA = [
  'mindful', 'meditaz', 'meditat', 'consapevolezza', 'mbsr', 'mbct', 'contemplativ',
  'self-compassion', 'autocompassione', 'yoga nidra', 'body scan'
]
