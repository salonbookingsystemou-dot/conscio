# Conscio · brief frontend: nuova schermata "Storico di pratica"

Riferimento visivo: `docs/mockup/storico.html` (aprilo nel browser; i dati sono di esempio).
Contesto generale: `docs/progetto.md`.

## Cosa cambia

La pagina `src/pages/LogPratica.jsx` oggi mostra un calendario a griglia (`CalendarioPratica`) e un grafico a linea
del tono (`GraficoAndamentoPratica`). Li sostituisce un **calendario a scorrimento verticale**: una riga per giornata,
dalla più recente all'inizio del percorso.

Non eliminare `CalendarioPratica` e `GraficoAndamentoPratica`: verifica prima se sono usati altrove (es. dashboard facilitatore).

## Struttura della pagina

1. **Titolo** "Storico di pratica".
2. **Contatore generale**, due riquadri affiancati:
   - minuti totali di meditazione dall'inizio del percorso;
   - giorni di pratica "su N dall'inizio del percorso", dove N = giorni trascorsi da `data_inizio` a oggi (compresi).
3. **Legenda** dei toni: barra colorata + etichetta con l'icona del tono.
4. **Elenco delle giornate**, raggruppate per settimana del percorso. Ogni gruppo ha un titolo:
   "Settimana N · <tema>" (tema da `lezioni.tema`; se manca, solo "Settimana N").
5. In fondo: "Inizio del percorso · <data>".

## Una giornata

- **Data** a sinistra: numero del giorno + giorno della settimana abbreviato.
- **Barra**: lunghezza = minuti di meditazione del giorno, su una scala fissa di 45 minuti per tutta la pagina
  (oltre 45 la barra è piena). Colore = tono del giorno:
  piacevole `var(--moss)`, neutro `#8A8F88`, spiacevole `var(--ochre)`.
  Tono mancante: barra vuota con bordo (non grigio pieno, per non confonderla con "neutro").
- **Minuti** accanto alla barra e **etichetta del tono** con l'icona: riusa `TonoMini` / `TonoIcon`
  e le classi `.tono-mini.is-*` già esistenti. Il tono non deve mai essere affidato al solo colore.
- **Nota** del diario, per intero, in Fraunces corsivo.
- **Pratiche del giorno** in piccolo: nomi degli esercizi formali (dal campo `esercizio`), poi "informale: …".
- Giorno con sola pratica informale: nessuna barra, etichetta "Solo informale".
- Giorno senza nessuna registrazione: riga sottile e attenuata, "Nessuna pratica registrata".
- Giorni futuri: non mostrarli.

## Da dove vengono i dati

Tutto da `log_pratica_del_partecipante(p_codice)` e `ciclo_del_partecipante(p_codice)`, già chiamate dalla pagina.
Righe restituite: `id, data, durata_minuti, tipo, note, numero_settimana, esercizio, tono_prima, tono_dopo`.

Per ogni giorno:
- **minuti** = somma di `durata_minuti` delle righe con `tipo` diverso da `giorno` e `informale`
  (stessa regola di `aggregaGiorni` in `CalendarioPratica.jsx`);
- **tono** = `tono_dopo` (altrimenti `tono_prima`) della riga `tipo = 'giorno'`; se ce ne sono più di una, l'ultima;
- **nota** = `note` della riga `tipo = 'giorno'`;
- **pratiche** = `esercizio` delle righe formali (senza duplicati), poi quelle informali;
- **settimana** = `floor((giorno - data_inizio) / 7) + 1`, coerente con `settimana_per_questionari` nel database.
  Per il tema serve anche `lezioni.tema` per settimana: se non è già disponibile al partecipante, aggiungi una RPC
  in un nuovo file `supabase/migrazione_*.sql` (e segnalalo nel registro di `docs/progetto.md`).

Contatore generale:
- **minuti totali** = somma dei minuti di tutti i giorni;
- **giorni di pratica** = giorni con almeno una riga, **compresi quelli con sola pratica informale**
  (decisione da confermare con Dimitri: in alternativa contare solo i giorni con almeno un ascolto).

## Tono prima e dopo (quando arriverà)

Quando gli ascolti registreranno `tono_prima` e `tono_dopo`, la barra potrà diventare bicolore
(prima parte il tono iniziale, seconda parte quello finale). Non implementarlo ora.

## Stile

Design system delle schermate partecipante (`src/styles.css`, `:root`): `--bg`, `--surface`, `--ink`, `--ink-soft`,
`--moss`, `--ochre`, `--border`; Fraunces per titoli e note, Inter per il resto. Righe separate da un filetto,
niente card per ogni giorno. Deve funzionare a 360 px di larghezza.
