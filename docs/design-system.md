# Conscio · design system e strategia di implementazione

Analisi del repository (`salonbookingsystemou-dot/conscio`, commit `1e454c0`) fatta per rispondere a un
problema concreto: **nell'area facilitatore coesistono due linguaggi visivi diversi**, nati in momenti
diversi senza una decisione esplicita. Questo documento registra la diagnosi, poi definisce un sistema
unico di token e componenti, poi una strategia di migrazione a fasi. Va letto insieme a `docs/progetto.md`
(regole sui dati, definizioni condivise) di cui è il complemento sul lato visivo.

Vetrina visiva dei token e dei componenti proposti (sezione 3): `docs/mockup/design-system.html`
(aprilo nel browser; un pulsante alterna Tema Partecipante / Tema Facilitatore sulla stessa pagina).

---

## 1. Diagnosi: cosa c'è oggi

Tre file CSS, caricati in quest'ordine in `src/main.jsx`:

| File | Righe | Cosa definisce | Chi lo usa |
|---|---|---|---|
| `src/styles/tokens.css` | 61 | Token globali + override colore di `.mbsr-theme` | Tutta l'app (import globale) |
| `src/styles.css` | 5356 | Sistema originale: token base + quasi tutti i componenti | Tutte le schermate partecipante; **anche** Dashboard (tab Cicli/Questionari), Comunicazioni, Segnala |
| `src/styles/admin.css` | 1396 | Sistema "redesign": componenti `.admin-*`, `.editor-*`, `.percorso-*`, `.pratica-*` | Solo `Libreria.jsx`, `EditorSettimana.jsx`, `Percorso.jsx`, `SchedaPratica.jsx` (tab Pratica della dashboard) |

### 1.1 Il meccanismo di aggancio esiste già, ma è a metà

Chi ha scritto `tokens.css` aveva capito il problema e ha provato a risolverlo con `.mbsr-theme`, la
classe che `AdminChrome.jsx` applica a tutta l'area facilitatore: **ridefinisce i nomi di variabile già
usati da `styles.css`** (`--ink`, `--bg`, `--surface`, `--border`, `--danger`) con i nuovi valori. Questo
funziona per il colore: un vecchio componente come `.card`, scritto con `background: var(--surface)`,
cambia colore automaticamente dentro l'area facilitatore, senza essere stato toccato.

Il bridging però si ferma al colore:

- **Tipografia**: `styles.css` non usa mai una variabile per il font, scrive ovunque il letterale
  `font-family: 'Fraunces', serif` o `'Inter', sans-serif` (26 occorrenze). `.mbsr-theme` non può
  sovrascrivere un letterale. Risultato: i titoli della tab "Cicli" restano in Fraunces anche dentro
  l'area facilitatore, mentre i titoli di `SchedaPratica` (che usa `var(--font-display)`, definito
  globalmente come Instrument Serif) sono nell'altro font. **Due font-serif diversi nella stessa
  dashboard.**
- **Spaziatura e raggi**: `styles.css` usa quasi ovunque numeri letterali (`padding: 24px`,
  `border-radius: 10px`, `border-radius: 12px` per `.btn` anche se esiste già `--radius-md: 12px` — non
  è nemmeno riusato all'interno dello stesso file). `admin.css` usa la sua scala (`--space-4..36`,
  `--radius-md/xl/pill`) in modo disciplinato. Le due scale non coincidono (`--radius-sm/md/lg` di
  `styles.css` è 8/12/16px; la nuova aggiunge `--radius-xl: 24px` e `--radius-pill: 999px` sopra,
  senza sostituire le prime tre).
- **Breakpoint**: `styles.css` usa 8 soglie diverse (`480/560/640/720/860/960/1099/1100`), `admin.css`
  ne usa 5 diverse e in parte sovrapposte ma non identiche (`640/720/800/899/900`). Nessuna delle due
  liste è dichiarata come scala ufficiale da qualche parte.
- **Componenti doppi**: esistono due card (`.card` vs `.admin-card`), due sistemi di pulsanti (`.btn`/
  `.btn-ghost`/`.btn-tonal`/`.btn-text` vs `.admin-btn-primario`/`.admin-btn-ghost`/`.admin-btn-pericolo`),
  due badge, due form field (`.field` vs `.admin-field`) — concettualmente identici, scritti due volte con
  proprietà leggermente diverse (es. altezza minima pulsante 48px nel vecchio, 42px nel nuovo).

### 1.2 Anche il sistema "vecchio" da solo non è pulito

Non è solo un problema di convivenza fra due sistemi: `styles.css` da solo ha già drift interno.
Esempi trovati con una scansione dei colori esadecimali fuori da `:root`: `#24312C` (= `--ink`),
`#EFF1EA` (= `--bg`), `#FBFAF6` (= `--surface`) e `#E9E3D3` (= `--border` di `.mbsr-theme`) compaiono
come **letterali** in punti del file invece che come variabile — probabilmente copiati a mano invece che
riusati. Più altri colori "orfani" mai promossi a token (`#8B5E4B`, `#C45B4A`, `#8A8F88`…) usati poche
volte ciascuno. Unificare i due sistemi è quindi anche l'occasione per far rispettare la disciplina dei
token nel sistema che resterà.

### 1.3 Cosa NON è il problema

Lo split fra area **Partecipante** (Fraunces + Inter, palette carta/terra, "calma, non dataviz clinico" —
scelta di design esplicita e documentata) e area **Facilitatore** (più densa, orientata ai dati) è
intenzionale e va mantenuto: sono due pubblici con esigenze diverse. Il problema è che **dentro** l'area
Facilitatore ci sono due implementazioni concorrenti dello stesso linguaggio, non che le due aree siano
diverse fra loro.

---

## 2. Principio guida

**Un'unica architettura di token, due superfici (temi) che la valorizzano diversamente.**

- I *nomi* dei token (`--ink`, `--surface`, `--space-16`, `--radius-md`, `--font-display`…) sono unici e
  condivisi da tutta l'app.
- I *valori* possono cambiare per superficie tramite uno scoping esplicito (`.tema-partecipante` /
  `.tema-facilitatore`, evoluzione di `.mbsr-theme`), mai tramite un secondo file di componenti paralleli.
- Ogni concetto di interfaccia (card, pulsante, badge, campo, tab, tabella) ha **un solo componente**,
  parametrizzato dai token — non un `.card` e un `.admin-card`.

---

## 3. Specifica dei token

### 3.1 Primitivi (uguali ovunque, nessuna sovrascrittura per tema)

```css
:root {
  /* Spaziatura — sostituisce sia i letterali di styles.css sia --space-* di tokens.css */
  --space-4: 4px;  --space-6: 6px;  --space-8: 8px;   --space-10: 10px;
  --space-12: 12px; --space-14: 14px; --space-16: 16px; --space-18: 18px;
  --space-20: 20px; --space-22: 22px; --space-24: 24px; --space-28: 28px;
  --space-32: 32px; --space-36: 36px;

  /* Raggi — un'unica scala, sostituisce --radius-sm/md/lg *e* --radius-xl/pill */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-pill: 999px;

  /* Tipografia — dimensioni (i font restano per tema, vedi 3.2, tranne il display: vedi sotto) */
  --fs-eyebrow: 11px;  --ls-eyebrow: 0.12em;
  --fs-label: 13px;
  --fs-meta: 13px;
  --fs-body: 15px;
  --fs-title: 1.5rem;   /* participant: usato per h2 di sezione */
  --fs-page: 30px;      /* facilitatore: titolo di pagina */
  --fs-card: 32px;      /* facilitatore: numero grande in una stat card */

  /* Font dei titoli — deciso il 30/9/2026: UNICO per entrambi i temi (vedi 3.2bis).
     Sostituisce Fraunces (participant) e Instrument Serif (facilitatore). */
  --font-display: 'Source Serif 4', serif;

  /* Ombre (solo facilitatore le usa oggi; restano disponibili a entrambi) */
  --shadow-hover: 0 8px 18px -12px rgba(38, 36, 26, 0.25);
  --shadow-elevated: 0 24px 48px -20px rgba(38, 36, 26, 0.22);

  /* Breakpoint di riferimento (valori concettuali, non var CSS — vedi 3.4) */
}
```

Nota sulla tipografia: `--fs-title` (participant) e `--fs-page`/`--fs-card` (facilitatore) restano nomi
distinti perché rispondono a gerarchie visive diverse (il participant ha una gerarchia di titoli più
piatta), ma nessuno dei due va più scritto come numero letterale nei componenti.

### 3.2bis Font dei titoli: un solo font condiviso

Decisione del 30/9/2026: invece di un `--font-display` diverso per tema (Fraunces per il partecipante,
Instrument Serif per il facilitatore), **un solo font dei titoli per tutta l'app: Source Serif 4**
(Google Fonts, variabile, ottimo per numeri tabellari — importante per le stat tile della dashboard).
Il font del corpo testo resta invece diverso per tema (Inter / Public Sans, vedi 3.2): la scelta riguarda
solo `--font-display`, non `--font-body`.

Motivo: fra le alternative confrontate (Fraunces, Newsreader, Source Serif 4, Piazzolla — vedi
`docs/mockup/font-titoli-alternative.html`), Source Serif 4 è quella pensata per la leggibilità dei numeri
in contesti densi di dati, il caso d'uso più frequente lato facilitatore (punteggi, medie, contatori).

Implicazioni sul caricamento dei font:

- **Da rimuovere**: `Fraunces` dalla riga `@import` di Google Fonts in cima a `src/styles.css` (Inter
  resta, è ancora il font body del tema partecipante).
- **Da sostituire**: l'import self-hosted `@fontsource/instrument-serif` in `src/styles/tokens.css` con
  `@fontsource/source-serif-4` (stesso meccanismo di auto-hosting già usato per Instrument Serif e Public
  Sans, per coerenza e per il precache PWA offline).
- Verificare che nessuna regola in `styles.css` scriva ancora `font-family: 'Fraunces'` come letterale
  dopo la fase 1 della migrazione (sezione 6): a quel punto ogni titolo passa da `var(--font-display)`.

### 3.2 Semantici per tema

```css
/* Partecipante — valori di oggi, solo dichiarati esplicitamente come tema invece di essere il :root implicito */
.tema-partecipante {
  --ink: #24312C;
  --ink-soft: #5B665F;
  --bg: #EFF1EA;
  --surface: #FBFAF6;
  --moss: #4B6B57;
  --moss-dark: #2F4438;
  --ochre: #A8763E;
  --border: #DAD9CE;
  --danger: #A3402F;
  --tint: color-mix(in srgb, var(--moss) 18%, var(--surface));
  --tint-ochre: color-mix(in srgb, var(--ochre) 22%, var(--surface));
  --primary: var(--moss);
  --on-primary: #fff;
  --primary-container: var(--tint);
  --on-primary-container: var(--moss-dark);

  /* --font-display non va più ridefinito qui: è un primitivo condiviso, vedi 3.1/3.2bis */
  --font-body: 'Inter', sans-serif;
}

/* Facilitatore — valori di oggi di .mbsr-theme, estesi a coprire anche i token che oggi restano "a metà" */
.tema-facilitatore {
  --ink: #262419;
  --bg: #F5F1E7;
  --surface: #FFFFFF;
  --border: #E9E3D3;
  --border-soft: #F0ECDF;
  --border-dashed: #E3DDC9;
  --danger: #A6503C;
  --danger-soft: #F3E6E0;
  --muted: #8A836F;
  --accent: #3F5443;
  --accent-soft: #E8ECE3;
  --primary: var(--accent);
  --on-primary: var(--surface);
  --primary-container: var(--accent-soft);
  --on-primary-container: var(--accent);

  /* --font-display non va più ridefinito qui: è un primitivo condiviso, vedi 3.1/3.2bis */
  --font-body: 'Public Sans', sans-serif;
}
```

Con questo schema, un componente canonico scrive sempre `var(--primary)`, `var(--font-display)`,
`var(--radius-md)` — mai un font o un colore letterale — e si adatta da solo al tema in cui viene
montato, esattamente come oggi succede già per `--ink`/`--bg`/`--surface` grazie a `.mbsr-theme`, ma
esteso a tutto.

`.tema-facilitatore` sostituisce `.mbsr-theme` (stesso ruolo, nome più leggibile e coerente con
`.tema-partecipante`); si applica allo stesso punto (`AdminChrome.jsx`), `.tema-partecipante` va aggiunto
al contenitore radice delle rotte non-facilitatore in `App.jsx`.

### 3.3 Componenti canonici (mappa vecchio → nuovo)

| Concetto | Nome oggi (participant) | Nome oggi (facilitatore) | Nome canonico unico |
|---|---|---|---|
| Superficie con bordo | `.card` | `.admin-card` | `.card` |
| Pulsante primario | `.btn` | `.admin-btn-primario` | `.btn` (variante `.btn-primario` di default) |
| Pulsante secondario | `.btn-ghost` | `.admin-btn-ghost` | `.btn-ghost` |
| Pulsante distruttivo | (non esiste, vedi `.btn-ciclo-elimina` ad hoc) | `.admin-btn-pericolo` | `.btn-pericolo` |
| Etichetta piccola colorata | `.badge` | (non esiste ancora) | `.badge` |
| Campo di modulo | `.field` | `.admin-field` | `.field` |
| Messaggio di sistema/avviso | `.disclaimer` / `.campo-errore` | `.admin-alert` | `.alert` (varianti `is-info`/`is-errore`) |
| Riga elenco cliccabile | `.card-click` | `.admin-riga` | `.riga-lista` |

Ogni riga di questa tabella diventa **una** definizione CSS, scritta con i token, dentro un unico file
di componenti condiviso (vedi 4). Le differenze visive fra le due superfici (raggio più stretto, ombra
diversa, ecc.) restano possibili tramite i token di tema, non tramite una seconda classe.

### 3.4 Breakpoint

Adottare un'unica scala, la più piccola che copre i casi reali già visti nei due file:

```
360px  — larghezza minima garantita (già un vincolo esplicito in più brief)
480px
640px
860px
1100px
```

Ogni combinazione `min-width`/`max-width` oggi sparsa nei due file va ricondotta a una di queste quattro
soglie durante la migrazione (fase 2), non introdotta come quinta soglia nuova.

---

## 4. Struttura dei file (destinazione)

```
src/styles/
  tokens.css        — SOLO variabili: primitivi + .tema-partecipante + .tema-facilitatore (sez. 3.1-3.2)
  componenti.css     — SOLO i componenti canonici della tabella 3.3, scritti con i token
  partecipante.css   — regole specifiche delle schermate partecipante (layout di pagina, non componenti generici)
  facilitatore.css   — regole specifiche delle schermate facilitatore (dashboard, editor, libreria)
```

`styles.css` e `admin.css` vengono smontati dentro questa struttura durante la migrazione (fase 2-3), non
rinominati di peso: molto del loro contenuto è layout specifico di una pagina (es. `.tp-card`,
`.editor-settimane`) e resta dov'è concettualmente, solo riscritto con i token invece che con letterali.

---

## 5. Regola per non ricadere nello stesso problema

Prima di scrivere una nuova regola CSS, chi lavora al progetto (Cursor, Claude, chiunque altro)
controlla, in quest'ordine:

1. **Esiste già un token per questo valore** (colore, spaziatura, raggio, font)? Usalo. Non scrivere un
   numero o un colore letterale se un token con quel valore esiste.
2. **Esiste già un componente per questo concetto** nella tabella 3.3? Estendilo con una variante o un
   modificatore (`.btn.is-piccolo`), non crearne uno parallelo con un nome diverso.
3. Se serve davvero un token o un componente nuovo, **aggiungilo al file condiviso**, non dentro il CSS
   della singola pagina, e annotalo nel registro di `docs/progetto.md` come già si fa per le decisioni sul
   database.

Questa regola va scritta anche in `CLAUDE.md` (si veda la fase 4 sotto), così ogni sessione futura la
vede prima di iniziare.

---

## 6. Strategia di implementazione

Migrazione incrementale, non un rewrite in un colpo solo: il rischio di regressione visiva è alto (5300+
righe coinvolte) e il progetto è già in uso con partecipanti reali. Ogni fase è verificabile da sola e
lascia l'app funzionante.

### Fase 0 — Consolidare i token (basso rischio, un solo file)

- Riscrivere `tokens.css` secondo la sezione 3.1-3.2: primitivi unici, `.tema-partecipante` e
  `.tema-facilitatore` con i valori *di oggi* (nessun cambio visivo atteso in questa fase).
- Aggiungere `.tema-partecipante` al contenitore radice non-facilitatore in `App.jsx` (oggi non ha una
  classe di tema esplicita, si appoggia solo al `:root` implicito).
- Rinominare `.mbsr-theme` in `.tema-facilitatore` (o mantenerlo come alias per un periodo, per non
  rompere riferimenti che potrebbero esserci in altri punti — verificare con una ricerca testuale prima
  di rimuoverlo).
- **Criterio di completamento**: build che compila, nessuna differenza visiva percepibile (i valori sono
  identici a prima, solo riorganizzati).

### Fase 1 — Bonificare i letterali nei componenti condivisi più usati

- `.card`, `.btn`/`.btn-ghost`/`.btn-tonal`/`.btn-text`, `.badge`, `.field`, `.disclaimer`,
  `.campo-errore`: sostituire ogni font-family, colore esadecimale e valore di spaziatura/raggio
  letterale con il token equivalente della sezione 3.1.
- Questi componenti sono usati da **entrambe** le superfici (participant e le parti non ancora migrate
  del facilitatore, es. Comunicazioni): appena i letterali diventano token, ereditano automaticamente il
  tema corretto ovunque siano montati, senza toccare i componenti "gemelli" nuovi (`.admin-btn-*` ecc.,
  che restano per ora, verranno ritirati in fase 3).
- **Criterio di completamento**: le schermate partecipante sono visivamente identiche a prima (stesso
  tema, valori uguali); `Comunicazioni.jsx` visto da un facilitatore comincia già ad avvicinarsi
  visivamente al resto dell'area facilitatore (font corretto, raggi coerenti), pur usando ancora nomi di
  classe "vecchi".

### Fase 2 — Migrare la Dashboard (Cicli, Questionari) al linguaggio unico

- La parte più grossa e più visibile: le tab "Cicli" e "Questionari" di `Dashboard.jsx` oggi usano
  `.dash-*`, `.tp-card`, `.card`, `.badge`, `.orientamento-*` scritte per il tema partecipante.
- Con i componenti canonici già pronti (fase 1) e montati dentro `.tema-facilitatore` (già applicato da
  `AdminChrome`), gran parte del lavoro è verificare che ogni classe specifica della dashboard
  (`.dash-kpi-card`, `.dash-panel`…) usi i token invece di valori propri, e allinearne spaziatura/raggio
  alla stessa scala di `SchedaPratica`/`admin.css`.
- Consolidare i breakpoint della dashboard sulle quattro soglie della sezione 3.4.
- **Criterio di completamento**: aprendo la dashboard e passando fra le quattro tab (Cicli, Questionari,
  Pratica, Sito) il font dei titoli, lo stile dei pulsanti e delle card non cambia più da una tab
  all'altra.

### Fase 3 — Ritirare i doppioni

- Una volta che Dashboard, Comunicazioni e Segnala sono migrate, `.admin-btn-*`, `.admin-card`,
  `.admin-field`, ecc. non hanno più bisogno di esistere separatamente da `.btn`, `.card`, `.field`:
  rimuovere le definizioni duplicate da `admin.css`, far puntare `Libreria.jsx`/`EditorSettimana.jsx`/
  `Percorso.jsx` ai nomi canonici.
- Spostare quel che resta di `admin.css` (layout specifico di editor/percorso, non componenti generici)
  dentro `facilitatore.css` secondo la struttura della sezione 4.
- **Criterio di completamento**: `admin.css` non contiene più definizioni di componenti generici, solo
  layout di pagina; nessuna classe `.admin-btn-*`/`.admin-card`/`.admin-field` resta referenziata nel
  codice JSX.

### Fase 4 — Governance

- Aggiungere la checklist della sezione 5 a `CLAUDE.md`.
- Aggiungere una riga in `docs/progetto.md` che rimanda a questo documento come fonte di verità per lo
  stile, accanto alle "Regole sui dati" già presenti.

### Rischi e mitigazioni

- **Regressione visiva silenziosa**: dopo ogni fase, controllo visivo manuale delle schermate toccate
  (partecipante: Iscrizione, Questionari, Programma; facilitatore: le quattro tab della Dashboard,
  Libreria, Comunicazioni) a 360px e a desktop, non solo lettura del diff CSS.
  Comunicazioni/Segnala/Questionari andrebbe fatto anche a schermo intero, non solo a 360px.
- **Lavoro concorrente su più sessioni**: dato che il problema è nato proprio da questo, ogni fase va
  registrata in `docs/progetto.md` appena iniziata (non solo a fine fase), così una sessione parallela la
  vede prima di scrivere CSS nuovo nello stesso punto.
- **Le fasi 2-3 sono le più costose**: possono essere ulteriormente spezzate per singola tab/pagina se
  il tempo disponibile è poco; l'ordine proposto (Cicli prima di Questionari, per esempio) non è
  vincolante, ma completare l'intera fase 1 prima di iniziare la fase 2 sì — altrimenti si migrano
  componenti che cambiano di nuovo poco dopo.
