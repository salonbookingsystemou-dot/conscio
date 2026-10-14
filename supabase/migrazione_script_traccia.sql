-- Script della generazione vocale, per rivedere una traccia senza rifarla da zero.
-- Testo, pause e impostazioni stanno sulla riga. L'audio di ogni paragrafo
-- sta nel bucket privato bozze-voce: lo legge solo il facilitatore.
-- Non è la traccia del partecipante e non entra nella sua cache.
-- Non è un dato dei partecipanti: niente informativa, export o reset.

alter table public.tracce
  add column if not exists generazione jsonb;

comment on column public.tracce.generazione is
  'Ricetta della voce generata (modello, voce, paragrafi). L''audio sta nel bucket bozze-voce.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bozze-voce',
  'bozze-voce',
  false,
  52428800,
  array['application/gzip', 'application/octet-stream']
)
on conflict (id) do nothing;

drop policy if exists "facilitatore legge bozze voce" on storage.objects;
create policy "facilitatore legge bozze voce"
on storage.objects for select
to authenticated
using (bucket_id = 'bozze-voce' and public.is_facilitatore());

drop policy if exists "facilitatore carica bozze voce" on storage.objects;
create policy "facilitatore carica bozze voce"
on storage.objects for insert
to authenticated
with check (bucket_id = 'bozze-voce' and public.is_facilitatore());

drop policy if exists "facilitatore aggiorna bozze voce" on storage.objects;
create policy "facilitatore aggiorna bozze voce"
on storage.objects for update
to authenticated
using (bucket_id = 'bozze-voce' and public.is_facilitatore())
with check (bucket_id = 'bozze-voce' and public.is_facilitatore());

drop policy if exists "facilitatore elimina bozze voce" on storage.objects;
create policy "facilitatore elimina bozze voce"
on storage.objects for delete
to authenticated
using (bucket_id = 'bozze-voce' and public.is_facilitatore());
