# Brief · Marchio di Conscio nell'app

15/10/2026. Da eseguire con Claude Code sul repo `conscio`.
Marchio scelto da Dimitri: **segno a spirale + scritta «conscio» in Literata 600**, minuscolo, a un solo colore.
Riferimento visivo: canvas Claude Design «Logo Conscio», tavola «Spirale + Literata · finale».

**Leggi prima:** `docs/design-system.md`, `docs/interfaccia.md`, `docs/framework_layout_facilitatore.md` (rail e marchio del guscio).

## 0. Contenuto del kit

| File | A cosa serve |
|---|---|
| `react/Marchio.jsx` | componente unico del marchio: varianti `segno`, `orizzontale`, `verticale`; colore da `currentColor` |
| `svg/conscio-{orizzontale,verticale,segno,segno-piccolo}-{verde,inchiostro,carta}.svg` | file sorgente per usi fuori dal codice (documenti, social, stampa). Verde `#3F5443`, inchiostro `#262419`, carta `#F5F1E7` (su fondo scuro) |
| `svg/favicon.svg` | favicon vettoriale (spirale semplificata, verde; carta in tema scuro del sistema) |
| `favicon.ico` | 16 + 32 + 48 px |
| `png/apple-touch-icon.png` | 180 px, fondo pieno |
| `png/pwa-192.png`, `png/pwa-512.png` | icone PWA `any` (angoli arrotondati, fondo trasparente) |
| `png/pwa-maskable-192.png`, `png/pwa-maskable-512.png` | icone PWA `maskable` (fondo pieno, segno nella zona sicura) |
| `png/conscio-email-2x.png` | marchio orizzontale per la firma in fondo alle email, alto 128 px (mostrato a 45) |

La scritta è già convertita in tracciati: **non** caricare Literata nell'app.
Il segno ha due disegni: spirale piena (da 40 px in su) e spirale semplificata (sotto i 40 px). `Marchio.jsx` sceglie da solo.

## 1. Prima di scrivere codice

Verifica e riporta in una lista breve:
- dove compare oggi il nome o un marchio (`grep -ri "conscio\|percorso mbsr" src/ index.html public/ supabase/functions/_shared/`);
- come `vite.config.*` dichiara il manifest di `vite-plugin-pwa` (icone, `theme_color`, `background_color`);
- quali icone e favicon ci sono in `public/` e in `index.html`.

Se qualcosa contraddice questo brief, fermati e chiedi.

## 2. File

- `react/Marchio.jsx` → `src/components/Marchio.jsx`.
- SVG sorgente → `src/assets/marchio/` (non importati dal codice, servono come archivio).
- `favicon.svg`, `favicon.ico`, `apple-touch-icon.png` → `public/`.
- `pwa-*.png` → `public/icons/`.
- `conscio-email-2x.png` → `public/email/` (servito da `https://conscio.mnesti.it/email/conscio-email-2x.png`).
- Elimina le icone vecchie che non servono più, dopo aver controllato che nessun file le richiami.

## 3. Manifest e `index.html`

Manifest (`vite-plugin-pwa`):
```js
name: 'Conscio', short_name: 'Conscio',
background_color: '#F5F1E7', theme_color: '#3F5443',
icons: [
  { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: 'icons/pwa-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
  { src: 'icons/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
]
```
Se `name`, `short_name` o i colori attuali sono diversi per scelta, tienili e segnalalo nel resoconto.
Percorsi relativi alla `base` di Vite (GitHub Pages, dominio proprio: `base` è `/`).

`index.html`:
```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#3F5443">
```
Aggiungi i file nuovi alle risorse precaricate del service worker se `includeAssets` è usato.

## 4. Dove usare `Marchio`

Il colore viene dal genitore: metti `color: var(--accent)` (o `var(--ink)`) sul contenitore, mai un esadecimale.
La funzione Tonalità ruota `--accent`: il marchio la segue, ed è voluto.

| Dove | Variante | Altezza |
|---|---|---|
| `Nav.jsx` (marchio del partecipante) | `orizzontale` | 28 px, 24 sotto i 600 px |
| `RailNavigazione` esteso | `orizzontale` + occhiello «Facilitatore» sotto (già previsto) | 30 px |
| `RailNavigazione` compatto (oggi «C») | `segno` | 32 px |
| `Splash.jsx` (hero) | `verticale` | 96–120 px |
| `Accedi.jsx`, `Entra.jsx` (testata della card, se c'è) | `segno` | 40 px |
| `InvitoHome` (installazione PWA) | `segno` | 40 px |
| `StatoAttesa`, `ConfineErrori` | nessuno: non usare il marchio come decorazione | — |

Dove il marchio è un link alla home, il link ha l'etichetta e il marchio è `decorativo`:
```jsx
<a href="#/" aria-label="Conscio, pagina iniziale"><Marchio variante="orizzontale" altezza={28} decorativo /></a>
```
Dove sta da solo, lascia l'etichetta predefinita «Conscio».

## 5. Email

In `supabase/functions/_shared/stileEmail.ts` sostituisci l'intestazione testuale con:
```html
<img src="https://conscio.mnesti.it/email/conscio-email-2x.png" width="199" height="45" alt="Conscio" style="display:block;border:0">
```
Le Edge Functions si ridistribuiscono a mano: elenca nel resoconto quali vanno ridistribuite, senza farlo.

## 6. Vincoli

- Nessun cambio a RPC, dati, rotte.
- Nessun colore esadecimale nuovo nel CSS: solo token. Gli esadecimali stanno solo in manifest, `index.html` e nei file del kit.
- Non ridisegnare i tracciati: se una misura non funziona, segnalalo.
- `prefers-reduced-motion`: il marchio non si anima.

## 7. Criteri di accettazione

1. Il marchio compare nei punti della sez. 4, col colore del contenitore, nitido a 390, 768 e 1440 px.
2. Sotto i 40 px si vede la spirale semplificata (es. rail compatto, favicon).
3. Installata la PWA su Android e iOS, l'icona è il segno chiaro su fondo verde, non tagliato.
4. Favicon visibile nella scheda del browser, chiara e scura.
5. `npm run build` passa; nessun riferimento a icone eliminate.
6. Lettori di schermo: un solo nome per ogni marchio-link («Conscio, pagina iniziale»).

## 8. A lavoro fatto

- `docs/design-system.md`: nuova sezione «Marchio» (componente, varianti, misure minime, colori, cosa non fare: niente ombre, contorni, rotazioni, altri font per la scritta).
- `docs/interfaccia.md`: `Marchio` nel catalogo (sez. 3) e nei gusci (sez. 1).
- Registro in `docs/progetto.md`.
- Un commit per blocco (file e manifest · componente e usi · email · documentazione), messaggi in italiano.
- Resoconto breve: fatto, rimasto fuori, decisioni prese in autonomia, funzioni da ridistribuire.
