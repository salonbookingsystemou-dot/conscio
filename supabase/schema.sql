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
  onboarding_completato boolean not null default false,
  onboarding_completato_il timestamptz,
  onboarding_q1 text,
  onboarding_q2 text,
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
  sottotitolo text,
  pratiche_formali text,
  pratiche_informali text,
  materiali text,
  traccia_audio text,
  unique (ciclo_id, numero_settimana)
);

create table esercizi (
  id uuid primary key default gen_random_uuid(),
  lezione_id uuid references lezioni(id) on delete cascade,
  tipo text,
  descrizione text,
  traccia_audio text,
  ordine int,
  durata_minuti int
);

create table log_pratica (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid references utenti(id) on delete cascade,
  esercizio_id uuid references esercizi(id) on delete set null,
  data date not null default current_date,
  durata_minuti int,
  tipo text,
  note text,
  tono_prima text check (tono_prima is null or tono_prima in ('piacevole', 'neutro', 'spiacevole')),
  tono_dopo text check (tono_dopo is null or tono_dopo in ('piacevole', 'neutro', 'spiacevole'))
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
    from utenti u
    left join iscrizioni i on i.utente_id = u.id
    where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
      and u.ruolo = 'partecipante'
      and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
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

-- Settimana 0 = prima dell'inizio; 1–9 durante il ciclo (come settimana_corrente, ma senza clamp a 1).
create or replace function settimana_per_questionari(p_inizio date)
returns int
language sql
stable
as $$
  select case
    when p_inizio is null then 0
    when current_date < p_inizio then 0
    else greatest(1, least(9, ((current_date - p_inizio) / 7) + 1))
  end;
$$;

create or replace function timepoint_in_finestra(
  p_timepoint text,
  p_settimana int,
  p_inizio date,
  p_fine date
)
returns boolean
language sql
stable
as $$
  select case p_timepoint
    when 'T0' then coalesce(p_settimana, 0) <= 1
    when 'T1' then coalesce(p_settimana, 0) between 4 and 5
    when 'T2' then
      coalesce(p_settimana, 0) between 8 and 9
      and (p_fine is null or current_date <= p_fine)
    when 'T3' then
      (p_fine is not null and current_date > p_fine)
      or (p_fine is null and p_inizio is not null and current_date >= p_inizio + 63)
    else false
  end;
$$;

create or replace function stato_questionari_del_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_inizio date;
  v_fine date;
  v_sett int;
  v_tp text;
  v_fatti text[] := '{}';
  v_lista jsonb := '[]'::jsonb;
  v_stato text;
begin
  select u.id into v_utente_id
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  select c.data_inizio, coalesce(c.data_fine, c.data_inizio + 62)
    into v_inizio, v_fine
  from iscrizioni i
  join cicli c on c.id = i.ciclo_id
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  v_sett := settimana_per_questionari(v_inizio);

  select coalesce(array_agg(distinct r.timepoint), '{}')
    into v_fatti
  from risposte r
  where r.utente_id = v_utente_id;

  foreach v_tp in array array['T0', 'T1', 'T2', 'T3']
  loop
    if v_tp = any (v_fatti) then
      v_stato := 'completato';
    elsif timepoint_in_finestra(v_tp, v_sett, v_inizio, v_fine) then
      v_stato := 'aperto';
    elsif
      (v_tp = 'T1' and v_sett < 4)
      or (v_tp = 'T2' and v_sett < 8)
      or (v_tp = 'T3')
    then
      v_stato := 'in_attesa';
    else
      v_stato := 'chiuso';
    end if;

    v_lista := v_lista || jsonb_build_array(jsonb_build_object(
      'id', v_tp,
      'stato', v_stato,
      'quando', case v_tp
        when 'T0' then 'Dall’iscrizione alla settimana 1'
        when 'T1' then 'Settimane 4 e 5'
        when 'T2' then 'Settimane 8 e 9 (fine e intensiva)'
        else 'Dopo la fine del ciclo'
      end
    ));
  end loop;

  return jsonb_build_object(
    'settimana', v_sett,
    'data_inizio', v_inizio,
    'data_fine', v_fine,
    'timepoints', v_lista
  );
end;
$$;

-- Inserisce le risposte associate al codice (non al nome, non all'email).
-- Rifiuta i timepoint fuori dalla finestra della settimana di ciclo.
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
  v_inizio date;
  v_fine date;
  v_sett int;
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

  if not exists (
    select 1
    from utenti u
    left join iscrizioni i on i.utente_id = u.id
    where u.id = v_utente_id
      and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
  ) then
    raise exception 'ACCESSO_NON_IDONEO';
  end if;

  select c.data_inizio, coalesce(c.data_fine, c.data_inizio + 62)
    into v_inizio, v_fine
  from iscrizioni i
  join cicli c on c.id = i.ciclo_id
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  v_sett := settimana_per_questionari(v_inizio);

  if not timepoint_in_finestra(p_timepoint, v_sett, v_inizio, v_fine) then
    raise exception 'TIMEPOINT_NON_APERTO';
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
revoke all on function settimana_per_questionari(date) from public;
revoke all on function timepoint_in_finestra(text, int, date, date) from public;
revoke all on function stato_questionari_del_partecipante(text) from public;
revoke all on function salva_risposte_questionario(text, text, jsonb) from public;

grant execute on function codice_partecipante_valido(text) to anon, authenticated;
grant execute on function ha_compilato_timepoint(text, text) to anon, authenticated;
grant execute on function stato_questionari_del_partecipante(text) to anon, authenticated;
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
  select count(*) into v_iscritti
  from iscrizioni i
  join utenti u on u.id = i.utente_id
  where i.ciclo_id = p_ciclo_id
    and (i.esito_screening = 'idoneo' or u.stato_screening = 'idoneo');

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
  p_esercizio_id uuid default null,
  p_tono_dopo text default null,
  p_tono_prima text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_dopo text;
  v_prima text;
begin
  select id into v_utente_id
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  if not exists (
    select 1
    from utenti u
    left join iscrizioni i on i.utente_id = u.id
    where u.id = v_utente_id
      and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
  ) then
    raise exception 'ACCESSO_NON_IDONEO';
  end if;

  if p_durata is null or p_durata <= 0 then
    raise exception 'DURATA_NON_VALIDA';
  end if;

  if p_note is null or trim(p_note) = '' then
    raise exception 'NOTA_MANCANTE';
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

  v_dopo := case
    when p_tono_dopo in ('piacevole', 'neutro', 'spiacevole') then p_tono_dopo
  end;
  v_prima := case
    when p_tono_prima in ('piacevole', 'neutro', 'spiacevole') then p_tono_prima
  end;

  insert into log_pratica (
    utente_id, esercizio_id, data, durata_minuti, note, tipo, tono_prima, tono_dopo
  ) values (
    v_utente_id,
    p_esercizio_id,
    coalesce(p_data, current_date),
    p_durata,
    p_note,
    p_tipo,
    v_prima,
    v_dopo
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
  esercizio text,
  tono_prima text,
  tono_dopo text
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
    e.descrizione,
    l.tono_prima,
    l.tono_dopo
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
        'sottotitolo', l.sottotitolo,
        'pratiche_formali', l.pratiche_formali,
        'pratiche_informali', l.pratiche_informali,
        'materiali', l.materiali,
        'traccia_audio', l.traccia_audio,
        'esercizi', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', e.id,
            'tipo', e.tipo,
            'descrizione', e.descrizione,
            'traccia_audio', coalesce(
              nullif(e.traccia_audio, ''),
              case
                when e.tipo in ('formale', 'a_casa')
                  and not exists (
                    select 1 from esercizi e2
                    where e2.lezione_id = l.id
                      and nullif(e2.traccia_audio, '') is not null
                  )
                then nullif(l.traccia_audio, '')
              end
            ),
            'ordine', coalesce(e.ordine, 0),
            'durata_minuti', e.durata_minuti,
            'log', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', lg.id,
                'data', lg.data,
                'durata_minuti', lg.durata_minuti,
                'tipo', lg.tipo,
                'note', lg.note,
                'tono_prima', lg.tono_prima,
                'tono_dopo', lg.tono_dopo
              ) order by lg.data desc, lg.id desc)
              from log_pratica lg
              where lg.esercizio_id = e.id
                and lg.utente_id = v_utente_id
            ), '[]'::jsonb)
          ) order by coalesce(e.ordine, 0), e.id)
          from esercizi e where e.lezione_id = l.id
        ), '[]'::jsonb),
        'annotazioni_giorno', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', lg.id,
            'data', lg.data,
            'durata_minuti', lg.durata_minuti,
            'tipo', lg.tipo,
            'note', lg.note,
            'tono_prima', lg.tono_prima,
            'tono_dopo', lg.tono_dopo
          ) order by lg.data desc, lg.id desc)
          from log_pratica lg
          where lg.utente_id = v_utente_id
            and lg.tipo = 'giorno'
            and lg.esercizio_id is null
            and lg.data between
              (v_inizio + ((l.numero_settimana - 1) * 7))
              and (v_inizio + ((l.numero_settimana - 1) * 7) + 6)
        ), '[]'::jsonb)
      ) order by l.numero_settimana)
      from lezioni l
      where l.ciclo_id = v_ciclo_id
    ), '[]'::jsonb)
  );
end;
$$;


create or replace function spunta_informale(
  p_codice text,
  p_esercizio_id uuid,
  p_data date,
  p_fatto boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_giorno date;
begin
  select id into v_utente_id
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  if not exists (
    select 1
    from utenti u
    left join iscrizioni i on i.utente_id = u.id
    where u.id = v_utente_id
      and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
  ) then
    raise exception 'ACCESSO_NON_IDONEO';
  end if;

  if not exists (
    select 1
    from esercizi e
    join lezioni l on l.id = e.lezione_id
    join iscrizioni i on i.ciclo_id = l.ciclo_id
    where e.id = p_esercizio_id
      and i.utente_id = v_utente_id
      and e.tipo = 'informale'
  ) then
    raise exception 'ESERCIZIO_NON_VALIDO';
  end if;

  v_giorno := coalesce(p_data, current_date);

  if coalesce(p_fatto, false) then
    if not exists (
      select 1 from log_pratica
      where utente_id = v_utente_id
        and esercizio_id = p_esercizio_id
        and data = v_giorno
        and tipo = 'informale'
    ) then
      insert into log_pratica (utente_id, esercizio_id, data, durata_minuti, note, tipo)
      values (v_utente_id, p_esercizio_id, v_giorno, null, null, 'informale');
    end if;
  else
    delete from log_pratica
    where utente_id = v_utente_id
      and esercizio_id = p_esercizio_id
      and data = v_giorno
      and tipo = 'informale';
  end if;

  return jsonb_build_object('ok', true, 'fatto', coalesce(p_fatto, false));
end;
$$;

create or replace function registra_ascolto_formale(
  p_codice text,
  p_esercizio_id uuid,
  p_data date,
  p_durata_minuti int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_giorno date;
  v_minuti int;
  v_id uuid;
begin
  select id into v_utente_id
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  if not exists (
    select 1
    from utenti u
    left join iscrizioni i on i.utente_id = u.id
    where u.id = v_utente_id
      and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
  ) then
    raise exception 'ACCESSO_NON_IDONEO';
  end if;

  if not exists (
    select 1
    from esercizi e
    join lezioni l on l.id = e.lezione_id
    join iscrizioni i on i.ciclo_id = l.ciclo_id
    where e.id = p_esercizio_id
      and i.utente_id = v_utente_id
      and e.tipo in ('formale', 'a_casa')
  ) then
    raise exception 'ESERCIZIO_NON_VALIDO';
  end if;

  v_giorno := coalesce(p_data, current_date);
  v_minuti := case
    when p_durata_minuti is not null and p_durata_minuti > 0 then p_durata_minuti
  end;

  select id into v_id
  from log_pratica
  where utente_id = v_utente_id
    and esercizio_id = p_esercizio_id
    and data = v_giorno
    and tipo = 'ascolto'
  limit 1;

  if v_id is not null then
    update log_pratica
    set durata_minuti = coalesce(v_minuti, durata_minuti)
    where id = v_id;
  else
    insert into log_pratica (utente_id, esercizio_id, data, durata_minuti, note, tipo)
    values (v_utente_id, p_esercizio_id, v_giorno, v_minuti, null, 'ascolto')
    returning id into v_id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function minuti_ascolto_del_partecipante(p_codice text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_minuti int;
begin
  select id into v_utente_id
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_utente_id is null then
    return 0;
  end if;

  select coalesce(sum(greatest(coalesce(durata_minuti, 0), 0)), 0)
    into v_minuti
  from log_pratica
  where utente_id = v_utente_id
    and tipo = 'ascolto';

  return v_minuti;
end;
$$;

create or replace function salva_annotazione_giorno(
  p_codice text,
  p_data date,
  p_note text,
  p_durata int default null,
  p_tono_dopo text default null,
  p_lezione_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_giorno date;
  v_dopo text;
  v_id uuid;
begin
  select id into v_utente_id
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  if not exists (
    select 1
    from utenti u
    left join iscrizioni i on i.utente_id = u.id
    where u.id = v_utente_id
      and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
  ) then
    raise exception 'ACCESSO_NON_IDONEO';
  end if;

  if p_note is null or trim(p_note) = '' then
    raise exception 'NOTA_MANCANTE';
  end if;

  v_giorno := coalesce(p_data, current_date);
  v_dopo := case
    when p_tono_dopo in ('piacevole', 'neutro', 'spiacevole') then p_tono_dopo
  end;

  select id into v_id
  from log_pratica
  where utente_id = v_utente_id
    and data = v_giorno
    and tipo = 'giorno'
    and esercizio_id is null
  limit 1;

  if v_id is not null then
    update log_pratica
    set note = trim(p_note),
        durata_minuti = coalesce(p_durata, durata_minuti),
        tono_dopo = v_dopo
    where id = v_id;
  else
    insert into log_pratica (utente_id, esercizio_id, data, durata_minuti, note, tipo, tono_dopo)
    values (v_utente_id, null, v_giorno, p_durata, trim(p_note), 'giorno', v_dopo)
    returning id into v_id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
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

create or replace function ciclo_del_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_inizio date;
  v_fine date;
  v_nome text;
begin
  select u.id into v_utente_id
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  select c.data_inizio, coalesce(c.data_fine, c.data_inizio + 62), c.nome_ciclo
    into v_inizio, v_fine, v_nome
  from iscrizioni i
  join cicli c on c.id = i.ciclo_id
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  if v_inizio is null then
    return jsonb_build_object('nome_ciclo', null, 'data_inizio', null, 'data_fine', null);
  end if;

  return jsonb_build_object(
    'nome_ciclo', v_nome,
    'data_inizio', v_inizio,
    'data_fine', v_fine
  );
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
  esercizio text,
  tono_prima text,
  tono_dopo text
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
    e.descrizione,
    l.tono_prima,
    l.tono_dopo
  from log_pratica l
  left join esercizi e on e.id = l.esercizio_id
  left join lezioni lez on lez.id = e.lezione_id
  where l.utente_id = v_utente_id
  order by l.data desc, l.id desc;
end;
$$;

-- Solo email operative, senza join a risposte o log.
-- Default: idonei con consenso A. Screening può includere chi è ancora in valutazione.
drop function if exists email_destinatari_ciclo(uuid);
create or replace function email_destinatari_ciclo(
  p_ciclo_id uuid,
  p_includi_in_valutazione boolean default false
)
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
    and u.consenso_modulo_a = true
    and (
      u.stato_screening = 'idoneo'
      or i.esito_screening = 'idoneo'
      or (
        p_includi_in_valutazione
        and coalesce(i.esito_screening, u.stato_screening, 'in_attesa')
          in ('in_attesa', 'in_valutazione')
      )
    )
    and is_facilitatore();
$$;

-- Separa l’email dal record dopo la chiusura del ciclo (dati di percorso restano sul codice).
create or replace function separa_email_cicli_conclusi(p_giorni_grazia int default 90)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  if not is_facilitatore() then
    raise exception 'NON_AUTORIZZATO';
  end if;

  update utenti u
  set email = null
  where u.ruolo = 'partecipante'
    and u.email is not null
    and not exists (
      select 1
      from iscrizioni i
      join cicli c on c.id = i.ciclo_id
      where i.utente_id = u.id
        and (
          c.stato in ('reclutamento', 'attivo')
          or coalesce(c.data_fine, c.data_inizio + 62)
            >= (current_date - greatest(coalesce(p_giorni_grazia, 90), 0))
        )
    );

  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'email_separate', v_n);
end;
$$;

create or replace function esporta_dati_del_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente utenti%rowtype;
begin
  select * into v_utente
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_utente.id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  return jsonb_build_object(
    'esportato_il', now(),
    'codice', v_utente.codice_partecipante,
    'email', v_utente.email,
    'consenso_modulo_a', v_utente.consenso_modulo_a,
    'consenso_modulo_b', v_utente.consenso_modulo_b,
    'stato_screening', v_utente.stato_screening,
    'onboarding_completato', v_utente.onboarding_completato,
    'onboarding_q1', v_utente.onboarding_q1,
    'onboarding_q2', v_utente.onboarding_q2,
    'iscrizioni', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ciclo', c.nome_ciclo,
        'data_iscrizione', i.data_iscrizione,
        'esito_screening', i.esito_screening
      ) order by i.data_iscrizione desc)
      from iscrizioni i
      join cicli c on c.id = i.ciclo_id
      where i.utente_id = v_utente.id
    ), '[]'::jsonb),
    'risposte', coalesce((
      select jsonb_agg(jsonb_build_object(
        'timepoint', r.timepoint,
        'questionario', q.nome,
        'ordine', it.ordine,
        'testo', it.testo,
        'valore', r.valore,
        'data_compilazione', r.data_compilazione
      ) order by r.timepoint, q.nome, it.ordine)
      from risposte r
      join item it on it.id = r.item_id
      join questionari q on q.id = it.questionario_id
      where r.utente_id = v_utente.id
    ), '[]'::jsonb),
    'log_pratica', coalesce((
      select jsonb_agg(jsonb_build_object(
        'data', l.data,
        'tipo', l.tipo,
        'durata_minuti', l.durata_minuti,
        'note', l.note,
        'tono_prima', l.tono_prima,
        'tono_dopo', l.tono_dopo
      ) order by l.data desc, l.id desc)
      from log_pratica l
      where l.utente_id = v_utente.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function is_facilitatore() from public;
revoke all on function spunta_informale(text, uuid, date, boolean) from public;
revoke all on function salva_annotazione_giorno(text, date, text, int, text, uuid) from public;
revoke all on function registra_ascolto_formale(text, uuid, date, int) from public;
revoke all on function minuti_ascolto_del_partecipante(text) from public;
revoke all on function esporta_dati_del_partecipante(text) from public;
revoke all on function iscrivi_partecipante(text, uuid, text, boolean, boolean) from public;
revoke all on function salva_log_pratica(text, date, int, text, text, uuid, text, text) from public;
revoke all on function risposte_pseudonime() from public;
revoke all on function log_pratica_pseudonimi() from public;
revoke all on function log_pratica_del_partecipante(text) from public;
revoke all on function email_destinatari_ciclo(uuid, boolean) from public;
revoke all on function separa_email_cicli_conclusi(int) from public;
revoke all on function programma_del_partecipante(text) from public;
revoke all on function comunicazioni_del_partecipante(text) from public;
revoke all on function ciclo_del_partecipante(text) from public;

grant execute on function is_facilitatore() to anon, authenticated;
grant execute on function iscrivi_partecipante(text, uuid, text, boolean, boolean) to anon, authenticated;
grant execute on function salva_log_pratica(text, date, int, text, text, uuid, text, text) to anon, authenticated;
grant execute on function risposte_pseudonime() to authenticated;
grant execute on function log_pratica_pseudonimi() to authenticated;
grant execute on function log_pratica_del_partecipante(text) to anon, authenticated;
grant execute on function email_destinatari_ciclo(uuid, boolean) to authenticated;
grant execute on function separa_email_cicli_conclusi(int) to authenticated;
grant execute on function programma_del_partecipante(text) to anon, authenticated;
grant execute on function comunicazioni_del_partecipante(text) to anon, authenticated;
grant execute on function ciclo_del_partecipante(text) to anon, authenticated;
grant execute on function spunta_informale(text, uuid, date, boolean) to anon, authenticated;
grant execute on function salva_annotazione_giorno(text, date, text, int, text, uuid) to anon, authenticated;
grant execute on function registra_ascolto_formale(text, uuid, date, int) to anon, authenticated;
grant execute on function minuti_ascolto_del_partecipante(text) to anon, authenticated;
grant execute on function esporta_dati_del_partecipante(text) to anon, authenticated;

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

create table if not exists splash_sito (
  id smallint primary key default 1 check (id = 1),
  frase text not null,
  cta text not null default 'Prosegui',
  aggiornato_il timestamptz not null default now()
);

insert into splash_sito (id, frase, cta)
values (1, 'La pratica comincia qui, in questo momento.', 'Prosegui')
on conflict (id) do nothing;

alter table splash_sito enable row level security;

create policy "lettura pubblica splash" on splash_sito
  for select using (true);

create policy "facilitatore aggiorna splash" on splash_sito
  for update using (is_facilitatore()) with check (is_facilitatore());

grant select on splash_sito to anon, authenticated;
grant update on splash_sito to authenticated;

-- Per collegare l'account Auth al profilo facilitatore, dopo aver creato
-- l'utente in Authentication → Users:
--   insert into utenti (codice_partecipante, email, ruolo, auth_user_id, consenso_modulo_a)
--   values ('FACILITATORE', 'tua@email', 'facilitatore', '<uuid da auth.users>', true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tracce-audio',
  'tracce-audio',
  true,
  52428800,
  array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/m4a','audio/x-m4a','audio/aac','audio/ogg','audio/webm']
)
on conflict (id) do nothing;

create policy "lettura pubblica tracce"
on storage.objects for select
using (bucket_id = 'tracce-audio');

create policy "facilitatore carica tracce"
on storage.objects for insert
to authenticated
with check (bucket_id = 'tracce-audio' and public.is_facilitatore());

create policy "facilitatore aggiorna tracce"
on storage.objects for update
to authenticated
using (bucket_id = 'tracce-audio' and public.is_facilitatore())
with check (bucket_id = 'tracce-audio' and public.is_facilitatore());

create policy "facilitatore elimina tracce"
on storage.objects for delete
to authenticated
using (bucket_id = 'tracce-audio' and public.is_facilitatore());

create or replace function stato_pronto_percorso(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_onboarding boolean := false;
  v_t0 boolean := false;
begin
  select u.id, coalesce(u.onboarding_completato, false)
  into v_utente_id, v_onboarding
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  if not exists (
    select 1
    from utenti u
    left join iscrizioni i on i.utente_id = u.id
    where u.id = v_utente_id
      and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
  ) then
    raise exception 'ACCESSO_NON_IDONEO';
  end if;

  v_t0 := ha_compilato_timepoint(p_codice, 'T0');

  return jsonb_build_object(
    'onboarding', v_onboarding,
    't0', v_t0,
    'pronto', (v_onboarding and v_t0)
  );
end;
$$;

create or replace function salva_onboarding(
  p_codice text,
  p_q1 text,
  p_q2 text
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

  if not exists (
    select 1
    from utenti u
    left join iscrizioni i on i.utente_id = u.id
    where u.id = v_utente_id
      and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
  ) then
    raise exception 'ACCESSO_NON_IDONEO';
  end if;

  if p_q1 is null or trim(p_q1) = '' or p_q2 is null or trim(p_q2) = '' then
    raise exception 'RISPOSTE_MANCANTI';
  end if;

  update utenti
  set onboarding_q1 = trim(p_q1),
      onboarding_q2 = trim(p_q2),
      onboarding_completato = true,
      onboarding_completato_il = coalesce(onboarding_completato_il, now())
  where id = v_utente_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function stato_pronto_percorso(text) from public;
revoke all on function salva_onboarding(text, text, text) from public;
grant execute on function stato_pronto_percorso(text) to anon, authenticated;
grant execute on function salva_onboarding(text, text, text) to anon, authenticated;

