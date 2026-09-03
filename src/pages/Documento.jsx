import { Link, Navigate, useParams } from 'react-router-dom'
import { EMAIL_CONTATTO, GARANTE_URL, SITO_APP, STRUMENTI, TITOLARE } from '../lib/contatti.js'

const MAIL = <a href={`mailto:${EMAIL_CONTATTO}`}>{EMAIL_CONTATTO}</a>

const DOCS = {
  informativa: {
    titolo: 'Informativa sul trattamento dei dati',
    badge: 'Art. 13 GDPR',
    lead: 'Questo testo ti dice chi è il titolare, quali dati usiamo, su quale base e quali diritti hai. Va letto prima di iscriverti. Non è un consenso: i consensi sono nei Moduli A e B.'
  },
  'modulo-a': {
    titolo: 'Modulo A — consenso alla partecipazione',
    badge: 'Obbligatorio',
    lead: 'Serve per entrare nel percorso. Non include la documentazione social: quella è solo nel Modulo B, che resta facoltativo.'
  },
  'modulo-b': {
    titolo: 'Modulo B — documentazione social',
    badge: 'Facoltativo',
    lead: 'Non è richiesto per partecipare. Puoi rifiutarlo o ritirarlo in qualsiasi momento senza conseguenze sul percorso.'
  },
  diritti: {
    titolo: 'Come esercitare i tuoi diritti',
    badge: 'Procedura',
    lead: 'Passi concreti per accesso, portabilità, correzione e cancellazione. Vale per questo percorso pilota.'
  },
  'uso-punteggi': {
    titolo: 'Uso dei punteggi PSS-10 e FFMQ-I',
    badge: 'Protocollo',
    lead: 'Limiti di lettura dei numeri per chi partecipa e per chi conduce il percorso. Non è un uso clinico.'
  }
}

function Informativa() {
  return (
    <>
      <h3>1. Chi tratta i dati</h3>
      <p>
        <strong>Titolare del trattamento:</strong> {TITOLARE.nome}, {TITOLARE.ruolo}.
        Sede: {TITOLARE.indirizzo}. Contesto: {TITOLARE.contesto}.
      </p>
      <p>
        Recapito: {MAIL}. Sito dell’applicazione:{' '}
        <a href={SITO_APP}>{SITO_APP}</a>.
      </p>
      <p>{TITOLARE.nota}</p>

      <h3>2. Perché trattiamo i dati e su quale base</h3>
      <ul>
        <li>
          <strong>Iscrizione e accesso</strong> (email, ciclo, codice, consenso A):
          art. 6, par. 1, lett. b) GDPR — misure precontrattuali e gestione della
          partecipazione che hai chiesto.
        </li>
        <li>
          <strong>Comunicazioni operative</strong> (esito screening, avvisi, promemoria):
          art. 6, par. 1, lett. b) GDPR — far funzionare il percorso a cui ti sei iscritto.
        </li>
        <li>
          <strong>Questionari, onboarding e log di pratica</strong> (PSS-10, FFMQ-I, note,
          ascolti, tono): art. 6, par. 1, lett. a) e, se descrivono come stai,
          art. 9, par. 2, lett. a) GDPR — consenso esplicito nel Modulo A, per il
          percorso e lo studio pilota. Le risposte si legano al codice, non al nome.
        </li>
        <li>
          <strong>Documentazione social</strong>: art. 6, par. 1, lett. a) GDPR —
          consenso separato nel Modulo B.
        </li>
        <li>
          <strong>Prove di consenso e sicurezza dell’app</strong>: art. 6, par. 1, lett. c)
          e f) GDPR — dimostrare i consensi e tenere l’applicazione utilizzabile.
        </li>
      </ul>
      <p>
        Il percorso resta una pratica di meditazione sulla consapevolezza a scopo
        educativo e divulgativo: non è una diagnosi e non è una presa in carico.
      </p>

      <h3>3. Quali dati raccogliamo</h3>
      <ul>
        <li>indirizzo email (solo per le comunicazioni del percorso);</li>
        <li>codice partecipante (es. MBSR-7K2Q8N3P);</li>
        <li>ciclo scelto e data di iscrizione;</li>
        <li>accettazione del Modulo A e, se la dai, del Modulo B;</li>
        <li>risposte ai questionari PSS-10 e FFMQ-I nei momenti T0, T1, T2 e T3;</li>
        <li>
          registri di pratica: data, pratica, orario, nota, tono dell’esperienza
          (piacevole, neutro, spiacevole);
        </li>
        <li>eventuali materiali di documentazione social, solo con Modulo B.</li>
      </ul>
      <p>
        Non chiediamo il nome. L’email non viene unita alle risposte dei questionari
        né al log di pratica nelle analisi dello studio: lì usiamo solo il codice.
      </p>

      <h3>4. Chi può vederli</h3>
      <ul>
        <li>chi conduce il percorso, per organizzare il gruppo e lo studio;</li>
        <li>
          il fornitore del database (Supabase), con server in Europa o in un Paese
          per cui esiste una decisione di adeguatezza (es. Regno Unito);
        </li>
        <li>
          il fornitore di invio email, che riceve solo l’indirizzo e il testo del
          messaggio per recapitarlo.
        </li>
      </ul>
      <p>
        Se un fornitore tratta dati fuori dall’Unione europea, il trasferimento
        avviene secondo le garanzie previste dal GDPR (decisione di adeguatezza o
        clausole contrattuali tipo).
      </p>

      <h3>5. Quanto tempo li teniamo</h3>
      <p>
        L’email resta per la durata del ciclo. Dopo la chiusura del ciclo, se non
        restano edizioni aperte, viene separata dal record (non più usata per
        scriverti) entro 90 giorni. I dati legati al codice restano per l’analisi
        del pilota. Se chiedi di uscire, non raccogliamo altri dati; quanto già
        raccolto in forma di codice può restare se serve a non spezzare lo studio,
        nei limiti di legge.
      </p>

      <h3>6. I tuoi diritti</h3>
      <p>
        Puoi esercitarli come descritto nella{' '}
        <Link to="/documenti/diritti">procedura operativa</Link>. In sintesi:
        accesso e portabilità dalla pagina <Link to="/dati">I tuoi dati</Link>;
        correzione, limitazione, opposizione, revoca e cancellazione scrivendo a {MAIL}
        indicando il codice partecipante.
      </p>
      <p>
        Reclamo:{' '}
        <a href={GARANTE_URL} target="_blank" rel="noopener noreferrer">
          Garante per la protezione dei dati personali
        </a>.
      </p>
      <p>
        Revocare il Modulo B non tocca la partecipazione. Revocare il Modulo A
        significa uscire dal percorso.
      </p>

      <h3>7. Decisioni automatizzate</h3>
      <p>
        Non usiamo profilazione e non prendiamo decisioni automatizzate che
        producano effetti giuridici su di te.
      </p>

      <h3>8. Memoria del browser</h3>
      <p>
        Dopo l’iscrizione o l’accesso, il codice può restare su questo dispositivo
        (memoria del browser) così al prossimo ingresso è già compilato. Puoi
        dimenticarlo dalla pagina Entra. Serve solo al funzionamento dell’app.
        Non usiamo cookie di profilazione né strumenti di statistica di terze parti.
      </p>

      <h3>9. Maggiorenni</h3>
      <p>Il percorso è pensato per persone maggiorenni. Non iscriverti se hai meno di 18 anni.</p>

      <h3>10. Strumenti di autovalutazione e limiti d’uso</h3>
      <ul>
        {STRUMENTI.map(s => (
          <li key={s.id}>
            <strong>{s.nome}.</strong> {s.testo}
          </li>
        ))}
      </ul>
      <p>
        I numeri non sono una valutazione clinica e non servono a decidere idoneità,
        terapia o urgenza. Dettaglio:{' '}
        <Link to="/documenti/uso-punteggi">uso dei punteggi</Link>.
      </p>
    </>
  )
}

function Diritti() {
  return (
    <>
      <h3>1. Cosa serve per riconoscerti</h3>
      <p>
        Scrivi a {MAIL} dal recapito con cui ti sei iscritto e indica il codice
        partecipante. Senza codice non possiamo collegare la richiesta al record
        corretto. Rispondiamo di solito entro 30 giorni.
      </p>

      <h3>2. Accesso e portabilità</h3>
      <ol>
        <li>Entra nell’app con il codice.</li>
        <li>
          Apri <Link to="/dati">I tuoi dati</Link> e scarica il file JSON.
        </li>
        <li>
          Se non riesci, scrivi a {MAIL}: ti inviamo lo stesso contenuto sul recapito
          dell’iscrizione.
        </li>
      </ol>
      <p>
        Il file contiene email (se ancora presente), consensi, iscrizioni, item e
        valori dei questionari, note di pratica. Non contiene dati di altri.
      </p>

      <h3>3. Correzione, limitazione, opposizione, revoca</h3>
      <p>
        Scrivi a {MAIL} cosa va corretto o limitato. La revoca del Modulo B ferma
        l’uso dei materiali social. La revoca del Modulo A chiude l’accesso al
        percorso e ferma nuova raccolta.
      </p>

      <h3>4. Cancellazione</h3>
      <ol>
        <li>Invia la richiesta a {MAIL} con il codice.</li>
        <li>
          Chi conduce il percorso usa la funzione di rimozione in area riservata
          (cancella il record e, in cascata, risposte e log).
        </li>
        <li>
          Se lo studio è in corso, può restare una copia solo-codice senza email,
          solo se serve a non spezzare l’analisi e nei limiti di legge: te lo
          comunichiamo.
        </li>
      </ol>

      <h3>5. Reclamo</h3>
      <p>
        <a href={GARANTE_URL} target="_blank" rel="noopener noreferrer">
          Garante per la protezione dei dati personali
        </a>.
      </p>
    </>
  )
}

function UsoPunteggi() {
  return (
    <>
      <p>
        PSS-10 e FFMQ-I in questo pilota descrivono le risposte rispetto al range
        dello strumento. Non producono diagnosi, non sostituiscono un professionista
        sanitario e non decidono l’idoneità al gruppo.
      </p>
      <h3>Chi partecipa</h3>
      <ul>
        <li>Vedi il totale e dove sta sul range min–max dello strumento.</li>
        <li>Non ci sono fasce cliniche (niente «basso / alto stress» da letteratura).</li>
        <li>Se stai male, rivolgiti a un professionista sanitario, non a questi numeri.</li>
      </ul>
      <h3>Chi conduce il percorso</h3>
      <ul>
        <li>Guarda i totali solo per codice, per descrivere il gruppo dello studio.</li>
        <li>Non usare i numeri per triage, esclusione, «rischio» o consiglio terapeutico.</li>
        <li>Non unire i totali all’email nelle analisi o nelle comunicazioni di gruppo.</li>
        <li>Lo screening resta in linguaggio non clinico (idoneo / in valutazione / da ricontattare).</li>
      </ul>
      <h3>Fonti degli strumenti</h3>
      <ul>
        {STRUMENTI.map(s => (
          <li key={s.id}>
            <strong>{s.nome}.</strong> {s.testo}
          </li>
        ))}
      </ul>
    </>
  )
}

function ModuloA() {
  return (
    <>
      <p>
        Spuntando la casella «Modulo A» nella pagina di iscrizione, dichiaro quanto
        segue.
      </p>
      <ol>
        <li>
          Ho letto l’<Link to="/documenti/informativa">informativa sul trattamento dei dati</Link>
          {' '}e ho capito quali dati vengono usati e perché.
        </li>
        <li>
          Ho capito che questo è un percorso di pratica di consapevolezza
          (mindfulness) a scopo di ricerca, in gruppo, della durata di otto
          settimane, con eventuale giornata intensiva. Non è un percorso
          terapeutico, non è una presa in carico psicologica e non è condotto da
          uno psicologo abilitato.
        </li>
        <li>
          Chiedo di partecipare al ciclo che ho scelto e accetto che chi conduce
          il percorso valuti l’idoneità allo screening e mi comunichi l’esito via
          email.
        </li>
        <li>
          Acconsento al trattamento della mia email (solo per le comunicazioni
          del percorso), del codice partecipante, delle risposte ai questionari
          PSS-10 e FFMQ-I e dei registri di pratica, per la gestione del gruppo e
          per lo studio pilota.
        </li>
        <li>
          So che nei questionari e nel log di pratica non compare il mio nome: mi
          riconoscerò con il codice. L’email non viene unita a quelle risposte
          nelle analisi.
        </li>
        <li>
          So che il Modulo B (documentazione social) è un consenso a parte,
          facoltativo. Posso rifiutarlo o ritirarlo senza effetti su questo
          Modulo A.
        </li>
        <li>
          Posso revocare questo consenso in qualsiasi momento scrivendo a {MAIL}.
          Da quel momento non entrerò più nel percorso e non verranno raccolti
          altri dati a mio carico.
        </li>
        <li>Dichiaro di avere almeno 18 anni.</li>
      </ol>
    </>
  )
}

function ModuloB() {
  return (
    <>
      <p>
        Questo consenso è <strong>facoltativo e indipendente</strong> dal Modulo A.
        Se non lo accetti, partecipi lo stesso. Spuntando la casella «Modulo B»
        dichiaro quanto segue.
      </p>
      <ol>
        <li>
          Acconsento a essere ripreso o fotografato durante i momenti di gruppo,
          e all’uso di quei materiali (foto, video, audio, eventuali didascalie
          senza dati di contatto) sui canali social del percorso, ad esempio
          Instagram.
        </li>
        <li>
          Autorizzo l’uso della mia immagine per queste comunicazioni, nei limiti
          della legge sul diritto d’autore (artt. 96 e 97 della l. 633/1941). I
          materiali non saranno usati per pubblicità commerciale di terzi.
        </li>
        <li>
          So che posso chiedere di non comparire in uno scatto specifico e che
          posso revocare questo consenso in qualsiasi momento scrivendo a {MAIL},
          senza effetti sulla partecipazione.
        </li>
        <li>
          Se revoco, i materiali non ancora pubblicati non verranno usati. Per
          quanto già online, chiederò la rimozione dove è ancora ragionevolmente
          possibile.
        </li>
      </ol>
    </>
  )
}

const CORPI = {
  informativa: Informativa,
  'modulo-a': ModuloA,
  'modulo-b': ModuloB,
  diritti: Diritti,
  'uso-punteggi': UsoPunteggi
}

export default function Documento() {
  const { slug } = useParams()
  const meta = DOCS[slug]
  const Corpo = CORPI[slug]
  if (!meta || !Corpo) return <Navigate to="/" replace />

  return (
    <article className="card doc-pagina">
      <p className="badge">{meta.badge}</p>
      <h2>{meta.titolo}</h2>
      <p className="lead">{meta.lead}</p>
      <div className="doc-corpo">
        <Corpo />
      </div>
      <p className="hint">
        Testo del 2 settembre 2026, per il pilota. Un avvocato, un DPO o il
        comitato etico di ateneo possono ancora rileggerlo; i contenuti operativi
        (titolare, basi, diritti, strumenti) sono quelli usati in applicazione.
      </p>
      <div className="doc-azioni">
        <Link className="btn" to="/iscrizione">Torna all’iscrizione</Link>
        {slug !== 'informativa' && (
          <Link className="btn btn-ghost" to="/documenti/informativa">Informativa privacy</Link>
        )}
        {slug !== 'diritti' && (
          <Link className="btn btn-ghost" to="/documenti/diritti">Diritti</Link>
        )}
        {slug !== 'uso-punteggi' && (
          <Link className="btn btn-ghost" to="/documenti/uso-punteggi">Uso dei punteggi</Link>
        )}
        {slug !== 'modulo-a' && (
          <Link className="btn btn-ghost" to="/documenti/modulo-a">Modulo A</Link>
        )}
        {slug !== 'modulo-b' && (
          <Link className="btn btn-ghost" to="/documenti/modulo-b">Modulo B</Link>
        )}
      </div>
    </article>
  )
}
