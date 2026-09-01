import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'

export default function SoloFacilitatore({ children }) {
  const { caricamento, facilitatore } = useAuth()

  if (caricamento) return <p>Caricamento…</p>
  if (!facilitatore) return <Navigate to="/accedi" replace />
  return children
}
