// Email a Dimitri dopo ogni esecuzione: lettera programmata (con anteprima), ferma (con i motivi) o errore.

import { composiLettera } from '../../supabase/functions/_shared/letteraSettimanale.ts'
import { escapeHtml, htmlConCorpo, testoConFirma } from '../../supabase/functions/_shared/firmaEmail.ts'
import { EMAIL } from '../../supabase/functions/_shared/stileEmail.ts'
import { SITO } from './config.mjs'

const LINK_SCHEDA = `${SITO}/#/admin/comunicazioni?scheda=lettera`

export function oraItaliana(istante) {
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(new Date(istante))
}

function paragrafi(righe) {
  return righe.map((r) => `<p style="margin:0 0 12px;">${escapeHtml(r)}</p>`).join('')
}

function pulsante(etichetta) {
  return `<p style="margin:18px 0 24px;"><a href="${LINK_SCHEDA}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:${EMAIL.accent};color:${EMAIL.surface};font-weight:600;text-decoration:none;">${escapeHtml(etichetta)}</a></p>`
}

/** Testo e HTML della notifica. Pura: testata con dati finti. */
function quando(istante, adesso) {
  const giorno = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date(d))
  if (giorno(istante) === giorno(adesso)) return 'oggi'
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long' }).format(new Date(istante))
}

export function componiNotifica({ esito, bozza, motivi = [], errore, invito, adesso = new Date() }) {
  if (esito === 'programmata') {
    const ora = oraItaliana(bozza.invio_previsto_il)
    const giorno = quando(bozza.invio_previsto_il, adesso)
    const n = bozza.voci.length
    const oggetto = `La lettera parte ${giorno} alle ${ora} · ${n} notizie`
    const intro = [
      `La lettera di questa settimana è pronta e parte da sola ${giorno} alle ${ora}.`,
      'Fino ad allora puoi correggerla, bloccarla o inviarla subito dalla scheda «Lettera settimanale».'
    ]
    const anteprima = composiLettera({ bozza, invito, linkUscita: `${SITO}/#/lettera/esci` })
    return {
      oggetto,
      testo: testoConFirma([...intro, '', `Rivedila qui: ${LINK_SCHEDA}`, '', '— Anteprima —', '', anteprima.testo].join('\n')),
      // L'anteprima ha già la sua firma: si mette sotto, dentro un riquadro.
      html: htmlConCorpo(
        paragrafi(intro) + pulsante('Rivedi la lettera') +
        `<p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${EMAIL.muted};">Anteprima · oggetto: ${escapeHtml(bozza.oggetto)}</p>` +
        `<div style="border:1px solid ${EMAIL.border};border-radius:14px;overflow:hidden;">${anteprima.html.replace(/^.*?<body[^>]*>|<\/body>.*$/gs, '')}</div>`
      )
    }
  }
  if (esito === 'da_rivedere') {
    const intro = ['La lettera di questa settimana non parte da sola. Ecco perché:']
    return {
      oggetto: 'La lettera di questa settimana non parte da sola',
      testo: testoConFirma([...intro, '', ...motivi.map((m) => `• ${m}`), '', `Puoi correggerla e programmarla da qui: ${LINK_SCHEDA}`].join('\n')),
      html: htmlConCorpo(
        paragrafi(intro) +
        `<ul style="margin:0 0 14px;padding-left:20px;">${motivi.map((m) => `<li style="margin:0 0 6px;">${escapeHtml(m)}</li>`).join('')}</ul>` +
        paragrafi(['Puoi correggerla e programmarla dalla scheda «Lettera settimanale».']) + pulsante('Apri la scheda')
      )
    }
  }
  const righe = ['La preparazione della lettera di questa settimana si è fermata per un errore.', '', `Errore: ${errore || 'sconosciuto'}`, '', 'Puoi rilanciarla da GitHub (Azioni → Lettera settimanale → Run workflow) o scriverla a mano dalla scheda.']
  return {
    oggetto: 'La lettera di questa settimana non è stata preparata',
    testo: testoConFirma(righe.join('\n')),
    html: htmlConCorpo(paragrafi(righe.filter(Boolean)) + pulsante('Apri la scheda'))
  }
}

export async function inviaNotifica({ apiKey, da, a, contenuto, log }) {
  if (!apiKey || !a) {
    log('notifica: RESEND_API_KEY o FACILITATORE_EMAIL mancanti, nessuna email')
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: da, to: [a], subject: contenuto.oggetto, text: contenuto.testo, html: contenuto.html }),
      signal: AbortSignal.timeout(20_000)
    })
    if (!res.ok) log(`notifica: Resend ${res.status} ${(await res.text()).slice(0, 200)}`)
    return res.ok
  } catch (err) {
    log(`notifica: ${err.message || err}`)
    return false
  }
}
