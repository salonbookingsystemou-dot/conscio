import { escapeHtml, htmlConCorpo, testoConFirma } from './firmaEmail.ts'
import { EMAIL } from './stileEmail.ts'

export const LINK_CONCLUSIONE = 'https://conscio.mnesti.it/#/conclusione'
export const OGGETTO_CONCLUSIONE = 'Manca un ultimo passo per chiudere il tuo percorso'

const DISCLAIMER =
  'Questo percorso è una pratica di consapevolezza (mindfulness) a scopo di ricerca e non sostituisce un percorso terapeutico o una presa in carico psicologica.'

export type DatiConclusione = {
  codice: string
  t2DaFare: boolean
  t2ChiudeIl: string | null
}

function dataEstesa(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome'
  })
}

const APERTURA = 'le otto settimane del percorso sono arrivate alla fine. Ci sei arrivato un giorno alla volta, ed è già qualcosa da riconoscerti.'

// Chi ha già compilato il T2 (o non può più farlo) non legge del questionario.
function frasePassi(d: DatiConclusione): string {
  return d.t2DaFare
    ? 'Nell’app ti aspetta l’ultimo passaggio, quello che chiude il ciclo: il questionario finale, una breve valutazione dell’esperienza e un saluto. Bastano pochi minuti.'
    : 'Nell’app ti aspetta l’ultimo passaggio, quello che chiude il ciclo: una breve valutazione dell’esperienza e un saluto. Bastano pochi minuti.'
}

function fraseT2(d: DatiConclusione): string | null {
  if (!d.t2DaFare || !d.t2ChiudeIl) return null
  return `Il questionario finale resta aperto fino al ${dataEstesa(d.t2ChiudeIl)}: le tue risposte sono importanti quanto quelle dell’inizio.`
}

// Pulsante «a prova di Outlook»: tabella con il colore sulla cella, link a tutta larghezza del pulsante.
export function pulsanteHtml(etichetta: string, href: string): string {
  const h = escapeHtml(href)
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-collapse:separate;">',
    `<tr><td bgcolor="${EMAIL.accent}" style="background:${EMAIL.accent};border-radius:999px;">`,
    `<a href="${h}" style="display:inline-block;padding:13px 26px;font-family:${EMAIL.fontBody};font-size:16px;line-height:1.2;color:#FFFFFF;text-decoration:none;border-radius:999px;">${escapeHtml(etichetta)}</a>`,
    '</td></tr></table>'
  ].join('')
}

export function testoConclusione(d: DatiConclusione): string {
  const t2 = fraseT2(d)
  return testoConFirma([
    'Ciao,',
    '',
    APERTURA,
    '',
    frasePassi(d),
    ...(t2 ? ['', t2] : []),
    '',
    'Chiudi il tuo percorso:',
    LINK_CONCLUSIONE,
    '',
    `Se l’app ti chiede di entrare, usa il tuo codice partecipante: ${d.codice}`,
    '',
    DISCLAIMER
  ].join('\n'))
}

export function htmlConclusione(d: DatiConclusione): string {
  const t2 = fraseT2(d)
  const corpo = [
    '<p style="margin:0 0 16px;">Ciao,</p>',
    `<p style="margin:0 0 16px;">${escapeHtml(APERTURA)}</p>`,
    `<p style="margin:0 0 20px;">${escapeHtml(frasePassi(d))}</p>`,
    t2
      ? `<div style="margin:0 0 20px;padding:14px 18px;background:${EMAIL.surface};border:1px solid ${EMAIL.border};border-left:3px solid ${EMAIL.ochre};"><p style="margin:0;font-size:15px;">${escapeHtml(t2)}</p></div>`
      : '',
    pulsanteHtml('Chiudi il tuo percorso', LINK_CONCLUSIONE),
    `<p style="margin:0 0 6px;font-size:14px;color:${EMAIL.muted};">Se l’app ti chiede di entrare, usa il tuo codice partecipante:</p>`,
    `<p style="margin:0 0 20px;font-family:${EMAIL.fontDisplay};font-size:20px;letter-spacing:0.04em;color:${EMAIL.ink};">${escapeHtml(d.codice)}</p>`,
    `<p style="margin:0;font-size:13px;line-height:1.5;color:${EMAIL.muted};">${escapeHtml(DISCLAIMER)}</p>`
  ].join('')
  return htmlConCorpo(corpo)
}
