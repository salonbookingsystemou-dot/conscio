------------------------------------------------------------------------------
-- La condivisione chiude il percorso (14/11/2026)
--
-- «Condividi su WhatsApp» apre WhatsApp: chi condivide spesso non torna
-- nell'app a premere «Concludi». Al 14/11 due persone (MBSR-NH9HLADL,
-- MBSR-WD5ZRFZS) avevano fatto tutta la sequenza, condivisione compresa, ma
-- risultavano «da chiudere»: l'app le riportava alla sequenza e avrebbero
-- ricevuto l'email «Manca un ultimo passo».
-- Decisione di Dimitri: la condivisione vale come chiusura. «Concludi senza
-- condividere» resta per chi non condivide.
--
-- 1. salva_passo_conclusione: il passo «condivisione» registra anche completata_il.
-- 2. Chi ha già condiviso senza concludere: completata_il = condivisione_il.
-- Nessuna nuova categoria di dati: informativa, export e reset non cambiano.
------------------------------------------------------------------------------

create or replace function public.salva_passo_conclusione(p_codice text, p_passo text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_giorno date;
begin
  v_id := assert_partecipante_noto(p_codice);
  v_giorno := giorno_conclusione(v_id);
  if v_giorno is null or current_date < v_giorno then
    raise exception 'CONCLUSIONE_NON_APERTA';
  end if;
  if p_passo not in ('congratulazioni', 'condivisione', 'completata') then
    raise exception 'PASSO_NON_VALIDO';
  end if;

  insert into conclusioni_percorso (utente_id) values (v_id)
  on conflict (utente_id) do nothing;

  -- La condivisione è l'ultimo passo: vale anche come chiusura del percorso.
  update conclusioni_percorso set
    congratulazioni_il = case when p_passo = 'congratulazioni' then coalesce(congratulazioni_il, now()) else congratulazioni_il end,
    condivisione_il = case when p_passo = 'condivisione' then coalesce(condivisione_il, now()) else condivisione_il end,
    completata_il = case when p_passo in ('condivisione', 'completata') then coalesce(completata_il, now()) else completata_il end
  where utente_id = v_id;
end;
$function$;

update public.conclusioni_percorso
  set completata_il = condivisione_il
where condivisione_il is not null
  and completata_il is null;
