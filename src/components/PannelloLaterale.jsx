import { useEffect, useId, useRef } from 'react'

/**
 * Pannello che si apre di lato sopra un elenco: su schermo largo occupa la
 * destra, su telefono tutta la pagina. Esc, «Chiudi» e il clic fuori lo chiudono.
 */
export default function PannelloLaterale({ titolo, sopratitolo, onChiudi, children }) {
  const ref = useRef(null)
  const id = useId()

  useEffect(() => {
    const nodo = ref.current
    if (nodo && !nodo.open) nodo.showModal?.()
    const prima = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prima
      if (nodo?.open) nodo.close()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className="pannello"
      aria-labelledby={id}
      onCancel={e => { e.preventDefault(); onChiudi() }}
      onClick={e => { if (e.target === ref.current) onChiudi() }}
    >
      <div className="pannello-interno">
        <header className="pannello-testa">
          <div>
            {sopratitolo && <p className="pannello-sopratitolo">{sopratitolo}</p>}
            <h2 id={id}>{titolo}</h2>
          </div>
          <button type="button" className="btn btn-ghost is-piccolo" onClick={onChiudi}>
            Chiudi
          </button>
        </header>
        <div className="pannello-corpo">{children}</div>
      </div>
    </dialog>
  )
}
