import { Component } from 'react'
import { descriviErrore } from '../lib/segnalazione.js'
import SegnalaProblema from './SegnalaProblema.jsx'

export default class ConfineErrori extends Component {
  constructor(props) {
    super(props)
    this.state = { errore: null, dettaglio: '' }
  }

  static getDerivedStateFromError(errore) {
    return { errore }
  }

  componentDidCatch(errore, info) {
    this.setState({ dettaglio: descriviErrore(errore, info?.componentStack) })
  }

  render() {
    if (!this.state.errore) return this.props.children

    return (
      <div className={this.props.intero ? 'shell errore-app' : 'errore-app'}>
        <h2>Qualcosa non ha funzionato</h2>
        <p className="lead">
          Questa pagina si è interrotta per un errore dell’app. I tuoi dati già salvati non sono persi.
        </p>
        <p>
          <button type="button" className="btn btn-tonal" onClick={() => window.location.reload()}>
            Ricarica la pagina
          </button>
        </p>
        <div className="card">
          <h3>Aiutaci a correggerlo</h3>
          <SegnalaProblema errore={this.state.dettaglio || descriviErrore(this.state.errore)} />
        </div>
      </div>
    )
  }
}
