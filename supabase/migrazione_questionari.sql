-- Da eseguire nell'SQL editor se schema.sql è già stato applicato in una versione precedente.
-- Su un progetto nuovo basta schema.sql + seed_questionari.sql.

alter table questionari add column if not exists nome text;
-- unique su nome: si aggiunge solo se manca
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'questionari_nome_key'
  ) then
    alter table questionari add constraint questionari_nome_key unique (nome);
  end if;
end $$;

alter table item add column if not exists ordine int;
alter table item add column if not exists inverso boolean not null default false;
alter table item add column if not exists sottoscala text;
update item set ordine = 1 where ordine is null;
alter table item alter column ordine set not null;
alter table item alter column scala set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'item_questionario_id_ordine_key'
  ) then
    alter table item add constraint item_questionario_id_ordine_key unique (questionario_id, ordine);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'risposte_utente_id_item_id_timepoint_key'
  ) then
    alter table risposte add constraint risposte_utente_id_item_id_timepoint_key unique (utente_id, item_id, timepoint);
  end if;
end $$;

drop policy if exists "lettura pubblica questionari" on questionari;
create policy "lettura pubblica questionari" on questionari
  for select using (true);

drop policy if exists "lettura pubblica item" on item;
create policy "lettura pubblica item" on item
  for select using (true);

create or replace view v_risposte_pseudonime
with (security_invoker = true) as
select
  u.codice_partecipante,
  q.nome as questionario,
  i.ordine,
  i.sottoscala,
  i.inverso,
  r.timepoint,
  r.valore,
  r.data_compilazione
from risposte r
join utenti u on u.id = r.utente_id
join item i on i.id = r.item_id
join questionari q on q.id = i.questionario_id;

create or replace function codice_partecipante_valido(p_codice text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from utenti
    where upper(trim(codice_partecipante)) = upper(trim(p_codice))
      and ruolo = 'partecipante'
  );
$$;

create or replace function ha_compilato_timepoint(p_codice text, p_timepoint text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from risposte r
    join utenti u on u.id = r.utente_id
    where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
      and r.timepoint = p_timepoint
  );
$$;

create or replace function salva_risposte_questionario(
  p_codice text,
  p_timepoint text,
  p_risposte jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_inserite int;
begin
  if p_timepoint not in ('T0', 'T1', 'T2', 'T3') then
    raise exception 'TIMEPOINT_NON_VALIDO';
  end if;

  if p_risposte is null or jsonb_typeof(p_risposte) <> 'array' or jsonb_array_length(p_risposte) = 0 then
    raise exception 'RISPOSTE_MANCANTI';
  end if;

  select id into v_utente_id
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  if exists (
    select 1 from risposte
    where utente_id = v_utente_id and timepoint = p_timepoint
  ) then
    raise exception 'COMPILAZIONE_GIA_PRESENTE';
  end if;

  insert into risposte (utente_id, item_id, timepoint, valore)
  select
    v_utente_id,
    i.id,
    p_timepoint,
    (x->>'valore')::int
  from jsonb_array_elements(p_risposte) as x
  join item i on i.id = (x->>'item_id')::uuid
  where (i.scala = 'likert_0_4' and (x->>'valore')::int between 0 and 4)
     or (i.scala = 'likert_1_5' and (x->>'valore')::int between 1 and 5);

  get diagnostics v_inserite = row_count;

  if v_inserite <> jsonb_array_length(p_risposte) then
    raise exception 'RISPOSTE_NON_VALIDE';
  end if;

  return jsonb_build_object('ok', true, 'timepoint', p_timepoint, 'n_risposte', v_inserite);
end;
$$;

revoke all on function codice_partecipante_valido(text) from public;
revoke all on function ha_compilato_timepoint(text, text) from public;
revoke all on function salva_risposte_questionario(text, text, jsonb) from public;

grant execute on function codice_partecipante_valido(text) to anon, authenticated;
grant execute on function ha_compilato_timepoint(text, text) to anon, authenticated;
grant execute on function salva_risposte_questionario(text, text, jsonb) to anon, authenticated;
