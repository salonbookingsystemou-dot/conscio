import { escapeHtml, htmlConCorpo, testoConFirma } from './firmaEmail.ts'
import type { Curiosita } from './curiositaMindfulness.ts'

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
    ? `<a href="${escapeHtml(url)}" style="color:#3C5A48;text-decoration:underline;">${fonte}</a>`
    : fonte
  return [
    '<div style="margin:24px 0 0;padding:16px 16px 14px 14px;background:#FBFAF6;border:1px solid #DAD9CE;border-left:3px solid #A8763E;border-radius:10px;">',
    '<p style="margin:0 0 8px;font-size:13px;line-height:1.4;color:#A8763E;">Lo sapevi che...</p>',
    `<p style="margin:0 0 8px;font-weight:bold;color:#24312C;">${titolo}</p>`,
    `<p style="margin:0 0 12px;color:#24312C;">${testo}</p>`,
    `<p style="margin:0;font-size:12px;line-height:1.45;color:#5B665F;">Fonte: ${fonteHtml}</p>`,
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
    `<p style="margin:0 0 10px;font-weight:bold;">«${quote}»</p>`,
    `<p style="margin:0;font-size:16px;line-height:1.4;color:#2c2a26;">${author}</p>`,
    `<p style="margin:2px 0 4px;font-size:13px;line-height:1.45;color:#5c584f;font-style:italic;">${book}</p>`,
    curiosita ? htmlCuriosita(curiosita) : '',
    '<p style="margin:20px 0 0;">A domani, con la stessa presenza.</p>'
  ].join('')
  return htmlConCorpo(corpo)
}

export function testoIncoraggiamentoConFirma(citazione: CitazioneEmail, curiosita: Curiosita | null): string {
  return testoConFirma(testoIncoraggiamento(citazione, curiosita))
}
