import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePartecipante } from '../lib/partecipante.jsx'

export default function SoloRegistrato({ children }) {
  const { caricamento: authLoad, facilitatore } = useAuth()
  const { caricamento, registrato } = usePartecipante()
  const location = useLocation()

  if (authLoad || caricamento) return <p>Caricamento…</p>
  if (facilitatore || registrato) return children
  return <Navigate to="/entra" replace state={{ da: location.pathname }} />
}
