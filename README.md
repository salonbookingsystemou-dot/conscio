# Percorso MBSR — app di gestione

PWA per gestire iscrizioni, cicli, lezioni, questionari e comunicazioni del percorso MBSR.

## Stack
- **Frontend**: React + Vite, pubblicato come PWA statica su GitHub Pages
- **Backend**: Supabase (Postgres + Auth + Row Level Security), region EU
- **Deploy**: GitHub Actions, automatico ad ogni push su `main`

## Setup

1. **Crea un progetto Supabase** (https://supabase.com), region EU.
2. Nell'SQL editor esegui `supabase/schema.sql`, poi `supabase/seed_questionari.sql`.
   Se lo schema era già stato applicato: le `migrazione_*.sql` in ordine, inclusa
   `migrazione_modalita_fruizione.sql` (posti in presenza + fruizione remota),
   `migrazione_libreria_tracce.sql` (catalogo audio riusabile tra settimane e cicli),
   `migrazione_comunicazioni_remoto.sql` (avvisi solo agli utenti in remoto)
   e `migrazione_inattivita_remoto.sql` + `migrazione_inattivita_15_giorni.sql` (avviso e chiusura se il percorso da remoto non parte),
   `migrazione_citazioni_incoraggiamento.sql` (email con citazione dopo la pratica del giorno).
3. In Authentication → Users crea l’account del facilitatore. Poi in SQL:

   ```
   insert into utenti (codice_partecipante, email, ruolo, auth_user_id, consenso_modulo_a)
   values ('FACILITATORE', 'tua@email', 'facilitatore', '<uuid da auth.users>', true);
   ```

4. Copia `.env.example` in `.env.local` e inserisci `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   (li trovi in Project Settings → API del tuo progetto Supabase).
5. Installa le dipendenze e avvia in locale:
   ```
   npm install
   npm run dev
   ```
6. **Pubblicazione**: `vite.config.js` usa `base: './'`; il sito è servito da `conscio.mnesti.it` (`public/CNAME`).
   Repo [salonbookingsystemou-dot/conscio](https://github.com/salonbookingsystemou-dot/conscio).
7. Su GitHub: Settings → Pages → Source → "GitHub Actions".
8. Su GitHub: Settings → Secrets and variables → Actions, aggiungi i due secret
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (li userà il workflow di deploy).
9. Push su `main`: il workflow in `.github/workflows/deploy.yml` builda e pubblica automaticamente.

## Invio email (Resend)

Le comunicazioni si salvano sempre nel database. Per l’invio reale:

1. Crea un account [Resend](https://resend.com) e un dominio (o usa `onboarding@resend.dev` in test).
2. Distribuisci la funzione: `supabase functions deploy invia-comunicazione`.
3. Imposta i secret: `RESEND_API_KEY` e, se vuoi, `RESEND_FROM`.
4. Per l’opzione «Utenti in remoto»: esegui `supabase/migrazione_comunicazioni_remoto.sql` e ridistribuisci `invia-comunicazione`.

Senza la chiave la comunicazione resta `programmata`. L’email dei partecipanti serve solo al contatto operativo: non viene unita alle risposte o ai log.

## Inattività (solo da remoto)

Per chi è iscritto senza ciclo, un controllo giornaliero:

- **Onboarding non fatto**: idoneo da 15 giorni, primo accesso non fatto
- **Onboarding senza pratiche**: onboarding completato da 15 giorni, nessuna pratica iniziata

L’email avvisa che, se l’inattività continua, l’account verrà chiuso. Dopo altri 15 giorni senza onboarding o senza pratiche, l’iscrizione viene ritirata: i dati personali si azzerano e la persona può iscriversi di nuovo quando è pronta.

Ogni avviso si invia **una sola volta**. Una copia riassuntiva (solo codici) arriva a `contact@wordpresschef.it`.

1. Nell’SQL editor esegui `supabase/migrazione_inattivita_remoto.sql` e `supabase/migrazione_inattivita_15_giorni.sql`.
2. Imposta il secret `CRON_SECRET` sulla funzione.
3. Distribuisci: `supabase functions deploy notifica-inattivita --no-verify-jwt`.
4. Programma l’invio (07:00 UTC):
   - Dashboard Supabase → Edge Functions → Schedules, oppure
   - workflow `.github/workflows/notifica-inattivita.yml` (secret `SUPABASE_FUNCTIONS_URL` e `CRON_SECRET`)
5. Dalla pagina Avvisi il facilitatore può anche premere «Controlla e invia ora».

## Incoraggiamento dopo la pratica

Quando un partecipante preme «Registra la pratica di oggi» (`log_pratica.tipo = 'giorno'`), parte un’email con conferma del giorno (1–56) e una citazione del tema della settimana. Le citazioni si inseriscono a mano in `quotes` (SQL o Studio): non vengono generate dal codice.

1. Nell’SQL editor esegui `supabase/migrazione_citazioni_incoraggiamento.sql`.
2. Imposta i secret `RESEND_API_KEY` (già usato dalle altre email) e `ENCOURAGEMENT_SECRET`. Opzionale: `RESEND_FROM` o `EMAIL_FROM` (il dominio mittente va verificato su Resend).
3. Distribuisci: `supabase functions deploy invia-incoraggiamento-pratica --no-verify-jwt`.
4. Il trigger sul database è già stato creato via SQL (`trg_invia_incoraggiamento_pratica` su INSERT di `log_pratica`, solo `tipo = 'giorno'`).
   Se vuoi vederlo in Dashboard: **Integrations → Webhooks**
   (non è più sotto Database). Link diretto:
   `https://supabase.com/dashboard/project/<ref>/integrations/webhooks/overview`
5. Prova senza una sessione reale:
   ```
   ENCOURAGEMENT_SECRET=... FUNCTIONS_URL=https://<ref>.supabase.co/functions/v1 \
     supabase/functions/invia-incoraggiamento-pratica/prova.sh --codice CODICE123 --settimana 1
   ```

Un fallimento dell’invio non tocca il salvataggio della pratica: l’errore resta nei log della funzione. Una sola email per partecipante per giorno di pratica.

## Check-in settimanale e finestre dei questionari

`supabase/migrazione_dati_progressi.sql` è già applicata in produzione (28/9/2026): ora della pratica (`log_pratica.registrato_il`), tabella `checkin_settimanali` con le RPC `checkin_del_partecipante` / `salva_checkin`, nuove finestre T2 (dalla settimana 8 a fine + 14 giorni) e T3 (da fine + 28 a fine + 56). È nel repository come riferimento: non rieseguirla. Lo stesso vale per `supabase/migrazione_consenso_checkin.sql`: prima del primo check-in serve un consenso esplicito separato (`utenti.consenso_checkin_il`, RPC `dai_consenso_checkin`), che l’app chiede nella schermata del check-in.

Avviso al facilitatore quando un check-in segnala un’esperienza difficile (solo codice e settimana, mai la nota):

1. Secret: `RESEND_API_KEY` e `CHECKIN_WEBHOOK_SECRET`. Opzionale: `FACILITATORE_EMAIL` (predefinito `contact@wordpresschef.it`).
2. Distribuisci: `supabase functions deploy avvisa-segnalazione-checkin --no-verify-jwt`.
3. Trigger `trg_avvisa_segnalazione_checkin` su `checkin_settimanali` (INSERT e UPDATE): `supabase/migrazione_webhook_checkin.sql`, sostituendo `__CHECKIN_WEBHOOK_SECRET__` con il secret. Parte solo quando `esperienza_difficile` diventa `true` e la segnalazione non è già gestita; la nota non esce dal database.

Tutti e tre i passi sono già fatti in produzione (28/9/2026).

Le segnalazioni aperte compaiono nella scheda Cicli dell’area facilitatore, con la nota e il bottone «Segna come gestita».

Promemoria T3 all’apertura (fine + 28 giorni) e 7 giorni prima della chiusura:

1. Nell’SQL editor esegui `supabase/migrazione_promemoria_t3.sql`.
2. Distribuisci: `supabase functions deploy promemoria-questionari --no-verify-jwt` (secret `CRON_SECRET`, `RESEND_API_KEY`).
3. Programma l’invio giornaliero: workflow `.github/workflows/promemoria-questionari.yml` oppure Edge Functions → Schedules.

Ogni promemoria parte una sola volta per persona e percorso, e non a chi ha già compilato T3. Migrazione e deploy sono già fatti in produzione; il workflow parte dopo il push su `main`.

## Pausa di pratica (tre giorni senza ascolto)

Per chi è dentro un percorso aperto (ciclo di gruppo, oppure orologio personale da remoto), un controllo ogni mattina:

- non risulta nessuna meditazione ascoltata per intero (`log_pratica.tipo = 'ascolto'`) nei tre giorni precedenti;
- il giorno in corso non conta, perché si può ancora praticare;
- una sola email per pausa. Se la persona riprende e poi si ferma di nuovo, ne arriva un’altra.

L’oggetto è «Se senti di doverti fermare, lascia semplicemente che sia così». Una copia riassuntiva (solo codici) arriva a `contact@wordpresschef.it`.

Migrazione e funzione sono già in produzione (5/10/2026). L’invio del mattino è il workflow `.github/workflows/promemoria-pausa.yml` (07:15 UTC) e parte dopo il push su `main`. Dalla pagina Avvisi il facilitatore può anche premere «Controlla e invia ora» nella card Pausa di pratica.

## Protezione accessi (porta)

Entra, Iscrizione, recupero codice e Accedi facilitatore passano dall’edge function `porta` (tetto tentativi per IP hashato).

1. Nell’SQL editor esegui `supabase/migrazione_limiti_accesso.sql`.
   Per la fruizione remota: `supabase/migrazione_modalita_fruizione.sql`
   e `supabase/migrazione_iscrizione_solo_remoto.sql`. Poi ridistribuisci `porta`.
2. Distribuisci: `supabase functions deploy porta`.
   Per l’analisi automatica delle segnalazioni, prima del deploy imposta i secret
   `CURSOR_AUTOFIX_WEBHOOK_URL` e `CURSOR_AUTOFIX_WEBHOOK_KEY` (indirizzo e chiave del
   webhook nell’automazione). Senza i due secret la segnalazione resta solo email.
3. Per inviare il codice all’iscrizione e al recupero, la funzione usa gli stessi secret Resend di `invia-comunicazione` (`RESEND_API_KEY`, opzionale `RESEND_FROM`). A ogni iscrizione parte anche un avviso a `contact@wordpresschef.it`.
4. Opzionale in Auth (dashboard Supabase): protezione password compromesse e MFA sull’account facilitatore.

Il recupero codice è “cieco”: l’app non mostra mai email↔codice; se l’email è in anagrafe e non ancora separata, Resend invia il codice. La risposta a schermo è sempre generica.

Frontend e SQL/edge vanno aggiornati insieme: dopo il revoke, le RPC `stato_accesso_codice` e `iscrivi_partecipante` non sono più chiamabili con la chiave anon.

## Generazione tracce (ElevenLabs)

Dalla pagina **Genera** il facilitatore incolla uno script, sceglie modello e voce, mette le pause tra i paragrafi e salva l’MP3 in libreria. Lo script non viene scritto nel database.

1. Imposta il secret `ELEVENLABS_API_KEY` (Dashboard Supabase → Edge Functions → Secrets).
2. Distribuisci: `supabase functions deploy genera-voce`.

Senza la chiave la pagina avvisa che la generazione non è attiva. I crediti li consuma l’account ElevenLabs, come dall’interfaccia.

## Struttura dati

Vedi `supabase/schema.sql` per lo schema completo. Le tabelle principali:
- `utenti` — pseudonimizzati tramite `codice_partecipante`, con i due consensi
  (`consenso_modulo_a`, `consenso_modulo_b`) sempre indipendenti tra loro
- `cicli` — le edizioni del corso (`posti_totali` = posti in presenza; `link_incontro` solo per chi è remoto)
- `iscrizioni` — collega utenti a cicli (o resta senza ciclo se «solo da remoto»), con screening non clinico e modalità `presenza` | `remoto`
- `tracce` — libreria audio condivisa; `lezioni` e `esercizi` la collegano con `traccia_id`
- `lezioni` / `esercizi` — struttura settimanale a 8 settimane con pratiche formali/informali
- `questionari` / `item` / `risposte` — PSS-10 e FFMQ-I, con timepoint T0/T1/T2/T3
- `comunicazioni` — promemoria e annunci per ciclo
- `notifiche_inattivita` — traccia dei promemoria automatici agli iscritti solo da remoto
- `checkin_settimanali` — check-in della settimana (stress, sonno, presenza, ostacoli, momenti difficili); la nota la legge solo il facilitatore
- `promemoria_questionari` — traccia dei promemoria T3 inviati
- `quotes` / `quote_sent_log` — citazioni per l’email di incoraggiamento dopo la pratica del giorno (solo service role)

## Superfici dell’app

- Pubbliche: iscrizione (consensi A e B indipendenti), questionari, log di pratica
- Riservate al facilitatore: cicli, lezioni/esercizi, comunicazioni, punteggi e log solo per codice
