import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import StatoAttesa from './StatoAttesa.jsx'

export default function SoloFacilitatore({ children }) {
  const { caricamento, facilitatore } = useAuth()

  if (caricamento) return <StatoAttesa />
  if (!facilitatore) return <Navigate to="/accedi" replace />
  return children
}
