import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const NUMERI_SETTIMANA = [1, 2, 3, 4, 5, 6, 7, 8, 9]

function etichettaSettimana(numero) {
  return numero === 9 ? 'Intensiva' : `Settimana ${numero}`
}

function settimanaPronta(lezione) {
  return Boolean(lezione?.tema && String(lezione.tema).trim())
}

export default function Percorso() {
  const [search, setSearch] = useSearchParams()
  const [cicli, setCicli] = useState([])
  const [lezioni, setLezioni] = useState([])
  const [errore, setErrore] = useState(null)
  const cicloId = search.get('ciclo') || ''

  useEffect(() => {
    let vivo = true
    supabase
      .from('cicli')
      .select('id, nome_ciclo, stato')
      .order('data_inizio', { ascending: false })
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) {
          setErrore('Non è stato possibile leggere i cicli.')
          return
        }
        const lista = data || []
        setCicli(lista)
        const attuale = search.get('ciclo')
        if (attuale && lista.some(c => c.id === attuale)) return
        if (lista[0]?.id) {
          setSearch({ ciclo: lista[0].id }, { replace: true })
        }
      })
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    let vivo = true
    if (!cicloId) {
      setLezioni([])
      return undefined
    }
    supabase
      .from('lezioni')
      .select('id, numero_settimana, tema')
      .eq('ciclo_id', cicloId)
      .order('numero_settimana', { ascending: true })
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) {
          setErrore('Non è stato possibile leggere le settimane.')
          setLezioni([])
          return
        }
        setErrore(null)
        setLezioni(data || [])
      })
    return () => { vivo = false }
  }, [cicloId])

  const perNumero = useMemo(() => {
    const mappa = {}
    for (const l of lezioni) mappa[l.numero_settimana] = l
    return mappa
  }, [lezioni])

  return (
    <>
      <header className="admin-page-head">
        <h1>Percorso</h1>
        <p>Scegli il ciclo, poi la settimana da modificare.</p>
      </header>

      <div className="percorso-ciclo">
        <label htmlFor="percorso-ciclo">Ciclo</label>
        <select
          id="percorso-ciclo"
          value={cicloId}
          onChange={e => setSearch(e.target.value ? { ciclo: e.target.value } : {}, { replace: true })}
        >
          {cicli.length === 0 && <option value="">Nessun ciclo</option>}
          {cicli.map(c => (
            <option key={c.id} value={c.id}>
              {c.nome_ciclo} ({c.stato})
            </option>
          ))}
        </select>
      </div>

      {errore && <p className="admin-alert" role="alert">{errore}</p>}

      {cicloId && (
        <div className="percorso-griglia">
          {NUMERI_SETTIMANA.map(n => {
            const lezione = perNumero[n]
            const pronta = settimanaPronta(lezione)
            const tema = String(lezione?.tema || '').trim()
            return (
              <Link
                key={n}
                className={`percorso-card${pronta ? ' is-pronta' : ' is-vuota'}`}
                to={`/percorso/${cicloId}/settimana/${n}`}
              >
                <span className="percorso-card-capo">
                  <strong>{etichettaSettimana(n)}</strong>
                  <span className={`percorso-badge${pronta ? ' is-pronta' : ''}`}>
                    {pronta ? 'Pronta' : 'Da creare'}
                  </span>
                </span>
                {tema ? <span>{tema}</span> : <em>Da compilare</em>}
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
