# Conscio · contesto condiviso del progetto

Questo file è il punto d'incontro tra gli strumenti che lavorano su Conscio (Cursor, Claude su claude.ai, Claude Code).
Chiunque cambi qualcosa di importante aggiorna la sezione **Registro delle modifiche** qui sotto.

## Fonti di verità

- **Codice:** questo repository, ramo `main`.
- **Database:** progetto Supabase `Conscio` (region EU). Ogni modifica allo schema o alle funzioni
  finisce in un file `supabase/migrazione_*.sql` in questo repository, anche se è stata applicata
  dalla dashboard o da uno strumento esterno.
- **Funzioni del database:** prima di modificarne una, leggi la versione più recente nei file `supabase/`
  (l'ultimo file che la ridefinisce vince), non una copia precedente.
- **Stile grafico:** `docs/design-system.md` è la fonte di verità sui token e sui componenti. Prima di
  scrivere CSS nuovo, controlla lì se il token o il componente esiste già (sezione 5 del documento).

## Regole sui dati

- I partecipanti accedono solo tramite RPC `security definer` con `p_codice`. Nessuna tabella è leggibile dal client.
- L'email non viene mai unita a risposte, log o check-in nelle analisi.
  Unica eccezione operativa (decisa da Dimitri il 14/10/2026): nelle segnalazioni difficili in «Da fare»
  l'email compare come tooltip sul codice, come già nelle iscrizioni, per contattare la persona. Non entra
  in export aggregati, grafici o elenchi di check-in.
- Ogni nuova categoria di dati va aggiunta a: informativa (`src/pages/Documento.jsx`, sezione 3),
  `esporta_dati_del_partecipante`, `resetta_dati_del_partecipante`, e serve una base giuridica
  (per i dati sul benessere: consenso esplicito, art. 9 GDPR).
- Per la divulgazione si usano solo dati aggregati. Niente sottogruppi piccoli, niente dati individuali.
  Le citazioni dei partecipanti richiedono un consenso specifico (non ancora implementato).

## Definizioni e colori condivisi (decisi il 28/9/2026)

Valgono per tutte le schermate (storico del partecipante, dashboard, cruscotti):
- **Giorno di pratica** = almeno una meditazione ascoltata per intero (una riga `log_pratica.tipo = 'ascolto'`,
  che il player salva solo oltre il 90-95% della traccia). Le informali si contano a parte.
- **Aderenza** = giornate di pratica / (iscritti × giorni trascorsi del ciclo).
- **Durata del ciclo** = da `data_inizio` a `data_fine` comprese (Gruppo pilota: 50 giorni), mai fissata a 56.
- **Tono** = solo il tono della giornata (diario). Niente tono prima/dopo per singolo ascolto: troppo impegnativo per chi pratica.
- **Colori dei toni nei grafici**: piacevole `#4B6B57`, neutro `#B4B8B0`, spiacevole `#A8763E`,
  senza tono tratteggiato. Nelle etichette con faccina restano quelli di `.tono-mini`.

## Stile

Un solo design system per partecipante, facilitatore ed email, con riferimento la scheda Pratica:
regole in `docs/design-system.md`, valori in `src/styles/tokens.css`. Niente colori, font o raggi scritti a mano.

## Momenti dei questionari

| Momento | Finestra |
|---|---|
| T0 | dall'iscrizione alla settimana 1 |
| T1 | settimane 4-5 |
| T2 | dalla settimana 8 a 14 giorni dopo la fine |
| T3 (follow-up) | da 4 a 8 settimane dopo la fine |

## Registro delle modifiche

### 14/10/2026 · Comunicazioni con elenco e dettaglio (da Claude Code)
La pagina era una colonna di card con il modulo sempre aperto in cima e le email automatiche in fondo. Ora segue il layout elenco–dettaglio del framework, come Tracce: a sinistra l'elenco con chip (Tutte, Da inviare, Inviate, Automatiche) e tre gruppi, ogni riga con stato; a destra il dettaglio della voce aperta (`?voce=`). Il modulo si apre solo da «Nuova comunicazione» nel rail o aprendo una comunicazione da inviare; le inviate si rileggono per intero e si possono riusare come base; «Inattività · da remoto» e «Pausa di pratica» hanno regola, persone in attesa, controllo manuale e storico. Gli esiti vanno nella snackbar, gli errori restano nel dettaglio; ogni invio chiede conferma. Tolti «(Resend)» e l'indirizzo scritto a mano (ora `EMAIL_CONTATTO`), etichette collegate ai campi. Stesse funzioni e stessi dati: nessuna modifica al database né alle funzioni.

### 14/10/2026 · Comunicazioni: nessuna email parte senza conferma (da Claude Code)
In Comunicazioni «Invia ora via email» era già spuntato (e si rispuntava scegliendo il T3): un clic su «Salva e invia» mandava l’email a tutto il ciclo. Ora la spunta parte vuota, e ogni invio passa da `DialogConferma` con oggetto e destinatari («a tutti i partecipanti di …» / «a chi segue … da remoto»): salva e invia, «Invia ora» su una programmata, «Controlla e invia ora» di inattività e pausa di pratica (con quante persone sono in attesa e quanti account verranno chiusi). Il rosso del dialogo resta solo per «Cancella». Come chiede la sez. 4bis del brief di navigazione. Nessuna modifica al database né alle funzioni. Il nuovo layout elenco–dettaglio della pagina è un passo successivo.

### 14/10/2026 · Email al passaggio sul codice nelle segnalazioni difficili (da Claude Code)
In «Da fare», passando sopra il codice di una segnalazione difficile compare l'email della persona, come già in Iscritti e nei percorsi da remoto: serve a contattarla. È un'eccezione alla regola «email mai unita ai check-in», decisa da Dimitri e annotata nelle regole sui dati. L'email viene dalle iscrizioni già lette dalla pagina: nessuna RPC nuova; dopo `separa_email_cicli_conclusi` compare «Nessuna email registrata». Aggiornata la nota sulla privacy in fondo a Cicli. Nessuna modifica al database.

### 14/10/2026 · Esito delle segnalazioni di problemi in «Da fare» (da Claude Code)
Ogni segnalazione di un problema dell’app compare in «Da fare» su Cicli, e nel badge, finché il facilitatore non la archivia (snackbar con «Annulla»). Per ognuna: stato (In lavorazione, Risolta, Non risolta), testo, pagina, data e, quando l’agente l’ha chiusa, cosa è stato corretto o perché non è risolta, con il link alla pull request. Mai codice né email.
- **Agente**: le istruzioni che `porta` manda a Cursor ora chiedono di chiudere **sempre**: `esito: "risolta"` con riepilogo e `pr_url` dopo aver unito la correzione, `esito: "non_risolta"` con il motivo se non corregge. Senza `esito` vale «risolta», come prima. Con «non risolta» parte solo l’email al gestore, nessuna a chi ha segnalato. `porta` ridistribuita.
- **Database**: `supabase/migrazione_esito_segnalazioni.sql` (applicata): colonne `esito`, `pr_url`, `archiviata_il`; RPC `segnalazioni_problema_da_vedere` e `archivia_segnalazione_problema`, solo facilitatore. Esito e link entrano in `esporta_dati_del_partecipante` (stessa categoria di dati, informativa invariata); il reset cancella già la riga.
- La tabella era vuota: dal 9/10 non sono arrivate segnalazioni. Le istruzioni nuove valgono per le prossime; l’automazione in Cursor deve solo seguire il testo che riceve.

### 14/10/2026 · Velocità del parlato solo dove ElevenLabs la applica (da Claude Code)
Prova sulla stessa frase, stesso seed, velocità 0,70 e 1,20: Multilingual v2 passa da 14,3 a 8,2 secondi, v4 resta a 9,28 in entrambi i casi, V3 cambia a caso (10,5–11,5 s) senza seguire la velocità. Coerente con la documentazione di v4 (solo stabilità e somiglianza; niente speed né style). Ora, con v4 o V3 scelti, il cursore della velocità in «Genera da script» è disattivato con una nota (per il ritmo: punteggiatura e pause), il campione della voce si ascolta al ritmo normale, la stima non segue il cursore e i paragrafi non risultano «generati a un’altra velocità». `genera-voce` non manda più speed a V3, e a v4 manda solo stabilità e somiglianza; per v2 e Flash non cambia nulla. Funzione ridistribuita (versione 16, verifica JWT come prima). Nessuna modifica al database.

### 14/10/2026 · Dopo «Sostituisci il file» si sente la versione nuova (da Claude Code)
Rigenerando una traccia, il player continuava a suonare il file vecchio. Il file nuovo prende lo stesso percorso in Storage, quindi lo stesso indirizzo, e il service worker (CacheFirst, 120 giorni) serviva la copia già salvata: al facilitatore e a chi l'aveva già ascoltata. Ora `sostituisciFileTraccia` salva l'indirizzo con `?v=<istante del caricamento>`, e lo stesso indirizzo passa a pratiche e lezioni collegate: ogni versione del file ha un indirizzo suo. L'unica traccia già sostituita con l'indirizzo vecchio («Tre minuti per riprendere fiato», 14/10) è stata corretta a mano nel database, con `file_aggiornato_il` all'ora del caricamento. Nessuna modifica allo schema né ai dati dei partecipanti.

### 14/10/2026 · «Sostituisci il file» di una traccia non dava più errore (da Claude Code)
Sostituendo il file di una traccia (anche da «Rigenera da script») compariva «Non è stato possibile aggiornare la libreria tracce.». Storage rifiutava il caricamento: il file si sovrascrive con un upsert, che richiede anche il permesso di lettura, e sul bucket `tracce-audio` il facilitatore poteva caricare, aggiornare ed eliminare ma non leggere. Nuova policy SELECT solo per il facilitatore (`supabase/migrazione_storage_tracce_lettura.sql`, applicata). Il bucket resta pubblico: gli ascolti non cambiano. Nessun dato dei partecipanti.
Applicata anche `supabase/migrazione_controllo_tracce.sql` del 13/10, rimasta in sospeso: gli esiti del controllo tracce ora sopravvivono al ricaricamento e compare «Da ricontrollare». Le date di modifica delle 16 tracce non sono cambiate.

### 14/10/2026 · Framework di layout del facilitatore, fase 1 (da Claude Code)
Implementato `docs/brief_framework_fase1.md` (regole in `docs/framework_layout_facilitatore.md`, mockup in `docs/mockup/framework-facilitatore/`). Le rotte sotto `/admin` c'erano già (13/10): questa fase cambia il guscio e l'impaginazione.
- **Guscio**: niente più testata con le pillole. Da 600px un rail a sinistra (compatto con icona ed etichetta; esteso da 1200px) con marchio, azione principale della sezione come FAB («Nuovo ciclo», «Nuova traccia», «Nuova comunicazione»; Sito non ne ha), le quattro voci con il badge su Cicli ed «Esci». Sotto 600px la barra in basso (`BarraVoci` in variante facilitatore, quella del partecipante non cambia), il FAB sopra ed «Esci» nel menu ⋯ della pagina.
- **Pagine**: ogni pagina è un `PaginaAdmin` (barra della pagina con indietro, titolo, meta, contesto, un'azione secondaria e ⋯; schede come rotte) con uno di tre layout: flusso (Cicli, spazio del ciclo, Comunicazioni, Nuova traccia), elenco–dettaglio (Tracce: la scheda della traccia sta a destra da 840px e prende la pagina sotto; `PannelloLaterale` eliminato), supporto (Sito). `?nuovo=1` e `?nuova=1` aprono i moduli di creazione al posto dei bottoni nelle pagine.
- **Snackbar** per le conferme non bloccanti. Collegata a «Segna come gestita», senza «Annulla»: non esiste una funzione che riapra una segnalazione e non se n'è creata una nuova.
- **Tracce**: «Controlla tutte» è uno split button: tutta la libreria (azione principale; prima controllava solo le tracce in elenco), solo quelle in elenco, solo il ciclo filtrato.
- **Sito**: `EditorSplash` non ha un'anteprima, quindi il pannello di supporto tiene per ora la nota «Uso dei dati e dei punteggi».
- **Token** nuovi: classi di finestra 600/840/1200 (solo area facilitatore), `--surface-rail`, `--accent-indicatore` (`--accent-soft` sul fondo del rail non si vedeva), colori della snackbar, livelli di stato, misure del guscio, `--space-40`. `--radius-xl` passa da 24 a 28px: cambia di poco anche la card del player e il foglio dal basso di Ascolta.
- In Ascolta «Sorprendimi» è a tutta larghezza con l'icona, come nel mockup.
- Nessuna modifica al database, alle RPC o ai dati raccolti.

### 14/10/2026 · Lo script della traccia resta salvato (da Cursor)
Generando una traccia, testo, pause, modello, voce, velocità, variazione e l’audio di ogni paragrafo restano sulla traccia. «Rigenera da script» riapre quella bozza: si cambia una frase e si rigenerano solo i paragrafi toccati (se il modello aggancia la voce, anche i successivi). «Salva lo script» tiene la bozza senza sostituire il file che ascoltano i partecipanti. L’audio dei paragrafi sta nel bucket privato `bozze-voce`, solo per il facilitatore: non entra nella cache delle tracce e non è un dato dei partecipanti (niente informativa, export o reset). `supabase/migrazione_script_traccia.sql` è applicata. Le tracce già in libreria non hanno uno script finché non si generano di nuovo da questa pagina.

### 14/10/2026 · Descrizione della traccia nel player di Ascolta (da Claude Code)
Il player a schermo intero mostra la descrizione sotto titolo e autore, prima della barra di avanzamento. Chiusa si vedono tre righe; «Leggi tutto» compare solo se il testo è più lungo e apre un riquadro scuro che scorre, così i comandi restano al loro posto; a descrizione aperta le etichette spariscono e il velo sullo sfondo si scurisce. Il pulsante «Informazioni» diventa «Crediti e licenza» e la sua scheda non ripete la descrizione (la pagina `/ascolta/:slug` la mostra ancora nella scheda). Riferimento: canvas «Conscio · Player Ascolta». Nessuna modifica al database né ai dati raccolti.

### 13/10/2026 · Anteprima dei link di Ascolta con titolo e immagine (da Cursor)
Condividendo una meditazione, l’anteprima su WhatsApp, Telegram e social non aveva né immagine né titolo: `conscio.mnesti.it/ascolta/<slug>` non esisteva come file, GitHub Pages rispondeva con `404.html` e le anteprime non eseguono il JavaScript che porta all’app. Ora, dopo la build, `scripts/pagine-condivisione.mjs` legge `vetrina_elenco` con la chiave anon e scrive `dist/ascolta/<slug>/index.html` con `og:title`, `og:description` e `og:image` (la copertina dello sfondo, mai il video), più il rimando a `/#/ascolta/<slug>`. Se Supabase non risponde la build prosegue e resta il rimando di `404.html`. `deploy.yml` gira anche ogni mattina alle 05:45 UTC (e a mano), così una meditazione pubblicata dopo l’ultimo push ha l’anteprima entro il giorno dopo. Da telefono si condivide solo il link: titolo e descrizione arrivano dalla card di anteprima (un testo in più compariva come secondo messaggio). Nessuna modifica al database né ai dati raccolti.

### 13/10/2026 · Navigazione del facilitatore sotto /admin (da Cursor)
Implementato il brief `docs/brief_navigazione_facilitatore.md`, deciso con Dimitri: il menu principale dice su quale oggetto lavori, le schede dicono quale aspetto. Il menu del facilitatore ha quattro voci, Cicli · Tracce · Comunicazioni · Sito, più «Esci»; su telefono diventano una barra in basso (`BarraVoci`, la stessa del partecipante), senza menu a tendina. Il badge su Cicli conta le segnalazioni difficili aperte e le iscrizioni in attesa di esito. Tutte le pagine del facilitatore stanno sotto `/admin` (mappa in `docs/architettura.md`); le vecchie rotte sono solo redirect, il login porta a `/admin/cicli` e il link dell’email `avvisa-segnalazione-checkin` punta a `#/admin/cicli` (la funzione va ridistribuita).
- **Cicli**: la home ha «Da fare», i numeri, i cicli e i percorsi da remoto. Ogni ciclo ha una testata con il selettore (il ciclo si sceglie una volta sola) e cinque schede: Panoramica, Iscritti, Programma (con l’avviso delle tracce da guardare), Pratica, Questionari (con l’interruttore «Tutti i cicli»: **da confermare con Dimitri**, se preferisce solo la vista per ciclo vanno tolti l’interruttore e il link dalla home). Dati comuni in `lib/cicli.js` e `lib/useCiclo.js`. Pratica e Questionari mostrano solo aggregati e codici, mai email.
- **Tracce**: un’interfaccia sola al posto di Libreria, Genera e Controllo tracce. Elenco con filtri (Tutte, Da guardare, In vetrina, Non controllate, «Usate in» un ciclo), stato del controllo su ogni riga e «Controlla tutte». La scheda della traccia si apre in un pannello laterale (`PannelloLaterale`, pagina intera su telefono) con ascolto, contenuto, file (sostituisci o rigenera da script), vetrina, dove è usata, controllo ed eliminazione. Dopo una nuova traccia la scheda si apre e il controllo parte da solo. I file fuori libreria non hanno più l’ascolto tecnico: compaiono come «Pratiche senza traccia in libreria» quando si filtra per ciclo.
- **Database**: nuova `supabase/migrazione_controllo_tracce.sql` (applicata il 14/10/2026): colonna `tracce.file_aggiornato_il` e tabella `controlli_tracce` (ultimo esito di file e ascolto tecnico per traccia, solo facilitatore). Il backfill della colonna spegne per un attimo `trg_tracce_aggiornato`, così le date di modifica restano quelle vere. Finché la migrazione non è applicata l’app funziona, ma gli esiti non sopravvivono a un ricaricamento e non compare «Da ricontrollare». Non sono dati dei partecipanti: niente da aggiungere a informativa, export e reset.
- **Comunicazioni / Sito**: la parte del facilitatore è in `pages/admin/Comunicazioni.jsx`; `pages/Comunicazioni.jsx` resta «Avvisi» del partecipante. `/admin/sito` raccoglie frase di apertura, vetrina e uso dei dati.
- Nessuna modifica alle RPC dei partecipanti, a export/reset o ai dati raccolti. Eliminati `Dashboard.jsx`, `Percorso.jsx`, `Libreria.jsx`, `ControlloTracce.jsx` e `pagineAdminAmpie`.

### 13/10/2026 · Brief: nuova navigazione del facilitatore (da Claude Code)
Deciso con Dimitri, istruzioni in `docs/brief_navigazione_facilitatore.md`. Non ancora implementato.
Menu a 4 voci (Cicli · Tracce · Comunicazioni · Sito) sotto `/admin`, schede solo dentro il ciclo
(Panoramica · Iscritti · Programma · Pratica · Questionari), tracce gestite da un'interfaccia sola
(creazione, modifica, controllo). Proposta una tabella `controlli_tracce` per salvare l'esito del controllo
(`supabase/migrazione_controllo_tracce.sql`, da creare): nessun dato dei partecipanti.

### 12/10/2026 · Video di sfondo su iPhone (da Cursor)
Su iPhone il player di Ascolta mostrava solo la copertina al posto del video. Safari avvia da solo un video con traccia audio solo se è muto anche come attributo, e React imposta solo la proprietà; con il risparmio energetico l’avvio automatico è sempre rifiutato. Ora l’attributo è impostato, e se l’avvio viene rifiutato il video resta con il poster e riparte al primo tocco. Con «Riduci movimento» attivo resta la copertina, come previsto. Nessuna modifica al database.

### 12/10/2026 · Video come sfondo dal telefono (da Cursor)
Su iPhone, scegliendo un video in «Scegli lo sfondo», il pulsante restava su «Preparazione…»: Safari non decodifica i fotogrammi di un video fuori dalla pagina e fermo, quindi l’anteprima non veniva mai estratta. Ora `preparaVideo` mette il video nascosto nella pagina, lo avvia senza audio e prende il fotogramma appena c’è; dopo 20 secondi senza esito mostra un errore invece di restare in attesa. Nessuna modifica al database.

### 12/10/2026 · Player di Ascolta a schermo intero (da Cursor)
In `/ascolta` e `/ascolta/:slug` la card mostra solo sfondo, titolo, durata, autore, voce e un play rotondo, come nel mockup `docs/mockup/ascolta-player.png`. Il play apre il player a tutto schermo: sfondo pieno, etichette, barra con tempo trascorso e rimanente, ±15 secondi, «Sorprendimi», condivisione e «Informazioni», che apre dal basso la scheda della traccia con l’invito al percorso. Chiuso il player, l’ascolto continua e in basso resta una barra ridotta. Nuovo `PlayerVetrina.jsx`; la riproduzione resta in `CardTracciaAudio` (nuova prop `vista`), quindi accredito e offline non cambiano. Nessuna modifica al database.

### 12/10/2026 · Header di Ascolta solo con il logo (da Cursor)
Sulle pagine `/ascolta` l’header non ha più il menu, il nome e le azioni a destra. Resta l’icona, che porta all’inizio.

### 12/10/2026 · Pulsante nel box Il percorso (da Cursor)
Il box «Il percorso» in Ascolta ha sempre il pulsante «Iscriviti al prossimo ciclo», anche quando non c’è un ciclo in reclutamento. Porta a `/iscrizione`.

### 12/10/2026 · Ascolta senza l’elenco (da Cursor)
Dalla pagina `/ascolta` è tolto il blocco «Tutte le meditazioni» (filtri e griglia). Restano la meditazione in evidenza, «Sorprendimi» e l’invito al percorso. La scheda di una singola traccia non cambia.

### 12/10/2026 · Ricerca Unsplash (da Cursor)
La ricerca sfondi chiamava Unsplash con la chiave salvata sul server. Unsplash risponde 401: la chiave non è valida. Il messaggio in libreria ora lo dice, invece di «Unsplash non ha risposto».

### 12/10/2026 · Ascolta fuori dalla barra, indirizzo pubblico (da Cursor)
La voce Ascolta non è più nella barra bassa: resta nel menu in alto, e solo se la vetrina è accesa. L’indirizzo `https://conscio.mnesti.it/ascolta` (e `/ascolta/slug`) apre la pagina senza codice: una pagina statica e il service worker mandano al percorso dell’app. La route era già fuori da `SoloRegistrato`.

### 12/10/2026 · Vetrina Ascolta, le schermate (da Cursor)
Pagine pubbliche `/ascolta` e `/ascolta/:slug`, con il guscio del partecipante anche per il facilitatore. In Libreria la modifica di una traccia ha la sezione Vetrina (slug, sfondo, autore, licenza, voce, tag, revisione, pubblicazione). Nel pannello Sito ci sono l’interruttore, i testi dell’invito, il calendario e i conteggi delle ultime quattro settimane. Il player in vetrina non accredita la pratica e non prepara la copia offline. L’interruttore resta spento.

### 12/10/2026 · Vetrina Ascolta, solo i dati (da Cursor)
Migrazione `supabase/migrazione_vetrina.sql`: autori, tag, colonne di pubblicazione sulle tracce, contatori aggregati per traccia e giorno, impostazioni con la vetrina spenta. Le RPC pubbliche restituiscono tracce solo se l’interruttore è acceso. I conteggi passano da `porta` (`evento-vetrina`), con lo stesso tetto per IP hashato, e non entrano in `log_pratica`. Le funzioni del partecipante non sono state ridefinite. Gli sfondi Pexels si copiano nel bucket `sfondi-vetrina`; le foto Unsplash restano sui loro server. Le pagine e la sezione in Libreria non ci sono ancora: la vetrina va accesa a fine ciclo, o se è dichiarata nel protocollo, per non contaminare il pilota. I conteggi non sono dati di un partecipante, quindi export e reset non cambiano. L’informativa descrive la sezione, Unsplash, Pexels ed ElevenLabs.

### 9/10/2026 · La correzione di una segnalazione chiude il ciclo e avvisa (da Cursor)
Se chi segnala è entrato con il codice, `porta` salva la segnalazione collegata
all’account (`supabase/migrazione_segnalazioni_problema.sql`) e non inoltra codice
né email all’agente. Quando la correzione è giusta, l’agente unisce la pull request
su `main` (il sito si pubblica da solo) e chiama `porta` con `azione = chiudi_segnalazione`.
Partono due email, a chi gestisce l’app e all’email dell’iscrizione: l’errore
segnalato è stato corretto, e un ringraziamento per la segnalazione. Senza codice
resta solo l’avviso al gestore. Il testo entra in
informativa, export e reset.

### 9/10/2026 · Il calendario della settimana non sposta i giorni nel mese dopo (da Cursor)
Segnalazione anonima: il calendario riportava date non corrette. La riga che contiene
il primo del mese (per esempio 29 settembre–5 ottobre) prendeva il nome solo del mese
nuovo, quindi il 29 e il 30 sembravano di ottobre. Ora l’intestazione nomina entrambi
i mesi. Martedì e mercoledì non sono più la stessa lettera «M»: le sigle sono
lun, mar, mer, gio, ven, sab, dom. Nessuna modifica al database.

### 8/10/2026 · Copia offline delle tracce solo al play (da Cursor)
Supabase ha segnalato il superamento della quota di cached egress (lo Storage servito dal CDN).
`CardTracciaAudio` e `TracciaGuidata` scaricavano per intero ogni traccia appena la card
compariva nel programma, anche senza ascoltarla. Ora la copia completa per l’offline
(`assicuraTracciaOffline`) parte solo quando si preme play: una traccia è disponibile offline
dopo il primo ascolto online.

### 6/10/2026 · Durata delle pratiche formali presa dalla traccia (da Cursor)
Nell’editor della settimana il campo «Durata (minuti)» non c’è più: al salvataggio la pratica
prende la durata della traccia collegata (`tracce.durata_minuti`, misurata dal file), e
«Sostituisci file» in libreria la aggiorna su tutte le pratiche collegate. La colonna
`esercizi.durata_minuti` resta, perché la leggono `programma_del_partecipante`, l’etichetta della
card e il conteggio dei minuti formali del giorno. `migrazione_durata_pratiche_da_traccia.sql`
(applicata) ha allineato le 9 pratiche esistenti; 8 sono cambiate, la più evidente «Meditazione
sul dolore cronico» da 12 a 24 minuti. Gli ascolti già registrati non cambiano. Tolto da Controllo
tracce il confronto fra durata della pratica e della traccia, ora sempre uguali.

### 6/10/2026 · Controllo tracce (da Cursor)
Nuova pagina facilitatore `/controllo-tracce` (voce «Controllo» nel menu). Per il ciclo scelto
verifica ogni pratica formale come la riceve il partecipante, con la stessa regola di
`programma_del_partecipante` (traccia collegata → vecchio `traccia_audio` → audio della settimana):
- **collegamenti**: pratica senza traccia, traccia collegata sparita, file fuori libreria, durata
  della pratica molto diversa da quella della traccia;
- **file** (automatico, richiesta `HEAD` + primi 64 KB): risponde, è audio, non è vuoto, MP3
  leggibile, durata in libreria coerente con il file;
- **ascolto tecnico** (su richiesta, per traccia o per tutte): scarica e decodifica il file a 16 kHz,
  misura la loudness BS.1770 e segnala volume generale fuori misura, tratti di voce ≥ 8 dB sotto il
  resto (da 10 s di voce in su «Da guardare», più corti o in chiusura solo nota), silenzio iniziale,
  finale tagliato, silenzi lunghi, durata vera diversa da quella del file. «Ascolta da» apre il
  player nel punto segnalato (nuova prop `inizio` di `CardTracciaAudio`).
Sola lettura: nessuna modifica al database, nessun dato nuovo salvato, nessun dato dei partecipanti.
Le copie scaricate per il controllo usano un parametro `controllo=` e vengono tolte dalla cache del
service worker. Il calcolo a blocchi della loudness in `tracciaFinale.js` ora filtra in streaming
(stessi valori di prima per il generatore, molta meno memoria). `AdminDialogo` spostato in `components/`.

### 6/10/2026 · «Genera tutto» non lascia paragrafi in sospeso (da Cursor)
Con i modelli che agganciano la voce (v2, v4), rigenerare un paragrafo segna come obsoleti quelli
già pronti che lo seguono. «Genera tutto» sceglieva i paragrafi all’inizio e non rifaceva quelli
diventati obsoleti durante il giro: a fine generazione «Ascolta tutto» e «Prepara il file» restavano
disattivati. Ora scorre i paragrafi in ordine e rigenera anche quelli, nello stesso giro; il
contatore «Paragrafo n di m» li include. Nessuna modifica al database.

### 6/10/2026 · Il grafico del player porta a un punto della traccia (da Cursor)
In `CardTracciaAudio` le barre dell’avanzamento sono cliccabili: un clic porta l’ascolto in quel
punto e, se la traccia era ferma, la fa partire da lì senza campana. Da tastiera le frecce spostano
di 10 secondi, Inizio e Fine vanno agli estremi. Saltare in avanti non conta come ascolto: per
l’accredito servono sempre il 90–95% di tempo ascoltato davvero. Prima di ogni avvio il player
toglie il muto: una campana interrotta lasciava l’audio a volume zero e il salto partiva senza suono.
Nessuna modifica al database.

### 6/10/2026 · Paragrafi molto bassi riportati al volume della traccia (da Cursor)
Nella «Scansione del corpo» del 6/10 alcuni paragrafi erano usciti da ElevenLabs molto più
piano degli altri e restavano 7–10 dB sotto: il guadagno per paragrafo si fermava a +12 dB.
Ora in `lib/tracciaFinale.js` può arrivare a +30 dB, così ogni paragrafo rientra entro 2 dB
dal resto della traccia. Vale per i file preparati da qui in poi. Nessuna modifica al database.

### 6/10/2026 · Voce predefinita Dimitri Grassi (da Cursor)
All’apertura di `/genera` la voce selezionata è Dimitri Grassi. Se non è nell’account,
resta la prima voce italiana. Nessuna modifica al database.

### 6/10/2026 · Eleven v4 nel generatore di voce (da Cursor)
In `/genera` si può scegliere v4 (`eleven_v4`). Segue il percorso di Multilingual v2:
stesse impostazioni di voce, aggancio con `previous_request_ids` e `next_text`.
Il ramo senza aggancio resta solo per V3. La stima è un credito a carattere: sulla pagina
prezzi v4 è a 0,08 $ per mille caratteri, come v2, e non indica un costo in crediti diverso.
Multilingual v2 resta il modello predefinito. Funzione `genera-voce` ridistribuita.
Nessuna modifica al database.

### 5/10/2026 · V3 tiene lo stesso registro tra i paragrafi (da Cursor)
V3 non può agganciare una richiesta alla precedente, e ogni paragrafo ripartiva
con un tono diverso. Ora la generazione usa il registro stabile. I paragrafi già
fatti restano com’erano finché non si rigenerano. Funzione `genera-voce` ridistribuita.

### 5/10/2026 · Email dopo tre giorni senza ascolto (da Cursor)
Ogni mattina, chi è dentro un percorso aperto e non ha una meditazione ascoltata per
intero da tre giorni di fila riceve un’email. Il giorno in corso non conta. Una sola
volta per pausa: se riprende e si ferma di nuovo, ne arriva un’altra.
Tabella `promemoria_pausa` e funzione `candidati_pausa_pratica`
(`supabase/migrazione_promemoria_pausa.sql`), edge function `promemoria-pausa`,
cron GitHub alle 07:15 UTC. La data dell’invio entra in informativa, export e reset.

### 5/10/2026 · L’ultima parola non viene coperta dalla chiusura (da Cursor)
La rampa di chiusura partiva quando il volume era ancora alto, e le ultime lettere
dell’ultima parola non si sentivano. Ora parte solo a parlato già finito.
Nessuna modifica al database.

### 5/10/2026 · Attacco e chiusura morbidi (da Cursor)
Il raddrizzamento del fade alzava il rumore in apertura, che diventava un sibilo,
e lasciava la fine a volume pieno, quindi tagliata. Ora attacco e chiusura sono
una rampa breve; il volume del parlato resta allineato tra i paragrafi.
Nessuna modifica al database.

### 5/10/2026 · Volume uniforme e niente fade tra i paragrafi (da Cursor)
Ogni paragrafo generato viene rifinito prima dell’ascolto e del file: si toglie il fade
in apertura e in chiusura messo da ElevenLabs e il parlato va allo stesso volume,
così unendo i paragrafi non si sente un salto. Il parlato è ricodificato una volta
(MP3 44,1 kHz, 192 kb/s). Nessuna modifica al database e nessun dato nuovo dei partecipanti.

### 4/10/2026 · Velocità del parlato nel generatore (da Cursor)
Sulla pagina `/genera` un cursore imposta la velocità del parlato, da 0,70 a 1,20
(1,00 è il ritmo della voce). ElevenLabs la applica in generazione; i paragrafi già fatti
restano com’erano finché non si rigenerano. Il campione della voce si ascolta alla velocità del cursore.
Funzione `genera-voce` ridistribuita.
Nessuna modifica al database e nessun dato nuovo dei partecipanti.

### 4/10/2026 · Ascolto a schermo spento e tono del giorno (da Cursor)
Due segnalazioni dallo stesso iPhone (3/10): la prima meditazione non risultava completata
e il tono di giovedì non restava. L’accredito dell’ascolto scartava i salti oltre un secondo
e mezzo, quelli che Safari fa a schermo spento: ora conta il tempo reale, non il seek.
Un secondo salvataggio della nota senza tono cancellava il tono già scelto
(`supabase/migrazione_tono_giorno_conserva.sql`); riaprendo il giorno la nota e il tono
comparono di nuovo. Nello storico stretto il tono va a capo, così su un iPhone da 320px non esce dallo schermo.
Nessun dato nuovo dei partecipanti.

### 4/10/2026 · Segnalazione di un problema avvia l’analisi automatica (da Cursor)
Dopo l’email al gestore, `porta` (`azione = segnala_problema`) invia la stessa segnalazione
anonima al webhook dell’automazione Cursor, se i secret `CURSOR_AUTOFIX_WEBHOOK_URL` e
`CURSOR_AUTOFIX_WEBHOOK_KEY` sono impostati. Senza i secret l’email resta l’unico canale.
L’informativa dice che quel testo (pagina, browser, schermo, errore) arriva anche allo
strumento di analisi. Nessun dato nuovo nel database: export e reset non cambiano.

### 3/10/2026 · Durata della traccia nel player della settimana (da Cursor)
Il player della settimana scriveva i minuti della pratica (per esempio 13) mentre il tempo in basso
era quello del file (13:29, Meditazione da seduti). Ora etichetta e tempo usano la stessa durata del
file, in minuti e secondi. Se un MP3 unito dichiara solo la lunghezza del primo spezzone, si usa la
durata vera del file; le intestazioni Xing/Info non entrano più nei file nuovi.
Nessuna modifica al database.

### 2/10/2026 · Mappa dell'interfaccia (da Claude Code)
Nuovo `docs/interfaccia.md`: gusci partecipante e facilitatore, schermate con i blocchi che le compongono,
catalogo dei componenti per famiglia, pattern ricorrenti, layout e checklist per re-design. Segnalati due
componenti non usati (`GraficoAndamentoPratica.jsx`, `TracciaGuidata.jsx`). Collegato da `CLAUDE.md` e
`docs/design-system.md`. Nessuna modifica al codice né al database.

### 2/10/2026 · Mappa dell'architettura (da Claude Code)
Nuovo `docs/architettura.md`: vista d'insieme (PWA, Supabase, Edge Functions, servizi esterni), route e guardie,
modello dati, funzioni con i loro inneschi, flussi chiave e deploy. Va aggiornato quando cambiano route, tabelle,
funzioni o servizi esterni. Corretto anche il README (base `./` e dominio `conscio.mnesti.it`).
Nessuna modifica al codice né al database.

### 5/10/2026 · Voce generata: una sola compressione, mono, volume sulla traccia (da Claude Code)
`genera-voce` chiede a ElevenLabs PCM non compresso (`pcm_44100`) e, se il piano non lo consente,
ripiega su MP3 192 e poi 128; il formato ottenuto torna nell'header `x-formato`. I paragrafi restano
in PCM mono e si ascoltano come WAV; il file della traccia si codifica una sola volta, alla fine, in
MP3 mono 96 kbps (`lib/tracciaFinale.js`), pause comprese: niente più doppia compressione né giunture
fra frame MP3. Il volume non si allinea più paragrafo per paragrafo: si misura la loudness della
traccia intera (BS.1770) e la si porta a −18 LUFS, con tetto a −1 dBFS; un paragrafo si corregge da
solo solo se si scosta più di 2 dB dal resto. I file nuovi pesano circa la metà.

### 5/10/2026 · Voce generata: coda, aggancio e accenti (da Claude Code)
Tre correzioni a `/genera`. La rifinitura (`lib/audioVoce.js`) tagliava la coda dell'ultima parola:
soglia di fine parlato dal 12% al 3% del livello del corpo, dissolvenza da 30 a 180 ms. Con
Multilingual v2 e Flash ogni paragrafo riceve anche l'inizio del successivo (`next_text`), così non
viene letto come la fine del testo; se ElevenLabs rifiuta l'aggancio la pagina lo segnala invece di
proseguire in silenzio. Nuovo `_shared/pronuncia.ts`: parole a cui si forza l'accento tonico con
l'accento grafico (es. «rilàssati»), da ampliare quando se ne sentono di sbagliate. V3 resta senza
aggancio (limite di ElevenLabs). Nessuna modifica al database.

### 2/10/2026 · Data di modifica delle tracce (da Cursor)
In libreria ogni traccia mostra creazione e modifica, con ora. Nuova colonna `tracce.aggiornato_il`
(`supabase/migrazione_traccia_aggiornato_il.sql`): per le tracce già presenti coincide con la creazione;
da lì in poi un trigger la aggiorna a ogni modifica di titolo, testo o file. Nessun dato nuovo dei partecipanti.

### 2/10/2026 · Generazione tracce con ElevenLabs (da Cursor)
Pagina facilitatore `/genera`: si incolla lo script, si divide in paragrafi, si sceglie il modello
(Multilingual v2, V3 o Flash) e la voce, si mettono pause in secondi tra i paragrafi. L’audio si
ascolta paragrafo per paragrafo o tutto di seguito; il file MP3 entra in libreria solo con «Salva».
Le pause sono silenzio aggiunto in app e non passano da ElevenLabs. La chiave sta nel secret
`ELEVENLABS_API_KEY` della funzione `genera-voce`. Nessuna modifica al database e nessun dato nuovo
dei partecipanti: lo script non viene salvato, in libreria restano titolo, testo della card e file.

### 1/10/2026 · Il player non si ferma più al salvataggio dell’ascolto (da Cursor)
Intorno al 95% la traccia viene accreditata e il programma si aggiorna. Quell’aggiornamento
rimetteva in pausa il player e lo riportava all’inizio, quindi la card risultava già ascoltata
per intero. Ora l’audio prosegue fino alla fine; la dicitura «ascoltata» compare solo a traccia
conclusa (o riaprendo un ascolto già salvato). Pausa e ripresa restano sul punto raggiunto.
Nessuna modifica al database: il credito resta oltre il 90-95%.

### 30/9/2026 · Componenti doppi unificati, tolto Lezioni.jsx (da Claude Code)
Dopo il tema unico di Cursor restavano due versioni degli stessi componenti. Ora ce n'è una sola per concetto,
in `src/styles.css`, elencata in `docs/design-system.md` (sezione "Componenti condivisi"): `.btn` con le
varianti `.btn-pericolo`, `.btn-ghost.is-pericolo`, `.is-piccolo`; `.card` con `.is-lista` e `.card-vuota`;
`.field`; `.dialogo` + `.dialogo-azioni`; `.avviso-errore`. Tolti `.admin-btn-*`, `.admin-card`, `.admin-field`,
`.admin-alert`, `.admin-dialogo` (Libreria, EditorSettimana, Percorso) e `.dialog-conferma`,
`.btn-ciclo-elimina`, `.btn-elimina` (DialogConferma, Dashboard, Comunicazioni, IMieiDati). Differenze visibili
nell'area facilitatore: pulsanti alti 48px come nel resto dell'app, "Annulla" con contorno, conferme
distruttive in rosso pieno anche nelle modali del partecipante. Eliminato `src/pages/Lezioni.jsx` (non più
raggiungibile) con le sue regole CSS. Gli ultimi colori scritti a mano in `styles.css` sono diventati token
(`--ochre-strong`, `--moss-strong`). Segnati come superati `docs/mockup/design-system.html` (proposta a due
temi) e le note su `.mbsr-theme`/Instrument Serif nei brief. Nessuna modifica al database. Pubblicato il 1/10
insieme alla correzione del player.

### 30/9/2026 · Design system unico implementato (da Cursor)
Lo stile della scheda Pratica diventa quello di tutta l'app: regole in `docs/design-system.md`, token in
`src/styles/tokens.css` (copie in `src/lib/colori.js` per i grafici e in `supabase/functions/_shared/stileEmail.ts`
per le email). Tolti Fraunces, Inter e la classe `.mbsr-theme`: partecipante e facilitatore usano gli stessi
font (Source Serif 4 per i titoli, Public Sans per il testo), lo stesso fondo crema e la stessa scala dei titoli.
Supera la proposta a due temi dello stesso giorno; resta valida la scelta di Source Serif 4. La Tonalità ora parte
dai nuovi colori e con il valore predefinito non sovrascrive i token. Lo Storico usa i colori dei toni dei grafici
(neutro `#B4B8B0`, senza tono tratteggiato). Pubblicato il 30/9: sito su GitHub Pages e le sei funzioni email
ridistribuite con le stesse impostazioni JWT di prima.
Nessuna modifica al database né ai dati raccolti.

### 30/9/2026 · Diagnosi verificata con numeri reali sul codice (da Claude su claude.ai)
Aggiornata la sezione 1 di `docs/design-system.md` con un conteggio riga per riga delle classi del vecchio
sistema (`.btn`/`.badge`/`.card`/`.field`/`.disclaimer`/`.campo-errore`) nelle schermate facilitatore:
confermato che `Dashboard.jsx` (tab Cicli/Questionari), `Comunicazioni.jsx` e `Segnala.jsx` le usano ancora,
mentre `Libreria.jsx`, `Percorso.jsx`, `EditorSettimana.jsx` e `SchedaPratica.jsx` sono già puliti — il
confine passa dentro `Dashboard.jsx` stessa, non fra pagine diverse. Trovato anche un file orfano,
`src/pages/Lezioni.jsx`: non più raggiungibile (`/lezioni` reindirizza a `/percorso`), nessun altro file lo
importa, usa ancora il vecchio sistema. Non serve una fase dedicata: va solo eliminato prima che qualcuno
lo riprenda per errore durante la bonifica.

### 30/9/2026 · Deciso il font dei titoli unico: Source Serif 4 (da Claude su claude.ai)
Sostituisce Fraunces (tema Partecipante) e Instrument Serif (tema Facilitatore) come `--font-display`,
che diventa un primitivo condiviso invece di un token per tema (vedi `docs/design-system.md`, sez. 3.1 e
3.2bis, aggiornate). Il font del corpo testo resta invece diverso per tema (Inter / Public Sans): la
decisione riguarda solo i titoli. Confronto fatto in `docs/mockup/font-titoli-alternative.html` (Fraunces,
Newsreader, Source Serif 4, Piazzolla); scelto per la leggibilità dei numeri tabellari nelle stat tile
della dashboard. Da fare in implementazione (fase 1 della strategia): rimuovere `Fraunces` dall'import
Google Fonts in `src/styles.css` (Inter resta), sostituire `@fontsource/instrument-serif` con
`@fontsource/source-serif-4` in `src/styles/tokens.css`.

### 30/9/2026 · Design system e strategia per unificare lo stile facilitatore (analisi, da Claude su claude.ai)
Documento completo in `docs/design-system.md`. Diagnosi: l'area facilitatore ha oggi due linguaggi visivi
paralleli, nati senza una decisione esplicita — `styles.css` (Fraunces/Inter, usato anche dalle tab Cicli
e Questionari della dashboard, da Comunicazioni e da Segnala) e `src/styles/admin.css` + `tokens.css`
(Instrument Serif/Public Sans, usato solo da Libreria, EditorSettimana, Percorso e dalla tab Pratica).
Il meccanismo di aggancio `.mbsr-theme` già esiste ma copre solo i colori, non font/spaziatura/raggio.
Il documento definisce un'architettura di token unica con due temi (`.tema-partecipante`/
`.tema-facilitatore`), una mappa dei componenti doppioni da unificare (card, pulsanti, badge, campi,
alert), e una strategia a 4 fasi (consolidare i token → bonificare i componenti condivisi → migrare la
dashboard → ritirare i doppioni → governance). Non ancora implementato: solo analisi e piano.

### 29/9/2026 · Trigger dell'email di incoraggiamento nel repository (da Cursor)
Il trigger `trg_invia_incoraggiamento_pratica` e la funzione `invia_incoraggiamento_dopo_pratica()` esistevano
solo in produzione: ora sono in `supabase/migrazione_trigger_incoraggiamento.sql` (secret sostituito da un segnaposto).
Nessuna modifica in produzione. Verificato che gli invii del mattino risultano accettati da Resend: se un'email
non arriva, controllare lo stato di consegna nella dashboard di Resend.

### 29/9/2026 · Andamento del check-in settimanale, partecipante e facilitatore (mockup, da Claude su claude.ai)
Mockup in `docs/mockup/checkin-partecipante.html` e `docs/mockup/checkin-facilitatore.html`, istruzioni in
`docs/brief_andamento_checkin.md`. Non ancora implementato. Oggi il check-in si può solo compilare: stress,
sonno, presenza e ostacoli non sono visibili da nessuna parte (solo le segnalazioni di momenti difficili
arrivano al facilitatore, nella scheda Cicli). Il brief aggiunge: per il partecipante, uno storico
settimana per settimana dentro `Checkin.jsx`; per il facilitatore, una nuova scheda "Check-in" nella
dashboard con soli dati aggregati di gruppo (nessun codice, nessuna riga individuale — stessa regola già
seguita da `SchedaPratica`). Richiede una nuova RPC di sola lettura, proposta e non ancora applicata in
`supabase/migrazione_checkin_storico.sql` (`checkin_storico_del_partecipante`); la scheda del facilitatore
non ne ha bisogno, legge direttamente `checkin_settimanali` via la policy RLS già esistente.

### 29/9/2026 · Nuova schermata "Il tuo andamento" per il partecipante (mockup, da Claude su claude.ai)
Mockup in `docs/mockup/andamento.html`, istruzioni in `docs/brief_andamento.md`. Non ancora implementato.
Aggiunge un passo `andamento` dentro `Questionari.jsx`: confronto tra i timepoint già completati (PSS-10,
FFMQ-I totale e sottoscale), a barre orientamento in fila per T0-T3, senza grafico ad assi e senza
interpretazione del cambiamento (solo la differenza numerica). Nessuna nuova RPC: riusa
`risposte_questionario_del_partecipante` e `calcolaPunteggi` già esistenti per ogni timepoint.

### 28/9/2026 · Dati sui progressi (da Claude su claude.ai)
Applicato in produzione, documentato in `supabase/migrazione_checkin_progressi.sql`:
- `log_pratica.registrato_il`: ora di registrazione (vuota per le righe precedenti).
- Tabella `checkin_settimanali` con RPC `checkin_del_partecipante`, `salva_checkin`, `dai_consenso_checkin`.
- Consenso separato al check-in: `utenti.consenso_checkin_il`. Senza consenso `salva_checkin` rifiuta.
- Segnalazioni di esperienze difficili: `segnalazioni_difficili_aperte`, `segna_segnalazione_gestita` (solo facilitatore).
- Nuove finestre di T2 e T3 (prima T2 restava aperto un solo giorno per il Gruppo pilota).
- Export e reset dei dati includono il check-in.

**Da fare nel frontend:** vedi `docs/brief_checkin.md`.

### 28/9/2026 · Nuova schermata Storico (mockup, da Claude su claude.ai)
Deciso con Dimitri: lo storico diventa un calendario a scorrimento verticale, una riga per giornata
(barra dei minuti colorata dal tono, etichetta del tono, nota), con un contatore generale in alto.
Mockup in `docs/mockup/storico.html`, istruzioni in `docs/brief_storico.md`. Non ancora implementato.

### 28/9/2026 · Nuova scheda Pratica del facilitatore (mockup, da Claude su claude.ai)
Mockup in `docs/mockup/pratica.html`, istruzioni in `docs/brief_pratica.md`: quattro numeri, partecipazione
giorno per giorno per tono, mappa del percorso e totale per partecipante senza codici, informali in tabella.
Aggiornati anche mockup e brief dello Storico con le definizioni condivise qui sopra.

### 28/9/2026 · Scheda Pratica implementata (da Cursor)
`src/components/SchedaPratica.jsx` (calcoli in `src/lib/pratica.js`) sostituisce `GraficiTono` nella dashboard.
Iscritti al ciclo = iscrizioni idonee con `ciclo_id` (esclusi ritirati e percorsi individuali da remoto).
Senza ciclo aperto la scheda mostra il ciclo in corso (o l'ultimo iniziato); solo se nessun ciclo è
iniziato restano i quattro numeri, sommati su tutti i cicli. Nessuna modifica al database.

### 28/9/2026 · Check-in non modificabile, niente banner (da Cursor)
Applicato in produzione, documentato in `supabase/migrazione_checkin_non_modificabile.sql`:
`salva_checkin` non aggiorna più un check-in esistente e rifiuta con `CHECKIN_GIA_COMPILATO`.
Nell'app la pagina del check-in mostra "già registrato" invece del modulo, il banner nella pagina Programma
è stato tolto e l'invito passa solo dalla modale, che ricompare a ogni apertura dell'app finché il check-in
della settimana non è compilato. Supera quanto scritto in `docs/brief_checkin.md` sulla modifica entro la settimana.
