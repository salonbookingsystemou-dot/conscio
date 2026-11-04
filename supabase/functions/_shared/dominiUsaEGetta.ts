// Domini di caselle usa-e-getta più comuni, mantenuti a mano.
// Un'iscrizione con uno di questi domini (o un loro sottodominio) viene rifiutata con
// «Usa un indirizzo email personale, non temporaneo.». Aggiungi qui quelli che compaiono.

const DOMINI = new Set([
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  'anonbox.net',
  'burnermail.io',
  'byom.de',
  'discard.email',
  'dispostable.com',
  'dropmail.me',
  'emailondeck.com',
  'fakeinbox.com',
  'fakemail.net',
  'getairmail.com',
  'getnada.com',
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'harakirimail.com',
  'inboxkitten.com',
  'jetable.org',
  'mail.tm',
  'mailcatch.com',
  'maildrop.cc',
  'mailinator.com',
  'mailinator.net',
  'mailnesia.com',
  'mailpoof.com',
  'mintemail.com',
  'mohmal.com',
  'moakt.com',
  'mytemp.email',
  'nada.email',
  'sharklasers.com',
  'spam4.me',
  'spambox.us',
  'spamgourmet.com',
  'temp-mail.io',
  'temp-mail.org',
  'tempail.com',
  'tempmail.com',
  'tempmail.dev',
  'tempmail.net',
  'tempmailo.com',
  'tempr.email',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.de',
  'trashmail.net',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net'
])

export function dominioUsaEGetta(dominio: string): boolean {
  const parti = (dominio || '').trim().toLowerCase().split('.').filter(Boolean)
  // Controlla il dominio e i suoi genitori (es. a.mailinator.com → mailinator.com).
  for (let i = 0; i < parti.length - 1; i++) {
    if (DOMINI.has(parti.slice(i).join('.'))) return true
  }
  return false
}
