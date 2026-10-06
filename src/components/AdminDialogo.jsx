import { useEffect, useRef } from 'react'

export default function AdminDialogo({ titolo, children, onChiudi, className }) {
  const el = useRef(null)

  useEffect(() => {
    const dialog = el.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={el}
      className={['dialogo', className].filter(Boolean).join(' ')}
      onClose={onChiudi}
      onCancel={e => {
        e.preventDefault()
        onChiudi()
      }}
      onClick={e => {
        if (e.target === el.current) onChiudi()
      }}
    >
      <h2>{titolo}</h2>
      {children}
    </dialog>
  )
}
