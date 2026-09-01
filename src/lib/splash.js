import { supabase, supabaseConfigurato } from './supabaseClient'

export const SPLASH_DEFAULT = {
  frase: 'La pratica comincia qui, in questo momento.',
  cta: 'Prosegui'
}

export async function leggiSplash() {
  if (!supabaseConfigurato) return SPLASH_DEFAULT
  const { data, error } = await supabase
    .from('splash_sito')
    .select('frase, cta')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return SPLASH_DEFAULT
  return {
    frase: (data.frase || '').trim() || SPLASH_DEFAULT.frase,
    cta: (data.cta || '').trim() || SPLASH_DEFAULT.cta
  }
}

export async function salvaSplash({ frase, cta }) {
  const testo = (frase || '').trim()
  const pulsante = (cta || '').trim() || SPLASH_DEFAULT.cta
  if (!testo) throw new Error('FRASE_MANCANTE')
  const { error } = await supabase
    .from('splash_sito')
    .update({ frase: testo, cta: pulsante, aggiornato_il: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
  return { frase: testo, cta: pulsante }
}
