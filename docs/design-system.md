# Conscio · design system

Riferimento visivo: la scheda **Pratica** del facilitatore (`docs/mockup/pratica.html`,
`src/components/SchedaPratica.jsx`). Vale per l'app del partecipante, l'area facilitatore e le email:
**un solo tema**, senza distinzione fra partecipante e facilitatore. Supera la proposta a due temi
del 30/9/2026 (`.tema-partecipante` / `.tema-facilitatore`, vetrina in `docs/mockup/design-system.html`),
di cui resta solo la scelta del font dei titoli.

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

- Raggi: `--radius-lg` 16px card · `--radius-tile` 14px card numeriche e riquadri · `--radius-md` 12px pulsanti e campi ·
  `--radius-sm` 8px elementi piccoli · `--radius-pill` pillole e badge.
- Card: superficie bianca, bordo `--border`, niente ombra. Ombre solo per modali (`--shadow-dialog`),
  elementi sollevati (`--shadow-elevated`) e hover (`--shadow-hover`).
- Spaziature su multipli di 2 (`--space-*`): card 24×28px, card numeriche 18×20px, 16–24px tra card.

## Componenti di riferimento

- **Card numerica**: etichetta `--fs-meta` `--muted`, numero in serif `--fs-number`, nota `--fs-caption`.
  Esempi: `.pratica-numero`, `.dash-kpi-card`, `.dash-ciclo-stat`, `.storico-contatore`.
- **Card con titolo**: `h3` in serif `--fs-section`, descrizione `--fs-small` `--muted`, legenda a destra.
  Esempio: `.pratica-card`.
- **Tabella**: intestazioni maiuscole `--fs-caption`, righe separate da `--border-soft`, numeri `tabular-nums`.
