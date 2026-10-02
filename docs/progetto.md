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
