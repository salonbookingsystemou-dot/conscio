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
   `migrazione_modalita_fruizione.sql` (posti in presenza + fruizione remota) e
   `migrazione_libreria_tracce.sql` (catalogo audio riusabile tra settimane e cicli).
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
6. **Pubblicazione**: `vite.config.js` usa già `base` e `start_url` `/conscio/`
   (repo [salonbookingsystemou-dot/conscio](https://github.com/salonbookingsystemou-dot/conscio)).
7. Su GitHub: Settings → Pages → Source → "GitHub Actions".
8. Su GitHub: Settings → Secrets and variables → Actions, aggiungi i due secret
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (li userà il workflow di deploy).
9. Push su `main`: il workflow in `.github/workflows/deploy.yml` builda e pubblica automaticamente.

## Invio email (Resend)

Le comunicazioni si salvano sempre nel database. Per l’invio reale:

1. Crea un account [Resend](https://resend.com) e un dominio (o usa `onboarding@resend.dev` in test).
2. Distribuisci la funzione: `supabase functions deploy invia-comunicazione`.
3. Imposta i secret: `RESEND_API_KEY` e, se vuoi, `RESEND_FROM`.

Senza la chiave la comunicazione resta `programmata`. L’email dei partecipanti serve solo al contatto operativo: non viene unita alle risposte o ai log.

## Protezione accessi (porta)

Entra, Iscrizione, recupero codice e Accedi facilitatore passano dall’edge function `porta` (tetto tentativi per IP hashato).

1. Nell’SQL editor esegui `supabase/migrazione_limiti_accesso.sql`.
   Per la fruizione remota: `supabase/migrazione_modalita_fruizione.sql`
   e `supabase/migrazione_iscrizione_solo_remoto.sql`. Poi ridistribuisci `porta`.
2. Distribuisci: `supabase functions deploy porta`.
3. Per inviare il codice all’iscrizione e al recupero, la funzione usa gli stessi secret Resend di `invia-comunicazione` (`RESEND_API_KEY`, opzionale `RESEND_FROM`). A ogni iscrizione parte anche un avviso a `contact@wordpresschef.it`.
4. Opzionale in Auth (dashboard Supabase): protezione password compromesse e MFA sull’account facilitatore.

Il recupero codice è “cieco”: l’app non mostra mai email↔codice; se l’email è in anagrafe e non ancora separata, Resend invia il codice. La risposta a schermo è sempre generica.

Frontend e SQL/edge vanno aggiornati insieme: dopo il revoke, le RPC `stato_accesso_codice` e `iscrivi_partecipante` non sono più chiamabili con la chiave anon.

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

## Superfici dell’app

- Pubbliche: iscrizione (consensi A e B indipendenti), questionari, log di pratica
- Riservate al facilitatore: cicli, lezioni/esercizi, comunicazioni, punteggi e log solo per codice
