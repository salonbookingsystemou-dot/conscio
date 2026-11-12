import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { destinazionePartecipante, usePartecipante } from '../lib/partecipante.jsx'
import StatoAttesa from './StatoAttesa.jsx'

/**
 * Blocca Settimana / Storico / Avvisi finché onboarding + T0 non sono completi.
 * Con `pratica`, blocca anche finché c'è un questionario (T1, T2, T3) aperto e non compilato
 * e, dal giorno 57, finché la sequenza di fine percorso non è conclusa.
 */
export default function SoloPercorso({ children, pratica = true }) {
  const { caricamento: authLoad, facilitatore } = useAuth()
  const {
    codice,
    caricamento,
    registrato,
    onboardingCompleto,
    t0Completo,
    percorsoPronto,
    questionarioDaCompilare,
    conclusioneDaFare,
    aggiornaPercorso
  } = usePartecipante()
  const location = useLocation()

  // Un momento può aprirsi mentre l'app è già aperta: ricontrolla a ogni pagina del percorso.
  useEffect(() => {
    if (!facilitatore && registrato && codice && percorsoPronto) aggiornaPercorso(codice)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  if (authLoad || caricamento) return <StatoAttesa />
  if (facilitatore) return children
  if (!registrato) {
    return <Navigate to="/entra" replace state={{ da: location.pathname }} />
  }
  if (percorsoPronto && pratica && conclusioneDaFare) {
    return <Navigate to="/conclusione" replace state={{ da: location.pathname }} />
  }
  if (percorsoPronto && pratica && questionarioDaCompilare) {
    // Il T2 si compila dentro la sequenza di fine percorso.
    const dove = questionarioDaCompilare === 'T2' ? '/conclusione' : '/questionari'
    return <Navigate to={dove} replace state={{ da: location.pathname }} />
  }
  if (percorsoPronto) return children

  const dove = destinazionePartecipante({
    onboarding: onboardingCompleto,
    t0: t0Completo,
    pronto: false
  })
  return <Navigate to={dove} replace state={{ da: location.pathname }} />
}
