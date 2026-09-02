import { Link, Navigate, useParams } from 'react-router-dom'
import Disclaimer from '../components/Disclaimer.jsx'
import { EMAIL_CONTATTO } from '../lib/contatti.js'

const MAIL = <a href={`mailto:${EMAIL_CONTATTO}`}>{EMAIL_CONTATTO}</a>

const DOCS = {
  informativa: {
    titolo: 'Informativa sul trattamento dei dati',
    badge: 'Art. 13 GDPR',
    lead: 'Questo testo ti dice quali dati usiamo, perché e quali diritti hai. Va letto prima di iscriverti. Non è un consenso: i consensi sono nei Moduli A e B.'
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
  }
}

function Informativa() {
  return (
    <>
      <h3>1. Chi tratta i dati</h3>
      <p>
        Titolare del trattamento è chi conduce questo percorso pilota, nell’ambito di
        un progetto di studio in Discipline Psicosociali (Uninettuno). Non è uno
        psicologo abilitato e non svolge un’attività sanitaria.
      </p>
      <p>Per ogni richiesta sui dati: {MAIL}.</p>
      <p className="hint">
        Prima della pubblicazione definitiva, il titolare va indicato con nome e
        recapito completi. L’email sopra è il contatto operativo attuale.
      </p>

      <h3>2. Perché trattiamo i dati e su quale base</h3>
      <ul>
        <li>
          <strong>Iscrizione e accesso al percorso</strong> (email, ciclo, codice
          partecipante, consenso al Modulo A): per evadere la tua richiesta di
          partecipazione.
        </li>
        <li>
          <strong>Comunicazioni operative</strong> (esito dello screening, avvisi del
          gruppo, promemoria sui questionari): per far funzionare il percorso a cui
          ti sei iscritto.
        </li>
        <li>
          <strong>Questionari e log di pratica</strong> (PSS-10, FFMQ-I, note,
          orari, tono dell’esperienza): per il percorso e per lo studio pilota, solo
          se accetti il Modulo A. Le risposte si legano al codice, non al nome.
        </li>
        <li>
          <strong>Documentazione social</strong> (foto, video, audio, eventuali
          didascalie): solo se accetti il Modulo B, con un consenso separato.
        </li>
      </ul>
      <p>
        Se i questionari o le note descrivono come stai, possono rientrare tra i
        dati particolari previsti dall’art. 9 del GDPR. In quel caso la base è il
        consenso esplicito che dai nel Modulo A. Il percorso resta una pratica di
        consapevolezza a scopo di ricerca: non è una diagnosi e non è una presa in
        carico.
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
        L’email resta per la durata del ciclo e per il tempo necessario a chiudere
        lo studio pilota e le comunicazioni residue. Poi la cancelliamo o la
        separiamo in modo che non sia più usata per scriverti.
      </p>
      <p>
        I dati legati al codice (questionari e log) restano per il tempo necessario
        a completare l’analisi del pilota. Se chiedi di uscire dal percorso, non
        raccogliamo altri dati. Quanto già raccolto in forma di codice può essere
        conservato se serve a non spezzare lo studio, nei limiti previsti dalla
        legge.
      </p>

      <h3>6. I tuoi diritti</h3>
      <p>Puoi chiedere, scrivendo a {MAIL}:</p>
      <ul>
        <li>accesso a ciò che abbiamo su di te;</li>
        <li>correzione di dati inesatti;</li>
        <li>cancellazione, nei casi previsti;</li>
        <li>limitazione del trattamento;</li>
        <li>portabilità dei dati che ci hai fornito;</li>
        <li>opposizione, nei casi previsti;</li>
        <li>revoca del consenso, senza pregiudicare quanto fatto prima della revoca.</li>
      </ul>
      <p>
        Puoi anche presentare reclamo al Garante per la protezione dei dati
        personali (garanteprivacy.it).
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
  'modulo-b': ModuloB
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
      <Disclaimer />
      <div className="doc-corpo">
        <Corpo />
      </div>
      <p className="hint">
        Testo del 1 settembre 2026, pensato per il pilota. Va riletto da un
        professionista (avvocato o DPO) e, per lo studio, dal comitato etico di
        riferimento prima di usarlo come versione definitiva.
      </p>
      <div className="doc-azioni">
        <Link className="btn" to="/iscrizione">Torna all’iscrizione</Link>
        {slug !== 'informativa' && (
          <Link className="btn btn-ghost" to="/documenti/informativa">Informativa privacy</Link>
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
