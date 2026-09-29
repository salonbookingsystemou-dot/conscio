# Conscio · brief frontend: "Il tuo andamento" (partecipante)

Riferimento visivo: `docs/mockup/andamento.html` (aprilo nel browser; dati di esempio, T0 e T1 compilati).
Contesto generale e regole comuni: `docs/progetto.md`.

## Perché

Oggi in `src/pages/Questionari.jsx` il partecipante vede solo lo **snapshot del momento corrente**
(pulsante "Vedi esito" per un singolo timepoint). Non esiste un posto dove vedere come sono cambiate
le proprie risposte da un momento all'altro. Questa schermata colma quel vuoto, restando nello stesso
registro non clinico e non interpretativo già usato nella schermata di esito.

## Cosa creare

Un nuovo passo `andamento` dentro `Questionari.jsx` (stessa pagina, non una nuova route), raggiungibile:

- da un link "Vedi il tuo andamento" nella schermata `scelta` (quella con l'elenco dei momenti T0-T3),
  mostrato solo quando **almeno due timepoint risultano `completato`**;
- con un pulsante "Torna ai questionari" per uscire, come già fa il passo `esito`.

Se il link non è ancora sbloccabile (0 o 1 timepoint completati), non mostrarlo affatto nella schermata
`scelta` — niente stato disabilitato, semplicemente non compare ancora.

## Struttura della schermata

1. **Titolo** "Il tuo andamento" + sottotitolo breve (vedi mockup).
2. **Selettore tra i due strumenti** (PSS-10 / FFMQ-I), due pulsanti a pillola, uno attivo alla volta.
   Di default mostra PSS-10.
3. **Una riga per ogni timepoint del piano del partecipante** (T0, T1, T2, T3 — usa lo stesso elenco già
   disponibile in `piano.timepoints`), nell'ordine cronologico:
   - Se **completato**: la data di compilazione (se disponibile; altrimenti ometti la riga data) e la
     barra `IndicatoreOrientamento` già esistente, con etichetta e valore — stesso calcolo di
     `calcolaPunteggi` usato in `mostraEsito`. Da T1 in poi, accanto alla data, una nota fattuale e
     **non interpretativa**: "rispetto a T0: +N punti" o "−N punti" (mai "in miglioramento",
     "in peggioramento" o simili: il verso positivo/negativo dipende dallo strumento e dalla sottoscala,
     e non spetta all'app deciderlo).
   - Se **non ancora completato o non aperto**: riga attenuata con "Non ancora compilato." (vedi stile
     `.is-futuro` nel mockup). Nessuna barra vuota, nessun placeholder a zero.
4. **FFMQ-I, dettaglio sottoscale**: un `<details>` chiuso di default, "Vedi il dettaglio per le 5
   sottoscale" (`osservare`, `descrivere`, `agire_con_consapevolezza`, `non_giudicare`, `non_reagire`,
   etichette da `SOTTOSCALE_ETICHETTE` già definite in `Questionari.jsx`). Dentro, per ciascuna
   sottoscala una riga per timepoint completato, versione compatta (barra sottile, senza chip di
   etichetta testuale — solo colore + valore), per non appesantire la pagina. Non serve per il PSS-10,
   che non ha sottoscale.
5. **Disclaimer** in fondo, stesso testo (o equivalente) di quello già presente in `mostraEsito`.
6. **Stato alternativo**: se per lo strumento selezionato risultano meno di due timepoint completati
   (può succedere per un partecipante con un percorso individuale e finestre diverse), mostra il
   messaggio "Il tuo andamento sarà visibile qui" invece della lista a righe (vedi mockup, sezione
   "Stato alternativo").

## Da dove vengono i dati

Per ogni timepoint con stato `completato`, richiama la stessa RPC già usata da `mostraEsito`
(`risposte_questionario_del_partecipante`) e la stessa funzione `calcolaPunteggi` di `src/lib/scoring.js`
per ottenere `pss10`/`ffmq` con `totale`, `min`, `max`, `orientamento` e le sottoscale. Puoi caricare tutti
i timepoint completati in parallelo (`Promise.all`) quando si apre il passo `andamento`, con uno stato di
caricamento semplice (riusa `StatoAttesa`).

Non serve nessuna nuova RPC né modifica al database: i dati esistono già per-timepoint, va solo aggiunta
la vista che li mette in fila.

## Cosa NON fare

- Niente grafico a linee con assi: coerente con la scelta di design già fatta per questa app
  ("calma, non dataviz clinico"), il confronto tra momenti resta fatto di barre orientamento in fila,
  come nel mockup.
- Niente interpretazione del cambiamento ("stai migliorando"): solo la differenza numerica, senza segno
  di giudizio.
- Niente confronto con altri partecipanti o con medie di gruppo: questa vista è solo per il proprio codice
  (quella aggregata esiste già nella dashboard del facilitatore).

## Stile

Design system delle schermate partecipante (`src/styles.css`): palette `--moss`/`--ochre`/`--border`,
Fraunces per titoli e numeri, Inter per il resto. Riusa i componenti e le classi già esistenti
(`IndicatoreOrientamento`, `.card`, `.badge`, `Disclaimer`, `StatoAttesa`) invece di duplicarne lo stile;
le nuove classi (`.andamento-*`, `.sottoscala-*`) sono solo quelle che non esistono già, elencate nel
mockup. Deve funzionare a 360 px di larghezza.
