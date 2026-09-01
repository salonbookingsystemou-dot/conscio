-- Da eseguire se schema.sql è già stato applicato (anche dopo migrazione_questionari.sql).
-- Collega Auth al ruolo facilitatore, restringe le RLS e aggiunge log / iscrizione / email.

alter table utenti add column if not exists auth_user_id uuid unique;
alter table comunicazioni add column if not exists oggetto text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lezioni_ciclo_id_numero_settimana_key'
  ) then
    alter table lezioni add constraint lezioni_ciclo_id_numero_settimana_key unique (ciclo_id, numero_settimana);
  end if;
end $$;

drop policy if exists "iscrizione pubblica" on utenti;
create policy "iscrizione pubblica" on utenti
  for insert with check (
    ruolo = 'partecipante'
    and consenso_modulo_a = true
  );

create or replace function is_facilitatore()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from utenti
    where auth_user_id = auth.uid()
      and ruolo = 'facilitatore'
  );
$$;

create or replace function iscrivi_partecipante(
  p_email text,
  p_ciclo_id uuid,
  p_codice text,
  p_consenso_a boolean,
  p_consenso_b boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
begin
  if coalesce(p_consenso_a, false) is not true then
    raise exception 'CONSENSO_A_OBBLIGATORIO';
  end if;

  if p_email is null or trim(p_email) = '' then
    raise exception 'EMAIL_MANCANTE';
  end if;

  if not exists (select 1 from cicli where id = p_ciclo_id and stato = 'reclutamento') then
    raise exception 'CICLO_NON_DISPONIBILE';
  end if;

  insert into utenti (
    codice_partecipante, email, ruolo, stato_screening,
    consenso_modulo_a, consenso_modulo_b
  ) values (
    p_codice, trim(p_email), 'partecipante', 'in_valutazione',
    true, coalesce(p_consenso_b, false)
  ) returning id into v_utente_id;

  insert into iscrizioni (utente_id, ciclo_id, esito_screening)
  values (v_utente_id, p_ciclo_id, 'in_attesa');

  return jsonb_build_object('ok', true, 'codice', p_codice);
end;
$$;

create or replace function salva_log_pratica(
  p_codice text,
  p_data date,
  p_durata int,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
begin
  select id into v_utente_id
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  if p_durata is null or p_durata <= 0 then
    raise exception 'DURATA_NON_VALIDA';
  end if;

  insert into log_pratica (utente_id, data, durata_minuti, note)
  values (v_utente_id, coalesce(p_data, current_date), p_durata, p_note);

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function risposte_pseudonime()
returns table (
  codice_partecipante text,
  questionario text,
  ordine int,
  sottoscala text,
  inverso boolean,
  timepoint text,
  valore int,
  data_compilazione timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    u.codice_partecipante,
    q.nome,
    i.ordine,
    i.sottoscala,
    i.inverso,
    r.timepoint,
    r.valore,
    r.data_compilazione
  from risposte r
  join utenti u on u.id = r.utente_id
  join item i on i.id = r.item_id
  join questionari q on q.id = i.questionario_id
  where is_facilitatore()
    and u.ruolo = 'partecipante';
$$;

create or replace function log_pratica_pseudonimi()
returns table (
  codice_partecipante text,
  data date,
  durata_minuti int,
  note text
)
language sql
security definer
set search_path = public
as $$
  select u.codice_partecipante, l.data, l.durata_minuti, l.note
  from log_pratica l
  join utenti u on u.id = l.utente_id
  where is_facilitatore()
    and u.ruolo = 'partecipante';
$$;

create or replace function email_destinatari_ciclo(p_ciclo_id uuid)
returns table (email text)
language sql
security definer
set search_path = public
as $$
  select distinct u.email
  from utenti u
  join iscrizioni i on i.utente_id = u.id
  where i.ciclo_id = p_ciclo_id
    and u.ruolo = 'partecipante'
    and u.email is not null
    and is_facilitatore();
$$;

revoke all on function is_facilitatore() from public;
revoke all on function iscrivi_partecipante(text, uuid, text, boolean, boolean) from public;
revoke all on function salva_log_pratica(text, date, int, text) from public;
revoke all on function risposte_pseudonime() from public;
revoke all on function log_pratica_pseudonimi() from public;
revoke all on function email_destinatari_ciclo(uuid) from public;

grant execute on function is_facilitatore() to anon, authenticated;
grant execute on function iscrivi_partecipante(text, uuid, text, boolean, boolean) to anon, authenticated;
grant execute on function salva_log_pratica(text, date, int, text) to anon, authenticated;
grant execute on function risposte_pseudonime() to authenticated;
grant execute on function log_pratica_pseudonimi() to authenticated;
grant execute on function email_destinatari_ciclo(uuid) to authenticated;

drop policy if exists "facilitatore legge utenti" on utenti;
create policy "facilitatore legge utenti" on utenti
  for select using (is_facilitatore());

drop policy if exists "facilitatore aggiorna utenti" on utenti;
create policy "facilitatore aggiorna utenti" on utenti
  for update using (is_facilitatore()) with check (is_facilitatore());

drop policy if exists "facilitatore legge cicli" on cicli;
create policy "facilitatore legge cicli" on cicli
  for select using (is_facilitatore());

drop policy if exists "facilitatore scrive cicli" on cicli;
create policy "facilitatore scrive cicli" on cicli
  for all using (is_facilitatore()) with check (is_facilitatore());

drop policy if exists "facilitatore legge iscrizioni" on iscrizioni;
create policy "facilitatore legge iscrizioni" on iscrizioni
  for select using (is_facilitatore());

drop policy if exists "facilitatore aggiorna iscrizioni" on iscrizioni;
create policy "facilitatore aggiorna iscrizioni" on iscrizioni
  for update using (is_facilitatore()) with check (is_facilitatore());

drop policy if exists "facilitatore gestisce lezioni" on lezioni;
create policy "facilitatore gestisce lezioni" on lezioni
  for all using (is_facilitatore()) with check (is_facilitatore());

drop policy if exists "facilitatore gestisce esercizi" on esercizi;
create policy "facilitatore gestisce esercizi" on esercizi
  for all using (is_facilitatore()) with check (is_facilitatore());

drop policy if exists "facilitatore gestisce comunicazioni" on comunicazioni;
create policy "facilitatore gestisce comunicazioni" on comunicazioni
  for all using (is_facilitatore()) with check (is_facilitatore());
