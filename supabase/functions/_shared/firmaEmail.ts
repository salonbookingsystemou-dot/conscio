const ICONA_APP = 'https://conscio.mnesti.it/icon-192.png'
const SITO_HANUMAN = 'https://www.hanumanstudio.it/'
const FIRMA_TESTO =
  'Percorso MBSR è un progetto dell’Associazione ADS Hanuman, Via San Leonardo 10, Ariano Irpino (AV) — hanumanstudio.it — tutti i diritti sono riservati'

function escapeHtml(testo: string): string {
  return testo
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function firmaHtml(): string {
  return [
    '<div style="margin-top:28px;padding-top:20px;border-top:1px solid #d8d4cc;">',
    `<img src="${ICONA_APP}" width="48" height="48" alt="Percorso MBSR" style="display:block;border:0;width:48px;height:48px;border-radius:10px;" />`,
    '<p style="margin:12px 0 0;font-family:Georgia,\'Times New Roman\',serif;font-size:12px;line-height:1.5;color:#5c584f;">',
    'Percorso MBSR è un progetto dell’Associazione ADS Hanuman, Via San Leonardo 10, Ariano Irpino (AV) — ',
    `<a href="${SITO_HANUMAN}" style="color:#3C5A48;text-decoration:underline;">hanumanstudio.it</a>`,
    ' — tutti i diritti sono riservati',
    '</p>',
    '</div>'
  ].join('')
}

export function testoConFirma(testo: string): string {
  return `${testo.trimEnd()}\n\n—\n${FIRMA_TESTO}`
}

export function htmlConFirma(testo: string): string {
  const corpo = escapeHtml(testo).replace(/\n/g, '<br>')
  return [
    '<!DOCTYPE html><html><body style="margin:0;padding:16px 12px;background:#f6f4ef;">',
    '<div style="max-width:560px;font-family:Georgia,\'Times New Roman\',serif;font-size:16px;line-height:1.55;color:#2c2a26;">',
    corpo,
    firmaHtml(),
    '</div></body></html>'
  ].join('')
}
