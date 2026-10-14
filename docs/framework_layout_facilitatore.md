# Framework di layout · area facilitatore

Proposta del 14/10/2026, approvata da Dimitri lo stesso giorno (decisioni in sez. 11).
Livello "impaginazione" che sta sotto `brief_navigazione_facilitatore.md`
(architettura delle informazioni) e sopra `design-system.md` (token e componenti).
Riferimento: Material 3 Expressive per struttura, adattività e comportamento; **non** per l'aspetto
(niente Roboto, niente palette Material: restano Source Serif 4, Public Sans e i token di Conscio).
Mockup: `docs/mockup/framework-facilitatore/` (aprire `index.html`).

## 0. Diagnosi

| Cosa c'è | Limite |
|---|---|
| **Scheda Pratica** (canvas Claude Design, `docs/mockup/pratica.html`) | Ottimo vocabolario di card, numeri e grafici, ma è una pagina isolata: larghezza fissa 1280, nessun guscio, nessuna navigazione, testata propria |
| **Cruscotto Percorso MBSR** (artifact 28/9) | Fuori sistema: Fraunces + Inter, palette e raggi propri (10px). Terza grammatica visiva |
| **Brief navigazione** (13/10) | Sistema *dove* stanno le cose (4 voci, rotte, schede), non *come* è fatta una pagina |
| **Codice** | `AdminChrome` è solo una barra in alto; ogni pagina decide da sé testata, larghezza, posizione delle azioni; `pagineAdminAmpie` scritto a mano; breakpoint 720/860/960 non legati a nulla |

Causa: manca un **modello di pagina**. Le pagine sembrano scollegate perché ognuna reinventa testata, azioni e larghezza.

## 1. Regola guida

> **Ogni pagina facilitatore è: guscio + barra della pagina + uno di tre layout canonici.**
> Nessuna pagina costruisce la propria testata, sceglie la propria larghezza o posiziona a mano l'azione principale.

## 2. Classi di finestra (sostituiscono i breakpoint attuali)

| Classe M3 | Larghezza | Navigazione | Pannelli |
|---|---|---|---|
| Compatta | < 600 | barra in basso (4 voci, componente condiviso con `BarraBassa`) | 1 |
| Media | 600–839 | rail compatto (icona + etichetta) | 1 (dettaglio a pagina intera) |
| Espansa | 840–1199 | rail compatto | 2 (elenco + dettaglio) |
| Ampia | ≥ 1200 | rail esteso (etichette accanto alle icone) | 2, con larghezza massima del contenuto |

Token nuovi: `--bp-media: 600px`, `--bp-espansa: 840px`, `--bp-ampia: 1200px`. I 720/860/960 di `styles.css`
migrano su questi (l'area partecipante può seguire in un secondo momento).

## 3. Guscio (`AdminChrome` rifatto)

- **Rail di navigazione** a sinistra su media/espansa/ampia, al posto delle pillole in testata
  (recepito nella sez. 2.1 del brief di navigazione).
  - In alto: marchio «Conscio · Facilitatore».
  - Sotto: **azione principale contestuale** (FAB esteso nel rail): «Nuovo ciclo» in Cicli, «Nuova traccia» in Tracce,
    «Nuova comunicazione» in Comunicazioni; assente in Sito. La barra della pagina non la ripete.
  - Voci: Cicli (con badge) · Tracce · Comunicazioni · Sito. Indicatore attivo a pillola in `--accent-soft`.
  - In fondo: «Esci».
- **Barra in basso** su compatta, stesse voci; l'azione principale diventa FAB in basso a destra; «Esci» nel menu ⋯ della barra della pagina.
- Il contenuto non ha più una testata globale: la testata è della pagina.

## 4. Anatomia di una pagina (`PaginaAdmin`, unico componente)

Dall'alto:
1. **Barra della pagina** (top app bar M3): indietro o briciola («← Cicli»), titolo serif, sottotitolo/meta
   (stato, date), selettore di contesto (es. altro ciclo), al massimo **un'azione visibile** + menu ⋯.
   L'azione visibile è secondaria (es. «Controlla tutte»): la principale sta nel rail.
   Su compatta si riduce a riga singola e si compatta allo scorrimento.
2. **Schede** (facoltative): schede primarie M3, ciascuna una rotta (`.dash-tabs` rivisto, `aria-current`).
3. **Corpo** in uno dei layout canonici della sez. 5.
4. **Stati**: attesa / vuoto / errore occupano il corpo, mai la barra (la pagina resta orientata anche quando i dati mancano).

Props: `titolo`, `meta`, `indietro`, `contesto`, `azione`, `menu`, `schede`, `layout`. La larghezza si deduce dal layout:
sparisce `pagineAdminAmpie`. L'azione principale del rail si dichiara per sezione (es. `handle` della route), non per pagina.

## 5. Tre layout canonici

| Layout | Struttura | Dove |
|---|---|---|
| **Flusso** (feed) | griglia di card a 12 colonne; card numeriche in fila, card con titolo a tutta riga o a metà | Cicli (home), Panoramica, Pratica, Questionari |
| **Elenco–dettaglio** | elenco a sinistra (≈ 360–400px), dettaglio a destra; su compatta/media il dettaglio è una pagina con «←» | Tracce (+ scheda traccia), Iscritti, Programma (settimane → editor), Comunicazioni (inviate → dettaglio/composizione) |
| **Pannello di supporto** | area principale + pannello fisso a destra (≈ 360px); su compatta il pannello va sotto | Sito (editor + anteprima), Genera da script (paragrafi + voce/modello/pause) |

Il «pannello laterale» della scheda traccia previsto dal brief diventa il **pannello di dettaglio** dell'elenco–dettaglio:
un solo componente condiviso, non un elemento nuovo per pagina.

## 6. Superfici, forma, stati

**Superfici tonali al posto delle ombre** (coerente con «card senza ombra»):

| Ruolo M3 | Token Conscio (nuovo → valore) |
|---|---|
| surface | `--bg` |
| surface-container-lowest | `--surface` (card) |
| surface-container | `--surface-rail` (rail, barra in basso): #EEE8D9 nel mockup |
| surface-container-high | `--surface-muted` (riquadri, riga selezionata dell'elenco) |
| secondary-container | `--accent-soft` (indicatore attivo, filtro scelto) |
| inverse-surface | `--ink` come fondo della snackbar, testo `--bg` |

**Livelli di stato** M3 su tutto ciò che si preme: hover 8%, focus 10%, pressione 10% del colore del testo
(`--state-hover`, `--state-focus`, `--state-press`), più anello di focus visibile.

**Forma** (scala M3 → token esistenti): extra-small 4 · small `--radius-sm` 8 · medium `--radius-md` 12 ·
large `--radius-lg` 16 · extra-large 28 (nuovo `--radius-xl`, per pannelli e modali) · full `--radius-pill`.
Espressività contenuta: pillola per indicatori e FAB, leggero cambio di forma alla pressione dei pulsanti; niente forme decorative.

## 7. Componenti M3 → Conscio

| M3 | In Conscio | Stato |
|---|---|---|
| Navigation rail / bar | rail nuovo, barra estratta da `BarraBassa` | nuovo / da estrarre |
| Top app bar | barra della pagina in `PaginaAdmin` | nuovo |
| Tabs | `.dash-tabs` come link | da rivedere |
| Card | `.card`, card numeriche | esiste |
| List | righe di elenco (iscritti, tracce, inviate) con riga selezionata | da unificare (oggi `.admin-*` di layout) |
| Filter chips / button group | filtri Iscritti e Tracce (`Tutte · Da guardare · …`) | da unificare |
| Split button | «Controlla tutte ▾» (tutte / solo ciclo) | nuovo |
| FAB esteso | azione principale nel rail (FAB su compatta) | nuovo |
| Dialog | `.dialogo`, `DialogConferma` | esiste |
| Snackbar | conferme non bloccanti, con «Annulla» per le azioni reversibili (regole nel brief, sez. 4bis) | nuovo |
| Loading indicator | `StatoAttesa` | esiste |

Niente librerie Material: componenti propri in `src/components/admin/` + classi in `styles.css`, documentati in `design-system.md`.

## 8. Movimento

Transizioni brevi e "a molla" solo dove orientano: apertura del dettaglio (dall'elenco), cambio scheda, rail che si espande,
entrata della snackbar. Durate 150–300 ms, nessuna animazione decorativa, `prefers-reduced-motion` spegne tutto tranne le dissolvenze.

## 9. Tipografia sui ruoli M3

| Ruolo M3 | Token |
|---|---|
| Headline (titolo pagina nella barra) | `--fs-display`, Source Serif 4 |
| Title large (titolo card) | `--fs-section` |
| Title medium (voce di elenco, dettaglio) | `--fs-item` |
| Body | `--fs-body` / `--fs-small` |
| Label (rail, schede, chip, pulsanti) | `--fs-meta`, Public Sans 500–600 |

## 10. Percorso di lavoro

1. ~~Approvare questo framework~~ (fatto il 14/10/2026).
2. ~~Canvas in Claude Design~~ (fatto: `docs/mockup/framework-facilitatore/`).
3. **Token**: classi di finestra, superfici, livelli di stato, `--radius-xl` in `tokens.css` (+ `lib/colori.js`).
4. **Codice**: `AdminChrome` (rail + barra in basso) + `PaginaAdmin` + `PannelloDettaglio` + snackbar dentro la fase 1
   del brief di navigazione (istruzioni in `brief_framework_fase1.md`); poi ogni pagina migra come "template + contenuto".
5. **Pulizia**: il Cruscotto Percorso MBSR resta uno strumento di analisi esterno o si riallinea al sistema;
   aggiornare `interfaccia.md` (gusci e pattern) e `design-system.md` (nuovi componenti).

## 11. Decisioni (14/10/2026)

- **Rail laterale** al posto delle pillole in testata da 600px in su; barra in basso sotto.
- **Azione principale nel rail** (FAB esteso), una per sezione; la barra della pagina tiene solo azioni secondarie e menu ⋯.
- **Snackbar con «Annulla»** per le azioni reversibili; `DialogConferma` resta per quelle non reversibili o con effetti fuori dall'app.
