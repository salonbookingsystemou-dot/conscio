# Percorso MBSR — app di gestione

PWA per gestire iscrizioni, cicli, lezioni, questionari e comunicazioni del percorso MBSR.

## Stack
- **Frontend**: React + Vite, pubblicato come PWA statica su GitHub Pages
- **Backend**: Supabase (Postgres + Auth + Row Level Security), region EU
- **Deploy**: GitHub Actions, automatico ad ogni push su `main`

## Setup

1. **Crea un progetto Supabase** (https://supabase.com), region EU.
2. Nell'SQL editor esegui `supabase/schema.sql`, poi `supabase/seed_questionari.sql`.
   Se lo schema era già stato applicato: `migrazione_questionari.sql` e `migrazione_facilitatore.sql`.
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

## Struttura dati

Vedi `supabase/schema.sql` per lo schema completo. Le tabelle principali:
- `utenti` — pseudonimizzati tramite `codice_partecipante`, con i due consensi
  (`consenso_modulo_a`, `consenso_modulo_b`) sempre indipendenti tra loro
- `cicli` — le edizioni del corso
- `iscrizioni` — collega utenti a cicli, con stato di screening in linguaggio non clinico
- `lezioni` / `esercizi` — struttura settimanale a 8 settimane con pratiche formali/informali
- `questionari` / `item` / `risposte` — PSS-10 e FFMQ-I, con timepoint T0/T1/T2/T3
- `comunicazioni` — promemoria e annunci per ciclo

## Superfici dell’app

- Pubbliche: iscrizione (consensi A e B indipendenti), questionari, log di pratica
- Riservate al facilitatore: cicli, lezioni/esercizi, comunicazioni, punteggi e log solo per codice
