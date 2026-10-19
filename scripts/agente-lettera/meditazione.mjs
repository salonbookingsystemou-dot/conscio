// «Una pratica per la settimana»: una meditazione della vetrina scelta a caso, con la sua miniatura.

import { createHash } from 'node:crypto'
import { BUCKET_MINIATURE, UA } from './config.mjs'

/** A caso tra le tracce in vetrina, esclusa quella della lettera precedente (se ce n'è un'altra). */
export function scegliMeditazione(elenco, slugPrecedente, casuale = Math.random) {
  const valide = (elenco || []).filter((t) => t?.slug && t?.titolo)
  if (!valide.length) return null
  const altre = valide.filter((t) => t.slug !== slugPrecedente)
  const pool = altre.length ? altre : valide
  return pool[Math.floor(casuale() * pool.length) % pool.length]
}

export function voceLeggibile(voce) {
  if (!voce) return null
  if (voce.tipo === 'umana' && voce.nome) return voce.nome
  if (voce.tipo === 'sintetica') return 'sintetica'
  return voce.nome || null
}

/** Dalla riga di vetrina_elenco alla meditazione della bozza. */
export function meditazioneDaTraccia(t) {
  return {
    slug: t.slug,
    titolo: t.titolo,
    descrizione: t.descrizione || null,
    durata_minuti: t.durata_minuti || null,
    autore: t.autore?.nome || null,
    voce: voceLeggibile(t.voce),
    sfondo_url: t.sfondo?.poster_url || t.sfondo?.url || null,
    miniatura_url: t.sfondo?.poster_url || t.sfondo?.url || null,
    miniatura_con_play: false
  }
}

const L = 1120
const A = 630

/** Velo, cerchio con play e pillola della durata, disegnati sopra lo sfondo. */
export function svgSovrapposto(durataMinuti) {
  const cx = L / 2
  const cy = A / 2
  const r = 66
  const durata = durataMinuti ? `${durataMinuti} min` : ''
  const larghezzaPillola = 34 + durata.length * 17
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}">
  <defs><linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0.45" stop-color="#262419" stop-opacity="0"/>
    <stop offset="1" stop-color="#262419" stop-opacity="0.45"/>
  </linearGradient></defs>
  <rect width="${L}" height="${A}" fill="url(#v)"/>
  <circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="#262419" fill-opacity="0.18"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF" fill-opacity="0.94"/>
  <path d="M ${cx - 20} ${cy - 30} L ${cx - 20} ${cy + 30} L ${cx + 32} ${cy} Z" fill="#3F5443"/>
  ${durata ? `<rect x="${L - 28 - larghezzaPillola}" y="${A - 72}" width="${larghezzaPillola}" height="44" rx="22" fill="#262419" fill-opacity="0.6"/>
  <text x="${L - 28 - larghezzaPillola / 2}" y="${A - 42}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="600" fill="#FFFFFF">${durata}</text>` : ''}
</svg>`
}

/**
 * Prepara la miniatura 1120×630 con play e durata e la carica in Storage.
 * Riusa quella già caricata finché lo sfondo non cambia. Se qualcosa non va, la bozza usa lo sfondo com'è.
 */
export async function preparaMiniatura(m, db, log) {
  if (!m?.sfondo_url) return m
  const impronta = createHash('sha256').update(`${m.sfondo_url}|${m.durata_minuti || ''}`).digest('hex').slice(0, 10)
  const percorso = `lettera/${m.slug}-${impronta}.jpg`
  const pubblico = `${db.base}/storage/v1/object/public/${BUCKET_MINIATURE}/${percorso}`
  try {
    if (await db.esiste(pubblico)) return { ...m, miniatura_url: pubblico, miniatura_con_play: true }
    let sharp
    try {
      sharp = (await import('sharp')).default
    } catch {
      log('miniatura: sharp non installato, uso lo sfondo così com’è')
      return m
    }
    const res = await fetch(m.sfondo_url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`sfondo ${res.status}`)
    const originale = Buffer.from(await res.arrayBuffer())
    const jpeg = await sharp(originale)
      .resize(L, A, { fit: 'cover', position: 'attention' })
      .composite([{ input: Buffer.from(svgSovrapposto(m.durata_minuti)), top: 0, left: 0 }])
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()
    const url = await db.carica(BUCKET_MINIATURE, percorso, jpeg, 'image/jpeg')
    return { ...m, miniatura_url: url, miniatura_con_play: true }
  } catch (err) {
    log(`miniatura: ${err.message || err}`)
    return m
  }
}
