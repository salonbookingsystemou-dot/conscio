import { useEffect, useRef } from 'react'

export default function DialogConferma({
  aperto,
  titolo,
  children,
  confermaEtichetta = 'Conferma',
  annullaEtichetta = 'Annulla',
  pericolo = false,
  occupato = false,
  onConferma,
  onAnnulla
}) {
  const el = useRef(null)

  useEffect(() => {
    const dialog = el.current
    if (!dialog) return
    if (aperto && !dialog.open) dialog.showModal()
    if (!aperto && dialog.open) dialog.close()
  }, [aperto])

  useEffect(() => {
    if (!aperto) return undefined
    const precedente = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = precedente
    }
  }, [aperto])

  function chiudi() {
    if (!occupato) onAnnulla?.()
  }

  return (
    <dialog
      ref={el}
      className="dialog-conferma"
      onClose={chiudi}
      onCancel={e => {
        e.preventDefault()
        chiudi()
      }}
      onClick={e => {
        if (e.target === el.current) chiudi()
      }}
    >
      <h3>{titolo}</h3>
      {typeof children === 'string' ? <p>{children}</p> : children}
      <div className="azioni">
        <button
          className={pericolo ? 'btn btn-ghost btn-ciclo-elimina' : 'btn'}
          type="button"
          disabled={occupato}
          onClick={onConferma}
        >
          {occupato ? 'Un momento…' : confermaEtichetta}
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          disabled={occupato}
          onClick={chiudi}
        >
          {annullaEtichetta}
        </button>
      </div>
    </dialog>
  )
}
