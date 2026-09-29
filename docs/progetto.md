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

### 29/9/2026 · Trigger dell'email di incoraggiamento nel repository (da Cursor)
Il trigger `trg_invia_incoraggiamento_pratica` e la funzione `invia_incoraggiamento_dopo_pratica()` esistevano
solo in produzione: ora sono in `supabase/migrazione_trigger_incoraggiamento.sql` (secret sostituito da un segnaposto).
Nessuna modifica in produzione. Verificato che gli invii del mattino risultano accettati da Resend: se un'email
non arriva, controllare lo stato di consegna nella dashboard di Resend.

### 29/9/2026 · Design system unico (da Cursor)
Lo stile della scheda Pratica diventa quello di tutta l'app: regole in `docs/design-system.md`, token in
`src/styles/tokens.css` (copie in `src/lib/colori.js` per i grafici e in `supabase/functions/_shared/stileEmail.ts`
per le email). Tolti Fraunces, Inter e la classe `.mbsr-theme`: partecipante e facilitatore usano gli stessi
font (Source Serif 4 per i titoli, Public Sans per il testo), lo stesso fondo crema e la stessa scala dei titoli.
Supera la proposta a due temi dello stesso giorno; resta valida la scelta di Source Serif 4. La Tonalità ora parte
dai nuovi colori e con il valore predefinito non sovrascrive i token. Lo Storico usa i colori dei toni dei grafici
(neutro `#B4B8B0`, senza tono tratteggiato). Le email cambiano aspetto solo dopo il deploy delle funzioni.
Nessuna modifica al database né ai dati raccolti.
