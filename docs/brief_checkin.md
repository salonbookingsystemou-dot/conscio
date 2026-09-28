# Conscio · brief frontend: check-in settimanale e finestre dei questionari

Contesto: la parte database è **già applicata** in produzione (28/9/2026) ed è documentata in
`supabase/migrazione_checkin_progressi.sql`. Non va rieseguita. Leggi anche `docs/progetto.md`.
Non riscrivere le funzioni che quel file modifica partendo da copie più vecchie nei file `supabase/`.

Tutte le chiamate del partecipante seguono lo schema esistente: RPC `security definer` con `p_codice`,
nessun accesso diretto alle tabelle.

---

## Punto 2 · Ora della pratica

Nessun lavoro sul frontend. `log_pratica.registrato_il` si compila da solo con `default now()`.
Le righe precedenti restano con `registrato_il = null`: nelle analisi vanno escluse, non stimate.

---

## Punto 3 · Check-in settimanale

### RPC disponibili

```
checkin_del_partecipante(p_codice text) -> jsonb
  { settimana: int, aperto: bool, consenso: bool, compilato: bool, checkin: {...} | null }

dai_consenso_checkin(p_codice text) -> jsonb { ok }

salva_checkin(
  p_codice text,
  p_stress int,               -- 0..10
  p_sonno int,                -- 0..10
  p_presenza_quotidiana int,  -- 0..4
  p_ostacoli text[],          -- sottoinsieme di: tempo, stanchezza, dimenticanza, noia, disagio, altro
  p_esperienza_difficile bool,
  p_nota_difficile text       -- facoltativa, max 1000 caratteri
) -> jsonb { ok, id, settimana, segnalazione }
```

Errori possibili: `CODICE_NON_TROVATO`, `CONSENSO_CHECKIN_MANCANTE`, `ACCESSO_NON_IDONEO`, `CHECKIN_NON_APERTO`, limite di frequenza da `assert_limite`.
Un secondo salvataggio nella stessa settimana aggiorna il check-in esistente.

### Consenso (prima del primo check-in)

Il check-in raccoglie dati sul benessere (stress, sonno, esperienze difficili) che il Modulo A non elenca,
quindi serve un consenso esplicito e separato. Se `consenso` è `false`, la card apre prima questa schermata:

> **Check-in settimanale · facoltativo**
> Una volta a settimana ti chiediamo come stai: stress, sonno, momenti di presenza, cosa ti ha reso difficile
> praticare, ed eventuali momenti difficili durante la pratica. Serve a seguire il percorso del gruppo e per lo
> studio pilota. Le risposte sono legate al tuo codice, non al tuo nome, e non vengono unite alla tua email.
> Se segnali un momento difficile, lo leggerà solo chi conduce il percorso, per contattarti.
> Puoi smettere quando vuoi: il percorso non cambia. Per revocare il consenso scrivi a [email di contatto].
>
> [ ] Acconsento al trattamento di queste risposte (art. 9, par. 2, lett. a GDPR).
> Bottone: **Inizia il check-in** (attivo solo con la casella spuntata) → `dai_consenso_checkin`, poi il form.
> Link secondario: **Non ora** (la card resta, senza insistere).

Usa `EMAIL_CONTATTO` da `src/lib/contatti.js`.

### Aggiornare i documenti (`src/pages/Documento.jsx`)

- Informativa, sezione 2: aggiungere il check-in settimanale alla voce sui dati del percorso, con base
  art. 9, par. 2, lett. a) e consenso separato raccolto nell'app.
- Informativa, sezione 3: aggiungere "risposte al check-in settimanale facoltativo (stress, sonno, momenti di
  presenza, ostacoli alla pratica, eventuali momenti difficili), solo se dai il consenso".
- Diritti, sezione 2: il file JSON contiene anche i check-in.
- Aggiornare la data del testo in fondo alla pagina.

### Interfaccia partecipante

- Nella home, se `aperto && !compilato`: una card "Il check-in della settimana · 1 minuto".
- Se `compilato`: la card mostra "Fatto ✓" con la possibilità di modificarlo fino alla fine della settimana.
- Una sola schermata, nell'ordine:
  1. **Quanto stress hai sentito questa settimana?** Slider 0-10, estremi "per niente" / "moltissimo".
  2. **Come hai dormito questa settimana?** Slider 0-10, estremi "molto male" / "molto bene".
  3. **Quante volte ti sei accorto di essere presente durante la giornata, fuori dalle pratiche?**
     Cinque bottoni: mai (0), raramente (1), qualche volta (2), spesso (3), molto spesso (4).
  4. **Cosa ti ha reso difficile praticare?** Scelta multipla, facoltativa:
     tempo, stanchezza, mi sono dimenticato, noia, disagio durante la pratica, altro.
  5. **Durante la pratica hai vissuto momenti particolarmente difficili o che ti hanno turbato?** Sì / No.
     Se Sì: campo di testo facoltativo "Se vuoi, racconta brevemente cosa è successo. Lo leggerà solo Dimitri."
- Stile coerente con il design system di Conscio (Fraunces per i titoli, Inter per il testo, palette carta e terra).
  Nessuna estetica da grafico clinico: gli slider sono discreti, senza colori rosso/verde.

### Se la risposta alla domanda 5 è Sì

Dopo il salvataggio mostra un messaggio sobrio, senza allarmismi:

> Grazie per averlo condiviso. Dimitri ti contatterà nei prossimi giorni.
> Nel frattempo, se una pratica ti mette a disagio puoi fermarti, aprire gli occhi o passare a una versione più breve.
> Se ti senti in difficoltà adesso, parlane con il tuo medico. In caso di emergenza chiama il 112.

### Avviso email al facilitatore

- Nuova edge function (stesso provider email di `invia-comunicazione`), attivata da un Database Webhook
  su insert/update di `checkin_settimanali` quando `esperienza_difficile = true`.
- Contenuto dell'email: **solo** codice partecipante e settimana, più il link al pannello admin.
  **Non** inserire la nota nell'email.
- Nel pannello admin: una sezione "Segnalazioni da gestire" che legge `segnalazioni_difficili_aperte()`
  (mostra anche la nota) e un bottone "Segna come gestita" che chiama `segna_segnalazione_gestita(p_checkin_id)`.

### Privacy

- Il check-in è già incluso in `esporta_dati_del_partecipante` e cancellato da `resetta_dati_del_partecipante`
  e dalla cancellazione dell'utente (`on delete cascade`).
- Se l'app elenca da qualche parte le categorie di dati raccolti (informativa, schermata privacy, export),
  aggiungi il check-in settimanale.

---

## Punto 6 · Finestre dei questionari

Cosa cambia nel database:

| Momento | Prima | Adesso |
|---|---|---|
| T2 (fine percorso) | settimane 8-9 **e** entro la data di fine: per il Gruppo pilota aperto solo il 6/11 | dalla settimana 8 fino a 14 giorni dopo la fine |
| T3 (follow-up) | dal giorno dopo la fine, senza chiusura | da 4 a 8 settimane dopo la fine |

`stato_questionari_del_partecipante` restituisce ora anche `apre_il` (per T3) e `chiude_il` (per T2 e T3),
e le etichette `quando` sono aggiornate.

### Frontend

- Nella lista dei questionari mostra le date: "Aperto fino al …" per T2 e T3 quando sono aperti,
  "Si apre il …" per T3 quando è in attesa.
- Promemoria email all'apertura di T3 (fine + 28 giorni) e 7 giorni prima della chiusura,
  riusando la logica di `notifica-inattivita` o il sistema delle `comunicazioni`.
- Verifica che nessun testo dell'app parli di T3 come "subito dopo la fine".
