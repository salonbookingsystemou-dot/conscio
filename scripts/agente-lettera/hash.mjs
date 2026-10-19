// Impronta di un URL normalizzato (chiave di notizie_lettera). Solo Node.
import { createHash } from 'node:crypto'
import { normalizzaUrl } from './testi.mjs'

export function hashUrl(url) {
  return createHash('sha256').update(normalizzaUrl(url)).digest('hex')
}
