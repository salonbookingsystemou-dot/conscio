import { useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import SchedaPratica from '../../../components/SchedaPratica.jsx'
import { codiciPerCiclo } from '../../../lib/cicli.js'

export default function Pratica() {
  const { ciclo, tutteIscrizioni, log } = useOutletContext()
  const codici = useMemo(
    () => codiciPerCiclo(tutteIscrizioni).get(ciclo.id) || [],
    [tutteIscrizioni, ciclo.id]
  )
  return <SchedaPratica ciclo={ciclo} codici={codici} log={log} />
}
