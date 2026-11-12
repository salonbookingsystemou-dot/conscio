------------------------------------------------------------------------------
-- Il percorso si chiude con l'ottava settimana: tolta la settimana intensiva (12/11/2026)
--
-- Prima: 8 settimane + una nona «intensiva». Senza data_fine la fine era
-- data_inizio + 62 (9 settimane) e la settimana corrente arrivava a 9.
-- Ora: la fine predefinita è data_inizio + 55 (ultimo giorno della settimana 8)
-- e la settimana corrente si ferma a 8. Le date di fine già salvate nei cicli
-- non cambiano.
--
-- Funzioni toccate (solo i numeri, la logica resta quella in linea):
--   + 62 -> + 55     salva_risposte_questionario, apertura_t2, ciclo_del_partecipante,
--                    timepoint_in_finestra, stato_questionari_del_partecipante,
--                    separa_email_cicli_conclusi, periodo_del_partecipante
--   least(9, …) -> least(8, …)   settimana_per_questionari, programma_del_partecipante
--   between 1 and 9 -> between 1 and 8   checkin_del_partecipante
-- Vincoli: lezioni.numero_settimana e checkin_settimanali.settimana tra 1 e 8
-- (al 12/11 nessuna riga con settimana 9).
--
-- La riscrittura parte dalla definizione in linea (pg_get_functiondef), così
-- non si perdono modifiche fatte direttamente sul database: per esempio
-- apertura_t2 in linea usa greatest(fine + 1, inizio + 56), non least come in
-- migrazione_t2_fine_settimana_8.sql. Se un numero atteso manca, si ferma tutto.
------------------------------------------------------------------------------

do $$
declare
  r record;
  v_def text;
  v_nuova text;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'salva_risposte_questionario', 'apertura_t2', 'ciclo_del_partecipante',
        'timepoint_in_finestra', 'stato_questionari_del_partecipante',
        'separa_email_cicli_conclusi', 'periodo_del_partecipante',
        'settimana_per_questionari', 'programma_del_partecipante',
        'checkin_del_partecipante'
      )
  loop
    v_def := pg_get_functiondef(r.oid);
    v_nuova := v_def;
    v_nuova := regexp_replace(v_nuova, '\+ 62\M', '+ 55', 'g');
    v_nuova := regexp_replace(v_nuova, 'least\(9,', 'least(8,', 'g');
    v_nuova := regexp_replace(v_nuova, 'between 1 and 9\M', 'between 1 and 8', 'g');

    if v_nuova = v_def then
      raise exception 'Funzione % senza numeri da cambiare: controllare a mano', r.proname;
    end if;

    execute v_nuova;
  end loop;

  -- Controllo: non deve restare nessun riferimento alle 9 settimane.
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~ '(\+ 62\M|least\(9,|between 1 and 9\M)'
  ) then
    raise exception 'Restano funzioni con + 62 / least(9, / between 1 and 9';
  end if;
end;
$$;

-- Le 10 funzioni attese devono esserci tutte.
do $$
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'salva_risposte_questionario', 'apertura_t2', 'ciclo_del_partecipante',
          'timepoint_in_finestra', 'stato_questionari_del_partecipante',
          'separa_email_cicli_conclusi', 'periodo_del_partecipante',
          'settimana_per_questionari', 'programma_del_partecipante',
          'checkin_del_partecipante')) <> 10 then
    raise exception 'Mancano alcune funzioni attese';
  end if;
end;
$$;

-- Vincoli sulle settimane: da 1 a 8.
do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass as tabella, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.lezioni'::regclass, 'public.checkin_settimanali'::regclass)
      and pg_get_constraintdef(oid) ~ '<= 9\)'
  loop
    execute format('alter table %s drop constraint %I', c.tabella, c.conname);
  end loop;
end;
$$;

alter table public.lezioni
  add constraint lezioni_numero_settimana_check check (numero_settimana between 1 and 8);

alter table public.checkin_settimanali
  add constraint checkin_settimanali_settimana_check check (settimana between 1 and 8);
