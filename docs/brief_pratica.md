# Conscio · brief frontend: nuova scheda "Pratica" del facilitatore

Riferimento visivo: `docs/mockup/pratica.html` (aprilo nel browser; dati di esempio, 8 persone, giorno 11 di 50).
Contesto generale e regole comuni: `docs/progetto.md`.

## Cosa cambia

Nella dashboard (`src/pages/Dashboard.jsx`, scheda `pratica`) il componente `GraficiTono` va sostituito da una nuova
scheda con, dall'alto:

1. **Quattro numeri** (riquadri).
2. **Partecipazione giorno per giorno** (barre impilate per tono).
3. **Mappa del percorso** (griglia partecipanti × giorni, senza codici).
4. **Totale per partecipante** (barre orizzontali ordinate, senza codici) e **Pratiche informali** (tabella), affiancati.

`GraficoAndamentoPratica` e le funzioni di `src/lib/tono.js` usate altrove non vanno toccate.
Stile: tema unico (`src/styles/tokens.css`, `docs/design-system.md`; in origine `.mbsr-theme` con Instrument Serif):
Source Serif 4 per titoli e numeri, Public Sans per il resto, fondo `--bg`, riquadri `--surface` con bordo `--border`.

## Regole comuni (valgono per tutta la scheda)

- **Ambito: un ciclo.** I grafici hanno senso solo dentro un ciclo, perché l'asse dei giorni va dall'inizio alla
  fine del ciclo. Se nessun ciclo è aperto, mostra solo i quattro numeri e un invito ad aprire un ciclo dalla scheda
  Cicli (come già fa `cicloAperto`). Escludi chi segue un **percorso individuale da remoto** (iscrizione senza
  `ciclo_id`): ha un calendario suo.
- **Durata del ciclo**: da `data_inizio` a `data_fine` (se manca, `data_inizio + 62`), comprese. Mai fissata a 56:
  il Gruppo pilota dura 50 giorni, quindi l'ultima settimana ha un solo giorno.
- **Giorno di pratica** = giorno con **almeno una meditazione ascoltata per intero**, cioè almeno una riga
  `tipo = 'ascolto'` (il player la salva solo oltre il 90-95% della traccia). Le informali si contano a parte.
- **Minuti** = somma di `durata_minuti` delle righe `tipo = 'ascolto'` del giorno.
- **Tono del giorno** = `tono_dopo` (altrimenti `tono_prima`) della riga `tipo = 'giorno'` (diario). Non esiste
  un tono per singolo ascolto e non va introdotto.
- **Nessun codice e nessuna email nella scheda,** nemmeno nei `title`/tooltip. I dati arrivano da
  `log_pratica_pseudonimi()` con il codice: usalo solo per raggruppare, mai per mostrarlo. Le righe della mappa e
  le barre del totale sono ordinate per minuti, così l'ordine non è riconducibile ai codici.
- **Colori dei grafici** (uguali allo storico del partecipante):
  piacevole `#4B6B57`, neutro `#B4B8B0`, spiacevole `#A8763E`,
  senza tono `repeating-linear-gradient(135deg, #D6CFBD 0 2px, #F7F3EA 2px 5px)` con bordo `#CFC8B4`.
  Il neutro più chiaro del solito serve a distinguerlo dallo spiacevole anche per chi vede meno i colori.

## 1. Quattro numeri

- **Aderenza del gruppo**: giornate di pratica / (iscritti al ciclo × giorni trascorsi, oggi compreso), in %.
  Sotto: "X giornate con ascolto su Y possibili". Stessa definizione del cruscotto dati.
- **Minuti di meditazione**: somma di tutti i minuti del ciclo.
- **Media per partecipante**: minuti totali / iscritti; sotto, la mediana dei totali individuali.
- **Pratiche informali**: numero di spunte `tipo = 'informale'`.

## 2. Partecipazione giorno per giorno

- Una colonna per giorno del ciclo, raggruppate per settimana (etichetta "Sett. N" e date sotto ogni gruppo).
- Altezza = persone con almeno un ascolto quel giorno, su una scala 0 → numero di iscritti (asse con tacche pari).
- La colonna è impilata per tono del giorno, dal basso: piacevole, neutro, spiacevole, senza tono;
  1 px di spazio tra i segmenti.
- Giorni futuri: un trattino sulla linea di base. Tooltip: data, "N su M hanno praticato" e il conteggio per tono.
- Legenda sopra il grafico.

## 3. Mappa del percorso

- Una riga per iscritto al ciclo, ordinate per minuti totali decrescenti, senza etichetta a sinistra;
  a destra il totale in minuti.
- Una casella per giorno, allineata alle colonne del grafico 2. Colore per minuti del giorno:
  0 `#EFEADC`, 1-10 `#C9D6C9`, 11-20 `#8BA792`, oltre 20 `#3F5443`; giorni futuri bianchi con bordo `#ECE6D6`.
- Tooltip: data e minuti. Legenda con le quattro fasce.

## 4a. Totale per partecipante

- Una barra orizzontale per iscritto, ordinate dal totale più alto; lunghezza proporzionale al massimo.
- A destra: "N min" e "N giorni" di pratica.
- Linea verticale tratteggiata sulla **mediana**, con etichetta "mediana N min".
- Nessun codice.

## 4b. Pratiche informali

Tabella con: nome della pratica e settimana (da `numero_settimana`), **volte** (numero di spunte),
**persone** (quanti codici diversi l'hanno spuntata almeno una volta) "su N". Ordinata per volte decrescenti.
Sostituisce i riquadri per codice di `ConteggioInformali`.

## Da verificare in implementazione

- Il grafico deve stare nella larghezza della scheda senza scorrimento orizzontale su desktop (56 colonne al massimo);
  sotto i 900 px può scorrere dentro il proprio contenitore.
- Con i dati reali di oggi il tono è spesso assente (si registra solo con il diario): il segmento "senza tono"
  sarà frequente, ed è corretto così.
