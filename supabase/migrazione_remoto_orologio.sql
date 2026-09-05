-- Solo da remoto: settimane dal ciclo in presenza, orologio dal primo ascolto.
-- Eseguire nell’SQL editor dopo migrazione_iscrizione_solo_remoto.sql.

alter table iscrizioni
  add column if not exists ciclo_contenuto_id uuid references cicli(id) on delete set null;

alter table iscrizioni
  add column if not exists data_inizio_pratica date;

create or replace function assicura_ciclo_contenuto(p_utente_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_iscrizione uuid;
  v_libero boolean;
  v_ciclo uuid;
begin
  select i.id,
         (i.ciclo_id is null and i.modalita_fruizione = 'remoto'),
         coalesce(i.ciclo_contenuto_id, i.ciclo_id)
    into v_iscrizione, v_libero, v_ciclo
  from iscrizioni i
  where i.utente_id = p_utente_id
  order by i.data_iscrizione desc
  limit 1;

  if v_iscrizione is null then
    return null;
  end if;

  if not v_libero then
    return v_ciclo;
  end if;

  if v_ciclo is not null then
    return v_ciclo;
  end if;

  select c.id into v_ciclo
  from cicli c
  where exists (select 1 from lezioni l where l.ciclo_id = c.id)
  order by
    case c.stato when 'attivo' then 0 when 'reclutamento' then 1 else 2 end,
    c.data_inizio desc
  limit 1;

  if v_ciclo is not null then
    update iscrizioni
    set ciclo_contenuto_id = v_ciclo
    where id = v_iscrizione
      and ciclo_contenuto_id is null;
  end if;

  return v_ciclo;
end;
$$;

create or replace function esercizio_del_percorso(p_utente_id uuid, p_esercizio_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ciclo uuid;
begin
  v_ciclo := assicura_ciclo_contenuto(p_utente_id);
  if v_ciclo is null or p_esercizio_id is null then
    return false;
  end if;

  return exists (
    select 1
    from esercizi e
    join lezioni l on l.id = e.lezione_id
    where e.id = p_esercizio_id
      and l.ciclo_id = v_ciclo
  );
end;
$$;

create or replace function avvia_orologio_pratica(p_utente_id uuid, p_giorno date)
returns void
language sql
security definer
set search_path = public
as $$
  update iscrizioni
  set data_inizio_pratica = coalesce(p_giorno, current_date)
  where utente_id = p_utente_id
    and ciclo_id is null
    and modalita_fruizione = 'remoto'
    and data_inizio_pratica is null;
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
  v_personale boolean := false;
begin
  select u.id into v_utente_id
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  select
    case
      when i.ciclo_id is null and i.modalita_fruizione = 'remoto' then i.data_inizio_pratica
      else c.data_inizio
    end,
    case
      when i.ciclo_id is null and i.modalita_fruizione = 'remoto' then
        case when i.data_inizio_pratica is not null then i.data_inizio_pratica + 62 else null end
      else case when c.id is null then null else coalesce(c.data_fine, c.data_inizio + 62) end
    end,
    (i.ciclo_id is null and i.modalita_fruizione = 'remoto')
    into v_inizio, v_fine, v_personale
  from iscrizioni i
  left join cicli c on c.id = i.ciclo_id
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
    'orologio_personale', coalesce(v_personale, false),
    'timepoints', v_lista
  );
end;
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

  select
    case
      when i.ciclo_id is null and i.modalita_fruizione = 'remoto' then i.data_inizio_pratica
      else c.data_inizio
    end,
    case
      when i.ciclo_id is null and i.modalita_fruizione = 'remoto' then
        case when i.data_inizio_pratica is not null then i.data_inizio_pratica + 62 else null end
      else case when c.id is null then null else coalesce(c.data_fine, c.data_inizio + 62) end
    end
    into v_inizio, v_fine
  from iscrizioni i
  left join cicli c on c.id = i.ciclo_id
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

  return jsonb_build_object('ok', true, 'timepoint', p_timepoint, 'n_risposte', v_inserite);
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
  v_modalita text;
  v_inizio_pratica date;
begin
  select u.id into v_utente_id
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  select i.ciclo_id, i.modalita_fruizione, i.data_inizio_pratica, c.data_inizio
    into v_ciclo_id, v_modalita, v_inizio_pratica, v_inizio
  from iscrizioni i
  left join cicli c on c.id = i.ciclo_id
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  if v_ciclo_id is null and v_modalita = 'remoto' then
    v_ciclo_id := assicura_ciclo_contenuto(v_utente_id);
    if v_ciclo_id is null then
      return jsonb_build_object('settimana_corrente', 1, 'lezioni', '[]'::jsonb);
    end if;
    if v_inizio_pratica is null then
      v_inizio := current_date;
      v_settimana := 1;
    else
      v_inizio := v_inizio_pratica;
      v_settimana := greatest(1, least(9, ((current_date - v_inizio) / 7) + 1));
    end if;
  elsif v_ciclo_id is null or v_inizio is null then
    return jsonb_build_object('settimana_corrente', 1, 'lezioni', '[]'::jsonb);
  else
    v_settimana := greatest(1, least(9, ((current_date - v_inizio) / 7) + 1));
  end if;

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
        'traccia_audio', coalesce(
          (select t.url from tracce t where t.id = l.traccia_id),
          nullif(l.traccia_audio, '')
        ),
        'esercizi', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', e.id,
            'tipo', e.tipo,
            'descrizione', e.descrizione,
            'traccia_audio', coalesce(
              (select t.url from tracce t where t.id = e.traccia_id),
              nullif(e.traccia_audio, ''),
              case
                when e.tipo in ('formale', 'a_casa')
                  and not exists (
                    select 1 from esercizi e2
                    left join tracce t2 on t2.id = e2.traccia_id
                    where e2.lezione_id = l.id
                      and (
                        t2.url is not null
                        or nullif(e2.traccia_audio, '') is not null
                      )
                  )
                then coalesce(
                  (select ts.url from tracce ts where ts.id = l.traccia_id),
                  nullif(l.traccia_audio, '')
                )
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
  v_modalita text;
  v_link text;
  v_ciclo_id uuid;
  v_inizio_pratica date;
  v_ciclo_contenuto uuid;
  v_personale boolean := false;
begin
  select u.id into v_utente_id
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  select i.ciclo_id,
         i.data_inizio_pratica,
         i.ciclo_contenuto_id,
         c.data_inizio,
         case when c.id is null then null else coalesce(c.data_fine, c.data_inizio + 62) end,
         c.nome_ciclo,
         coalesce(i.modalita_fruizione, 'presenza'),
         case
           when coalesce(i.modalita_fruizione, 'presenza') = 'remoto'
           then c.link_incontro
           else null
         end
    into v_ciclo_id, v_inizio_pratica, v_ciclo_contenuto, v_inizio, v_fine, v_nome, v_modalita, v_link
  from iscrizioni i
  left join cicli c on c.id = i.ciclo_id
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'nome_ciclo', null,
      'data_inizio', null,
      'data_fine', null,
      'modalita_fruizione', null,
      'link_incontro', null,
      'orologio_personale', false,
      'orologio_avviato', false
    );
  end if;

  if v_ciclo_id is null and v_modalita = 'remoto' then
    v_personale := true;
    v_ciclo_contenuto := assicura_ciclo_contenuto(v_utente_id);
    if v_ciclo_contenuto is not null then
      select nome_ciclo into v_nome from cicli where id = v_ciclo_contenuto;
    end if;
    v_inizio := coalesce(v_inizio_pratica, current_date);
    v_fine := case when v_inizio_pratica is not null then v_inizio_pratica + 62 else null end;
    v_link := null;
  end if;

  return jsonb_build_object(
    'nome_ciclo', v_nome,
    'data_inizio', v_inizio,
    'data_fine', v_fine,
    'modalita_fruizione', v_modalita,
    'link_incontro', v_link,
    'orologio_personale', v_personale,
    'orologio_avviato', (v_inizio_pratica is not null)
  );
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

  if p_esercizio_id is not null and not esercizio_del_percorso(v_utente_id, p_esercizio_id) then
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
    where e.id = p_esercizio_id
      and e.tipo = 'informale'
      and esercizio_del_percorso(v_utente_id, e.id)
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
    where e.id = p_esercizio_id
      and e.tipo in ('formale', 'a_casa')
      and esercizio_del_percorso(v_utente_id, e.id)
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

  perform avvia_orologio_pratica(v_utente_id, v_giorno);

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function assicura_ciclo_contenuto(uuid) from public, anon;
revoke all on function esercizio_del_percorso(uuid, uuid) from public, anon;
revoke all on function avvia_orologio_pratica(uuid, date) from public, anon;

notify pgrst, 'reload schema';
