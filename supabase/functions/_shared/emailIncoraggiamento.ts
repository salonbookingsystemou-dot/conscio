import { escapeHtml, htmlConCorpo, testoConFirma } from './firmaEmail.ts'
import type { Curiosita } from './curiositaMindfulness.ts'
import { EMAIL } from './stileEmail.ts'

export type CitazioneEmail = {
  quoteText: string
  author: string
  bookTitle: string
}

function testoCuriosita(curiosita: Curiosita): string {
  const righe = [
    'Lo sapevi che...',
    curiosita.titolo,
    curiosita.testo,
    `Fonte: ${curiosita.fonte}`
  ]
  const url = curiosita.url.trim()
  if (url) righe.push(url)
  return righe.join('\n')
}

function htmlCuriosita(curiosita: Curiosita): string {
  const titolo = escapeHtml(curiosita.titolo)
  const testo = escapeHtml(curiosita.testo)
  const fonte = escapeHtml(curiosita.fonte)
  const url = curiosita.url.trim()
  const fonteHtml = url
    ? `<a href="${escapeHtml(url)}" style="color:${EMAIL.accent};text-decoration:underline;">${fonte}</a>`
    : fonte
  return [
    `<div style="margin:24px 0 0;padding:18px 20px;background:${EMAIL.surface};border:1px solid ${EMAIL.border};border-left:3px solid ${EMAIL.ochre};border-radius:14px;">`,
    `<p style="margin:0 0 8px;font-size:11px;line-height:1.4;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${EMAIL.ochre};">Lo sapevi che...</p>`,
    `<p style="margin:0 0 8px;font-family:${EMAIL.fontDisplay};font-size:22px;line-height:1.15;color:${EMAIL.ink};">${titolo}</p>`,
    `<p style="margin:0 0 12px;color:${EMAIL.ink};">${testo}</p>`,
    `<p style="margin:0;font-size:12px;line-height:1.45;color:${EMAIL.muted};">Fonte: ${fonteHtml}</p>`,
    '</div>'
  ].join('')
}

export function oggettoIncoraggiamento(giorno: number): string {
  return `Congratulati con te stesso sei giunto al giorno ${giorno} di 56`
}

export function testoIncoraggiamento(citazione: CitazioneEmail, curiosita: Curiosita | null): string {
  const righe = [
    'Ciao,',
    '',
    'hai appena completato la tua pratica di oggi. Un passo in più in un percorso',
    'che si costruisce proprio così: un giorno alla volta, senza fretta.',
    '',
    `«${citazione.quoteText}»`,
    '',
    citazione.author,
    citazione.bookTitle
  ]
  if (curiosita) righe.push('', testoCuriosita(curiosita))
  righe.push('', 'A domani, con la stessa presenza.')
  return righe.join('\n')
}

export function htmlIncoraggiamento(citazione: CitazioneEmail, curiosita: Curiosita | null): string {
  const quote = escapeHtml(citazione.quoteText)
  const author = escapeHtml(citazione.author)
  const book = escapeHtml(citazione.bookTitle)
  const corpo = [
    '<p style="margin:0 0 16px;">Ciao,</p>',
    '<p style="margin:0 0 20px;">hai appena completato la tua pratica di oggi. Un passo in più in un percorso che si costruisce proprio così: un giorno alla volta, senza fretta.</p>',
    `<p style="margin:0 0 10px;font-family:${EMAIL.fontDisplay};font-size:24px;line-height:1.25;color:${EMAIL.ink};">«${quote}»</p>`,
    `<p style="margin:0;font-size:15px;line-height:1.4;font-weight:600;color:${EMAIL.ink};">${author}</p>`,
    `<p style="margin:2px 0 4px;font-size:13px;line-height:1.45;color:${EMAIL.muted};">${book}</p>`,
    curiosita ? htmlCuriosita(curiosita) : '',
    '<p style="margin:20px 0 0;">A domani, con la stessa presenza.</p>'
  ].join('')
  return htmlConCorpo(corpo)
}

export function testoIncoraggiamentoConFirma(citazione: CitazioneEmail, curiosita: Curiosita | null): string {
  return testoConFirma(testoIncoraggiamento(citazione, curiosita))
}
