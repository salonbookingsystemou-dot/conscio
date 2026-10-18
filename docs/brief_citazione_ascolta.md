# Brief · Citazione in testa ad Ascolta

Data: 18/10/2026 · Esecuzione: Claude Code
Riferimento visivo: canvas «Conscio · Player Ascolta», tavola «/ascolta · vetrina».

Prima di iniziare leggi `docs/progetto.md`, `docs/interfaccia.md` e `docs/design-system.md`.

## Obiettivo

In `/ascolta` l'intestazione attuale (`header.ascolta-testa`, con titolo «E se ti fermassi un momento?» e un paragrafo) viene sostituita da una **citazione** presa dalla tabella `quotes`:
- il testo della citazione;
- sotto, l'**autore**;
- sotto ancora, il **libro** da cui è tratta.

La pagina `/ascolta/:slug` non cambia.

## 1. Database: `supabase/migrazione_citazione_vetrina.sql`

La tabella `quotes` è leggibile solo dal service role, perché serve all'email di incoraggiamento. **Non** aggiungere policy per `anon` sulla tabella. Serve invece una RPC dedicata:

```sql
create or replace function vetrina_citazione()
returns table (author text, book_title text, quote_text text)
language sql
stable
security definer
set search_path = public
as $$
  with attive as (
    select q.author, q.book_title, q.quote_text,
           row_number() over (order by q.id) - 1 as n,
           count(*) over () as totale
    from quotes q
    where q.active = true and q.language = 'it'
  )
  select a.author, a.book_title, a.quote_text
  from attive a
  where exists (select 1 from impostazioni_sito i where i.id = 1 and i.vetrina_attiva)
    and a.n = mod((current_date - date '2026-01-01'), a.totale);
$$;

revoke all on function vetrina_citazione() from public;
grant execute on function vetrina_citazione() to anon, authenticated;
```

Come funziona:
- **Una citazione al giorno, uguale per tutti.** Ruota su tutte le citazioni attive in un ordine stabile. È coerente tra visite e tra chi condivide la pagina, e non serve tracciare nessuno.
- Restituisce **solo** testo, autore e libro: nessun `id`, `week_theme` o dato degli invii.
- Se la vetrina è spenta o non ci sono citazioni attive, restituisce un insieme vuoto.
- **Non toccare** `scegli_citazione`, `quote_sent_log` e l'email di incoraggiamento.

## 2. Client

**`src/lib/vetrina.js`:** aggiungi `caricaCitazione()`, che chiama `supabase.rpc('vetrina_citazione')` e restituisce la prima riga oppure `null`. Mettila in cache in memoria per la sessione, come `vetrina_impostazioni`. Gli errori non devono bloccare la pagina.

**`src/pages/Ascolta.jsx`**, al posto di `header.ascolta-testa`, solo nella vista elenco (senza `slug`):

```jsx
<header className="ascolta-testa">
  <h1 className="sr-only">Ascolta</h1>
  {citazione ? (
    <figure className="ascolta-citazione">
      <blockquote><p>«{citazione.quote_text}»</p></blockquote>
      <figcaption>
        <span className="ascolta-citazione-autore">{citazione.author}</span>
        <cite>{citazione.book_title}</cite>
      </figcaption>
    </figure>
  ) : (
    /* l'intestazione di oggi, invariata */
  )}
</header>
```

- Usa la classe per il testo visibile solo ai lettori di schermo se esiste già nel progetto; altrimenti aggiungine una in `styles.css`. L'`h1` «Ascolta» resta come titolo della pagina per l'accessibilità.
- **Senza citazione** (caricamento, errore, nessun risultato) mostra l'intestazione attuale, così la pagina non resta mai vuota. Nessuno stato di attesa dedicato: niente salto visivo.
- Aggiungi i caporali «» lato client solo se il testo non li contiene già.
- **Dimensione adattiva**, con una classe calcolata dalla lunghezza del testo:
  - fino a 45 caratteri: `is-breve`;
  - fino a 70: `is-media`;
  - oltre 70: `is-lunga`.

## 3. Stile (`styles.css`, prefisso `.ascolta-`, solo token)

| Elemento | Regole |
|---|---|
| `.ascolta-citazione` | `margin: 0`; colonna con `gap: var(--space-14)`. Sopra il testo un segno di virgolette discreto: SVG inline `aria-hidden`, colore tenue del design system, ~28×22 px. |
| `blockquote p` | `var(--font-display)`, peso 400, `line-height: 1.25`, `text-wrap: balance`, colore `--ink`. Dimensioni: `is-breve` 26 px, `is-media` 23 px, `is-lunga` 21 px. Se esistono token di dimensione vicini (es. `--fs-section`), usali; altrimenti aggiungi tre token in `tokens.css` e non scrivere i px direttamente nelle regole. |
| `.ascolta-citazione-autore` | `--fs-body`, peso 600, `--ink`. |
| `cite` | corsivo, `--fs-small`, `--lh-body`, `--muted`. |

Il margine sotto l'intestazione resta quello attuale di `.ascolta-testa`.

## 4. Anteprime social

`scripts/pagine-condivisione.mjs` **non** cambia: l'anteprima di `/ascolta` resta quella attuale. La citazione cambia ogni giorno e non deve finire nei tag `og:`.

## 5. Verifiche

- Vetrina accesa con citazioni attive: la citazione compare, ed è la stessa ricaricando la pagina nello stesso giorno.
- Vetrina spenta: lo stato «La sezione non è ancora aperta» resta com'è, e la RPC restituisce un insieme vuoto.
- RPC che fallisce o tabella vuota: compare l'intestazione attuale.
- Da `anon`: `select * from quotes` resta negato; `rpc('vetrina_citazione')` funziona.
- Lettore di schermo: si sente «Ascolta» come titolo, poi citazione, autore e libro.
- Telefono a 360 px di larghezza: nessuna citazione va a capo male né esce dallo schermo.

## 6. A lavoro fatto

- `docs/architettura.md`: RPC `vetrina_citazione` tra quelle pubbliche.
- `docs/interfaccia.md`: intestazione di Ascolta con citazione e ripiego sull'intestazione attuale.
- `docs/progetto.md`: voce nel registro, con la nota che la tabella `quotes` resta chiusa ad `anon`.
