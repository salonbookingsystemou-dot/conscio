// Le quattro sezioni dell'area facilitatore, con l'azione principale che il guscio
// mostra nel rail (FAB su telefono). La barra della pagina non la ripete.
export const SEZIONI = [
  { id: 'cicli', etichetta: 'Cicli', icona: 'cicli', azione: { etichetta: 'Nuovo ciclo', a: '/admin/cicli?nuovo=1' } },
  { id: 'tracce', etichetta: 'Tracce', icona: 'tracce', azione: { etichetta: 'Nuova traccia', a: '/admin/tracce/nuova' } },
  { id: 'comunicazioni', etichetta: 'Comunicazioni', icona: 'posta', azione: { etichetta: 'Nuova comunicazione', a: '/admin/comunicazioni?nuova=1' } },
  { id: 'sito', etichetta: 'Sito', icona: 'sito', azione: null }
]

export function percorsoSezione(sezione) {
  return `/admin/${sezione.id}`
}

/** Sezione attiva dal primo segmento dopo /admin. */
export function sezioneDa(pathname) {
  const segmento = pathname.split('/')[2] || ''
  return SEZIONI.find(s => s.id === segmento) || null
}
