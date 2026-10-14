import { useState } from 'react'
import { Link } from 'react-router-dom'
import EditorSplash, { AnteprimaSplash } from '../../components/EditorSplash.jsx'
import EditorVetrina from '../../components/EditorVetrina.jsx'
import PaginaAdmin from '../../components/admin/PaginaAdmin.jsx'
import { AreaPrincipale, PannelloSupporto } from '../../components/admin/Pannelli.jsx'

export default function Sito() {
  const [splash, setSplash] = useState({ frase: '', cta: '' })

  return (
    <PaginaAdmin
      titolo="Sito"
      meta="La prima schermata e la pagina pubblica Ascolta."
      azione={(
        <Link className="btn btn-ghost" to="/ascolta" target="_blank" rel="noopener noreferrer">
          Apri Ascolta
        </Link>
      )}
      layout="supporto"
    >
      <AreaPrincipale>
        <EditorSplash onCambio={setSplash} />
        <EditorVetrina />
      </AreaPrincipale>
      <PannelloSupporto etichetta="Anteprima della prima schermata">
        <p className="pannello-supporto-occhiello">Anteprima · prima schermata</p>
        <AnteprimaSplash frase={splash.frase} cta={splash.cta} />
      </PannelloSupporto>
    </PaginaAdmin>
  )
}
