-- Traccia audio della lezione (body scan, seduta guidata, ecc.)
-- File in Storage bucket tracce-audio; URL pubblico in lezioni.traccia_audio.

alter table lezioni add column if not exists traccia_audio text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tracce-audio',
  'tracce-audio',
  true,
  52428800,
  array[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
    'audio/ogg',
    'audio/webm'
  ]
)
on conflict (id) do nothing;

drop policy if exists "lettura pubblica tracce" on storage.objects;
create policy "lettura pubblica tracce"
on storage.objects for select
using (bucket_id = 'tracce-audio');

drop policy if exists "facilitatore carica tracce" on storage.objects;
create policy "facilitatore carica tracce"
on storage.objects for insert
to authenticated
with check (bucket_id = 'tracce-audio' and public.is_facilitatore());

drop policy if exists "facilitatore aggiorna tracce" on storage.objects;
create policy "facilitatore aggiorna tracce"
on storage.objects for update
to authenticated
using (bucket_id = 'tracce-audio' and public.is_facilitatore())
with check (bucket_id = 'tracce-audio' and public.is_facilitatore());

drop policy if exists "facilitatore elimina tracce" on storage.objects;
create policy "facilitatore elimina tracce"
on storage.objects for delete
to authenticated
using (bucket_id = 'tracce-audio' and public.is_facilitatore());

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
