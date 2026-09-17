-- Testo della card player, scritto dal facilitatore in libreria tracce.

alter table tracce add column if not exists descrizione text;

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
            'traccia_descrizione', (
              select nullif(trim(td.descrizione), '')
              from tracce td
              where td.id = e.traccia_id
            ),
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
