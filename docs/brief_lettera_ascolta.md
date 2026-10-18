# Brief · «Restiamo in contatto»: avviso del ciclo e lettera settimanale

Data: 18/10/2026 · Esecuzione: Claude Code
Riferimento visivo: canvas «Conscio · Player Ascolta», tavola «/ascolta · vetrina» (box «Restiamo in contatto»).

Prima di iniziare leggi `docs/progetto.md`, `docs/architettura.md`, `docs/interfaccia.md` e `docs/design-system.md`.

## 0. Obiettivo e vincoli

In `/ascolta` un visitatore lascia la sua email e sceglie una o entrambe le liste:
- **Avviso del prossimo ciclo:** una email quando si aprono le iscrizioni a un nuovo ciclo.
- **Lettera settimanale:** notizie, studi ed eventi di mindfulness in Italia e nel mondo.

Si spedisce con il servizio attuale, **Resend**, attraverso le Edge Function. Nessun servizio di newsletter esterno.

**Vincoli, da rispettare in ogni fase:**
1. **Separati dallo studio.** Gli iscritti non sono partecipanti. Nessun collegamento con `utenti`, `iscrizioni`, codici, risposte o `log_pratica`, e nessuna lettura delle loro tabelle.
2. **Due consensi distinti.** Uno per lista, mai spuntati di partenza. Per ciascuno si salvano data e versione del testo accettato.
3. **Doppia conferma.** L'indirizzo riceve email solo dopo il clic sul link di conferma. Una richiesta non confermata entro 7 giorni viene cancellata.
4. **Cancellazione con un clic.** Ogni email ha il link per uscire e gli header `List-Unsubscribe`. Uscire non richiede accesso né conferme.
5. **Niente enumerazione.** La risposta all'iscrizione è identica sia che l'email sia nuova, sia già iscritta, sia cancellata.
6. **Dati minimi.** Si salvano email, scelte, date e token. Niente nome, IP in chiaro o tracciamento di aperture e clic.

## 1. Database: `supabase/migrazione_lettera.sql`

```sql
create extension if not exists citext;

create table iscritti_lettera (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  avviso_ciclo boolean not null default false,
  avviso_ciclo_consenso_il timestamptz,
  lettera boolean not null default false,
  lettera_consenso_il timestamptz,
  versione_testo text not null,            -- es. '2026-10-18'
  stato text not null default 'in_attesa'
    check (stato in ('in_attesa','confermato','cancellato')),
  token_conferma_hash text,                -- sha256 del token, mai il token
  token_conferma_scade timestamptz,
  token_uscita uuid not null default gen_random_uuid(),
  confermato_il timestamptz,
  cancellato_il timestamptz,
  ultimo_ciclo_avvisato uuid references cicli(id) on delete set null,
  creato_il timestamptz not null default now()
);

create table lettere_inviate (
  id uuid primary key default gen_random_uuid(),
  oggetto text not null,
  corpo text not null,
  destinatari int not null,
  inviata_il timestamptz not null default now(),
  inviata_da uuid references auth.users(id)
);

alter table iscritti_lettera enable row level security;
alter table lettere_inviate enable row level security;
-- Nessuna policy per anon o authenticated su iscritti_lettera: si accede solo dalle Edge Function (service role).
-- lettere_inviate: lettura per is_facilitatore(), come le altre tabelle dell'area facilitatore.
```

RPC per l'area facilitatore (`security definer`, solo `is_facilitatore()`): `lettera_conteggi()` restituisce i confermati per lista, quelli in attesa e i cancellati negli ultimi 30 giorni. **Non** restituisce le email.

Pulizia: a ogni chiamata di `porta` con azione `iscrivi_lettera`, oppure con il cron esistente, se è più semplice, cancella le righe `in_attesa` con `token_conferma_scade < now()`. Una riga `cancellato` mantiene solo email, stato e `cancellato_il`: serve a non riscrivere a chi è uscito. Azzera token e flag.

## 2. Edge Function `porta`: tre nuove azioni

Riusa il rate limit per IP hashato che `porta` ha già. Imposta un tetto basso su `iscrivi_lettera`, per esempio 5 all'ora per IP.

**`iscrivi_lettera`**: `{ email, avviso_ciclo: bool, lettera: bool }`
- Valida l'email e controlla che almeno una lista sia scelta; altrimenti 400.
- **Email nuova:** inserisci la riga `in_attesa`, genera un token casuale di 32 byte, salva solo il suo hash con scadenza a 7 giorni e invia l'email di conferma.
- **Email `in_attesa`:** aggiorna le scelte e reinvia la conferma (al massimo una ogni 10 minuti).
- **Email `confermato`:** aggiungi le liste nuove con le loro date di consenso. Non reinviare la conferma; manda al massimo una email «Hai aggiornato le tue preferenze».
- **Email `cancellato`:** riporta la riga `in_attesa` con le nuove scelte e invia la conferma. È una nuova iscrizione esplicita.
- Rispondi **sempre** `{ ok: true }`, comunque vada (vincolo 5).

**`conferma_lettera`**: `{ token }`
- Cerca per hash con scadenza valida, imposta `confermato`, `confermato_il`, e azzera token e scadenza.
- Risponde `{ ok: true, liste: [...] }` oppure `{ ok: false, motivo: 'scaduto' }`.

**`esci_lettera`**: `{ token_uscita, lista?: 'avviso_ciclo' | 'lettera' }`
- Senza `lista`: stato `cancellato`, entrambi i flag a false.
- Con `lista`: spegne solo quella. Se non ne resta nessuna attiva, passa a `cancellato`.
- Va accettata anche come `POST` con `List-Unsubscribe=One-Click`, per l'uscita con un clic dei client di posta (RFC 8058). Per quella richiesta il token arriva nella query string.

**Email di conferma.** Usa `stileEmail.ts` e `firmaEmail.ts`.
- **Oggetto:** «Conferma la tua iscrizione a Conscio».
- **Corpo:** cosa si è scelto, il pulsante «Conferma», la scadenza a 7 giorni e la frase «Se non sei stato tu, ignora questa email: non ti scriveremo».
- **Link:** `https://conscio.mnesti.it/#/lettera/conferma?t=<token>`.

## 3. Pagine pubbliche

Nuove route in `App.jsx`, con il guscio pubblico come `/ascolta`.

- **`/lettera/conferma`:** legge `t` e chiama `conferma_lettera`.
  - Riuscita: «Fatto, ti scriveremo» con le liste attive e un link ad Ascolta.
  - Link scaduto: «Il link è scaduto» con un link per iscriversi di nuovo da Ascolta.
  - Prevedi i tre stati: attesa, riuscita, errore.
- **`/lettera/esci`:** legge `u` (`token_uscita`) e l'eventuale `lista`.
  - Mostra cosa si sta per disattivare e un pulsante «Non voglio più riceverla». Il pulsante serve a evitare che i prefetch dei client di posta cancellino l'iscrizione per errore.
  - Dopo il clic: «Non riceverai più …», con un link per tornare.

## 4. Box in `/ascolta`

Nuovo componente `src/components/IscrizioneLettera.jsx`, nella vista elenco dopo la card «Il percorso» e prima della nota finale. Segui la tavola del canvas.

- Occhiello «Restiamo in contatto», titolo `h2`, una riga di testo.
- Campo `type="email"` con `autocomplete="email"`, e `fieldset` con `legend` «Cosa vuoi ricevere».
- Due checkbox, **non spuntate**, ciascuna con titolo e una riga:
  - «Avviso del prossimo ciclo — Una sola email, quando si aprono le iscrizioni.»
  - «Lettera settimanale — Notizie, studi ed eventi di mindfulness in Italia e nel mondo.»
- `.btn` «Iscrivimi». Sotto, in `--fs-caption`: «Ti mandiamo un'email per confermare. Puoi cancellarti in qualsiasi momento con un clic.» e il link all'informativa.
- **Errori**, in `.campo-errore` collegato con `aria-describedby`:
  - email non valida: «Controlla l'indirizzo email.»;
  - nessuna lista scelta: «Scegli almeno una delle due opzioni.»
- **Dopo l'invio** il form è sostituito da un riquadro `role="status"`: «Controlla la tua casella. Ti abbiamo scritto a {email}. Apri il messaggio e conferma: senza conferma non ti scriviamo.», con il link «Usa un'altra email».
- **Attesa:** pulsante disabilitato con `StatoAttesa` inline. Se la rete non risponde, mostra «Non è stato possibile completare l'iscrizione. Riprova.»
- **Stile:** card con fondo `--accent-soft` o il token tonale più vicino. Solo token, prefisso `.ascolta-lettera-`.
- La nota finale di Ascolta diventa: «Le voci sono sintetiche, salvo dove indicato. L'email serve solo per i messaggi che scegli.»

## 5. Area facilitatore

### `/admin/comunicazioni`: nuova scheda «Lettera settimanale»

- In alto i conteggi da `lettera_conteggi()`.
- Editor con oggetto e corpo in testo semplice o Markdown leggero, come le comunicazioni esistenti.
- «Invia una prova a me»: manda solo all'email del facilitatore.
- «Invia a N iscritti»: apre `DialogConferma` e chiama la nuova Edge Function `invia-lettera`.
- Storico da `lettere_inviate`: data, oggetto, destinatari.

### Edge Function `invia-lettera`

- **Accesso:** JWT obbligatorio e `is_facilitatore()`, come `invia-comunicazione`.
- **Input:** `{ oggetto, corpo, prova?: boolean }`.
- **Destinatari:** `stato = 'confermato' and lettera = true`.
- **Invio:** un'email per destinatario, mai in CC o BCC, con l'endpoint batch di Resend (`POST /emails/batch`, fino a 100 per chiamata). Rispetta il limite di richieste del piano. Verifica sulla documentazione attuale di Resend che il batch accetti gli header personalizzati; se non li accetta, invia una email per chiamata con una pausa tra l'una e l'altra.
- **Ogni email** ha:
  - in fondo il link `https://conscio.mnesti.it/#/lettera/esci?u=<token_uscita>&lista=lettera` e la riga «Ricevi questa email perché ti sei iscritto alla lettera di Conscio»;
  - gli header `List-Unsubscribe: <https://…/functions/v1/porta?azione=esci_lettera&u=…&lista=lettera>, <mailto:…>` e `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
- **Al termine:** riga in `lettere_inviate`. Se alcuni invii falliscono, restituisci il conteggio di riusciti e falliti.

### Avviso del prossimo ciclo, in `/admin/cicli/:id`

Quando il ciclo è in `reclutamento`, mostra il pulsante «Avvisa gli iscritti (N)».
- Il testo è precompilato con titolo, date e link a `/iscrizione`, ed è modificabile.
- Destinatari: `stato = 'confermato' and avviso_ciclo = true and ultimo_ciclo_avvisato is distinct from <ciclo>`.
- Dopo l'invio imposta `ultimo_ciclo_avvisato = <ciclo>`, così nessuno riceve due volte l'avviso dello stesso ciclo.
- Usa `invia-lettera` con un parametro `tipo: 'avviso_ciclo'` e `ciclo_id`, oppure una funzione gemella: scegli la soluzione più semplice. Link di uscita con `lista=avviso_ciclo`.

## 6. Informativa e documenti

Aggiorna `/documenti/informativa`, oppure crea un documento breve `/documenti/lettera` e collegalo dal box. Deve dire:
- quali dati si trattano: email, scelte, date di consenso e conferma;
- per quale scopo, distinto per lista;
- la base giuridica (consenso) e che il consenso si revoca con un clic;
- il fornitore che spedisce, Resend, ed eventuali trasferimenti fuori dall'UE secondo le sue condizioni;
- i tempi di conservazione: richieste non confermate cancellate dopo 7 giorni; dopo l'uscita resta solo l'indirizzo, marcato come cancellato, per non scrivere più;
- che questi dati sono **separati** dallo studio pilota.

Aggiorna `versione_testo` in base alla data dell'informativa.

## 7. Verifiche

- Iscrizione con una sola lista e con entrambe; email non valida; nessuna lista scelta.
- La risposta di `iscrivi_lettera` è identica per email nuove, già confermate e cancellate.
- Senza conferma non si riceve niente; un link scaduto mostra il messaggio giusto.
- Il link di uscita disattiva solo la lista indicata; l'uscita con un clic da Gmail funziona (POST).
- Una riga `cancellato` non riceve più nulla finché la persona non si iscrive di nuovo e conferma.
- Da `anon`: `select` su `iscritti_lettera` negato.
- L'avviso dello stesso ciclo non parte due volte.
- Il box regge a 360 px e si usa con tastiera e lettore di schermo.

## 8. Fuori ambito

- Statistiche di apertura e clic.
- Segmentazione per città o interessi.
- Lettera in altre lingue.
- Import di contatti da altre liste.

## 9. A lavoro fatto

- `docs/architettura.md`: nuove tabelle, azioni di `porta`, funzione `invia-lettera`, route `/lettera/*`.
- `docs/interfaccia.md`: box in Ascolta, pagine `/lettera/*`, scheda «Lettera settimanale» e pulsante di avviso nel ciclo.
- `docs/progetto.md`: voce nel registro, con la regola che gli iscritti alla lettera sono separati dai partecipanti.
