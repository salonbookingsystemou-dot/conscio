-- Libreria tracce: file caricati una volta, collegati a più settimane e cicli.
-- URL legacy su lezioni/esercizi resta come fallback durante la transizione.

create table if not exists tracce (
  id uuid primary key default gen_random_uuid(),
  titolo text not null,
  url text not null unique,
  storage_path text,
  durata_minuti int,
  creato_il timestamptz default now()
);

alter table lezioni add column if not exists traccia_id uuid references tracce(id) on delete set null;
alter table esercizi add column if not exists traccia_id uuid references tracce(id) on delete set null;

create index if not exists lezioni_traccia_id_idx on lezioni(traccia_id);
create index if not exists esercizi_traccia_id_idx on esercizi(traccia_id);

alter table tracce enable row level security;

drop policy if exists "facilitatore gestisce tracce" on tracce;
create policy "facilitatore gestisce tracce" on tracce
  for all using (is_facilitatore()) with check (is_facilitatore());

grant select, insert, update, delete on tracce to authenticated;

insert into tracce (titolo, url, storage_path, durata_minuti)
select
  coalesce(nullif(trim(max(etichetta)), ''), 'Traccia'),
  url,
  max(storage_path),
  max(durata_minuti)
from (
  select
    e.descrizione as etichetta,
    e.traccia_audio as url,
    substring(e.traccia_audio from '/tracce-audio/(.+)$') as storage_path,
    e.durata_minuti
  from esercizi e
  where nullif(trim(e.traccia_audio), '') is not null
  union all
  select
    coalesce(nullif(trim(l.tema), ''), 'Traccia di settimana') as etichetta,
    l.traccia_audio as url,
    substring(l.traccia_audio from '/tracce-audio/(.+)$') as storage_path,
    null::int as durata_minuti
  from lezioni l
  where nullif(trim(l.traccia_audio), '') is not null
) src
group by url
on conflict (url) do nothing;

update esercizi e
set traccia_id = t.id
from tracce t
where e.traccia_id is null
  and nullif(trim(e.traccia_audio), '') = t.url;

update lezioni l
set traccia_id = t.id
from tracce t
where l.traccia_id is null
  and nullif(trim(l.traccia_audio), '') = t.url;

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

revoke all on function programma_del_partecipante(text) from public;
grant execute on function programma_del_partecipante(text) to anon, authenticated;
