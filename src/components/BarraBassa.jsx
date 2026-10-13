import { usePartecipante } from '../lib/partecipante.jsx'
import BarraVoci from './BarraVoci.jsx'

function IconaQuestionari() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5.5" y="3.5" width="13" height="17" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function IconaSettimana() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="5.5" width="15" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.5 9.5h15M9 3.8v3.4M15 3.8v3.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function IconaStorico() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 16.5 9.2 11l3.3 3.6 6.5-8.1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19.2h14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function IconaAvvisi() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5 16.5h14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10.4 19.2a1.8 1.8 0 0 0 3.2 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

const VOCI = [
  { to: '/programma', label: 'Settimana', Icona: IconaSettimana },
  { to: '/questionari', label: 'Questionari', Icona: IconaQuestionari },
  { to: '/pratica', label: 'Storico', Icona: IconaStorico },
  { to: '/comunicazioni', label: 'Avvisi', Icona: IconaAvvisi }
]

export default function BarraBassa() {
  const { registrato, percorsoPronto } = usePartecipante()
  if (!registrato || !percorsoPronto) return null
  return <BarraVoci voci={VOCI} etichetta="Sezioni principali" />
}
