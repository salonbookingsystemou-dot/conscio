-- Pratica settimanale → esecuzione giornaliera:
-- traccia/ordine/durata su esercizi, sottotitolo su lezioni,
-- spunta informale, annotazione del giorno, programma aggiornato.

alter table lezioni add column if not exists sottotitolo text;

alter table esercizi add column if not exists traccia_audio text;
alter table esercizi add column if not exists ordine int;
alter table esercizi add column if not exists durata_minuti int;

update esercizi set ordine = 1 where ordine is null;

-- Backfill settimana 1: Body scan con la traccia della lezione + informale dal testo.
insert into esercizi (lezione_id, tipo, descrizione, traccia_audio, ordine, durata_minuti)
select l.id, 'formale', 'Body scan guidato', l.traccia_audio, 1, 5
from lezioni l
join cicli c on c.id = l.ciclo_id
where c.nome_ciclo = 'Ciclo pilota'
  and l.numero_settimana = 1
  and l.traccia_audio is not null
  and not exists (
    select 1 from esercizi e
    where e.lezione_id = l.id
      and e.tipo = 'formale'
      and e.descrizione ilike 'Body scan%'
  );

insert into esercizi (lezione_id, tipo, descrizione, ordine)
select l.id, 'informale', trim(both from regexp_replace(l.pratiche_informali, '\s+', ' ', 'g')), 10
from lezioni l
join cicli c on c.id = l.ciclo_id
where c.nome_ciclo = 'Ciclo pilota'
  and l.numero_settimana = 1
  and l.pratiche_informali is not null
  and trim(l.pratiche_informali) <> ''
  and not exists (
    select 1 from esercizi e
    where e.lezione_id = l.id and e.tipo = 'informale'
  );

update esercizi e
set traccia_audio = l.traccia_audio,
    ordine = coalesce(e.ordine, 1)
from lezioni l
join cicli c on c.id = l.ciclo_id
where e.lezione_id = l.id
  and c.nome_ciclo = 'Ciclo pilota'
  and l.numero_settimana = 1
  and e.tipo = 'formale'
  and e.descrizione ilike 'Body scan%'
  and (e.traccia_audio is null or e.traccia_audio = '')
  and l.traccia_audio is not null;

update esercizi e
set ordine = 2
from lezioni l
join cicli c on c.id = l.ciclo_id
where e.lezione_id = l.id
  and c.nome_ciclo = 'Ciclo pilota'
  and l.numero_settimana = 1
  and e.tipo = 'formale'
  and e.descrizione not ilike 'Body scan%'
  and (e.ordine is null or e.ordine <= 1);

update lezioni l
set sottotitolo = 'Portare attenzione al corpo, uscire dall’autopilota.'
from cicli c
where c.id = l.ciclo_id
  and c.nome_ciclo = 'Ciclo pilota'
  and l.numero_settimana = 1
  and (l.sottotitolo is null or l.sottotitolo = '');

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

revoke all on function spunta_informale(text, uuid, date, boolean) from public;
revoke all on function salva_annotazione_giorno(text, date, text, int, text, uuid) from public;
grant execute on function spunta_informale(text, uuid, date, boolean) to anon, authenticated;
grant execute on function salva_annotazione_giorno(text, date, text, int, text, uuid) to anon, authenticated;
grant execute on function programma_del_partecipante(text) to anon, authenticated;
