# Conscio · design system

Riferimento visivo: la scheda **Pratica** del facilitatore (`docs/mockup/pratica.html`,
`src/components/SchedaPratica.jsx`). Vale per l'app del partecipante, l'area facilitatore e le email:
**un solo tema**, senza distinzione fra partecipante e facilitatore. Supera la proposta a due temi
del 30/9/2026 (`.tema-partecipante` / `.tema-facilitatore`, vetrina in `docs/mockup/design-system.html`),
di cui resta solo la scelta del font dei titoli.

L'inventario di schermate, componenti React e pattern è in `docs/interfaccia.md`.

## Dove stanno i valori

| Dove | File |
|---|---|
| CSS (unica fonte) | `src/styles/tokens.css` |
| Grafici e tonalità (JS) | `src/lib/colori.js` |
| Email | `supabase/functions/_shared/stileEmail.ts` |

Gli ultimi due sono copie a mano: se cambi un valore in `tokens.css`, aggiornalo anche lì.
Nel CSS non si scrivono colori esadecimali, font o raggi: si usano i token.

## Colori

- **Fondo** `--bg` #F5F1E7 · **superficie** delle card `--surface` bianco · `--surface-muted` per riquadri tenui.
- **Testo** `--ink` #262419 · `--ink-2` per legende · `--muted` #6B6553 per descrizioni, meta e assi.
  `--faint` solo per segnaposto e decorazioni (non raggiunge il contrasto AA).
- **Bordi** `--border` per le card · `--border-soft` tra righe di una lista · `--grid` per griglie e caselle future ·
  `--border-strong` per assi e contorni dei campioni.
- **Accento** `--accent` #3F5443 per tutto ciò che si preme o è selezionato (pulsanti, schede attive, link,
  settimana corrente), `--accent-hover` al passaggio, `--accent-soft` per sfondi tenui.
  `--moss` #4B6B57 è per dati e stati (barre, giorni fatti), non per i pulsanti.
- **Ocra** `--ochre` per attenzione e "Lo sapevi che" · `--terra` per esiti elevati · `--danger` per errori e azioni distruttive.
- **Toni della giornata** nei grafici: `--tono-piacevole`, `--tono-neutro`, `--tono-spiacevole`, `--tono-nd` (tratteggio).
  Nelle etichette con faccina `.tono-mini` il neutro resta `--tono-neutro-etichetta`.
- **Scala dei minuti** `--scala-0` … `--scala-3` (dalla casella vuota al verde scuro).

- **Area facilitatore** (Material 3, `docs/framework_layout_facilitatore.md`): `--surface-rail` #EEE8D9 per rail e barra in basso
  (surface-container), `--accent-indicatore` #DDE5D8 per l'indicatore della voce attiva e dei chip scelti (su `--surface-rail`
  `--accent-soft` non si distingue), `--inverse-surface` / `--inverse-on-surface` / `--inverse-accent` per la snackbar.
  La voce attiva si riconosce anche senza colore: testo `--ink` 600 e `aria-current`.

La funzione Tonalità ruota l'accento, il fondo, i testi e i bordi (elenco in `src/lib/tonalita.js`);
toni e scala dei minuti non ruotano. Con la tonalità predefinita non scrive nulla e valgono i token.

## Tipografia

Due famiglie: **Source Serif 4** (`--font-display`, peso 400, niente grassetto né corsivo nei titoli)
e **Public Sans** (`--font-body`). Source Serif 4 è stato scelto il 30/9/2026 fra quattro alternative
(`docs/mockup/font-titoli-alternative.html`) per la leggibilità dei numeri nei contesti densi di dati.
Le dimensioni sono ricalibrate rispetto al mockup Pratica, disegnato con Instrument Serif (più stretto).

| Ruolo | Token | Uso |
|---|---|---|
| Titolo di pagina | `--fs-display` (28–36px) | `h1`, `h2` |
| Numero in evidenza | `--fs-number` (28–32px) | card numeriche |
| Titolo di card | `--fs-section` (21–24px) | `h3` |
| Titolo di voce | `--fs-item` 18px | `h4`, titoli dentro liste e modali piccole |
| Testo | `--fs-body` 15px | paragrafi |
| Descrizione di card | `--fs-small` 14px | sottotitoli sotto un `h3` |
| Meta ed etichette | `--fs-meta` 13px | etichette dei campi e delle card numeriche |
| Didascalie | `--fs-caption` 12px | note sotto i numeri, intestazioni di tabella |
| Occhiello | `--fs-eyebrow` 11px, maiuscolo, `--ls-eyebrow`, 600 | kicker sopra un titolo |

Le intestazioni di tabella sono maiuscole a 12px con `--ls-table`. Il corsivo resta solo per le note scritte dai partecipanti.

## Forme e spazi

- Raggi: `--radius-xl` 28px pannelli di dettaglio e di supporto, modali, foglio dal basso, card del player ·
  `--radius-lg` 16px card e FAB · `--radius-tile` 14px card numeriche e riquadri · `--radius-md` 12px pulsanti e campi ·
  `--radius-sm` 8px elementi piccoli, chip e snackbar · `--radius-pill` pillole, badge e indicatori.
- Card: superficie bianca, bordo `--border`, niente ombra. Ombre solo per modali (`--shadow-dialog`),
  elementi sollevati (`--shadow-elevated`) e hover (`--shadow-hover`).
- Spaziature su multipli di 2 (`--space-*`, fino a `--space-48`): card 24×28px, card numeriche 18×20px, 16–24px tra card.
- **Classi di finestra** (solo area facilitatore, per ora): compatta < 600 · media 600–839 · espansa 840–1199 · ampia ≥ 1200
  (`--bp-media`, `--bp-espansa`, `--bp-ampia`; nelle `@media` vanno scritte come numeri). In JS: `useClasseFinestra()`.
  Misure del guscio: `--rail-esteso` 248 · `--rail-compatto` 88 · `--barra-bassa-h` 80 · `--pannello-elenco` 420 · `--pannello-supporto` 380.
- **Livelli di stato** (area facilitatore): velo del colore del testo al passaggio (`--state-hover` 8%) e alla pressione
  (`--state-press` 10%) su pulsanti, voci del rail e della barra, chip, schede, voci di menu; anello di focus 2px `--accent`
  con 2px di distanza. Niente ombre né cambi di fondo al passaggio. Regola unica in `styles/admin.css`.

## Marchio

Segno a spirale + scritta «conscio» in Literata 600, minuscolo, a un solo colore (deciso il 15/10/2026, brief in `docs/brief_logo.md`).
La scritta è già in tracciati: Literata non si carica nell’app.

- **Componente:** `src/components/Marchio.jsx`, varianti `segno`, `orizzontale`, `verticale`; prop `altezza` in px, `decorativo` quando un link attorno porta già il nome («Conscio, pagina iniziale»).
- **Colore:** eredita `currentColor`: si mette `color: var(--accent)` (o `var(--ink)`) sul contenitore, mai un esadecimale. Con la Tonalità il marchio ruota insieme all’accento.
- **Misure:** header 28px (24 sotto i 600px), in Ascoltati solo il segno a 32px; rail esteso 30px con occhiello «Facilitatore», rail compatto segno 32px; prima schermata verticale 112px; accesso e invito all’installazione segno 40px. Nell’app il segno usa sempre la spirale standard, anche sotto i 40px; la semplificata (prop `semplice`) resta per la favicon.
- **Fuori dal codice:** SVG sorgente in `src/assets/marchio/` (verde, inchiostro, carta); favicon, icone PWA e icona iOS in `public/`; marchio per le email in `public/email/conscio-email-2x.png` (mostrato a 64px).
- **Cosa non fare:** niente ombre, contorni, rotazioni, animazioni (rispetta `prefers-reduced-motion`), altri font per la scritta, tracciati ridisegnati a mano. Non usarlo come decorazione in stati di attesa o errori.

## Componenti di riferimento

- **Card numerica**: etichetta `--fs-meta` `--muted`, numero in serif `--fs-number`, nota `--fs-caption`.
  Esempi: `.pratica-numero`, `.dash-kpi-card`, `.dash-ciclo-stat`, `.storico-contatore`.
- **Card con titolo**: `h3` in serif `--fs-section`, descrizione `--fs-small` `--muted`, legenda a destra.
  Esempio: `.pratica-card`.
- **Tabella**: intestazioni maiuscole `--fs-caption`, righe separate da `--border-soft`, numeri `tabular-nums`.

## Componenti condivisi (in `src/styles.css`, uno per concetto)

Valgono per partecipante e facilitatore. Non creare un secondo componente per lo stesso concetto:
aggiungi una variante qui.

| Concetto | Classe | Varianti |
|---|---|---|
| Pulsante | `.btn` | `.btn-ghost` (contorno), `.btn-tonal`, `.btn-text`, `.btn-pericolo` (rosso pieno, conferma di un'azione distruttiva), `.btn-ghost.is-pericolo` (contorno, testo rosso: apre un'azione distruttiva), `.is-piccolo` (righe di elenchi densi) |
| Card | `.card` | `.card.is-lista` (senza padding, per righe a filo bordo), `.card-vuota` (messaggio di card vuota o in caricamento) |
| Campo di modulo | `.field` | — |
| Modale | `.dialogo` (+ `.dialogo-azioni`) | `.dialogo.is-ascolto` (più larga, per l'anteprima di una traccia) |
| Filtri | `.filtri-chip` con chip `.chip` (scelto con `aria-pressed`, `aria-current` o `.is-on`) | — |
| Errore | `.avviso-errore` (riquadro sopra un modulo o un elenco), `.campo-errore` (riga sotto un campo) | — |
| Nota informativa | `.disclaimer` | — |

### Area facilitatore (`src/components/admin/`, CSS in `styles/admin.css`)

Regola del framework: ogni pagina è guscio + barra della pagina + uno di tre layout. Nessuna pagina costruisce la propria
testata, sceglie la propria larghezza o mette l'azione principale («Nuovo …»): quella sta nel rail.

| Componente | Cosa fa |
|---|---|
| `AdminChrome` | Guscio di `/admin`: `RailNavigazione` da 600px (compatto, esteso da 1200px), `BarraVoci` + FAB sotto. Passa classe di finestra ed «Esci» alle pagine (`useGuscio`), monta `SnackbarProvider` |
| `RailNavigazione` | Marchio, FAB dell'azione principale della sezione (`lib/sezioniAdmin.js`; Sito non ne ha e lo spazio resta), le 4 voci con indicatore a pillola e badge, «Esci» in fondo |
| `BarraVoci` `.is-facilitatore` | Barra in basso sotto 600px: fondo `--surface-rail`, indicatore 64×32, badge 18px `--danger`. La variante del partecipante non cambia |
| `.fab` | Azione principale: alto 56, raggio 16, `--accent`. Nel rail compatto solo icona; su telefono galleggia sopra la barra (`.is-galleggiante`) |
| `PaginaAdmin` | Barra della pagina (indietro, titolo serif `--fs-display`, meta, contesto, al massimo un'azione secondaria, menu ⋯ con «Esci» sotto 600px), schede come rotte (`.pagina-scheda`, `aria-current`), corpo `layout="flusso" \| "elenco-dettaglio" \| "supporto"`, `stato="attesa" \| "vuoto" \| "errore"`. In flusso i blocchi vanno a tutta riga; `.colonna-testo` li limita a 8 colonne per moduli e testi lunghi |
| `ElencoPannello` + `PannelloDettaglio` | Elenco largo `--pannello-elenco` e dettaglio a destra (`--surface`, raggio `--radius-xl`, scroll interno, ✕, Esc). Senza selezione uno stato vuoto (bordo tratteggiato, icona in un cerchio `--accent-indicatore`, titolo serif e una riga su cosa si fa da lì: props `vuoto`, `vuotoTesto`, `vuotoIcona`). Sotto 840px il dettaglio prende la pagina e titolo e «←» passano nella barra |
| `.riga-elenco` (+ `.elenco-gruppo`, `.elenco-strumenti`) | Riga selezionabile di un elenco a gruppi (titolo, meta, badge di stato a destra; `aria-current` sulla riga aperta, fondo `--surface-muted`). Oggi in Comunicazioni; Tracce usa ancora `.admin-riga` |
| `AreaPrincipale` + `PannelloSupporto` | Contenuto più pannello fisso a destra largo `--pannello-supporto` su `--surface-rail`; sotto 840px va sotto |
| `useSnackbar().mostra({ testo, annulla? })` | Conferma non bloccante in basso al centro dell'area contenuto (sopra barra e FAB su telefono), `role="status"`, una alla volta, 6 s (10 s con «Annulla»), si ferma al passaggio. Per le azioni reversibili al posto di `DialogConferma` |
| `SplitButton` | `.btn-tonal` diviso: azione + freccia con menu (Esc, clic fuori, frecce) |
| `MenuAzioni` | Menu a comparsa del ⋯ e dello split button |

Le classi `.admin-*` rimaste in `src/styles/admin.css` sono solo layout di pagina dell'area facilitatore
(barra degli strumenti, righe della libreria, testata), non componenti generici. Unificazione fatta il
30/9/2026: tolti `.admin-btn-*`, `.admin-card`, `.admin-field`, `.admin-alert`, `.admin-dialogo`,
`.dialog-conferma`, `.btn-ciclo-elimina`, `.btn-elimina`.

