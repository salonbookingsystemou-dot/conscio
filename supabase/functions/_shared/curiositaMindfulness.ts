// Curiosità verificate per l'email di fine sessione.
// Fonte unica: src/data/curiosita-mindfulness.json
// Le nuove voci si aggiungono in fondo, così l'indice di rotazione non si sposta.

import elenco from '../../../src/data/curiosita-mindfulness.json' with { type: 'json' }

export type Curiosita = {
  id: string
  categoria: string
  titolo: string
  testo: string
  paese: string
  fonte: string
  url: string
}

const CURIOSITA = (elenco as Curiosita[]).filter(c =>
  c.id && c.titolo && c.testo && c.fonte
)

function scartoPartecipante(utenteId: string, n: number): number {
  let h = 2166136261
  for (let i = 0; i < utenteId.length; i++) {
    h ^= utenteId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % n
}

export function scegliCuriosita(opts: {
  utenteId: string
  inviiPrecedenti: number
  categoria?: string
}): Curiosita | null {
  const pool = opts.categoria
    ? CURIOSITA.filter(c => c.categoria === opts.categoria)
    : CURIOSITA
  if (pool.length === 0) return null
  const partenza = scartoPartecipante(opts.utenteId, pool.length)
  const passi = Number.isFinite(opts.inviiPrecedenti)
    ? Math.max(0, Math.floor(opts.inviiPrecedenti))
    : 0
  return pool[(partenza + passi) % pool.length]
}

export function ordinalGiorno(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return 0
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}
