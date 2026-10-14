import { useEffect, useState } from 'react'

// Classi di finestra di Material 3, con i valori di --bp-media, --bp-espansa e --bp-ampia (tokens.css).
const MEDIA = '(min-width: 600px)'
const ESPANSA = '(min-width: 840px)'
const AMPIA = '(min-width: 1200px)'

function leggi() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'ampia'
  if (window.matchMedia(AMPIA).matches) return 'ampia'
  if (window.matchMedia(ESPANSA).matches) return 'espansa'
  if (window.matchMedia(MEDIA).matches) return 'media'
  return 'compatta'
}

/** 'compatta' (< 600) · 'media' (600–839) · 'espansa' (840–1199) · 'ampia' (≥ 1200). */
export default function useClasseFinestra() {
  const [classe, setClasse] = useState(leggi)

  useEffect(() => {
    const liste = [MEDIA, ESPANSA, AMPIA].map(q => window.matchMedia(q))
    const aggiorna = () => setClasse(leggi())
    liste.forEach(l => l.addEventListener('change', aggiorna))
    aggiorna()
    return () => liste.forEach(l => l.removeEventListener('change', aggiorna))
  }, [])

  return classe
}

/** Vero da 'espansa' in su: c'è posto per due pannelli affiancati. */
export function dueColonne(classe) {
  return classe === 'espansa' || classe === 'ampia'
}
