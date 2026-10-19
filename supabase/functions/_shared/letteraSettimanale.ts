// Lettera settimanale composta dalla bozza dell'agente (docs/brief_agente_lettera.md, sez. 7).
// Funzione pura: la usano invia-lettera (invio vero e prova) e l'anteprima nella scheda del facilitatore.
// Gli iscritti non sono partecipanti: qui non entrano codici né dati dello studio.

import { EMAIL } from './stileEmail.ts'
import { escapeHtml, htmlConCorpo, testoConFirma } from './firmaEmail.ts'

export const SITO_LETTERA = 'https://conscio.mnesti.it'

export type Sezione = 'italia' | 'mondo' | 'ricerca' | 'eventi'

export type VoceLettera = {
  sezione: Sezione
  titolo: string
  sunto: string
  perche_conta?: string | null
  tipo_studio?: string | null
  fonte: string
  data: string // AAAA-MM-GG
  url: string
}

export type MeditazioneLettera = {
  slug: string
  titolo: string
  descrizione?: string | null
  durata_minuti?: number | null
  autore?: string | null
  voce?: string | null
  miniatura_url?: string | null
  /** true quando la miniatura ha già play e durata disegnati sopra. */
  miniatura_con_play?: boolean
}

export type BozzaLettera = {
  settimana: string // lunedì, AAAA-MM-GG
  oggetto: string
  introduzione?: string | null
  voci: VoceLettera[]
  meditazione?: MeditazioneLettera | null
  pratica_settimana?: string | null
}

export type InvitoPercorso = {
  titolo?: string | null
  testo?: string | null
}

export const SEZIONI: { id: Sezione; titolo: string }[] = [
  { id: 'italia', titolo: 'Dall’Italia' },
  { id: 'mondo', titolo: 'Dal mondo' },
  { id: 'ricerca', titolo: 'Dalla ricerca' },
  { id: 'eventi', titolo: 'Eventi' }
]

export const NOTA_IA =
  'I sunti sono preparati con l’aiuto di un’intelligenza artificiale. Per i dettagli fa fede la fonte.'

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'
]

/** «2026-10-16» → «16 ottobre 2026». Una data non valida torna com'è. */
export function dataLunga(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  if (!m) return String(iso || '')
  const mese = MESI[Number(m[2]) - 1]
  if (!mese) return String(iso)
  return `${Number(m[3])} ${mese} ${m[1]}`
}

/** Giovedì della settimana che inizia con il lunedì dato. */
export function giovediDi(lunedi: string): string {
  const d = new Date(`${lunedi}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return lunedi
  d.setUTCDate(d.getUTCDate() + 3)
  return d.toISOString().slice(0, 10)
}

export function urlMeditazione(slug: string): string {
  return `${SITO_LETTERA}/ascolta/${encodeURIComponent(slug)}/`
}

/** Solo link https: un URL strano non diventa mai un href. */
function hrefSicuro(url: string): string {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' ? u.href : SITO_LETTERA
  } catch {
    return SITO_LETTERA
  }
}

const h = (t: unknown) => escapeHtml(String(t ?? ''))

function occhiello(testo: string, colore: string = EMAIL.muted): string {
  return `<p style="margin:0 0 6px;font-family:${EMAIL.fontBody};font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${colore};">${h(testo)}</p>`
}

function titoloSerif(testo: string, px: number, href?: string): string {
  const interno = href
    ? `<a href="${h(hrefSicuro(href))}" style="color:${EMAIL.ink};text-decoration:none;">${h(testo)}</a>`
    : h(testo)
  return `<h3 style="margin:0 0 10px;font-family:${EMAIL.fontDisplay};font-weight:400;font-size:${px}px;line-height:1.3;color:${EMAIL.ink};">${interno}</h3>`
}

function card(contenuto: string, fondo: string = EMAIL.surface, bordo = true): string {
  const linea = bordo ? `border:1px solid ${EMAIL.border};` : ''
  return `<div style="margin:0 0 14px;padding:20px 22px;background:${fondo};${linea}border-radius:14px;">${contenuto}</div>`
}

function voceHtml(v: VoceLettera): string {
  const badge = v.tipo_studio
    ? `<p style="margin:0 0 10px;"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${EMAIL.accentSoft};color:${EMAIL.accent};font-size:12px;font-weight:500;">${h(v.tipo_studio)}</span></p>`
    : ''
  const conta = v.perche_conta
    ? `<p style="margin:0 0 12px;font-size:14px;color:${EMAIL.muted};">${h(v.perche_conta)}</p>`
    : ''
  const fonte = [
    `<p style="margin:0;padding-top:10px;border-top:1px solid ${EMAIL.border};font-size:13px;color:${EMAIL.muted};">`,
    `${h(v.fonte)} · ${h(dataLunga(v.data))} — `,
    `<a href="${h(hrefSicuro(v.url))}" style="color:${EMAIL.accent};font-weight:600;text-decoration:none;">Leggi la fonte →</a>`,
    '</p>'
  ].join('')
  return card(
    badge + titoloSerif(v.titolo, 20) + `<p style="margin:0 0 10px;">${h(v.sunto)}</p>` + conta + fonte
  )
}

function sezioneHtml(titolo: string, voci: VoceLettera[]): string {
  return [
    `<h2 style="margin:28px 0 12px;padding-bottom:8px;border-bottom:1px solid ${EMAIL.border};font-family:${EMAIL.fontBody};font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${EMAIL.accent};">${h(titolo)}</h2>`,
    ...voci.map(voceHtml)
  ].join('')
}

function rigaAutore(m: MeditazioneLettera): string {
  const parti = []
  if (m.autore) parti.push(`Testo di ${m.autore}`)
  if (m.voce) parti.push(`voce di ${m.voce}`)
  return parti.join(' · ')
}

function meditazioneHtml(m: MeditazioneLettera, pratica?: string | null): string {
  const link = urlMeditazione(m.slug)
  const durata = m.durata_minuti ? `${m.durata_minuti} min` : ''
  const immagine = m.miniatura_url
    ? `<a href="${h(link)}" style="display:block;margin:4px 0 14px;"><img src="${h(hrefSicuro(m.miniatura_url))}" width="516" alt="Ascolta «${h(m.titolo)}»${durata ? `, ${h(durata)}` : ''}" style="display:block;width:100%;max-width:516px;height:auto;border:0;border-radius:12px;"></a>`
    : ''
  // Senza play disegnato sull'immagine, il link d'ascolto va in chiaro sotto.
  const ascolta = !m.miniatura_url || !m.miniatura_con_play
    ? `<p style="margin:0 0 10px;"><a href="${h(link)}" style="color:${EMAIL.accent};font-weight:600;text-decoration:none;">▶ Ascolta${durata ? ` · ${h(durata)}` : ''}</a></p>`
    : ''
  const autore = rigaAutore(m)
  return card(
    [
      occhiello('Una pratica per la settimana'),
      immagine,
      titoloSerif(m.titolo, 21, link),
      m.descrizione ? `<p style="margin:0 0 10px;">${h(m.descrizione)}</p>` : '',
      ascolta,
      autore ? `<p style="margin:0;font-size:13px;color:${EMAIL.muted};">${h(autore)}</p>` : '',
      pratica ? `<p style="margin:14px 0 0;">${h(pratica)}</p>` : ''
    ].join(''),
    EMAIL.accentSoft,
    false
  )
}

function praticaSolaHtml(pratica: string): string {
  return card(occhiello('Una pratica per la settimana') + `<p style="margin:0;">${h(pratica)}</p>`, EMAIL.accentSoft, false)
}

function invitoHtml(inv: InvitoPercorso): string {
  const link = `${SITO_LETTERA}/#/iscrizione`
  return card(
    [
      occhiello('Il percorso di Conscio'),
      inv.titolo
        ? `<h3 style="margin:0 0 10px;font-family:${EMAIL.fontDisplay};font-weight:400;font-size:23px;line-height:1.25;color:${EMAIL.ink};">${h(inv.titolo)}</h3>`
        : '',
      inv.testo ? `<p style="margin:0 0 16px;">${h(inv.testo)}</p>` : '',
      `<a href="${link}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:${EMAIL.accent};color:${EMAIL.surface};font-family:${EMAIL.fontBody};font-size:15px;font-weight:600;text-decoration:none;">Iscriviti al prossimo ciclo</a>`
    ].join('')
  )
}

export function vociPerSezione(voci: VoceLettera[]): { id: Sezione; titolo: string; voci: VoceLettera[] }[] {
  return SEZIONI.map((s) => ({ ...s, voci: voci.filter((v) => v.sezione === s.id) })).filter((s) => s.voci.length > 0)
}

/** Corpo della lettera: HTML con firma standard e versione testo con lo stesso ordine. */
export function composiLettera(opts: {
  bozza: BozzaLettera
  invito?: InvitoPercorso | null
  /** Link della pagina «Non voglio più riceverla» per questo destinatario. */
  linkUscita: string
  perche?: string
}): { oggetto: string; html: string; testo: string } {
  const { bozza } = opts
  const perche = opts.perche || 'Ricevi questa email perché ti sei iscritto alla lettera di Conscio.'
  const data = dataLunga(giovediDi(bozza.settimana))
  const sezioni = vociPerSezione(bozza.voci || [])
  const invito = opts.invito && (opts.invito.titolo || opts.invito.testo) ? opts.invito : null

  const html = [
    occhiello(`Lettera settimanale · ${data}`),
    `<h1 style="margin:0 0 12px;font-family:${EMAIL.fontDisplay};font-weight:400;font-size:30px;line-height:1.2;color:${EMAIL.ink};">Questa settimana</h1>`,
    bozza.introduzione ? `<p style="margin:0 0 8px;">${h(bozza.introduzione)}</p>` : '',
    ...sezioni.map((s) => sezioneHtml(s.titolo, s.voci)),
    `<div style="height:14px;"></div>`,
    bozza.meditazione
      ? meditazioneHtml(bozza.meditazione, bozza.pratica_settimana)
      : bozza.pratica_settimana
        ? praticaSolaHtml(bozza.pratica_settimana)
        : '',
    invito ? invitoHtml(invito) : '',
    `<p style="margin:18px 0 0;padding-left:12px;border-left:2px solid ${EMAIL.ochre};font-size:13px;color:${EMAIL.muted};">${h(NOTA_IA)}</p>`,
    `<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${EMAIL.muted};">${h(perche)} `,
    `<a href="${h(hrefSicuro(opts.linkUscita))}" style="color:${EMAIL.muted};">Non voglio più riceverla</a>.</p>`
  ].join('')

  const righe: string[] = [`LETTERA SETTIMANALE · ${data.toUpperCase()}`, '', 'Questa settimana', '']
  if (bozza.introduzione) righe.push(bozza.introduzione, '')
  for (const s of sezioni) {
    righe.push(s.titolo.toUpperCase(), '')
    for (const v of s.voci) {
      if (v.tipo_studio) righe.push(`[${v.tipo_studio}]`)
      righe.push(v.titolo, v.sunto)
      if (v.perche_conta) righe.push(v.perche_conta)
      righe.push(`${v.fonte} · ${dataLunga(v.data)} — ${v.url}`, '')
    }
  }
  if (bozza.meditazione) {
    const m = bozza.meditazione
    righe.push('UNA PRATICA PER LA SETTIMANA', '', m.titolo)
    if (m.descrizione) righe.push(m.descrizione)
    righe.push(`Ascolta${m.durata_minuti ? ` (${m.durata_minuti} min)` : ''}: ${urlMeditazione(m.slug)}`)
    const autore = rigaAutore(m)
    if (autore) righe.push(autore)
    if (bozza.pratica_settimana) righe.push('', bozza.pratica_settimana)
    righe.push('')
  } else if (bozza.pratica_settimana) {
    righe.push('UNA PRATICA PER LA SETTIMANA', '', bozza.pratica_settimana, '')
  }
  if (invito) {
    righe.push('IL PERCORSO DI CONSCIO', '')
    if (invito.titolo) righe.push(invito.titolo)
    if (invito.testo) righe.push(invito.testo)
    righe.push(`Iscriviti al prossimo ciclo: ${SITO_LETTERA}/#/iscrizione`, '')
  }
  righe.push(NOTA_IA, '', '—', perche, `Per non riceverla più: ${opts.linkUscita}`)

  return {
    oggetto: bozza.oggetto,
    html: htmlConCorpo(html),
    testo: testoConFirma(righe.join('\n'))
  }
}
