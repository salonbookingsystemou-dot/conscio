import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'

/**
 * Barra fissa in basso su telefono, comune a partecipante e facilitatore.
 * `voci`: [{ to, label, Icona, badge? }]. Quando un badge è > 0 compare un numero sull'icona.
 */
export default function BarraVoci({ voci, etichetta, className }) {
  useEffect(() => {
    document.body.classList.add('has-barra-bassa')
    return () => document.body.classList.remove('has-barra-bassa')
  }, [])

  return (
    <nav className={['barra-bassa', className].filter(Boolean).join(' ')} aria-label={etichetta}>
      {voci.map(({ to, label, Icona, badge }) => (
        <NavLink key={to} to={to} className="barra-bassa-voce">
          <span className="barra-bassa-icona">
            <Icona />
            {badge > 0 && <span className="barra-bassa-badge" aria-hidden="true">{badge}</span>}
          </span>
          <span>{label}</span>
          {badge > 0 && <span className="visually-hidden">, {badge} da fare</span>}
        </NavLink>
      ))}
    </nav>
  )
}
