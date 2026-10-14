# Brief · Framework area facilitatore · fase 1 (token, guscio, componenti base)

14/10/2026. Da eseguire con Claude Code sul repo `conscio`.

**Leggi prima, in quest'ordine:**
1. `docs/framework_layout_facilitatore.md`: regole del layout, il *perché*.
2. `docs/brief_navigazione_facilitatore.md`: rotte, voci, reindirizzamenti, il *dove*. Questa fase coincide con la sua fase 1 (sez. 7).
3. `docs/design-system.md` e `docs/interfaccia.md`: token e componenti esistenti.
4. I mockup in `docs/mockup/framework-facilitatore/`, aperti nel browser (`index.html`):
   sono il riferimento visivo, con dati di esempio. Riproduci struttura, misure e comportamento, non i valori esadecimali
   (nel codice si usano i token).

## 0. Perimetro

**Dentro:**
- token nuovi;
- rotte `/admin` + reindirizzamenti (brief navigazione, sez. 2.2–2.3);
- `AdminChrome` rifatto con rail e barra in basso;
- i componenti condivisi della sez. 3;
- le pagine facilitatore esistenti montate dentro `PaginaAdmin` **col contenuto di oggi**.

**Fuori:**
- lo smontaggio di `Dashboard.jsx` e le schede del ciclo (fase 2 del brief navigazione);
- Tracce unificate (fase 3);
- qualsiasi cambio a RPC, dati, area partecipante.

Prima di scrivere codice, verifica nel repo e riporta in una lista breve:
- come è montato il router (`HashRouter` + `<Routes>` o `createHashRouter`);
- come `BarraBassa` è costruita oggi;
- dove sono i breakpoint 720/860/960;
- quali pagine usano `AdminChrome`.

Se qualcosa contraddice questo brief, fermati e chiedi.

## 1. Token (`src/styles/tokens.css` + `src/lib/colori.js`)

Aggiungi, senza toccare i valori esistenti:

```css
/* Classi di finestra (Material 3) — usare nelle media query come valori letterali, i custom property non valgono in @media */
--bp-media: 600px;      /* da qui rail compatto */
--bp-espansa: 840px;    /* da qui due pannelli */
--bp-ampia: 1200px;     /* da qui rail esteso */

/* Superfici */
--surface-rail: #EEE8D9;            /* surface-container: rail e barra in basso */
--inverse-surface: var(--ink);      /* fondo snackbar */
--inverse-on-surface: var(--bg);    /* testo snackbar */
--inverse-accent: #C9D9C4;          /* azione «Annulla» sulla snackbar (contrasto AA su --ink) */

/* Livelli di stato: sovrapposti con un ::before o background-image, colore = currentColor o --ink */
--state-hover: 0.08;
--state-focus: 0.10;
--state-press: 0.10;

/* Forma */
--radius-xl: 28px;      /* pannello di dettaglio, pannello di supporto, modali */

/* Misure del guscio */
--rail-esteso: 248px;
--rail-compatto: 88px;
--barra-bassa-h: 80px;
--pannello-elenco: 420px;
--pannello-supporto: 380px;
```

- `--surface-rail` e `--inverse-accent` vanno anche in `src/lib/colori.js`. Le email non ne hanno bisogno.
- Se la funzione Tonalità (`src/lib/tonalita.js`) ruota `--bg`, ruota anche `--surface-rail` con la stessa logica.
- In questa fase **non** migrare i breakpoint dell'area partecipante. Usa 600/840/1200 solo nei file nuovi e in `styles/admin.css`.

## 2. Rotte e guscio

Segui il brief navigazione, sez. 2.2–2.3:
- route padre `/admin` con `SoloFacilitatore` + `AdminChrome` + `<Outlet />`;
- tutte le rotte figlie;
- i reindirizzamenti dalle vecchie;
- login → `/admin/cicli`;
- il ramo facilitatore tolto da `Nav.jsx`;
- `pagineAdminAmpie` tolto da `App.jsx`.

Finché non esistono le pagine nuove, le rotte figlie montano le pagine attuali:

| Rotta | Pagina attuale |
|---|---|
| `/admin/cicli` | `Dashboard` |
| `/admin/cicli/:cicloId/programma` | `Percorso` |
| `/admin/tracce` | `Libreria` |
| `/admin/tracce/nuova` | `GeneraTraccia` |
| `/admin/comunicazioni` | parte facilitatore di `Comunicazioni` |
| `/admin/sito` | `EditorSplash` |

**Sezione attiva e azione principale.** Calcolale dal primo segmento dopo `/admin` con una mappa unica
in `src/lib/sezioniAdmin.js`:

```js
export const SEZIONI = [
  { id: 'cicli',         etichetta: 'Cicli',         icona: 'cicli',  azione: { etichetta: 'Nuovo ciclo',         a: '/admin/cicli?nuovo=1' } },
  { id: 'tracce',        etichetta: 'Tracce',        icona: 'tracce', azione: { etichetta: 'Nuova traccia',       a: '/admin/tracce/nuova' } },
  { id: 'comunicazioni', etichetta: 'Comunicazioni', icona: 'posta',  azione: { etichetta: 'Nuova comunicazione', a: '/admin/comunicazioni?nuova=1' } },
  { id: 'sito',          etichetta: 'Sito',          icona: 'sito',   azione: null },
]
```

I parametri `?nuovo=1` e `?nuova=1` aprono il modulo di creazione che oggi si apre con un bottone nella pagina.
Togli quel bottone dalla pagina: l'azione vive solo nel guscio.

## 3. Componenti nuovi

Metti i componenti in `src/components/admin/`, salvo dove indicato, e le classi in `src/styles/admin.css`. Solo token.

### 3.1 `useClasseFinestra()` (`src/lib/useClasseFinestra.js`)
Restituisce `'compatta' | 'media' | 'espansa' | 'ampia'` con `matchMedia` (600/840/1200), aggiornato al ridimensionamento.

### 3.2 `BarraNavigazione` (`src/components/BarraNavigazione.jsx`, condiviso)
È la parte grafica estratta da `BarraBassa`. Props: `voci=[{ a, etichetta, icona, badge?, attiva }]`, `aria-label`.
- Barra fissa in basso, alta `--barra-bassa-h`, fondo `--surface-rail`.
- Voci a colonna: indicatore a pillola 64×32 dietro l'icona (`--accent-soft` sulla voce attiva), etichetta 12px sotto.
- `aria-current="page"` sulla voce attiva.
- Badge numerico in alto a destra dell'indicatore (`--danger`, testo bianco, 18px).

`BarraBassa` del partecipante deve usare questo componente senza alcun cambio visibile: controlla prima e dopo.

### 3.3 `RailNavigazione`
Props: `sezioni`, `attiva`, `badge`, `esteso`, `onEsci`. Fondo `--surface-rail`, altezza 100vh, `position: sticky; top: 0`.

**Esteso** (`--rail-esteso`):
- dall'alto: marchio «Conscio» in serif 26px con occhiello «Facilitatore»;
- FAB esteso dell'azione principale: alto 56, raggio 16, `--accent`, testo bianco 15px 600, icona +;
- voci a riga alte 56 a pillola piena (`--accent-soft` + 600 sulla voce attiva), badge a destra;
- «Esci» in fondo.

**Compatto** (`--rail-compatto`):
- marchio ridotto a «C»;
- FAB solo icona 56×56 con `aria-label`;
- voci come nella barra in basso (indicatore 56×32, etichetta sotto);
- «Esci» in fondo.

Se la sezione non ha azione (Sito), al posto del FAB c'è uno spazio vuoto della stessa altezza, così le voci non saltano.
Mockup: `cicli-1280.html` (esteso), `ciclo-pratica-768.html` (compatto).

### 3.4 `AdminChrome` (rifatto)
- `compatta` → contenuto + `BarraNavigazione` in basso + FAB esteso fisso in basso a destra, sopra la barra
  (16px dal bordo, 16px sopra la barra);
- `media` / `espansa` → `RailNavigazione` compatto + contenuto;
- `ampia` → `RailNavigazione` esteso + contenuto.

Il badge di «Cicli» vale segnalazioni difficili aperte + iscrizioni in attesa. Leggilo con le funzioni che la Dashboard usa già;
nessuna RPC nuova.

Sotto i 600px «Esci» va nel menu ⋯ di `PaginaAdmin`: il guscio lo passa tramite context.

### 3.5 `PaginaAdmin`
Props: `titolo`, `meta?`, `indietro?: { a, etichetta }`, `contesto?` (nodo, es. selettore ciclo), `azione?` (nodo: al massimo
un pulsante secondario o uno `SplitButton`), `menu?: [{ etichetta, onClick, pericolo? }]`, `schede?: [{ a, etichetta }]`,
`layout: 'flusso' | 'elenco-dettaglio' | 'supporto'`, `stato?: 'attesa' | 'vuoto' | 'errore'`, `children`.

- **Barra della pagina:** riga con [indietro] / titolo in serif `--fs-display` + meta `--fs-small` `--muted` / [contesto] [azione] [⋯].
  Padding 32px 40px 24px da `espansa` in su, 16px 20px 8px su `compatta`.
  Sotto i 600px «indietro» diventa un'icona ← (44px) a sinistra del titolo.
- **Schede:** link in fila, `role="tablist"`, voce attiva con bordo inferiore 3px `--accent` e `aria-current="page"`.
  Su schermo stretto scorrono in orizzontale. Mockup: `ciclo-pratica-768.html`.
- **Corpo:** padding laterale 40px (`espansa`+), 24px (`media`), 16px (`compatta`).
  - `flusso` = griglia a 12 colonne, gap 24;
  - `elenco-dettaglio` e `supporto` = flex a due colonne (sez. 3.6–3.7).
- **Stati:** con `stato` impostato, il corpo mostra `StatoAttesa`, `StatoVuoto` o `.avviso-errore`; la barra resta visibile.

### 3.6 `PannelloDettaglio` + layout elenco–dettaglio
`PaginaAdmin layout="elenco-dettaglio"` riceve due figli: `<ElencoPannello>` e `<PannelloDettaglio aperto onChiudi>`.
- **Da `espansa`:** elenco largo `--pannello-elenco` (card, righe separate da `--border-soft`, riga selezionata `--surface-muted`);
  dettaglio a destra, fondo `--surface`, raggio `--radius-xl`, scroll interno, chiusura ✕ in alto a destra.
  Senza selezione, il dettaglio mostra uno `StatoVuoto` («Scegli una traccia»).
- **Sotto `espansa`:** con `aperto`, il dettaglio prende tutta la pagina e la barra della pagina mostra ← al posto del titolo
  della lista; senza `aperto`, solo l'elenco.

Mockup: `tracce-1280.html`. In questa fase basta il componente con una pagina di prova; Tracce lo userà in fase 3.

### 3.7 Layout di supporto
Area principale flessibile + `<PannelloSupporto>` largo `--pannello-supporto`, fondo `--surface-rail`, raggio `--radius-xl`.
Sotto `espansa` il pannello va sotto il contenuto. Mockup: `sito-1280.html`. Usalo subito per `/admin/sito`
(editor a sinistra, anteprima della splash a destra se `EditorSplash` la offre già; altrimenti pannello vuoto e una nota nel resoconto).

### 3.8 Snackbar
`SnackbarProvider` dentro `AdminChrome` + hook `useSnackbar()` → `mostra({ testo, annulla?: () => Promise|void })`.
- Fondo `--inverse-surface`, testo `--inverse-on-surface` 14px, azione «Annulla» `--inverse-accent` 600, raggio 8, alta almeno 48.
- In basso al centro dell'area contenuto (non della finestra); sotto i 600px sopra la barra in basso; `role="status"`.
- Una sola alla volta: la nuova sostituisce la vecchia. Si chiude dopo 6 s, o dopo 10 s se ha «Annulla».
- Entra con una dissolvenza e un movimento di 8px, tolti con `prefers-reduced-motion`.

Collegala subito a **una** azione esistente reversibile come prova: «Segna come gestita» sulle segnalazioni difficili.
«Annulla» la riapre con la stessa funzione di `lib/`, se ne esiste una; se non esiste, **non** crearne una nuova:
mostra la snackbar senza «Annulla» e annotalo.
Regole complete: brief navigazione, sez. 4bis.

### 3.9 `SplitButton`
Pulsante tonale (`.btn-tonal`) diviso in due: azione principale + freccia che apre un menu.
Raggi 12/4/4/12 e 4/12/12/4, separazione di 2px.
Props: `etichetta`, `onClick`, `opzioni=[{ etichetta, onClick }]`. Il menu si chiude con Esc e clic fuori; frecce su/giù per muoversi.
Mockup: `tracce-1280.html` («Controlla tutte»). Montalo su `/admin/tracce` al posto dei bottoni di controllo attuali,
se la pagina li ha già.

### 3.10 Livelli di stato
Una regola comune in `admin.css` per `.btn`, voci del rail e della barra, chip e righe cliccabili: velo `currentColor` con
opacità `--state-hover` al passaggio e `--state-press` alla pressione, più `:focus-visible` con anello 2px `--accent` e offset 2px.
Niente ombre al passaggio nell'area facilitatore.

## 4. Criteri di accettazione

1. A 390, 768, 1024 e 1440px la navigazione ha la forma attesa:
   - 390: barra in basso + FAB;
   - 768 e 1024: rail compatto;
   - 1440: rail esteso.

   Confronta con i mockup.
2. Ogni pagina facilitatore ha la barra della pagina di `PaginaAdmin`; nessuna testata propria e nessun bottone
   «Nuovo …» dentro le pagine.
3. Tutti i vecchi indirizzi del brief navigazione (sez. 2.3) portano alla rotta nuova; nessuna pagina facilitatore fuori da `/admin`.
4. `BarraBassa` del partecipante è identica a prima.
5. «Segna come gestita» mostra la snackbar (con o senza «Annulla», sez. 3.8).
6. `npm run build` passa; nessun colore esadecimale nuovo fuori da `tokens.css` e `colori.js`.
7. Tastiera: Tab attraversa rail → barra della pagina → schede → corpo nell'ordine visivo; focus visibile ovunque.

## 5. A lavoro fatto

- Aggiorna `docs/design-system.md` (sezione «Componenti condivisi»): `BarraNavigazione`, `RailNavigazione`, `PaginaAdmin`,
  `PannelloDettaglio`, `PannelloSupporto`, `Snackbar`, `SplitButton`, livelli di stato, token nuovi.
- Aggiorna `docs/interfaccia.md`: guscio facilitatore (sez. 1) e catalogo (sez. 3).
- Aggiorna il registro in `docs/progetto.md`.
- Fai un commit per blocco (token · rotte · guscio · componenti · documentazione), messaggi in italiano.
- Chiudi con un resoconto breve: cosa è fatto, cosa è rimasto fuori e perché, decisioni prese in autonomia.

## 6. Aggiornamento dopo la verifica del repo (14/10/2026)

La verifica di Claude Code ha mostrato che le fasi 1–3 del brief navigazione sono già fatte (13/10). Valgono queste decisioni,
che prevalgono sulle sezioni sopra:

- **Rotte (sez. 2):** già fatte, si salta il blocco. Le pagine di `pages/admin/` passano dentro `PaginaAdmin`.
  La mappa `SEZIONI` serve comunque per il rail; se esiste già un equivalente, si riusa quello.
- **Tracce (sez. 3.6):** `Tracce.jsx` usa subito `PannelloDettaglio`. `PannelloLaterale` si elimina: nessun doppione.
- **`--radius-xl`:** passa da 24 a 28px, un solo token come la scala M3. Si controllano a occhio le due superfici del partecipante
  che lo usano (modale e foglio dal basso). Niente `--radius-pannello`.
- **Barra in basso (sez. 3.2):** si tiene il componente esistente `BarraVoci`, con una variante facilitatore
  (pillola 64×32, badge 18px). La variante del partecipante resta identica.
- **Colori:** contano i token, non gli esadecimali dei mockup. Il badge usa `--danger`.
  Con l'indicatore attivo `--accent-soft` (#E8ECE3) su `--surface-rail` (#EEE8D9) la pillola rischia di non vedersi.
  Se a schermo non si distingue, si aggiunge `--accent-indicatore: #DDE5D8` in `tokens.css` e `colori.js`, solo per gli
  indicatori di rail, barra e chip selezionati. La voce attiva resta comunque riconoscibile anche senza colore:
  testo `--ink` 600 e `aria-current`.
