// Icone a tratto dell'area facilitatore (24×24, tratto 1.7), come nei mockup del framework.
function Icona({ children, className }) {
  return (
    <svg className={['icona-admin', className].filter(Boolean).join(' ')} viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

export function IconaCicli(props) {
  return <Icona {...props}><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v4h-4" /></Icona>
}

export function IconaTracce(props) {
  return <Icona {...props}><path d="M4 10v4M8 6v12M12 3v18M16 8v8M20 11v2" /></Icona>
}

export function IconaPosta(props) {
  return <Icona {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Icona>
}

export function IconaSito(props) {
  return <Icona {...props}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Icona>
}

export function IconaEsci(props) {
  return <Icona {...props}><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></Icona>
}

export function IconaPiu(props) {
  return <Icona {...props}><path d="M12 5v14M5 12h14" /></Icona>
}

export function IconaIndietro(props) {
  return <Icona {...props}><path d="M19 12H5M11 6l-6 6 6 6" /></Icona>
}

export function IconaAltro(props) {
  return (
    <Icona {...props}>
      <circle cx="12" cy="5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="19" r="1.2" />
    </Icona>
  )
}

export function IconaChiudi(props) {
  return <Icona {...props}><path d="M6 6l12 12M18 6 6 18" /></Icona>
}

export function IconaGiu(props) {
  return <Icona {...props}><path d="m6 9 6 6 6-6" /></Icona>
}

export const ICONE_SEZIONE = {
  cicli: IconaCicli,
  tracce: IconaTracce,
  posta: IconaPosta,
  sito: IconaSito
}
