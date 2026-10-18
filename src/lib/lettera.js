// «Restiamo in contatto»: avviso del prossimo ciclo e lettera settimanale.
// Gli iscritti non sono partecipanti: niente codici, niente dati dello studio.
import { chiamaPorta, supabase } from './supabaseClient'

export const LISTE = {
  avviso_ciclo: {
    titolo: 'Avviso del prossimo ciclo',
    riga: 'Una sola email, quando si aprono le iscrizioni.',
    nome: 'l’avviso del prossimo ciclo'
  },
  lettera: {
    titolo: 'Lettera settimanale',
    riga: 'Notizie, studi ed eventi di mindfulness in Italia e nel mondo.',
    nome: 'la lettera settimanale'
  }
}

export function emailValida(email) {
  return email.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** La risposta è sempre la stessa, che l’email sia nuova, già iscritta o cancellata. */
export function iscriviLettera({ email, avviso_ciclo, lettera }) {
  return chiamaPorta({ azione: 'iscrivi_lettera', email, avviso_ciclo, lettera })
}

export function confermaLettera(token) {
  return chiamaPorta({ azione: 'conferma_lettera', token })
}

export function esciLettera(tokenUscita, lista) {
  return chiamaPorta({ azione: 'esci_lettera', token_uscita: tokenUscita, ...(lista ? { lista } : {}) })
}

// ── Area facilitatore ────────────────────────────────────────────────────────

export async function leggiConteggiLettera(cicloId) {
  const { data, error } = await supabase.rpc('lettera_conteggi', cicloId ? { p_ciclo_id: cicloId } : {})
  if (error) throw error
  return data
}

export async function leggiLettereInviate(tipo) {
  let q = supabase
    .from('lettere_inviate')
    .select('id, tipo, ciclo_id, oggetto, destinatari, falliti, inviata_il')
    .order('inviata_il', { ascending: false })
    .limit(50)
  if (tipo) q = q.eq('tipo', tipo)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

/** { oggetto, corpo, prova?, tipo?: 'lettera' | 'avviso_ciclo', ciclo_id? } */
export async function inviaLettera(body) {
  const { data, error } = await supabase.functions.invoke('invia-lettera', { body })
  if (data && typeof data === 'object') return data
  const risposta = error?.context
  if (risposta && typeof risposta.json === 'function') {
    try {
      const parsed = await risposta.json()
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      /* corpo non json */
    }
  }
  throw error || new Error('INVIO_NON_RIUSCITO')
}

/** Messaggio per il facilitatore a partire dall’esito di invia-lettera. */
export function esitoInvio(esito, prova = false) {
  if (esito?.motivo === 'RESEND_NON_CONFIGURATO') return { errore: 'Non inviata: manca il servizio email sul server.' }
  if (esito?.motivo === 'NESSUN_DESTINATARIO') {
    return { errore: prova ? 'Non trovo l’email del tuo account: esci e rientra, poi riprova.' : 'Non c’è nessun iscritto confermato a cui scrivere.' }
  }
  if (esito?.motivo === 'TESTO_MANCANTE') return { errore: 'Servono oggetto e testo.' }
  if (esito?.motivo === 'CICLO_NON_IN_RECLUTAMENTO') return { errore: 'L’avviso parte solo per un ciclo in reclutamento.' }
  if (esito?.motivo === 'DESTINATARI_NON_LEGGIBILI') return { errore: 'Non è stato possibile leggere gli iscritti. Riprova tra un momento.' }
  if (!esito?.ok) return { errore: esito?.errore ? `Il servizio email ha rifiutato l’invio: ${esito.errore}` : 'L’invio non è andato a buon fine.' }
  if (prova) return { testo: 'Prova inviata alla tua email di accesso. Controlla anche lo spam' }
  const n = esito.inviate
  const testo = `Inviata a ${n} ${n === 1 ? 'iscritto' : 'iscritti'}`
  return esito.falliti > 0
    ? { testo, errore: `${n} invii riusciti, ${esito.falliti} non riusciti${esito.errore ? `: ${esito.errore}` : ''}.` }
    : { testo }
}
