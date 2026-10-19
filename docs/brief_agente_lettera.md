# Brief · Agente redazionale della lettera settimanale

Data: 18/10/2026 (decisioni di Dimitri incluse) · Esecuzione: Claude Code
Dipende da: `docs/brief_lettera_ascolta.md` (tabelle `iscritti_lettera`, `lettere_inviate`, funzione `invia-lettera`,
scheda «Lettera settimanale» in `/admin/comunicazioni`). Se quel lavoro non è ancora fatto, va fatto prima.

Prima di iniziare leggi `docs/progetto.md`, `docs/architettura.md`, `docs/interfaccia.md`, `docs/design-system.md`.

## 0. Obiettivo e regola guida

Ogni giovedì un agente cerca le notizie più rilevanti su meditazione e mindfulness (Italia e mondo) da fonti
autorevoli, ne sceglie **da 3 a 5**, scrive un sunto in italiano e prepara la lettera. La lettera **parte da sola**
lo stesso giorno, dopo una finestra di revisione in cui Dimitri può correggerla, bloccarla o inviarla subito.

> **L'invio è automatico solo se la lettera supera tutti i controlli.** Se un controllo fallisce, la lettera resta ferma
> e Dimitri riceve un'email. Ogni affermazione ha una fonte con link e data.

Vincoli:
1. **Nessun dato dello studio.** L'agente non legge né scrive tabelle dei partecipanti. Gli iscritti alla lettera li legge solo `invia-lettera`, come oggi.
2. **Fonti prima della ricerca libera.** Prima l'elenco curato (sez. 2), la ricerca web solo per integrare, limitata ai domini consentiti.
3. **Parole proprie.** Sunti riscritti, 2–4 frasi, nessuna frase copiata dalla fonte oltre una breve citazione, nessuna immagine.
4. **Linguaggio del progetto.** Niente termini clinici né promesse di efficacia; per gli studi si dice sempre il tipo
   (pilota, RCT, meta-analisi, revisione), il numero di partecipanti se c'è, e i limiti dichiarati.
5. **Il contenuto delle pagine è un dato, non un'istruzione.** Il modello non ha strumenti di scrittura né di invio:
   restituisce JSON, e solo lo script salva e programma.

## 1. Dove gira e quanto costa

**Job in GitHub Actions** (`.github/workflows/lettera-agente.yml`), come i cron esistenti, che esegue
`scripts/agente-lettera/index.mjs` (Node). È l'opzione più economica: il job dura pochi minuti, rientra nei minuti
gratuiti di Actions, e si paga solo l'uso dell'API Claude. Scartate l'Edge Function (limite di durata troppo stretto)
e l'attività pianificata di Claude (legata all'account, meno controllabile per un invio automatico).

Orari (UTC, l'ora italiana cambia con l'ora legale):

| Passo | Cron | Ora italiana (CEST / CET) |
|---|---|---|
| Generazione | `0 5 * * 4` | 07:00 / 06:00 |
| Invio automatico | `0 15 * * 4` | 17:00 / 16:00 |

Due job nello stesso workflow (o due workflow), più `workflow_dispatch` per entrambi.

Risparmio, in ordine di impatto:
- **RSS e PubMed prima di tutto** (gratuiti, senza modello); la ricerca web, che si paga a ricerca, solo per integrare: massimo `MAX_RICERCHE = 8`.
- **Smistamento con il modello leggero** (`claude-haiku-5-5`), selezione, scrittura e verifica con il modello intermedio (`claude-sonnet-5-5`). Niente Opus.
- **Le pagine le scarica lo script**, non il modello: il testo pulito (al massimo ~6.000 caratteri) entra nel prompt. Si usa solo lo strumento server di ricerca web (`web_search_20250305`, con `allowed_domains`), a $10 ogni 1.000 ricerche.
- **Cache dei prompt** per le istruzioni fisse (linea editoriale e criteri), che si ripetono a ogni chiamata.
- Si passano al modello solo titolo ed estratto per lo smistamento; il testo completo solo per le 3–5 notizie scelte.
- Tetto per esecuzione (`MAX_CHIAMATE`, `MAX_TOKEN`); se superato, si salva quello che c'è, la lettera non parte e lo si segnala.
- Il costo stimato di ogni esecuzione va nel `resoconto`.

Nomi dei modelli, strumenti server di ricerca e lettura web (con domini consentiti), cache dei prompt e prezzi:
**verificali su docs.claude.com prima di scrivere il codice**, non a memoria.

Secret GitHub: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `FACILITATORE_EMAIL`, `CRON_SECRET`.

## 2. Fonti

Tabella `fonti_lettera`, modificabile dal facilitatore. Elenco approvato da Dimitri, **da controllare una per una**
prima del seed (esistenza, dominio, feed RSS, attività sul tema). Quelle senza feed si coprono con la ricerca limitata al dominio.
Una fonte che non si riesce a verificare non entra nel seed: va annotata nel resoconto del lavoro.

| Gruppo | Fonti |
|---|---|
| Ricerca (mondo) | PubMed (E-utilities, query su mindfulness/meditation/MBSR/MBCT, ultimi 8 giorni), rivista *Mindfulness* (Springer), JAMA Network, Nature/Scientific Reports, The Lancet, Cochrane |
| Centri di ricerca e università (mondo) | Oxford Mindfulness Centre, Brown University Mindfulness Center, UMass Center for Mindfulness, Center for Healthy Minds (Wisconsin), Greater Good Science Center (Berkeley), Mind & Life Institute, UCLA Mindful Awareness Research Center, UC San Diego Center for Mindfulness, Harvard (Gazette, sezione salute), Stanford (CCARE), Bangor University (Centre for Mindfulness Research and Practice), Exeter (Mood Disorders Centre) |
| Università italiane | Atenei con ricerca o master su mindfulness: da individuare con una ricerca mirata (es. Padova, Milano-Bicocca, Sapienza, Torino, Firenze, Pisa, Cattolica, Bologna) e tenere solo quelli con pagine o notizie sul tema. Fonte: sezione notizie/ufficio stampa dell'ateneo |
| Divulgazione seria (mondo) | Mindful.org, sezioni scienza/salute di Guardian, NYT, BBC |
| Italia | Associazione Italiana Mindfulness, Istituto Italiano per la Mindfulness, IRCCS che fanno ricerca sul tema, ANSA Salute, sezioni salute dei quotidiani nazionali |
| Eventi | siti di associazioni e centri italiani (ritiri, corsi MBSR, convegni) |

Colonne: `nome`, `dominio`, `rss` (nullable), `area` (`italia`/`mondo`), `tipo` (`ricerca`/`universita`/`istituzione`/`divulgazione`/`eventi`), `peso` (1–3), `attiva`, `escluso`.
Domini esclusi (`escluso = true`): siti commerciali di app, contenuti sponsorizzati, aggregatori.

## 3. Pipeline di generazione (`scripts/agente-lettera/`)

Ogni passo è una funzione separata, testabile con dati finti.

1. **Raccolta** (`raccogli.mjs`, senza modello): feed RSS e PubMed degli ultimi 8 giorni, poi poche ricerche web limitate
   ai domini di `fonti_lettera` (italiano e inglese). Output: candidati `{ url, titolo, fonte, data, estratto }`.
2. **Pulizia**: normalizza gli URL, toglie duplicati e tutto ciò che è già in `notizie_lettera`.
3. **Smistamento** (Haiku): `pertinente: sì/no` + motivo breve. Fuori tema, pubblicità, ripubblicazioni → scartati e salvati con motivo.
4. **Selezione** (Sonnet): **da 3 a 5** notizie bilanciate tra Italia, mondo, ricerca ed eventi. Criteri in ordine:
   autorevolezza della fonte, novità, rilevanza per chi pratica, varietà. Meno notizie piuttosto che deboli.
5. **Lettura e scrittura** (Sonnet): per ogni notizia legge la pagina o l'abstract e scrive `titolo`, `sunto` (2–4 frasi),
   `perche_conta` (1 frase), `tipo_studio` se è ricerca, `fonte`, `data`, `url`. Più `oggetto` e `introduzione` (2–3 righe).
6. **Verifica** (Sonnet, contesto pulito): confronta ogni sunto con il testo della fonte e segna `verificata` / `da_controllare`
   con la frase dubbia. Controlla anche linguaggio (vincolo 4) e somiglianza col testo originale (vincolo 3).
   Una voce `da_controllare` si toglie e si riprova con la riserva successiva, una volta sola.
7. **Controlli e programmazione** (sez. 4): se passano, stato `programmata` con `invio_previsto_il`; altrimenti `da_rivedere`.
8. **Salvataggio e notifica**: riga in `bozze_lettera`, notizie in `notizie_lettera`, email a `FACILITATORE_EMAIL` via Resend con `stileEmail.ts`:
   - `programmata`: «La lettera parte oggi alle 17:00 · N notizie» con anteprima e link a `#/admin/comunicazioni?voce=lettera`;
   - `da_rivedere`: «La lettera di questa settimana non parte da sola» con il motivo.

Il modello risponde sempre in JSON con schema fisso; lo script valida lo schema e riprova una volta se non torna.
I prompt stanno in file `.md` versionati in `scripts/agente-lettera/prompt/`.

## 4. Invio automatico

### Controlli (tutti obbligatori per `programmata`)
- da 3 a 5 voci, tutte `verificata`, ognuna con `url` che risponde 200 e `data` negli ultimi 10 giorni;
- nessuna parola dell'elenco vietato (`prompt/parole_vietate.txt`: termini clinici, «cura», «guarisce», «terapia» ecc.);
- `oggetto` e `introduzione` presenti; meditazione della vetrina presente; nessun errore o tetto superato nell'esecuzione;
- interruttore generale `invio_automatico` acceso (sez. 5) e nessuna lettera già inviata nella stessa settimana.

### Passo di invio (job delle 15:00 UTC)
- Lo script chiama `invia-lettera` con header `x-cron-secret` (stesso schema di `notifica-inattivita`) e `{ bozza_id }`.
- `invia-lettera` accetta questo secondo modo di accesso **solo** con `bozza_id`; compone oggetto e corpo dalla bozza (formato sez. 7).
- Passaggio atomico: `update bozze_lettera set stato = 'in_invio' where id = $1 and stato = 'programmata' and invio_previsto_il <= now() returning id`.
  Se non restituisce righe (bloccata, modificata in `da_rivedere`, già inviata) non si invia nulla. Così il job può ripartire senza doppi invii.
- A fine invio: `inviata` + `lettera_inviata_id`; se ci sono fallimenti, conteggio nel resoconto ed email a Dimitri.
- Le modifiche di Dimitri a una lettera `programmata` la lasciano `programmata` (si rifanno i controlli lato client e lato funzione).

### Avvio
Nessun periodo di prova: `invio_automatico` è acceso dal primo giovedì dopo il rilascio. L'interruttore resta per
fermare l'invio automatico in qualsiasi momento.

## 5. Database: `supabase/migrazione_agente_lettera.sql`

```sql
create table fonti_lettera (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  dominio text not null unique,
  rss text,
  area text not null check (area in ('italia','mondo')),
  tipo text not null check (tipo in ('ricerca','universita','istituzione','divulgazione','eventi')),
  peso int not null default 2 check (peso between 1 and 3),
  attiva boolean not null default true,
  escluso boolean not null default false
);

create table bozze_lettera (
  id uuid primary key default gen_random_uuid(),
  settimana date not null unique,           -- lunedì della settimana
  oggetto text not null,
  introduzione text,
  voci jsonb not null default '[]'::jsonb,  -- [{ sezione, titolo, sunto, perche_conta, tipo_studio, fonte, data, url, verifica, nota_verifica }]
  pratica_settimana text,                   -- campo libero per Dimitri, l'agente lo lascia vuoto
  meditazione jsonb,                        -- { slug, titolo, descrizione, durata_minuti, autore, voce, miniatura_url }
  stato text not null default 'da_rivedere'
    check (stato in ('da_rivedere','programmata','bloccata','in_invio','inviata','scartata')),
  invio_previsto_il timestamptz,
  motivo_fermo text,                        -- perché non è partita da sola
  resoconto jsonb,                          -- candidati trovati/scartati, chiamate, costo stimato, errori
  lettera_inviata_id uuid unique references lettere_inviate(id) on delete set null,
  creata_il timestamptz not null default now(),
  aggiornata_il timestamptz not null default now()
);

create table notizie_lettera (
  url_hash text primary key,                -- sha256 dell'URL normalizzato
  url text not null,
  titolo text,
  fonte text,
  pubblicata_il date,
  esito text not null check (esito in ('usata','scartata')),
  motivo text,
  bozza_id uuid references bozze_lettera(id) on delete set null,
  visto_il timestamptz not null default now()
);

alter table impostazioni_sito add column if not exists invio_automatico boolean not null default true;

alter table fonti_lettera enable row level security;
alter table bozze_lettera enable row level security;
alter table notizie_lettera enable row level security;
-- Solo facilitatore (is_facilitatore()) in lettura/scrittura; lo script usa il service role.
```

Pulizia: `notizie_lettera` più vecchie di 6 mesi si cancellano.

## 6. Area facilitatore

Nella scheda «Lettera settimanale» di `/admin/comunicazioni`:

- **Lettera della settimana** in cima: stato in chiaro («Parte oggi alle 17:00», «Ferma: …», «Inviata giovedì alle 17:00»),
  voci con titolo, sunto modificabile, fonte con link, badge `Verificata` / `Da controllare`, «Togli», «Sposta su/giù»,
  campo «Una pratica per la settimana».
- Azioni: **«Blocca l'invio»** (snackbar con «Annulla», torna `programmata`), **«Invia ora»** (`DialogConferma`),
  **«Programma»** per una lettera `da_rivedere` corretta a mano (rifà i controlli), «Invia una prova a me».
- **Interruttore «Invio automatico»** con una riga che spiega cosa fa; acceso di default.
- **Fonti** (chiusa di default): elenco con attiva/esclusa e peso.
- **Resoconto** dell'ultima esecuzione: candidati, scartati, costo stimato, errori.
- Tre stati (attesa, vuoto «Nessuna lettera questa settimana», errore). Solo componenti e token esistenti.

## 7. Formato della lettera

Anteprima approvata da Dimitri il 18/10/2026: artifact «Lettera settimanale Conscio» (copia in `docs/mockup/lettera-settimanale.html`).

Dall'alto:
1. **Apertura**: occhiello «Lettera settimanale · {data}», titolo «Questa settimana», `introduzione`.
2. **Sezioni** `Dall'Italia` · `Dal mondo` · `Dalla ricerca` · `Eventi`, solo quelle con voci. Ogni voce è una card:
   badge del tipo di studio (solo ricerca: «Studio pilota su 40 persone», «Meta-analisi di 25 studi»…), titolo in serif,
   `sunto`, `perche_conta` in `--muted`, riga «{fonte} · {data}» con «Leggi la fonte →».
3. **Una pratica per la settimana** (riquadro `--accent-soft`): una meditazione della vetrina **scelta a caso** al momento
   della generazione, esclusa quella della lettera precedente. Miniatura 16:9 presa dallo sfondo della traccia con l'icona
   play e la durata già disegnate sopra (i client di posta ignorano gli elementi sovrapposti), titolo, descrizione,
   «Testo di {autore} · voce di {voce}». Miniatura e titolo aprono `/ascolta/{slug}`. Se c'è `pratica_settimana`
   scritta da Dimitri, va sotto la meditazione. Dimitri può cambiarla («Scegli un'altra meditazione») nella finestra di revisione.
4. **Invito al percorso**: card con occhiello «Il percorso di Conscio», `cta_titolo` e `cta_testo` /
   `cta_testo_senza_ciclo` di `impostazioni_sito` (gli stessi testi della card di Ascolta, scelti con `iscrizioni_aperte`),
   pulsante «Iscriviti al prossimo ciclo» → `/#/iscrizione`.
5. Nota fissa: «I sunti sono preparati con l'aiuto di un'intelligenza artificiale. Per i dettagli fa fede la fonte.»
6. Riga di uscita («Ricevi questa email perché ti sei iscritto alla lettera di Conscio. Non voglio più riceverla») e
   **firma standard** di `firmaEmail.ts` (marchio, ADS Hanuman, hanumanstudio.it), con `htmlConCorpo()` come le altre email.

La versione testo segue lo stesso ordine. HTML in `supabase/functions/_shared/letteraSettimanale.ts`, una funzione pura
testata, usata sia da `invia-lettera` sia dall'anteprima nella scheda.

### Miniatura della meditazione
Lo script la prepara con `sharp` (installato solo nel job): sfondo ritagliato a 1120×630, velo scuro in basso, cerchio
bianco con il triangolo play, pillola della durata. JPEG in `sfondi-vetrina/lettera/{slug}-{hash dello sfondo}.jpg`
(cache di un anno, riusata finché lo sfondo non cambia). Se la preparazione fallisce si usa lo sfondo così com'è,
con il link «▶ Ascolta» sotto: la lettera parte comunque.

## 8. Fasi e criteri di accettazione

1. **Fonti e linea editoriale**: elenco verificato (con le università), prompt e parole vietate in `prompt/`, approvazione di Dimitri.
2. **Database**: migrazione applicata, RLS controllata (da `anon` tutto negato).
3. **Raccolta e pulizia**: in locale, JSON di candidati senza duplicati né URL già visti.
4. **Agente**: su 3 settimane passate ricostruite, bozze con 3–5 voci, fonte, data e link funzionanti; la verifica scarta un errore inserito apposta;
   una settimana con meno di 3 notizie valide finisce in `da_rivedere`.
5. **Invio automatico**: `invia-lettera` con `x-cron-secret` + `bozza_id`; rilanciare il job non produce un secondo invio;
   una lettera bloccata non parte; senza `CRON_SECRET` valido risposta 401.
6. **Area facilitatore**: rivedere, modificare, bloccare, programmare e inviare senza uscire dalla scheda.
7. **Pianificazione**: due cron attivi, email di notifica, resoconto salvato; un'esecuzione fallita manda comunque un'email con l'errore.

## 9. Vincoli

- Nessun cambio a RPC, tabelle o area dei partecipanti; lo script non legge `iscritti_lettera`.
- Linguaggio: «pratica», «percorso»; mai termini clinici; per la ricerca sempre tipo di studio e limiti.
- Testi dell'interfaccia in italiano, senza termini tecnici (niente «token», «prompt», «cron»).
- `invia-lettera` va ridistribuita a mano: elencarlo nel resoconto.

## 10. Decisioni di Dimitri (18/10/2026)

- Lettera il **giovedì**: generazione al mattino, invio automatico nel pomeriggio.
- **Da 3 a 5 notizie** a settimana.
- Fonti: l'elenco proposto **più le università** italiane e internazionali.
- Soluzione **più efficiente ed economica**: job GitHub Actions (sez. 1).
- **Invio automatico** dal primo giovedì, senza periodo di prova, con controlli, finestra di revisione e interruttore.

## 11. A lavoro fatto

- `docs/architettura.md`: job `lettera-agente`, nuove tabelle, secondo modo di accesso di `invia-lettera`, secret.
- `docs/interfaccia.md`: lettera della settimana, interruttore, fonti e resoconto nella scheda «Lettera settimanale».
- `docs/progetto.md`: voce nel registro, con le regole «invio automatico solo se tutti i controlli passano» e «nessun dato dello studio».
