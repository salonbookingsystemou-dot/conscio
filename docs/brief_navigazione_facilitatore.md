# Brief · Riorganizzazione della navigazione del facilitatore

Deciso con Dimitri il 13/10/2026. Da implementare in Cursor, a fasi.
Prima di iniziare leggi `docs/interfaccia.md`, `docs/architettura.md` e `docs/design-system.md`.

## 0. Obiettivo e regola guida

L'area facilitatore oggi ha due livelli di navigazione (pillole in `AdminChrome` e schede della Dashboard)
che si ripetono e si contraddicono. La nuova struttura segue una regola sola:

> **Il menu principale dice su quale oggetto lavori. Le schede dicono quale aspetto di quell'oggetto.**
> Nessuna etichetta compare su entrambi i livelli. Il ciclo si sceglie una volta sola.

Cambiano solo navigazione, rotte e impaginazione. Nessuna RPC dei partecipanti, nessun dato nuovo
dei partecipanti. L'unica modifica al database è la tabella degli esiti del controllo tracce (sez. 4.4).

## 1. Problemi di oggi (per capire cosa non rifare)

| Problema | Dove |
|---|---|
| «Cicli» è sia una pillola sia la prima scheda della Dashboard | `AdminChrome.jsx`, `Dashboard.jsx` (`TAB`) |
| Il sito (splash, vetrina Ascolta, uso dei dati) è una scheda dentro Cicli | `Dashboard.jsx` tab `sito` |
| Il ciclo si sceglie in quattro modi: elenco (Cicli), tendina (Percorso), altra tendina (Controllo), automatico (Pratica); Questionari non lo sceglie affatto | `Dashboard.jsx`, `Percorso.jsx`, `ControlloTracce.jsx`, `SchedaPratica.jsx` |
| Il dettaglio del ciclo rimanda con «Apri Percorso» a un'altra pillola dove il ciclo va riscelto | `Dashboard.jsx` |
| Le tracce occupano tre pillole (Libreria, Genera, Controllo) | `AdminChrome.jsx` |
| «Avvisi» indica cose diverse per partecipante e facilitatore; `/comunicazioni` è una rotta sola che cambia contenuto in base a chi è entrato | `Comunicazioni.jsx` (`if (!facilitatore) return <AvvisiPartecipante />`) |
| Un secondo menu facilitatore, già disallineato (manca Controllo), vive in `Nav.jsx` | `Nav.jsx` |
| Le pagine larghe sono un elenco di percorsi scritto a mano | `App.jsx` `pagineAdminAmpie` |
| Marchio «Percorso MBSR · Admin» | `AdminChrome.jsx` |

## 2. Nuova architettura

### 2.1 Menu principale (4 voci)

`Cicli · Tracce · Comunicazioni · Sito` + `Esci`

- Marchio: «Conscio · Facilitatore», porta a `/admin/cicli`.
- Schermo largo: pillole in testata come oggi.
- Telefono: barra in basso a 4 voci con icona, stesso componente visivo di `BarraBassa` (estrarre la parte
  grafica in un componente condiviso, con le voci passate come prop). Niente menu a scomparsa. «Esci» resta in testata.
- Badge numerico su «Cicli» = segnalazioni difficili aperte + iscrizioni in attesa.

### 2.2 Rotte

Tutto il facilitatore sotto `/admin`. Una route padre `/admin` con `SoloFacilitatore` + `AdminChrome` e
`<Outlet />`; la larghezza si decide per route (es. `handle` o prop sul layout), non con `pagineAdminAmpie`.

| Rotta | Contenuto |
|---|---|
| `/admin/cicli` | pagina iniziale (sez. 3.1) |
| `/admin/cicli/:cicloId` | reindirizza a `…/panoramica` |
| `/admin/cicli/:cicloId/panoramica` · `/iscritti` · `/programma` · `/pratica` · `/questionari` | spazio del ciclo (sez. 3.2) |
| `/admin/cicli/:cicloId/programma/settimana/:numero` | `EditorSettimana` |
| `/admin/tracce` | elenco tracce; `?traccia=<id>` apre la scheda; filtri in query (`?ciclo=`, `?filtro=da-guardare`) |
| `/admin/tracce/nuova` | nuova traccia; `?modo=carica` o `?modo=genera` |
| `/admin/comunicazioni` | comunicazioni del facilitatore |
| `/admin/sito` | sito pubblico |

### 2.3 Reindirizzamenti (obbligatori)

Ci sono link salvati e almeno un link nelle email (`avvisa-segnalazione-checkin` → `#/dashboard`).

| Vecchia | Nuova |
|---|---|
| `/dashboard` | `/admin/cicli` |
| `/percorso` (`?ciclo=X`) | `/admin/cicli/X/programma`, senza ciclo → `/admin/cicli` |
| `/percorso/:id/settimana/:n` | `/admin/cicli/:id/programma/settimana/:n` |
| `/lezioni` | `/admin/cicli` |
| `/libreria` | `/admin/tracce` |
| `/genera` | `/admin/tracce/nuova?modo=genera` |
| `/controllo-tracce` (`?ciclo=X`) | `/admin/tracce?ciclo=X&filtro=da-guardare` |
| `/comunicazioni` **solo se facilitatore** | `/admin/comunicazioni` (per il partecipante resta la pagina Avvisi) |

Dopo il login (`Accedi.jsx`) si va a `/admin/cicli`. Aggiornare anche il link nell'email di
`avvisa-segnalazione-checkin` a `#/admin/cicli` (il reindirizzamento resta comunque).

## 3. Cicli

### 3.1 Pagina iniziale `/admin/cicli`

Dall'alto in basso:
1. **Da fare**: segnalazioni difficili aperte (blocco attuale con «Segna come gestita») e iscrizioni in attesa
   di esito, ciascuna con link al ciclo/scheda giusta. Se non c'è niente, una riga sola «Niente da fare».
2. **Numeri chiave**: le card `.dash-kpi-card` attuali.
3. **Cicli**: elenco (card o tabella attuale) con nome, date, stato, iscritti; clic → spazio del ciclo. «Nuovo ciclo» in testata.
4. **Percorsi individuali da remoto**: l'attuale sezione `remoti-liberi` (iscritti senza ciclo), con le stesse azioni.
5. **Questionari · tutti i cicli**: link alla vista aggregata (sez. 3.2, Questionari).

### 3.2 Spazio del ciclo `/admin/cicli/:cicloId/*`

Testata fissa: «← Cicli», nome del ciclo, stato, date, e un selettore per passare a un altro ciclo
mantenendo la scheda corrente. Sotto, le schede (stile `.dash-tabs` attuale, collegate alle rotte):

`Panoramica · Iscritti · Programma · Pratica · Questionari`

| Scheda | Da dove arriva il contenuto |
|---|---|
| Panoramica | `.dash-ciclo-stats` + «Date e stato» (impostazioni, link incontro, posti) da `Dashboard.jsx` |
| Iscritti | elenco iscrizioni del ciclo con filtri (Idoneo, In presenza, Da remoto) e azioni (esito, modalità, assegna, ritira) da `Dashboard.jsx` |
| Programma | griglia delle settimane di `Percorso.jsx` senza la tendina; editor settimana come sotto-rotta. In alto, se il controllo tracce segnala problemi sulle tracce di questo ciclo: avviso «N tracce da guardare» con link a `/admin/tracce?ciclo=<id>&filtro=da-guardare` |
| Pratica | `SchedaPratica` con il ciclo passato come prop (non più scelto in automatico) |
| Questionari | contenuto della scheda Questionari attuale, filtrato sul ciclo. Un interruttore «Tutti i cicli» ripristina la vista aggregata di oggi, così non si perde nulla |

Regola dati invariata: Pratica e Questionari restano aggregati o per codice come oggi, mai email.

## 4. Tracce: un'interfaccia sola per creare, modificare e controllare

Sostituisce `Libreria.jsx`, `GeneraTraccia.jsx` e `ControlloTracce.jsx` come pagine. La logica resta nei moduli
esistenti (`lib/tracce.js`, `lib/generaVoce.js`, `lib/audioMp3.js`, `lib/controlloTracce.js`, `lib/vetrina.js`):
si sposta l'interfaccia, non si riscrive la logica.

### 4.1 Elenco `/admin/tracce`

- Testata: «Tracce», bottoni **Nuova traccia** e **Controlla tutte** (in coda, `FILE_IN_PARALLELO` come oggi).
- Ricerca + filtri: `Tutte · Usate nel ciclo [selettore] · Da guardare · In vetrina · Non controllate`.
- Ogni riga: titolo, durata, creata/modificata, spunta vetrina, **badge di stato** (`Funziona` / `Da guardare` /
  `Problema` / `Non controllata` / `Da ricontrollare`, etichette di `ETICHETTE_STATO`), azioni rapide (ascolta, menu ⋯).
- Ordinamento: per data di creazione come oggi; con filtro «Da guardare» prima i problemi.

### 4.2 Scheda traccia (`?traccia=<id>`)

Pannello laterale su schermo largo, pagina intera su telefono. Sezioni:
1. **Ascolto** (player attuale, `CardTracciaAudio` in anteprima).
2. **Contenuto**: titolo, testo della card (form di modifica attuale).
3. **File**: sostituisci file · rigenera da script (apre il flusso Genera precompilato solo con il titolo:
   lo script non è salvato).
4. **Vetrina**: `ModuloVetrina` attuale.
5. **Dove è usata**: cicli e settimane (da `lezioni`/`esercizi` con `traccia_id`), con link alla settimana.
6. **Controllo**: esito salvato (sez. 4.4) con data, elenco degli esiti per livello (collegamenti, file, ascolto
   tecnico, con i minuti dei tratti bassi), bottone **Ricontrolla**.
7. **Elimina** in fondo (`.btn-ghost.is-pericolo` → `DialogConferma`; il blocco «Traccia ancora collegata» resta).

### 4.3 Nuova traccia `/admin/tracce/nuova`

Prima schermata con due scelte: **Carica un file** (form attuale della Libreria) e **Genera da script**
(tutto il flusso di `GeneraTraccia.jsx`: paragrafi, modello, voce, pause, ascolto, salva).
Al salvataggio: si torna all'elenco con la scheda della nuova traccia aperta e il controllo parte da solo.

### 4.4 Esito del controllo nel database

Oggi il controllo legge e basta; l'esito si perde a ogni ricarica e l'ascolto tecnico (decodifica completa)
non si può rifare per tutte le tracce a ogni apertura. Si salva l'esito per traccia.

Nuovo file `supabase/migrazione_controllo_tracce.sql` (proposta, da rivedere prima di applicare):

```sql
-- Esito dell'ultimo controllo di ogni traccia (file + ascolto tecnico).
-- Solo facilitatore. Nessun dato dei partecipanti.
alter table tracce add column if not exists file_aggiornato_il timestamptz;
update tracce set file_aggiornato_il = coalesce(aggiornato_il, creato_il) where file_aggiornato_il is null;
alter table tracce alter column file_aggiornato_il set default now();

create table if not exists controlli_tracce (
  traccia_id uuid primary key references tracce(id) on delete cascade,
  stato text not null check (stato in ('ok', 'attenzione', 'errore')),
  esiti jsonb not null default '[]'::jsonb,   -- [{ livello, stato, testo }]
  misure jsonb,                               -- { durata, integrata, tipo, totale }
  controllato_il timestamptz not null default now()
);

alter table controlli_tracce enable row level security;
drop policy if exists "facilitatore gestisce controlli" on controlli_tracce;
create policy "facilitatore gestisce controlli" on controlli_tracce
  for all using (is_facilitatore()) with check (is_facilitatore());
grant select, insert, update, delete on controlli_tracce to authenticated;

notify pgrst, 'reload schema';
```

Regole:
- `sostituisciFileTraccia` (stesso URL, `upsert: true`) e la creazione di una traccia impostano `file_aggiornato_il = now()`.
- Badge «Da ricontrollare» quando `controllato_il < file_aggiornato_il`; «Non controllata» quando la riga non c'è.
- Il livello 1 (collegamenti) dipende dal ciclo e si calcola al volo (è leggero): non va salvato.
  Lo stato mostrato nel filtro «Usate nel ciclo X» = peggiore fra esito salvato e collegamenti di quel ciclo (`peggiore()`).
- Dopo «Ricontrolla» o «Controlla tutte» si fa `upsert` della riga. `pulisciCacheControllo()` resta.

## 5. Comunicazioni e Sito

- `/admin/comunicazioni`: la parte facilitatore di `Comunicazioni.jsx` (componi, inviate, inattività, pausa di pratica)
  spostata in una pagina propria, es. `pages/admin/Comunicazioni.jsx`. `Comunicazioni.jsx` resta solo
  per il partecipante (titolo «Avvisi»). Il facilitatore non vede mai la parola «Avvisi» nel suo menu.
- `/admin/sito`: `EditorSplash`, `EditorVetrina`, card «Uso dei dati e dei punteggi», tolti da `Dashboard.jsx`.
  In testata un link «Apri Ascolta» per vedere la vetrina pubblica.

## 6. Pulizia

- Togliere il ramo facilitatore dal menu di `Nav.jsx` (righe con `facilitatore ? (…Cicli, Percorso…)`).
  Su `/` e `/accedi` il facilitatore loggato vede solo un link «Area facilitatore» → `/admin/cicli`.
- Togliere `pagineAdminAmpie` da `App.jsx`.
- Smontare `Dashboard.jsx` (~1.600 righe) nelle pagine/schede nuove. Suggerita la cartella `src/pages/admin/`
  (`Cicli.jsx`, `Ciclo.jsx` + `ciclo/Panoramica.jsx`, `Iscritti.jsx`, `Programma.jsx`, `Pratica.jsx`, `Questionari.jsx`;
  `Tracce.jsx`, `NuovaTraccia.jsx`, `SchedaTraccia.jsx`; `Comunicazioni.jsx`; `Sito.jsx`). I file vecchi si eliminano
  quando la loro rotta è solo un reindirizzamento.
- Il ciclo attivo nello spazio del ciclo arriva dalla rotta: un solo hook (es. `useCiclo(cicloId)`) che carica il ciclo
  e lo passa alle schede, invece delle letture separate di oggi.

## 7. Fasi e criteri di accettazione

1. **Rotte e guscio**: layout `/admin`, 4 voci, barra in basso su telefono, reindirizzamenti, login → `/admin/cicli`,
   menu tolto da `Nav.jsx`. *Fatto quando*: ogni vecchio indirizzo apre la pagina giusta; nessuna pagina facilitatore
   raggiungibile fuori da `/admin`.
2. **Cicli**: pagina iniziale e spazio del ciclo con le 5 schede; `Percorso.jsx` e la Dashboard non più usati.
   *Fatto quando*: il ciclo si sceglie solo dall'elenco o dal selettore in testata; nessuna tendina «Ciclo» nelle schede.
3. **Tracce**: elenco, scheda, nuova traccia, migrazione `controlli_tracce` applicata.
   *Fatto quando*: si può creare (carica/genera), modificare, mettere in vetrina, controllare ed eliminare una traccia
   senza lasciare `/admin/tracce`; il badge sopravvive al ricaricamento e diventa «Da ricontrollare» dopo una sostituzione del file.
4. **Comunicazioni e Sito** separati.
5. **Documentazione**: aggiornare `docs/interfaccia.md` (gusci, schermate, catalogo), `docs/architettura.md`
   (rotte, nuova tabella) e il registro di `docs/progetto.md`.

## 8. Vincoli

- Solo componenti e token esistenti (`docs/design-system.md`): `.btn`, `.card`, `.field`, `.dialogo`, `.dash-tabs`, card numeriche.
  Il pannello laterale della scheda traccia è l'unico elemento nuovo: aggiungerlo come componente condiviso e documentarlo.
- Tre stati in ogni pagina (attesa, vuoto, errore).
- Accessibilità: schede con `role="tablist"` come oggi, ma ognuna è una rotta (link con `aria-current`).
- Nessun cambio alle RPC dei partecipanti, a export/reset o ai dati raccolti.
- Linguaggio: «pratica», «percorso», «programma»; mai termini clinici.

## 9. Punto da confermare con Dimitri

Questionari nello spazio del ciclo: di default filtrati sul ciclo, con interruttore «Tutti i cicli» (sez. 3.2).
Se Dimitri preferisce solo la vista per ciclo, togliere l'interruttore e il link al punto 5 della sez. 3.1.
