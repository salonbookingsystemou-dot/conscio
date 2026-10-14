# Prompt per Claude Code

Scompatta lo zip nella radice del repo (aggiunge o sostituisce file solo in `docs/`), poi incolla in Claude Code:

---

Lavoriamo alla fase 1 del nuovo framework dell'area facilitatore.

Leggi, nell'ordine:
1. `docs/brief_framework_fase1.md`: è il brief operativo, seguilo;
2. `docs/framework_layout_facilitatore.md`;
3. `docs/brief_navigazione_facilitatore.md`, sezioni 2, 4bis e 7;
4. `docs/design-system.md` e `docs/interfaccia.md`.

Apri anche i mockup in `docs/mockup/framework-facilitatore/` (parti da `index.html`). Sono il riferimento visivo:
- struttura, misure e comportamento vanno riprodotti;
- i colori vanno espressi solo con i token.

Prima di scrivere codice, fai la verifica della sez. 0 del brief e mostrami:
- la lista delle cose trovate nel repo;
- il piano dei commit.

Aspetta il mio ok.

Poi procedi un blocco alla volta, nell'ordine dei commit:
1. token;
2. rotte;
3. guscio;
4. componenti;
5. documentazione.

Dopo ogni blocco esegui `npm run build`. Fermati e chiedimi se qualcosa nel codice contraddice il brief.

---

Contenuto dello zip:
- `docs/brief_framework_fase1.md`: nuovo, brief operativo della fase 1.
- `docs/framework_layout_facilitatore.md`: nuovo, regole del layout (Material 3 Expressive su token Conscio).
- `docs/brief_navigazione_facilitatore.md`: aggiornato il 14/10, con rail laterale, azione principale nel rail e snackbar (sez. 4bis).
- `docs/mockup/framework-facilitatore/`: 5 tavole HTML statiche + `index.html`.
- `docs/prompt_claude_code_fase1.md`: questo file.
