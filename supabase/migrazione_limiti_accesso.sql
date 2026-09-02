-- Tetto tentativi su Entra / Iscrizione / Dashboard e sulle RPC con codice.
-- IP hashati (SHA-256), mai in chiaro. Le porte stato_accesso e iscrivi
-- restano solo per service_role (edge function porta).

create extension if not exists pgcrypto with schema extensions;

create table if not exists limiti_richieste (
  azione text not null,
  chiave text not null,
  n int not null default 0,
  finestra_inizio timestamptz not null default now(),
  primary key (azione, chiave)
);

alter table limiti_richieste enable row level security;

create or replace function assert_limite(
  p_azione text,
  p_chiave text,
  p_max int,
  p_secondi int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chiave text := coalesce(nullif(trim(p_chiave), ''), 'sconosciuto');
  v_n int;
begin
  if p_azione is null or trim(p_azione) = '' then
    raise exception 'AZIONE_MANCANTE';
  end if;
  if coalesce(p_max, 0) < 1 or coalesce(p_secondi, 0) < 1 then
    raise exception 'LIMITE_NON_VALIDO';
  end if;

  insert into limiti_richieste (azione, chiave, n, finestra_inizio)
  values (trim(p_azione), v_chiave, 1, now())
  on conflict (azione, chiave) do update
    set
      n = case
        when limiti_richieste.finestra_inizio < now() - make_interval(secs => p_secondi)
        then 1
        else limiti_richieste.n + 1
      end,
      finestra_inizio = case
        when limiti_richieste.finestra_inizio < now() - make_interval(secs => p_secondi)
        then now()
        else limiti_richieste.finestra_inizio
      end
  returning n into v_n;

  if v_n > p_max then
    raise exception 'TROPPI_TENTATIVI';
  end if;
end;
$$;

create or replace function chiave_client_hash()
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_headers json;
  v_ip text;
begin
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;

  v_ip := nullif(trim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1)), '');
  if v_ip is null then
    v_ip := nullif(trim(coalesce(
      v_headers->>'cf-connecting-ip',
      v_headers->>'x-real-ip',
      ''
    )), '');
  end if;
  if v_ip is null then
    v_ip := 'sconosciuto';
  end if;

  return encode(digest(v_ip, 'sha256'), 'hex');
end;
$$;

-- Se il codice non esiste, conta il tentativo (IP hash) e solleva.
create or replace function assert_partecipante_noto(p_codice text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_id is not null then
    return v_id;
  end if;

  perform assert_limite('rpc_codice', chiave_client_hash(), 40, 900);
  raise exception 'CODICE_NON_TROVATO';
end;
$$;

-- Iscrizione: tetto coda in_attesa oltre al tetto idonei.
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
  v_idonei int;
  v_coda int;
  v_tetto_coda int;
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
  select count(*) into v_idonei
  from iscrizioni i
  join utenti u on u.id = i.utente_id
  where i.ciclo_id = p_ciclo_id
    and (i.esito_screening = 'idoneo' or u.stato_screening = 'idoneo');

  if v_idonei >= coalesce(v_posti, 0) then
    raise exception 'CICLO_PIENO';
  end if;

  select count(*) into v_coda
  from iscrizioni i
  join utenti u on u.id = i.utente_id
  where i.ciclo_id = p_ciclo_id
    and not (i.esito_screening = 'idoneo' or u.stato_screening = 'idoneo');

  v_tetto_coda := greatest(coalesce(v_posti, 0) * 2, 30);
  if v_coda >= v_tetto_coda then
    raise exception 'CODA_ISCRIZIONI_PIENA';
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

-- Porte pubbliche chiuse: solo service_role (edge porta).
revoke all on function stato_accesso_codice(text) from public;
revoke all on function stato_accesso_codice(text) from anon, authenticated;
revoke all on function iscrivi_partecipante(text, uuid, text, boolean, boolean) from public;
revoke all on function iscrivi_partecipante(text, uuid, text, boolean, boolean) from anon, authenticated;
revoke all on function assert_limite(text, text, int, int) from public;
revoke all on function assert_limite(text, text, int, int) from anon, authenticated;
revoke all on function chiave_client_hash() from public;
revoke all on function chiave_client_hash() from anon, authenticated;
revoke all on function assert_partecipante_noto(text) from public;
revoke all on function assert_partecipante_noto(text) from anon, authenticated;

grant execute on function stato_accesso_codice(text) to service_role;
grant execute on function iscrivi_partecipante(text, uuid, text, boolean, boolean) to service_role;
grant execute on function assert_limite(text, text, int, int) to service_role;

-- Guardie sulle RPC ancora chiamabili con codice (enumerazione).
create or replace function esporta_dati_del_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente utenti%rowtype;
begin
  select * into v_utente from utenti where id = assert_partecipante_noto(p_codice);

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
  v_utente_id := assert_partecipante_noto(p_codice);

  select coalesce(u.onboarding_completato, false)
  into v_onboarding
  from utenti u
  where u.id = v_utente_id;

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
  v_utente_id := assert_partecipante_noto(p_codice);

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
  v_utente_id := assert_partecipante_noto(p_codice);

  select coalesce(sum(greatest(coalesce(durata_minuti, 0), 0)), 0)
    into v_minuti
  from log_pratica
  where utente_id = v_utente_id
    and tipo = 'ascolto';

  return v_minuti;
end;
$$;

create or replace function risposte_questionario_del_partecipante(
  p_codice text,
  p_timepoint text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
begin
  v_utente_id := assert_partecipante_noto(p_codice);

  if not exists (
    select 1
    from utenti u
    left join iscrizioni i on i.utente_id = u.id
    where u.id = v_utente_id
      and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
  ) then
    raise exception 'ACCESSO_NON_IDONEO';
  end if;

  if p_timepoint is null or p_timepoint not in ('T0', 'T1', 'T2', 'T3') then
    raise exception 'TIMEPOINT_NON_VALIDO';
  end if;

  if not exists (
    select 1 from risposte
    where utente_id = v_utente_id and timepoint = p_timepoint
  ) then
    raise exception 'COMPILAZIONE_ASSENTE';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'item_id', r.item_id,
      'valore', r.valore
    ) order by i.ordine)
    from risposte r
    join item i on i.id = r.item_id
    where r.utente_id = v_utente_id
      and r.timepoint = p_timepoint
  ), '[]'::jsonb);
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
  v_utente_id := assert_partecipante_noto(p_codice);

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
  v_utente_id := assert_partecipante_noto(p_codice);

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
  v_utente_id := assert_partecipante_noto(p_codice);

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
  v_utente_id := assert_partecipante_noto(p_codice);

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
        'traccia_audio', l.traccia_audio,
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
                'note', lg.note,
                'tono_prima', lg.tono_prima,
                'tono_dopo', lg.tono_dopo
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

notify pgrst, 'reload schema';
