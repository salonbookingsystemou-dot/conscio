// Funzioni pure su testi, URL, date e feed. Nessuna rete e nessun modulo di Node:
// controlli.mjs e questo file si usano anche nella scheda del facilitatore (Vite).

import { FUSO, ORA_INVIO, PAROLE_TEMA } from './config.mjs'

const ENTITA = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', ndash: '–', mdash: '—', egrave: 'è', eacute: 'é', agrave: 'à', ograve: 'ò', ugrave: 'ù', igrave: 'ì' }

export function decodificaEntita(testo) {
  return String(testo || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITA[n.toLowerCase()] ?? m)
}

/** HTML → testo leggibile: via script, stili, menu e piè di pagina; spazi compattati. */
export function testoDaHtml(html, max = Infinity) {
  let s = String(html || '')
  const corpo = /<(article|main)\b[\s\S]*?<\/\1>/i.exec(s)
  if (corpo) s = corpo[0]
  s = s
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|aside|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|br|tr|section)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  s = decodificaEntita(s)
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function senzaCdata(s) {
  return String(s || '').replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
}

function tag(blocco, nome) {
  const m = new RegExp(`<${nome}\\b[^>]*>([\\s\\S]*?)<\\/${nome}>`, 'i').exec(blocco)
  return m ? senzaCdata(m[1]).trim() : ''
}

/** Legge RSS 2.0 e Atom. Restituisce { titolo, url, data, estratto }. */
export function leggiFeedXml(xml) {
  const testo = String(xml || '')
  const voci = []
  const items = testo.match(/<item\b[\s\S]*?<\/item>/gi) || []
  for (const it of items) {
    voci.push({
      titolo: testoDaHtml(tag(it, 'title')),
      url: decodificaEntita(tag(it, 'link') || tag(it, 'guid')).trim(),
      data: dataIso(tag(it, 'pubDate') || tag(it, 'dc:date')),
      estratto: testoDaHtml(tag(it, 'description') || tag(it, 'content:encoded'), 500)
    })
  }
  const entries = testo.match(/<entry\b[\s\S]*?<\/entry>/gi) || []
  for (const en of entries) {
    const link = /<link\b[^>]*rel=["']alternate["'][^>]*>/i.exec(en)?.[0] || /<link\b[^>]*>/i.exec(en)?.[0] || ''
    voci.push({
      titolo: testoDaHtml(tag(en, 'title')),
      url: decodificaEntita(/href=["']([^"']+)["']/i.exec(link)?.[1] || '').trim(),
      data: dataIso(tag(en, 'published') || tag(en, 'updated')),
      estratto: testoDaHtml(tag(en, 'summary') || tag(en, 'content'), 500)
    })
  }
  return voci.filter((v) => v.titolo && /^https?:\/\//i.test(v.url))
}

/** Qualsiasi data riconoscibile → AAAA-MM-GG, altrimenti null. */
export function dataIso(valore) {
  if (!valore) return null
  const s = String(valore).trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  // Con il fuso nella stringa conta il giorno UTC; senza («October 14, 2026») il giorno scritto.
  if (/(?:[+-]\d{2}:?\d{2}|GMT|UTC|Z)\s*$/i.test(s)) return d.toISOString().slice(0, 10)
  const due = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`
}

/** «3 days ago», «1 week ago», «October 14, 2026» → AAAA-MM-GG rispetto a oggi. */
export function dataDaEta(eta, oggi = new Date()) {
  if (!eta) return null
  const rel = /(\d+)\s*(minute|hour|day|week|month)s?\s+ago/i.exec(String(eta))
  if (rel) {
    const n = Number(rel[1])
    const giorni = { minute: 0, hour: 0, day: n, week: n * 7, month: n * 30 }[rel[2].toLowerCase()]
    const d = new Date(oggi)
    d.setUTCDate(d.getUTCDate() - giorni)
    return d.toISOString().slice(0, 10)
  }
  return dataIso(eta)
}

export function giorniTra(daIso, aIso) {
  const a = Date.parse(`${daIso}T00:00:00Z`)
  const b = Date.parse(`${aIso}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity
  return Math.round((b - a) / 86_400_000)
}

const PARAMETRI_TRACCIA = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|cmpid$|ito$|at_medium$|at_campaign$|srsltid$)/i

/** URL comparabile: host minuscolo senza www, niente parametri di tracciamento, niente # e / finale. */
export function normalizzaUrl(url) {
  try {
    const u = new URL(String(url).trim())
    u.hash = ''
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '')
    for (const k of [...u.searchParams.keys()]) if (PARAMETRI_TRACCIA.test(k)) u.searchParams.delete(k)
    u.searchParams.sort()
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '')
    return u.toString().replace(/^http:\/\//, 'https://')
  } catch {
    return ''
  }
}

export function dominioDi(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** La fonte a cui appartiene un URL: il dominio più lungo che corrisponde. */
export function fontePerUrl(url, fonti) {
  const host = dominioDi(url)
  let migliore = null
  for (const f of fonti) {
    const d = String(f.dominio || '').toLowerCase()
    if (host === d || host.endsWith(`.${d}`)) {
      if (!migliore || d.length > migliore.dominio.length) migliore = f
    }
  }
  return migliore
}

export function parlaDelTema(...testi) {
  const t = testi.join(' ').toLowerCase()
  return PAROLE_TEMA.some((p) => t.includes(p))
}

/** Parole vietate: una per riga, «#» per i commenti. Confronto per parola intera, senza maiuscole. */
export function leggiParoleVietate(testo) {
  return String(testo || '')
    .split('\n')
    .map((r) => r.replace(/#.*/, '').trim().toLowerCase())
    .filter(Boolean)
}

export function trovaParoleVietate(testo, parole) {
  const t = ` ${String(testo || '').toLowerCase()} `
  const trovate = []
  for (const p of parole) {
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(^|[^\\p{L}])${esc}([^\\p{L}]|$)`, 'u').test(t)) trovate.push(p)
  }
  return trovate
}

/** Parti di una data nel fuso italiano. */
function partiNelFuso(data) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short'
  })
  const p = Object.fromEntries(f.formatToParts(data).map((x) => [x.type, x.value]))
  return p
}

export function oggiItalia(ora = new Date()) {
  const p = partiNelFuso(ora)
  return `${p.year}-${p.month}-${p.day}`
}

/** Lunedì della settimana (ora italiana) che contiene la data. */
export function lunediDi(ora = new Date()) {
  const oggi = oggiItalia(ora)
  const d = new Date(`${oggi}T12:00:00Z`)
  const giorno = (d.getUTCDay() + 6) % 7 // lunedì = 0
  d.setUTCDate(d.getUTCDate() - giorno)
  return d.toISOString().slice(0, 10)
}

/** Istante UTC di un'ora italiana in un giorno dato (gestisce l'ora legale). */
export function istanteItalia(giornoIso, ore, minuti = 0) {
  const guess = new Date(`${giornoIso}T${String(ore).padStart(2, '0')}:${String(minuti).padStart(2, '0')}:00Z`)
  const p = partiNelFuso(guess)
  const comeUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  const scarto = comeUtc - guess.getTime()
  return new Date(guess.getTime() - scarto)
}

/** Giovedì della settimana alle 17:00 italiane (il job delle 15:00 UTC lo trova pronto). */
export function invioPrevisto(ora = new Date()) {
  const giovedi = new Date(`${lunediDi(ora)}T12:00:00Z`)
  giovedi.setUTCDate(giovedi.getUTCDate() + 3)
  return istanteItalia(giovedi.toISOString().slice(0, 10), ORA_INVIO.ore, ORA_INVIO.minuti)
}

/** Estrae il primo oggetto JSON da un testo (anche dentro ```json). */
export function estraiJson(testo) {
  const s = String(testo || '')
  try {
    return JSON.parse(s)
  } catch { /* prova sotto */ }
  const recinto = /```(?:json)?\s*([\s\S]*?)```/i.exec(s)
  if (recinto) {
    try { return JSON.parse(recinto[1]) } catch { /* prova sotto */ }
  }
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  if (a >= 0 && b > a) {
    try { return JSON.parse(s.slice(a, b + 1)) } catch { /* niente */ }
  }
  return null
}
