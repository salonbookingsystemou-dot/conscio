// Controlli obbligatori per l'invio automatico (sez. 4 del brief). Funzione pura:
// riceve la bozza e ciò che lo script ha già misurato (link che rispondono, errori, impostazioni).

import { GIORNI_VALIDITA, MAX_VOCI, MIN_VOCI } from './config.mjs'
import { giorniTra, trovaParoleVietate } from './testi.mjs'

/**
 * @returns {{ ok: boolean, motivi: string[] }} motivi in italiano, da mostrare a Dimitri.
 */
export function controllaBozza(bozza, { oggi, linkOk = {}, paroleVietate = [], errori = [], invioAutomatico = true, giaInviata = false }) {
  const motivi = []
  const voci = bozza.voci || []

  if (voci.length < MIN_VOCI) motivi.push(`Ci sono ${voci.length} notizie valide: ne servono almeno ${MIN_VOCI}.`)
  if (voci.length > MAX_VOCI) motivi.push(`Ci sono ${voci.length} notizie: al massimo ${MAX_VOCI}.`)

  voci.forEach((v, i) => {
    const n = `Notizia ${i + 1} («${v.titolo}»)`
    if (v.verifica !== 'verificata') motivi.push(`${n}: da controllare. ${v.nota_verifica || ''}`.trim())
    if (!v.url) motivi.push(`${n}: manca il link alla fonte.`)
    else if (linkOk[v.url] !== true) motivi.push(`${n}: il link alla fonte non risponde.`)
    if (!v.data) motivi.push(`${n}: manca la data.`)
    else {
      const eta = giorniTra(v.data, oggi)
      if (eta > GIORNI_VALIDITA) motivi.push(`${n}: è di ${eta} giorni fa (al massimo ${GIORNI_VALIDITA}).`)
      if (eta < -1) motivi.push(`${n}: la data è nel futuro (${v.data}).`)
    }
    if (!v.sunto?.trim()) motivi.push(`${n}: manca il sunto.`)
    if (!v.fonte?.trim()) motivi.push(`${n}: manca il nome della fonte.`)
  })

  const testoTutto = [bozza.oggetto, bozza.introduzione, ...voci.flatMap((v) => [v.titolo, v.sunto, v.perche_conta, v.tipo_studio])]
    .filter(Boolean)
    .join('\n')
  const vietate = trovaParoleVietate(testoTutto, paroleVietate)
  if (vietate.length) motivi.push(`Compaiono parole da evitare: ${vietate.map((p) => `«${p}»`).join(', ')}.`)

  if (!bozza.oggetto?.trim()) motivi.push('Manca l’oggetto.')
  if (!bozza.introduzione?.trim()) motivi.push('Manca l’introduzione.')
  if (!bozza.meditazione?.slug) motivi.push('Manca la meditazione della settimana (vetrina vuota o spenta).')
  for (const e of errori) motivi.push(`Errore durante la preparazione: ${e}`)
  if (!invioAutomatico) motivi.push('L’invio automatico è spento.')
  if (giaInviata) motivi.push('Questa settimana è già partita una lettera.')

  return { ok: motivi.length === 0, motivi }
}
