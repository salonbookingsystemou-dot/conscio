import { useEffect, useState } from 'react'
import { osservaVetrina, vetrinaAperta } from './vetrina.js'

export default function useVetrinaAperta() {
  const [aperta, setAperta] = useState(false)

  useEffect(() => {
    let vivo = true
    const applica = () => {
      vetrinaAperta().then(valore => {
        if (vivo) setAperta(valore)
      }).catch(() => {})
    }
    applica()
    const smetti = osservaVetrina(applica)
    return () => {
      vivo = false
      smetti()
    }
  }, [])

  return aperta
}
