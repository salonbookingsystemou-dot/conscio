import { version } from '../../package.json'
import { chiamaPorta } from './supabaseClient'

/** Le segnalazioni sono anonime: il codice partecipante non deve mai partire. */
export function senzaCodici(testo) {
  return String(testo || '').replace(/MBSR-[A-Z0-9]{4,12}/gi, '[codice rimosso]')
}

export function descriviErrore(errore, componentStack) {
  const parti = []
  if (errore?.message) parti.push(String(errore.message))
  if (errore?.stack) parti.push(String(errore.stack))
  if (componentStack) parti.push(`Componenti:${componentStack}`)
  return senzaCodici(parti.join('\n\n')).slice(0, 6000)
}

function contesto() {
  const pagina = (window.location.hash || '#/').split('?')[0]
  return {
    pagina: senzaCodici(pagina),
    browser: navigator.userAgent,
    schermo: `${window.innerWidth}×${window.innerHeight}`,
    versione: version
  }
}

export async function inviaSegnalazione({ messaggio, errore, sitoWeb }) {
  return chiamaPorta({
    azione: 'segnala_problema',
    messaggio: senzaCodici(messaggio),
    errore: errore || '',
    sito_web: sitoWeb || '',
    ...contesto()
  })
}
