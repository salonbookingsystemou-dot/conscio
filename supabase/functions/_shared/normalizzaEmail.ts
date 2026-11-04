// Email normalizzata per confrontare gli indirizzi e calcolare i limiti.
// Minuscole per tutti i domini; per Gmail e Googlemail (stessa casella) via i punti
// e tutto ciò che segue un «+». Stessa regola di public.normalizza_email
// (supabase/migrazione_conferma_email.sql): se cambi l'una, cambia l'altra.

const DOMINI_GMAIL = new Set(['gmail.com', 'googlemail.com'])

export function normalizzaEmail(email: string): string {
  const e = (email || '').trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at < 1) return e
  const locale = e.slice(0, at)
  const dominio = e.slice(at + 1)
  if (!DOMINI_GMAIL.has(dominio)) return e
  return `${locale.split('+')[0].replace(/\./g, '')}@gmail.com`
}

export function dominioEmail(email: string): string {
  const e = (email || '').trim().toLowerCase()
  return e.slice(e.lastIndexOf('@') + 1)
}
