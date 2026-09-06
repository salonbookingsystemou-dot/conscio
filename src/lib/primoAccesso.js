/** Quattro passi del primo accesso: benvenuto, domande, atteggiamenti, T0. */
export const PASSI_PRIMO_ACCESSO = 4

export function numeroPassoPrimoAccesso(id) {
  if (id === 'intro') return 1
  if (id === 'q1' || id === 'q2') return 2
  if (id === 'atteggiamenti') return 3
  if (id === 't0') return 4
  return 1
}

export function avanzamentoPrimoAccesso(numeroPasso, frazioneNelPasso = 1) {
  const precedenti = Math.max(0, numeroPasso - 1)
  const inQuesto = Math.min(1, Math.max(0, frazioneNelPasso))
  return Math.round(((precedenti + inQuesto) / PASSI_PRIMO_ACCESSO) * 100)
}
