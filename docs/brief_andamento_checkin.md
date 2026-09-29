# Conscio · brief frontend: andamento del check-in settimanale

Oggi il check-in settimanale (`src/pages/Checkin.jsx`) si può solo compilare: non esiste, né per il
partecipante né per il facilitatore, un posto dove rivedere le risposte delle settimane precedenti.
L'unica cosa che arriva al facilitatore è la coda "Segnalazioni da gestire" (scheda Cicli), solo quando
`esperienza_difficile = true`. Stress, sonno, presenza e ostacoli restano nel database ma non si vedono
da nessuna parte. Questo brief copre entrambe le viste mancanti.

Mockup:
- Partecipante: `docs/mockup/checkin-partecipante.html`
- Facilitatore: `docs/mockup/checkin-facilitatore.html`

Contesto generale e regole comuni: `docs/progetto.md`.

## Parte 1 · Partecipante — "Il tuo check-in nel tempo"

### Dove

Nuova sezione dentro `src/pages/Checkin.jsx`, raggiungibile con un link "Vedi il tuo andamento" da
`GiaRegistrato` (quando ha già compilato il check-in della settimana) e/o dalla schermata "check-in non
aperto". Non serve una nuova route: un nuovo stato locale (`passo === 'storico'`) come già fa `Questionari.jsx`
per `esito`/`scelta`.

### Dati: nuova RPC

`checkin_del_partecipante` restituisce solo la settimana corrente: serve una RPC per lo storico completo.

È già pronta in `supabase/migrazione_checkin_storico.sql` (**non ancora applicata**):
`checkin_storico_del_partecipante(p_codice text) -> jsonb`, un array ordinato per settimana con
`settimana, stress, sonno, presenza_quotidiana, ostacoli, creato_il`. Verifica la migrazione prima di
applicarla (segue lo stesso stile delle altre RPC del file `migrazione_checkin_progressi.sql`), poi
applicala e documentala nel registro di `docs/progetto.md` come fanno le altre.

Nota volutamente esclusa da questa RPC: `esperienza_difficile` e `nota_difficile` sono per il
facilitatore, non tornano al partecipante da qui (restano comunque nell'export dati personali già
esistente).

### Struttura della schermata

1. **Titolo** "Il tuo check-in nel tempo" + sottotitolo (vedi mockup).
2. **Tre contatori** in alto: check-in compilati su settimane possibili, stress medio, sonno medio
   (medie sulle sole settimane compilate).
3. **Una riga per settimana**, dalla più recente alla prima, fino alla settimana corrente del percorso
   (usa lo stesso calcolo di settimana già disponibile altrove, es. `settimana_per_questionari`):
   - **Settimana compilata**: data di compilazione (`creato_il`), due barre orizzontali (stress in un
     colore, sonno in un altro — riusa la distinzione cromatica esistente nel progetto, non introdurne
     di nuovi arbitrari), la presenza come frase ("Presenza durante la giornata: **spesso**", etichetta
     da `PRESENZA` in `src/lib/checkin.js`), e gli ostacoli come chip (solo se presenti — l'assenza di
     chip è normale, la domanda è facoltativa).
   - **Settimana non compilata** (ma già aperta/passata): riga attenuata, "Check-in non compilato questa
     settimana." Nessuna barra a zero.
   - **Settimana futura**: riga più attenuata ancora, "Si apre con la prossima settimana." (o simile).
4. **Disclaimer** in fondo: non è una valutazione clinica; se è stato segnalato un momento difficile in
   una settimana, la nota non compare qui — la vede solo il facilitatore (per essere espliciti e non far
   pensare a un dato nascosto per errore).

### Cosa NON fare

- Niente riferimento esplicito a "hai segnalato un momento difficile" settimana per settimana: sarebbe
  ridondante con quanto il partecipante già sa di aver scritto, e rischia di sembrare un'etichetta
  valutativa. Il disclaimer generico in fondo basta.
- Niente interpretazione ("il tuo stress sta calando"): solo i numeri.

## Parte 2 · Facilitatore — nuova scheda "Check-in" nella dashboard

### Dove

Nuova voce nell'array `TAB` di `src/pages/Dashboard.jsx` (dopo `pratica`, prima di `sito`):
`{ id: 'checkin', label: 'Check-in' }`, con il proprio pannello `tab === 'checkin'`, stesso pattern delle
altre schede (ambito: un ciclo alla volta, stesse regole di `SchedaPratica` per l'assenza di un ciclo
aperto — vedi `docs/brief_pratica.md`, sezione "Regole comuni", che valgono anche qui).

**Ambito: un ciclo**, come la scheda Pratica. Escludi chi segue un percorso individuale da remoto (senza
`ciclo_id`). Se nessun ciclo è aperto, mostra solo un invito ad aprirne uno.

### Dati

Il facilitatore ha già accesso diretto alla tabella (`policy "facilitatore legge checkin"`,
`is_facilitatore()`): non serve una RPC nuova, basta una select autenticata su
`checkin_settimanali` filtrata per `ciclo_id`, unita a `utenti` solo per contare le persone (mai per
mostrare codici in questa scheda — vedi sotto).

### Regola non negoziabile: solo dati aggregati

Stessa scelta già fatta per `SchedaPratica.jsx`: **nessun codice partecipante, nessuna riga individuale**
in questa scheda. Le medie e le distribuzioni bastano a capire come sta andando il gruppo; chi ha bisogno
di parlare con una persona specifica lo sa già dalla coda "Segnalazioni da gestire" (scheda Cicli, non
toccarla: resta l'unico punto dove compaiono codice e nota).

### Struttura della scheda

1. **Quattro numeri**: compilazione della settimana corrente ("N su M"), stress medio di gruppo della
   settimana corrente, sonno medio di gruppo della settimana corrente, totale check-in da inizio ciclo.
2. **Stress e sonno medi, settimana per settimana**: una colonna per settimana del ciclo (non per
   giorno, a differenza della scheda Pratica), con due barre affiancate (stress, sonno), media calcolata
   solo su chi ha compilato quella settimana. Settimane future: colonna vuota.
3. **Presenza durante la giornata**: barre impilate a 5 livelli (mai → molto spesso) per settimana,
   percentuale sul totale di chi ha risposto quella settimana. Stesso principio delle barre impilate per
   tono della scheda Pratica, ma 5 livelli invece di 3-4.
4. **Ostacoli più segnalati**: tabella con ostacolo, quante volte è stato segnalato, quante persone
   diverse l'hanno segnalato almeno una volta "su N" (N = iscritti che hanno risposto almeno un
   check-in), ordinata per volte decrescenti. Stesso principio della tabella "Pratiche informali" della
   scheda Pratica.
5. **Promemoria breve**: una riga che ricorda che le segnalazioni restano nella scheda Cicli (vedi
   mockup) — utile finché le due schede convivono, per non far pensare che manchino.

### Colori

Non riusare i colori del tono (piacevole/neutro/spiacevole) per stress e sonno: sono scale diverse
(0–10, non un giudizio in 3 categorie) e mischiarle confonderebbe. Nel mockup sono usati un colore
"caldo" per lo stress e l'accento principale del tema amministrazione per il sonno, a titolo di
esempio — adatta ai token già definiti in `src/styles/tokens.css` (`.mbsr-theme`) invece di introdurne
di nuovi. Per la presenza (5 livelli), una scala di intensità di un solo colore va bene, come nel mockup.

## Privacy

Nessuna modifica alle regole di `docs/progetto.md`: il check-in resta incluso in
`esporta_dati_del_partecipante` e cancellato da `resetta_dati_del_partecipante` (già così). La nuova RPC
per lo storico del partecipante non introduce nuovi dati, solo un modo di rileggerli che già gli
appartengono. La scheda del facilitatore non introduce l'accesso a dati individuali che non avesse già
(la tabella era già leggibile via RLS): li rende solo visibili in forma aggregata, cosa che oggi non
succede da nessuna parte.
