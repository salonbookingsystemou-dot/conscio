import { EMAIL } from './stileEmail.ts'

// Marchio Conscio in cima a ogni email: PNG alto 128 px, mostrato a 64 (kit del logo, 15/10/2026).
const MARCHIO_EMAIL = 'https://conscio.mnesti.it/email/conscio-email-2x.png'
const SITO_HANUMAN = 'https://www.hanumanstudio.it/'
const FIRMA_TESTO =
  'Conscio è un progetto dell’Associazione ADS Hanuman, Via San Leonardo 10, Ariano Irpino (AV) — hanumanstudio.it — tutti i diritti sono riservati'

export function escapeHtml(testo: string): string {
  return testo
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function firmaHtml(): string {
  return [
    `<div style="margin-top:28px;padding-top:20px;border-top:1px solid ${EMAIL.border};">`,
    `<p style="margin:0;font-family:${EMAIL.fontBody};font-size:12px;line-height:1.5;color:${EMAIL.muted};">`,
    'Conscio è un progetto dell’Associazione ADS Hanuman, Via San Leonardo 10, Ariano Irpino (AV) — ',
    `<a href="${SITO_HANUMAN}" style="color:${EMAIL.accent};text-decoration:underline;">hanumanstudio.it</a>`,
    ' — tutti i diritti sono riservati',
    '</p>',
    '</div>'
  ].join('')
}

export function testoConFirma(testo: string): string {
  return `${testo.trimEnd()}\n\n—\n${FIRMA_TESTO}`
}

function involucroEmail(corpoHtml: string): string {
  return [
    `<!DOCTYPE html><html><body style="margin:0;padding:16px 12px;background:${EMAIL.bg};">`,
    `<div style="max-width:560px;font-family:${EMAIL.fontBody};font-size:16px;line-height:1.55;color:${EMAIL.ink};">`,
    `<img src="${MARCHIO_EMAIL}" width="284" height="64" alt="Conscio" style="display:block;border:0;margin:0 0 24px;">`,
    corpoHtml,
    firmaHtml(),
    '</div></body></html>'
  ].join('')
}

export function htmlConFirma(testo: string): string {
  return involucroEmail(escapeHtml(testo).replace(/\n/g, '<br>'))
}

export function htmlConCorpo(corpoHtml: string): string {
  return involucroEmail(corpoHtml)
}
