// Email di «Restiamo in contatto» (avviso del ciclo e lettera settimanale).
// Gli iscritti non sono partecipanti: qui non entrano codici né dati dello studio.

import { EMAIL } from './stileEmail.ts'
import { escapeHtml, htmlConCorpo, testoConFirma } from './firmaEmail.ts'

export const SITO = 'https://conscio.mnesti.it'
export const REPLY_TO_LETTERA = 'contact@wordpresschef.it'
// Data dell'informativa «Restiamo in contatto» (/documenti/lettera): si salva con ogni consenso.
export const VERSIONE_TESTO_LETTERA = '2026-10-18'

export type Lista = 'avviso_ciclo' | 'lettera'

export const LISTE: Record<Lista, { titolo: string; riga: string; perche: string; nome: string }> = {
  avviso_ciclo: {
    titolo: 'Avviso del prossimo ciclo',
    riga: 'Una sola email, quando si aprono le iscrizioni.',
    perche: 'Ricevi questa email perché hai chiesto a Conscio l’avviso del prossimo ciclo.',
    nome: 'l’avviso del prossimo ciclo'
  },
  lettera: {
    titolo: 'Lettera settimanale',
    riga: 'Notizie, studi ed eventi di mindfulness in Italia e nel mondo.',
    perche: 'Ricevi questa email perché ti sei iscritto alla lettera di Conscio.',
    nome: 'la lettera settimanale'
  }
}

export function linkUscita(tokenUscita: string, lista?: Lista): string {
  const q = new URLSearchParams({ u: tokenUscita })
  if (lista) q.set('lista', lista)
  return `${SITO}/#/lettera/esci?${q.toString()}`
}

/** Header per l'uscita con un clic dei client di posta (RFC 8058). */
export function headerUscita(supabaseUrl: string, tokenUscita: string, lista: Lista): Record<string, string> {
  const q = new URLSearchParams({ azione: 'esci_lettera', u: tokenUscita, lista })
  const mailto = `mailto:${REPLY_TO_LETTERA}?subject=${encodeURIComponent('Cancellami dalla lettera di Conscio')}`
  return {
    'List-Unsubscribe': `<${supabaseUrl}/functions/v1/porta?${q.toString()}>, <${mailto}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
  }
}

function pulsante(href: string, etichetta: string): string {
  return [
    `<p style="margin:24px 0;">`,
    `<a href="${href}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:${EMAIL.accent};`,
    `color:${EMAIL.surface};font-family:${EMAIL.fontBody};font-size:16px;font-weight:600;text-decoration:none;">${escapeHtml(etichetta)}</a>`,
    '</p>'
  ].join('')
}

function paragrafo(testo: string, stile = ''): string {
  return `<p style="margin:0 0 14px;${stile}">${escapeHtml(testo)}</p>`
}

function elencoListe(liste: Lista[]): { testo: string; html: string } {
  return {
    testo: liste.map((l) => `• ${LISTE[l].titolo} — ${LISTE[l].riga}`).join('\n'),
    html: [
      '<ul style="margin:0 0 14px;padding-left:20px;">',
      ...liste.map(
        (l) => `<li style="margin:0 0 6px;"><strong>${escapeHtml(LISTE[l].titolo)}</strong> — ${escapeHtml(LISTE[l].riga)}</li>`
      ),
      '</ul>'
    ].join('')
  }
}

export function emailConferma(token: string, liste: Lista[]) {
  const link = `${SITO}/#/lettera/conferma?t=${token}`
  const elenco = elencoListe(liste)
  const avviso = 'Se non sei stato tu, ignora questa email: non ti scriveremo.'
  const scadenza = 'Il link vale 7 giorni. Senza conferma non ti scriviamo e la richiesta si cancella da sola.'
  return {
    oggetto: 'Conferma la tua iscrizione a Conscio',
    testo: testoConFirma(
      ['Ciao,', '', 'hai chiesto di ricevere da Conscio:', elenco.testo, '', 'Conferma qui:', link, '', scadenza, '', avviso].join('\n')
    ),
    html: htmlConCorpo(
      [
        paragrafo('Ciao,'),
        paragrafo('hai chiesto di ricevere da Conscio:'),
        elenco.html,
        pulsante(link, 'Conferma'),
        paragrafo(scadenza, `font-size:14px;color:${EMAIL.muted};`),
        paragrafo(avviso, `font-size:14px;color:${EMAIL.muted};`)
      ].join('')
    )
  }
}

export function emailPreferenze(tokenUscita: string, attive: Lista[]) {
  const elenco = elencoListe(attive)
  const uscita = linkUscita(tokenUscita)
  const nota = 'Se non sei stato tu, puoi uscire con un clic:'
  return {
    oggetto: 'Hai aggiornato le tue preferenze',
    testo: testoConFirma(
      ['Ciao,', '', 'da adesso ricevi da Conscio:', elenco.testo, '', nota, uscita].join('\n')
    ),
    html: htmlConCorpo(
      [
        paragrafo('Ciao,'),
        paragrafo('da adesso ricevi da Conscio:'),
        elenco.html,
        `<p style="margin:0 0 14px;font-size:14px;color:${EMAIL.muted};">${escapeHtml(nota)} `,
        `<a href="${uscita}" style="color:${EMAIL.accent};">non voglio più ricevere email</a>.</p>`
      ].join('')
    )
  }
}

/** Testo semplice → HTML: paragrafi sulle righe vuote, a capo, link https cliccabili. */
function corpoInHtml(corpo: string): string {
  return corpo
    .trim()
    .split(/\n{2,}/)
    .map((blocco) => {
      const html = escapeHtml(blocco)
        .replace(/https:\/\/[^\s<]+[^\s<.,;:!?)»]/g, (u) => `<a href="${u}" style="color:${EMAIL.accent};">${u}</a>`)
        .replace(/\n/g, '<br>')
      return `<p style="margin:0 0 14px;">${html}</p>`
    })
    .join('')
}

/** Lettera o avviso del ciclo, con il piede per uscire dalla lista. */
export function emailLettera(opts: { corpo: string; tokenUscita: string; lista: Lista }) {
  const uscita = linkUscita(opts.tokenUscita, opts.lista)
  const perche = LISTE[opts.lista].perche
  return {
    testo: testoConFirma(
      [opts.corpo.trim(), '', '—', perche, `Per non riceverla più: ${uscita}`].join('\n')
    ),
    html: htmlConCorpo(
      [
        corpoInHtml(opts.corpo),
        `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${EMAIL.muted};">${escapeHtml(perche)} `,
        `<a href="${uscita}" style="color:${EMAIL.accent};">Non voglio più riceverla</a>.</p>`
      ].join('')
    )
  }
}
