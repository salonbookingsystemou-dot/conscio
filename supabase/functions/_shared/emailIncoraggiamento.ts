import { escapeHtml, htmlConCorpo, testoConFirma } from './firmaEmail.ts'

export type CitazioneEmail = {
  quoteText: string
  author: string
  bookTitle: string
}

export function oggettoIncoraggiamento(giorno: number): string {
  return `Congratulati con te stesso sei giunto al giorno ${giorno} di 56`
}

export function testoIncoraggiamento(citazione: CitazioneEmail): string {
  return [
    'Ciao,',
    '',
    'hai appena completato la tua pratica di oggi. Un passo in più in un percorso',
    'che si costruisce proprio così: un giorno alla volta, senza fretta.',
    '',
    `«${citazione.quoteText}»`,
    '',
    citazione.author,
    citazione.bookTitle,
    '',
    'A domani, con la stessa presenza.'
  ].join('\n')
}

export function htmlIncoraggiamento(citazione: CitazioneEmail): string {
  const quote = escapeHtml(citazione.quoteText)
  const author = escapeHtml(citazione.author)
  const book = escapeHtml(citazione.bookTitle)
  const corpo = [
    '<p style="margin:0 0 16px;">Ciao,</p>',
    '<p style="margin:0 0 20px;">hai appena completato la tua pratica di oggi. Un passo in più in un percorso che si costruisce proprio così: un giorno alla volta, senza fretta.</p>',
    `<p style="margin:0 0 10px;font-weight:bold;">«${quote}»</p>`,
    `<p style="margin:0;font-size:16px;line-height:1.4;color:#2c2a26;">${author}</p>`,
    `<p style="margin:2px 0 20px;font-size:13px;line-height:1.45;color:#5c584f;font-style:italic;">${book}</p>`,
    '<p style="margin:0;">A domani, con la stessa presenza.</p>'
  ].join('')
  return htmlConCorpo(corpo)
}

export function testoIncoraggiamentoConFirma(citazione: CitazioneEmail): string {
  return testoConFirma(testoIncoraggiamento(citazione))
}
