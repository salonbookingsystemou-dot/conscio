import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import ScegliSfondo from './ScegliSfondo.jsx'
import {
  creaAutore,
  GRUPPI_TAG,
  leggiAutori,
  leggiSchedaVetrina,
  leggiTag,
  LICENZE,
  mancaPerPubblicare,
  normalizzaSlug,
  salvaSchedaVetrina,
  slugDaTitolo,
  urlAscolta,
  VOCI_REVISIONE
} from '../lib/vetrina.js'

const VUOTO = {
  slug: '',
  sfondo_tipo: '',
  sfondo_fonte: '',
  sfondo_url: '',
  sfondo_poster_url: '',
  sfondo_fonte_id: '',
  sfondo_autore: '',
  sfondo_autore_link: '',
  sfondo_fuoco: 'centro',
  autore_id: '',
  licenza: '',
  fonte_url: '',
  permesso_nota: '',
  voce_tipo: '',
  voce_nome: '',
  revisione: {},
  stato_revisione: 'bozza',
  pubblica: false,
  in_evidenza_dal: '',
  tag_ids: []
}

function linkAccettabile(valore) {
  const testo = String(valore || '').trim()
  if (!testo) return true
  try {
    const url = new URL(testo)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

const ModuloVetrina = forwardRef(function ModuloVetrina({ tracciaId, titolo, descrizione }, ref) {
  const [scheda, setScheda] = useState(VUOTO)
  const [autori, setAutori] = useState([])
  const [tag, setTag] = useState([])
  const [pronta, setPronta] = useState(false)
  const [slugModificato, setSlugModificato] = useState(false)
  const [nuovo, setNuovo] = useState(false)
  const [nomeAutore, setNomeAutore] = useState('')
  const [linkNuovo, setLinkNuovo] = useState('')
  const [scegli, setScegli] = useState(false)
  const [errore, setErrore] = useState('')
  const titoloRef = useRef(titolo)
  titoloRef.current = titolo

  useEffect(() => {
    let vivo = true
    setPronta(false)
    Promise.all([leggiSchedaVetrina(tracciaId), leggiAutori(), leggiTag()])
      .then(([dati, listaAutori, listaTag]) => {
        if (!vivo) return
        const slug = dati.slug || slugDaTitolo(titoloRef.current)
        setScheda({
          ...VUOTO,
          ...dati,
          slug,
          autore_id: dati.autore_id || '',
          licenza: dati.licenza || '',
          voce_tipo: dati.voce_tipo || '',
          sfondo_fuoco: dati.sfondo_fuoco || 'centro',
          in_evidenza_dal: dati.in_evidenza_dal ? String(dati.in_evidenza_dal).slice(0, 10) : '',
          revisione: dati.revisione || {},
          tag_ids: dati.tag_ids || []
        })
        setSlugModificato(Boolean(dati.slug))
        setAutori(listaAutori)
        setTag(listaTag)
        setPronta(true)
      })
      .catch(() => {
        if (vivo) setErrore('Non è stato possibile leggere la scheda della vetrina.')
      })
    return () => { vivo = false }
  }, [tracciaId])

  useEffect(() => {
    if (!pronta || slugModificato) return
    setScheda(attuale => ({ ...attuale, slug: slugDaTitolo(titolo) }))
  }, [titolo, pronta, slugModificato])

  function aggiorna(campo, valore) {
    setScheda(attuale => ({ ...attuale, [campo]: valore }))
    setErrore('')
  }

  function spuntaRevisione(chiave, acceso) {
    setScheda(attuale => {
      const revisione = { ...attuale.revisione, [chiave]: acceso }
      const completa = VOCI_REVISIONE.every(([nome]) => revisione[nome])
      const stato = !completa && attuale.stato_revisione === 'approvata'
        ? 'in-revisione'
        : attuale.stato_revisione
      return { ...attuale, revisione, stato_revisione: stato }
    })
  }

  function alternaTag(id) {
    setScheda(attuale => {
      const presenti = new Set(attuale.tag_ids)
      if (presenti.has(id)) presenti.delete(id)
      else presenti.add(id)
      return { ...attuale, tag_ids: [...presenti] }
    })
  }

  async function aggiungiAutore() {
    const nome = nomeAutore.trim()
    if (!nome) {
      setErrore('Il nuovo autore ha bisogno di un nome.')
      return
    }
    if (!linkAccettabile(linkNuovo)) {
      setErrore('Il link dell’autore non è un indirizzo valido.')
      return
    }
    setErrore('')
    try {
      const creato = await creaAutore(nome, linkNuovo)
      setAutori(lista => [...lista, creato].sort((a, b) => a.nome.localeCompare(b.nome, 'it')))
      aggiorna('autore_id', creato.id)
      setNomeAutore('')
      setLinkNuovo('')
      setNuovo(false)
    } catch {
      setErrore('Non è stato possibile aggiungere l’autore.')
    }
  }

  useImperativeHandle(ref, () => ({
    async salva() {
      const fallisci = messaggio => {
        setErrore(messaggio)
        throw new Error(messaggio)
      }
      if (!pronta) fallisci('La scheda della vetrina è ancora in caricamento.')
      if (!linkAccettabile(scheda.fonte_url) || !linkAccettabile(scheda.sfondo_autore_link)) {
        fallisci('Uno dei link non è un indirizzo valido.')
      }
      const bozza = {
        ...scheda,
        descrizione,
        slug: String(scheda.slug || '').replace(/-+$/, '')
      }
      const manca = mancaPerPubblicare(bozza)
      try {
        await salvaSchedaVetrina(tracciaId, {
          ...bozza,
          pubblica: manca.length === 0 && scheda.pubblica
        }, scheda.tag_ids)
      } catch (err) {
        fallisci(err?.message || 'Non è stato possibile salvare la scheda della vetrina.')
      }
    }
  }))

  const revisioneCompleta = VOCI_REVISIONE.every(([chiave]) => scheda.revisione?.[chiave])
  const manca = mancaPerPubblicare({ ...scheda, descrizione })
  const credito = scheda.sfondo_autore
    ? `${scheda.sfondo_tipo === 'video' ? 'Video' : 'Foto'} di ${scheda.sfondo_autore}`
    : ''

  if (!pronta && !errore) return <p className="hint">Caricamento della scheda vetrina…</p>

  return (
    <section className="vetrina-scheda" aria-label="Vetrina">
      <h3>Vetrina</h3>
      <p className="hint">
        Questi campi servono alla pagina pubblica. La traccia resta fuori finché non la pubblichi, e la pubblicazione chiede revisione, autore, licenza, voce e sfondo.
      </p>

      <div className="field">
        <label htmlFor="vetrina-slug">Slug</label>
        <input
          id="vetrina-slug"
          value={scheda.slug}
          onChange={e => {
            setSlugModificato(true)
            aggiorna('slug', normalizzaSlug(e.target.value))
          }}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {scheda.slug && <p className="hint">{urlAscolta(String(scheda.slug).replace(/-+$/, ''))}</p>}
      </div>

      <div className="vetrina-blocco">
        <p className="vetrina-etichetta">Sfondo</p>
        {scheda.sfondo_poster_url || scheda.sfondo_url ? (
          <img className="vetrina-anteprima" src={scheda.sfondo_poster_url || scheda.sfondo_url} alt="" />
        ) : (
          <p className="hint">Nessuno sfondo. Senza, la traccia non si può pubblicare.</p>
        )}
        {credito && <p className="hint">{credito}</p>}
        {scheda.sfondo_tipo === 'video' && (
          <p className="hint">In pagina il video va in loop, senza audio. L’anteprima copre anche chi preferisce meno movimento.</p>
        )}
        <div className="dialogo-azioni">
          <button type="button" className="btn btn-tonal" onClick={() => setScegli(true)}>Scegli lo sfondo</button>
          {scheda.sfondo_url && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setScheda(attuale => ({
                ...attuale,
                sfondo_tipo: '',
                sfondo_fonte: '',
                sfondo_url: '',
                sfondo_poster_url: '',
                sfondo_fonte_id: '',
                sfondo_autore: '',
                sfondo_autore_link: ''
              }))}
            >
              Togli sfondo
            </button>
          )}
        </div>
      </div>

      <div className="field">
        <label htmlFor="vetrina-autore">Autore del testo</label>
        <select id="vetrina-autore" value={scheda.autore_id} onChange={e => aggiorna('autore_id', e.target.value)}>
          <option value="">Nessuno</option>
          {autori.map(autore => (
            <option key={autore.id} value={autore.id}>{autore.nome}</option>
          ))}
        </select>
      </div>
      {nuovo ? (
        <div className="vetrina-blocco">
          <div className="field">
            <label htmlFor="nuovo-autore">Nome</label>
            <input id="nuovo-autore" value={nomeAutore} onChange={e => setNomeAutore(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="nuovo-autore-link">Link</label>
            <input id="nuovo-autore-link" type="url" placeholder="https://" value={linkNuovo} onChange={e => setLinkNuovo(e.target.value)} />
          </div>
          <div className="dialogo-azioni">
            <button type="button" className="btn" onClick={aggiungiAutore}>Aggiungi</button>
            <button type="button" className="btn btn-ghost" onClick={() => setNuovo(false)}>Annulla</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={() => setNuovo(true)}>+ Nuovo autore</button>
      )}

      <div className="field">
        <label htmlFor="vetrina-licenza">Licenza</label>
        <select id="vetrina-licenza" value={scheda.licenza} onChange={e => aggiorna('licenza', e.target.value)}>
          <option value="">Da scegliere</option>
          {LICENZE.map(voce => (
            <option key={voce.valore} value={voce.valore}>{voce.etichetta}</option>
          ))}
        </select>
      </div>
      {scheda.licenza === 'permesso-autore' && (
        <div className="field">
          <label htmlFor="vetrina-permesso">Nota sul permesso</label>
          <textarea
            id="vetrina-permesso"
            rows={2}
            value={scheda.permesso_nota || ''}
            onChange={e => aggiorna('permesso_nota', e.target.value)}
          />
        </div>
      )}
      <div className="field">
        <label htmlFor="vetrina-fonte">Fonte, se arriva da un video o da un testo altrui</label>
        <input
          id="vetrina-fonte"
          type="url"
          placeholder="https://"
          value={scheda.fonte_url || ''}
          onChange={e => aggiorna('fonte_url', e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="vetrina-voce">Voce</label>
        <select id="vetrina-voce" value={scheda.voce_tipo} onChange={e => aggiorna('voce_tipo', e.target.value)}>
          <option value="">Da scegliere</option>
          <option value="sintetica">Sintetica</option>
          <option value="umana">Umana</option>
        </select>
      </div>
      {scheda.voce_tipo === 'umana' && (
        <div className="field">
          <label htmlFor="vetrina-voce-nome">Nome di chi ha prestato la voce</label>
          <input
            id="vetrina-voce-nome"
            value={scheda.voce_nome || ''}
            onChange={e => aggiorna('voce_nome', e.target.value)}
          />
        </div>
      )}
      {scheda.voce_tipo === 'sintetica' && (
        <p className="hint">In pagina compare «Voce sintetica (ElevenLabs)».</p>
      )}

      {GRUPPI_TAG.map(([gruppo, etichetta]) => {
        const voci = tag.filter(voce => voce.gruppo === gruppo)
        if (!voci.length) return null
        return (
          <fieldset key={gruppo} className="vetrina-tag">
            <legend>{etichetta}</legend>
            {voci.map(voce => (
              <label key={voce.id} className="vetrina-spunta">
                <input
                  type="checkbox"
                  checked={scheda.tag_ids.includes(voce.id)}
                  onChange={() => alternaTag(voce.id)}
                />
                <span>{voce.etichetta}</span>
              </label>
            ))}
          </fieldset>
        )
      })}

      <fieldset className="vetrina-tag">
        <legend>Revisione</legend>
        <p className="hint">Si può segnare approvata solo se tutte e quattro le voci sono spuntate.</p>
        {VOCI_REVISIONE.map(([chiave, etichetta]) => (
          <label key={chiave} className="vetrina-spunta">
            <input
              type="checkbox"
              checked={Boolean(scheda.revisione?.[chiave])}
              onChange={e => spuntaRevisione(chiave, e.target.checked)}
            />
            <span>{etichetta}</span>
          </label>
        ))}
      </fieldset>

      <div className="field">
        <label htmlFor="vetrina-stato">Stato della revisione</label>
        <select
          id="vetrina-stato"
          value={scheda.stato_revisione}
          onChange={e => aggiorna('stato_revisione', e.target.value)}
        >
          <option value="bozza">Bozza</option>
          <option value="in-revisione">In revisione</option>
          <option value="approvata" disabled={!revisioneCompleta}>Approvata</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="vetrina-evidenza">In evidenza dal</label>
        <input
          id="vetrina-evidenza"
          type="date"
          value={scheda.in_evidenza_dal || ''}
          onChange={e => aggiorna('in_evidenza_dal', e.target.value)}
        />
        <p className="hint">La meditazione della settimana è la più recente fra quelle con questa data già arrivata.</p>
      </div>

      <label className="vetrina-spunta">
        <input
          type="checkbox"
          checked={Boolean(scheda.pubblica) && manca.length === 0}
          disabled={manca.length > 0}
          onChange={e => aggiorna('pubblica', e.target.checked)}
        />
        <span>Pubblica nella vetrina</span>
      </label>
      {manca.length > 0 && (
        <p className="campo-errore">Per pubblicare manca: {manca.join(', ')}.</p>
      )}
      {errore && <p className="avviso-errore" role="alert">{errore}</p>}

      {scegli && (
        <ScegliSfondo
          onChiudi={() => setScegli(false)}
          onConferma={campi => {
            setScheda(attuale => ({ ...attuale, ...campi }))
            setScegli(false)
          }}
        />
      )}
    </section>
  )
})

export default ModuloVetrina
