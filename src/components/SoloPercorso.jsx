import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { destinazionePartecipante, usePartecipante } from '../lib/partecipante.jsx'
import StatoAttesa from './StatoAttesa.jsx'

/** Blocca Settimana / Storico / Avvisi finché onboarding + T0 non sono completi. */
export default function SoloPercorso({ children }) {
  const { caricamento: authLoad, facilitatore } = useAuth()
  const {
    caricamento,
    registrato,
    onboardingCompleto,
    t0Completo,
    percorsoPronto
  } = usePartecipante()
  const location = useLocation()

  if (authLoad || caricamento) return <StatoAttesa />
  if (facilitatore) return children
  if (!registrato) {
    return <Navigate to="/entra" replace state={{ da: location.pathname }} />
  }
  if (percorsoPronto) return children

  const dove = destinazionePartecipante({
    onboarding: onboardingCompleto,
    t0: t0Completo,
    pronto: false
  })
  return <Navigate to={dove} replace state={{ da: location.pathname }} />
}
