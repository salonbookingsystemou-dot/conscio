-- Schema per il progetto pilota MBSR
-- Da eseguire nell'SQL editor di Supabase (progetto in region EU per allineamento GDPR)
-- Dopo questo file: seed_questionari.sql (item PSS-10 e FFMQ-I).
-- Se lo schema era già stato applicato: migrazione_questionari.sql poi migrazione_facilitatore.sql.

create extension if not exists "pgcrypto";

create table utenti (
  id uuid primary key default gen_random_uuid(),
  codice_partecipante text unique not null,
  email text,
  ruolo text not null default 'partecipante' check (ruolo in ('partecipante', 'facilitatore')),
  stato_screening text default 'in_valutazione',
  consenso_modulo_a boolean not null default false,
  consenso_modulo_b boolean not null default false,
  auth_user_id uuid unique,
  creato_il timestamptz default now()
);

create table cicli (
  id uuid primary key default gen_random_uuid(),
  nome_ciclo text not null,
  data_inizio date not null,
  data_fine date,
  stato text not null default 'reclutamento' check (stato in ('reclutamento', 'attivo', 'concluso')),
  posti_totali int not null default 8
);

create table iscrizioni (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid references utenti(id) on delete cascade,
  ciclo_id uuid references cicli(id) on delete cascade,
  data_iscrizione timestamptz default now(),
  esito_screening text default 'in_attesa'
);

create table lezioni (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid references cicli(id) on delete cascade,
  numero_settimana int not null check (numero_settimana between 1 and 9), -- 8 settimane + eventuale giornata intensiva
  tema text,
  pratiche_formali text,
  pratiche_informali text,
  materiali text,
  unique (ciclo_id, numero_settimana)
);

create table esercizi (
  id uuid primary key default gen_random_uuid(),
  lezione_id uuid references lezioni(id) on delete cascade,
  tipo text,
  descrizione text
);

create table log_pratica (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid references utenti(id) on delete cascade,
  esercizio_id uuid references esercizi(id) on delete set null,
  data date not null default current_date,
  durata_minuti int,
  tipo text,
  note text
);

create table questionari (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique, -- es. 'PSS-10', 'FFMQ-I'
  timepoint text             -- null = somministrato a tutti i timepoint (T0–T3)
);

create table item (
  id uuid primary key default gen_random_uuid(),
  questionario_id uuid references questionari(id) on delete cascade,
  ordine int not null,
  testo text not null,
  scala text not null, -- 'likert_0_4' (PSS-10) | 'likert_1_5' (FFMQ-I)
  inverso boolean not null default false,
  sottoscala text,
  unique (questionario_id, ordine)
);

create table risposte (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid references utenti(id) on delete cascade,
  item_id uuid references item(id) on delete cascade,
  timepoint text not null check (timepoint in ('T0', 'T1', 'T2', 'T3')),
  valore int,
  data_compilazione timestamptz default now(),
  unique (utente_id, item_id, timepoint)
);

create table comunicazioni (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid references cicli(id) on delete cascade,
  tipo text,
  oggetto text,
  testo text,
  data_invio timestamptz default now(),
  stato text default 'programmata'
);

-- Row Level Security: attivata su tutte le tabelle.
-- Policy di base: il facilitatore (autenticato) vede/scrive tutto tramite l'app admin;
-- l'iscrizione pubblica passa da una funzione/anon key con insert consentito solo su utenti+iscrizioni.
-- Da affinare in base al modello di autenticazione scelto (Supabase Auth con ruolo facilitatore).

alter table utenti enable row level security;
alter table cicli enable row level security;
alter table iscrizioni enable row level security;
alter table lezioni enable row level security;
alter table esercizi enable row level security;
alter table log_pratica enable row level security;
alter table questionari enable row level security;
alter table item enable row level security;
alter table risposte enable row level security;
alter table comunicazioni enable row level security;

-- Esempio: chiunque (anon) può leggere i cicli in reclutamento e iscriversi
create policy "lettura pubblica cicli in reclutamento" on cicli
  for select using (stato = 'reclutamento');

-- Iscrizione solo tramite iscrivi_partecipante (SECURITY DEFINER):
-- niente insert anonimi diretti su utenti o iscrizioni.

-- Compilazione pubblica dei questionari: si leggono solo gli item (niente email).
-- Le risposte si inseriscono solo tramite le funzioni SECURITY DEFINER qui sotto,
-- che risolvono il partecipante dal codice e non espongono mai l'email.
create policy "lettura pubblica questionari" on questionari
  for select using (true);

create policy "lettura pubblica item" on item
  for select using (true);

-- Vista di ricerca: risposte + codice, mai l'email.
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

-- Lookup del codice: restituisce solo un booleano, mai email o id.
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

-- Inserisce le risposte associate al codice (non al nome, non all'email).
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

  -- Nessun join verso email: si conferma solo l'avvenuto salvataggio.
  return jsonb_build_object('ok', true, 'timepoint', p_timepoint, 'n_risposte', v_inserite);
end;
$$;

revoke all on function codice_partecipante_valido(text) from public;
revoke all on function ha_compilato_timepoint(text, text) from public;
revoke all on function salva_risposte_questionario(text, text, jsonb) from public;

grant execute on function codice_partecipante_valido(text) to anon, authenticated;
grant execute on function ha_compilato_timepoint(text, text) to anon, authenticated;
grant execute on function salva_risposte_questionario(text, text, jsonb) to anon, authenticated;

-- Ruolo facilitatore: collegato a auth.uid() tramite utenti.auth_user_id.
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

-- Iscrizione atomica: restituisce solo il codice, mai l'email.
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
  v_posti int;
  v_iscritti int;
begin
  if coalesce(p_consenso_a, false) is not true then
    raise exception 'CONSENSO_A_OBBLIGATORIO';
  end if;

  if p_email is null or trim(p_email) = '' then
    raise exception 'EMAIL_MANCANTE';
  end if;

  if p_codice is null or trim(p_codice) = '' then
    raise exception 'CODICE_MANCANTE';
  end if;

  perform 1 from cicli where id = p_ciclo_id and stato = 'reclutamento' for update;
  if not found then
    raise exception 'CICLO_NON_DISPONIBILE';
  end if;

  select posti_totali into v_posti from cicli where id = p_ciclo_id;
  select count(*) into v_iscritti from iscrizioni where ciclo_id = p_ciclo_id;

  if v_iscritti >= coalesce(v_posti, 0) then
    raise exception 'CICLO_PIENO';
  end if;

  if exists (
    select 1
    from utenti u
    join iscrizioni i on i.utente_id = u.id
    where i.ciclo_id = p_ciclo_id
      and lower(trim(u.email)) = lower(trim(p_email))
  ) then
    raise exception 'EMAIL_GIA_ISCRITTA';
  end if;

  insert into utenti (
    codice_partecipante, email, ruolo, stato_screening,
    consenso_modulo_a, consenso_modulo_b
  ) values (
    trim(p_codice), trim(p_email), 'partecipante', 'in_valutazione',
    true, coalesce(p_consenso_b, false)
  ) returning id into v_utente_id;

  insert into iscrizioni (utente_id, ciclo_id, esito_screening)
  values (v_utente_id, p_ciclo_id, 'in_attesa');

  return jsonb_build_object('ok', true, 'codice', trim(p_codice));
exception
  when unique_violation then
    raise exception 'CODICE_DUPLICATO';
end;
$$;

create or replace function salva_log_pratica(
  p_codice text,
  p_data date,
  p_durata int,
  p_note text,
  p_tipo text default null,
  p_esercizio_id uuid default null
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

  if p_esercizio_id is not null and not exists (
    select 1
    from esercizi e
    join lezioni l on l.id = e.lezione_id
    join iscrizioni i on i.ciclo_id = l.ciclo_id
    where e.id = p_esercizio_id
      and i.utente_id = v_utente_id
  ) then
    raise exception 'ESERCIZIO_NON_VALIDO';
  end if;

  insert into log_pratica (utente_id, esercizio_id, data, durata_minuti, note, tipo)
  values (
    v_utente_id,
    p_esercizio_id,
    coalesce(p_data, current_date),
    p_durata,
    p_note,
    p_tipo
  );

  return jsonb_build_object('ok', true);
end;
$$;

-- Dati di ricerca: codice + risposte, nessuna email.
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
  tipo text,
  note text,
  numero_settimana int,
  esercizio text
)
language sql
security definer
set search_path = public
as $$
  select
    u.codice_partecipante,
    l.data,
    l.durata_minuti,
    l.tipo,
    l.note,
    lez.numero_settimana,
    e.descrizione
  from log_pratica l
  join utenti u on u.id = l.utente_id
  left join esercizi e on e.id = l.esercizio_id
  left join lezioni lez on lez.id = e.lezione_id
  where is_facilitatore()
    and u.ruolo = 'partecipante'
  order by l.data desc, u.codice_partecipante;
$$;

create or replace function programma_del_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_ciclo_id uuid;
  v_inizio date;
  v_settimana int;
begin
  select u.id into v_utente_id
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  select i.ciclo_id, c.data_inizio into v_ciclo_id, v_inizio
  from iscrizioni i
  join cicli c on c.id = i.ciclo_id
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  if v_ciclo_id is null then
    return jsonb_build_object('settimana_corrente', 1, 'lezioni', '[]'::jsonb);
  end if;

  v_settimana := greatest(1, least(9, ((current_date - v_inizio) / 7) + 1));

  return jsonb_build_object(
    'settimana_corrente', v_settimana,
    'lezioni', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'numero_settimana', l.numero_settimana,
        'tema', l.tema,
        'pratiche_formali', l.pratiche_formali,
        'pratiche_informali', l.pratiche_informali,
        'materiali', l.materiali,
        'esercizi', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', e.id,
            'tipo', e.tipo,
            'descrizione', e.descrizione,
            'log', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', lg.id,
                'data', lg.data,
                'durata_minuti', lg.durata_minuti,
                'tipo', lg.tipo,
                'note', lg.note
              ) order by lg.data desc, lg.id desc)
              from log_pratica lg
              where lg.esercizio_id = e.id
                and lg.utente_id = v_utente_id
            ), '[]'::jsonb)
          ) order by e.id)
          from esercizi e where e.lezione_id = l.id
        ), '[]'::jsonb)
      ) order by l.numero_settimana)
      from lezioni l
      where l.ciclo_id = v_ciclo_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function comunicazioni_del_partecipante(p_codice text)
returns table (
  id uuid,
  tipo text,
  oggetto text,
  testo text,
  data_invio timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_ciclo_id uuid;
begin
  select u.id into v_utente_id
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  select i.ciclo_id into v_ciclo_id
  from iscrizioni i
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  return query
  select c.id, c.tipo, c.oggetto, c.testo, c.data_invio
  from comunicazioni c
  where c.ciclo_id = v_ciclo_id
  order by (c.tipo = 'reminder_t3') desc, c.data_invio desc;
end;
$$;

create or replace function log_pratica_del_partecipante(p_codice text)
returns table (
  id uuid,
  data date,
  durata_minuti int,
  tipo text,
  note text,
  numero_settimana int,
  esercizio text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
begin
  select u.id into v_utente_id
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  return query
  select
    l.id,
    l.data,
    l.durata_minuti,
    l.tipo,
    l.note,
    lez.numero_settimana,
    e.descrizione
  from log_pratica l
  left join esercizi e on e.id = l.esercizio_id
  left join lezioni lez on lez.id = e.lezione_id
  where l.utente_id = v_utente_id
  order by l.data desc, l.id desc;
end;
$$;

-- Solo email operative, senza join a risposte o log.
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
revoke all on function salva_log_pratica(text, date, int, text, text, uuid) from public;
revoke all on function risposte_pseudonime() from public;
revoke all on function log_pratica_pseudonimi() from public;
revoke all on function log_pratica_del_partecipante(text) from public;
revoke all on function email_destinatari_ciclo(uuid) from public;
revoke all on function programma_del_partecipante(text) from public;
revoke all on function comunicazioni_del_partecipante(text) from public;

grant execute on function is_facilitatore() to anon, authenticated;
grant execute on function iscrivi_partecipante(text, uuid, text, boolean, boolean) to anon, authenticated;
grant execute on function salva_log_pratica(text, date, int, text, text, uuid) to anon, authenticated;
grant execute on function risposte_pseudonime() to authenticated;
grant execute on function log_pratica_pseudonimi() to authenticated;
grant execute on function log_pratica_del_partecipante(text) to anon, authenticated;
grant execute on function email_destinatari_ciclo(uuid) to authenticated;
grant execute on function programma_del_partecipante(text) to anon, authenticated;
grant execute on function comunicazioni_del_partecipante(text) to anon, authenticated;

create policy "facilitatore legge utenti" on utenti
  for select using (is_facilitatore());

create policy "facilitatore aggiorna utenti" on utenti
  for update using (is_facilitatore()) with check (is_facilitatore());

create policy "facilitatore legge cicli" on cicli
  for select using (is_facilitatore());

create policy "facilitatore scrive cicli" on cicli
  for all using (is_facilitatore()) with check (is_facilitatore());

create policy "facilitatore legge iscrizioni" on iscrizioni
  for select using (is_facilitatore());

create policy "facilitatore aggiorna iscrizioni" on iscrizioni
  for update using (is_facilitatore()) with check (is_facilitatore());

create policy "facilitatore gestisce lezioni" on lezioni
  for all using (is_facilitatore()) with check (is_facilitatore());

create policy "facilitatore gestisce esercizi" on esercizi
  for all using (is_facilitatore()) with check (is_facilitatore());

create policy "facilitatore gestisce comunicazioni" on comunicazioni
  for all using (is_facilitatore()) with check (is_facilitatore());

-- Per collegare l'account Auth al profilo facilitatore, dopo aver creato
-- l'utente in Authentication → Users:
--   insert into utenti (codice_partecipante, email, ruolo, auth_user_id, consenso_modulo_a)
--   values ('FACILITATORE', 'tua@email', 'facilitatore', '<uuid da auth.users>', true);
