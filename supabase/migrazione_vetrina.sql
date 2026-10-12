-- Vetrina pubblica «Ascolta». Fase 1: tabelle, colonne, tag, impostazioni, RPC e bucket.
-- Non ridefinisce nessuna funzione dei partecipanti (programma, ascolto, questionari, export, reset).
-- I contatori sono aggregati per traccia e giorno: niente codice, niente identificativo.
-- Da applicare nell'SQL editor, poi: supabase functions deploy porta && supabase functions deploy cerca-sfondi
--
-- tracce ha già titolo, descrizione, url, storage_path, durata_minuti
-- (migrazione_libreria_tracce.sql, migrazione_traccia_descrizione.sql). Non si duplicano.
-- Il bucket tracce-audio è già pubblico: l'ascolto del percorso usa l'URL in tracce.url.
-- Non si aggiunge una policy di lettura anon, che non restringerebbe nulla e permetterebbe l'elenco dei file.

-- Autori dei testi
create table if not exists autori (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  link text,
  nota text,
  creato_il timestamptz not null default now()
);

-- Tassonomia chiusa. Lo slug è unico fra tutti i gruppi:
-- «respiro» della pratica e «respiro» dell'ancora non possono coincidere.
create table if not exists tag (
  id uuid primary key default gen_random_uuid(),
  gruppo text not null check (gruppo in ('pratica', 'contesto', 'livello', 'ancora', 'attenzione')),
  slug text not null unique,
  etichetta text not null,
  ordine int not null default 0
);

create table if not exists tracce_tag (
  traccia_id uuid references tracce(id) on delete cascade,
  tag_id uuid references tag(id) on delete cascade,
  primary key (traccia_id, tag_id)
);

-- descrizione è in migrazione_traccia_descrizione.sql, non ancora applicata in produzione.
alter table tracce
  add column if not exists descrizione text,
  add column if not exists slug text,
  add column if not exists sfondo_tipo text,
  add column if not exists sfondo_fonte text,
  add column if not exists sfondo_url text,
  add column if not exists sfondo_poster_url text,
  add column if not exists sfondo_fonte_id text,
  add column if not exists sfondo_autore text,
  add column if not exists sfondo_autore_link text,
  add column if not exists sfondo_fuoco text not null default 'centro',
  add column if not exists autore_id uuid references autori(id),
  add column if not exists licenza text,
  add column if not exists fonte_url text,
  add column if not exists permesso_nota text,
  add column if not exists voce_tipo text,
  add column if not exists voce_nome text,
  add column if not exists revisione jsonb not null default '{}'::jsonb,
  add column if not exists stato_revisione text not null default 'bozza',
  add column if not exists pubblica boolean not null default false,
  add column if not exists in_evidenza_dal date;

alter table tracce drop constraint if exists tracce_slug_formato;
alter table tracce add constraint tracce_slug_formato check (
  slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
);

alter table tracce drop constraint if exists tracce_sfondo_tipo;
alter table tracce add constraint tracce_sfondo_tipo check (
  sfondo_tipo is null or sfondo_tipo in ('foto', 'video')
);

alter table tracce drop constraint if exists tracce_sfondo_fonte;
alter table tracce add constraint tracce_sfondo_fonte check (
  sfondo_fonte is null or sfondo_fonte in ('caricato', 'unsplash', 'pexels')
);

alter table tracce drop constraint if exists tracce_sfondo_fuoco;
alter table tracce add constraint tracce_sfondo_fuoco check (
  sfondo_fuoco in ('centro', 'alto', 'basso')
);

alter table tracce drop constraint if exists tracce_licenza;
alter table tracce add constraint tracce_licenza check (
  licenza is null or licenza in (
    'propria', 'cc0', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa', 'permesso-autore'
  )
);

alter table tracce drop constraint if exists tracce_voce_tipo;
alter table tracce add constraint tracce_voce_tipo check (
  voce_tipo is null or voce_tipo in ('sintetica', 'umana')
);

alter table tracce drop constraint if exists tracce_stato_revisione;
alter table tracce add constraint tracce_stato_revisione check (
  stato_revisione in ('bozza', 'in-revisione', 'approvata')
);

alter table tracce drop constraint if exists tracce_licenza_completa;
alter table tracce add constraint tracce_licenza_completa check (
  licenza is distinct from 'permesso-autore' or permesso_nota is not null
);

alter table tracce drop constraint if exists tracce_pubblicabile;
alter table tracce add constraint tracce_pubblicabile check (
  not pubblica or (
    slug is not null and descrizione is not null
    and sfondo_url is not null and sfondo_poster_url is not null and sfondo_autore is not null
    and autore_id is not null and licenza is not null and voce_tipo is not null
    and stato_revisione = 'approvata'
  )
);

create unique index if not exists tracce_slug_idx on tracce (slug);

create index if not exists tracce_vetrina_evidenza_idx
  on tracce (in_evidenza_dal desc)
  where pubblica and in_evidenza_dal is not null;

-- Contatori aggregati, nessun identificativo.
create table if not exists statistiche_vetrina (
  traccia_id uuid references tracce(id) on delete cascade,
  giorno date not null default current_date,
  avvii int not null default 0,
  completamenti int not null default 0,
  clic_cta int not null default 0,
  condivisioni int not null default 0,
  primary key (traccia_id, giorno)
);

-- Impostazioni della vetrina, separate da splash_sito: quella riga è già
-- leggibile da anon per la frase di apertura. Qui legge solo il facilitatore;
-- il pubblico passa da vetrina_impostazioni().
create table if not exists impostazioni_sito (
  id smallint primary key default 1 check (id = 1),
  vetrina_attiva boolean not null default false,
  cta_titolo text not null default 'Vuoi praticare con una guida?',
  cta_testo text not null default 'Il percorso MBSR dura otto settimane, in presenza o da remoto, con un gruppo e un facilitatore.',
  cta_testo_senza_ciclo text not null default 'In questo momento non ci sono iscrizioni aperte. Le meditazioni di questa pagina restano disponibili.',
  aggiornato_il timestamptz not null default now()
);

insert into impostazioni_sito (id)
values (1)
on conflict (id) do nothing;

insert into tag (gruppo, slug, etichetta, ordine) values
  ('pratica', 'respiro', 'Respiro', 10),
  ('pratica', 'body-scan', 'Body scan', 20),
  ('pratica', 'movimento-consapevole', 'Movimento consapevole', 30),
  ('pratica', 'suoni', 'Suoni', 40),
  ('pratica', 'gentilezza-amorevole', 'Gentilezza amorevole', 50),
  ('pratica', 'meditazione-seduta', 'Meditazione seduta', 60),
  ('contesto', 'sonno', 'Sonno', 10),
  ('contesto', 'pausa-breve', 'Pausa breve', 20),
  ('contesto', 'inizio-giornata', 'Inizio giornata', 30),
  ('contesto', 'momenti-agitati', 'Momenti agitati', 40),
  ('livello', 'prima-volta', 'Prima volta', 10),
  ('livello', 'con-esperienza', 'Con esperienza', 20),
  ('ancora', 'ancora-respiro', 'Respiro', 10),
  ('ancora', 'corpo', 'Corpo', 20),
  ('ancora', 'ancora-suoni', 'Suoni', 30),
  ('ancora', 'mani', 'Mani', 40),
  ('attenzione', 'preferisce-non-respiro', 'Adatta a chi preferisce non concentrarsi sul respiro', 10)
on conflict (slug) do nothing;

alter table autori enable row level security;
alter table tag enable row level security;
alter table tracce_tag enable row level security;
alter table statistiche_vetrina enable row level security;
alter table impostazioni_sito enable row level security;

drop policy if exists "facilitatore gestisce autori" on autori;
create policy "facilitatore gestisce autori" on autori
  for all using (is_facilitatore()) with check (is_facilitatore());

drop policy if exists "facilitatore gestisce tag" on tag;
create policy "facilitatore gestisce tag" on tag
  for all using (is_facilitatore()) with check (is_facilitatore());

drop policy if exists "facilitatore gestisce tracce_tag" on tracce_tag;
create policy "facilitatore gestisce tracce_tag" on tracce_tag
  for all using (is_facilitatore()) with check (is_facilitatore());

drop policy if exists "facilitatore legge statistiche vetrina" on statistiche_vetrina;
create policy "facilitatore legge statistiche vetrina" on statistiche_vetrina
  for select using (is_facilitatore());

drop policy if exists "facilitatore legge impostazioni sito" on impostazioni_sito;
create policy "facilitatore legge impostazioni sito" on impostazioni_sito
  for select using (is_facilitatore());

drop policy if exists "facilitatore aggiorna impostazioni sito" on impostazioni_sito;
create policy "facilitatore aggiorna impostazioni sito" on impostazioni_sito
  for update using (is_facilitatore()) with check (is_facilitatore());

grant select, insert, update, delete on autori to authenticated;
grant select, insert, update, delete on tag to authenticated;
grant select, insert, update, delete on tracce_tag to authenticated;
grant select on statistiche_vetrina to authenticated;
grant select, update on impostazioni_sito to authenticated;

-- Sfondi caricati e copie Pexels. Foto fino a 10 MB e video fino a 50 MB:
-- il tetto del bucket è il massimo (50 MB); i 10 MB della foto li controlla il client
-- e, per Pexels, la funzione cerca-sfondi. Lettura tramite URL pubblico, senza policy
-- di elenco (stessa scelta di tracce-audio).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sfondi-vetrina',
  'sfondi-vetrina',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "facilitatore carica sfondi vetrina" on storage.objects;
create policy "facilitatore carica sfondi vetrina"
on storage.objects for insert
to authenticated
with check (bucket_id = 'sfondi-vetrina' and public.is_facilitatore());

drop policy if exists "facilitatore aggiorna sfondi vetrina" on storage.objects;
create policy "facilitatore aggiorna sfondi vetrina"
on storage.objects for update
to authenticated
using (bucket_id = 'sfondi-vetrina' and public.is_facilitatore())
with check (bucket_id = 'sfondi-vetrina' and public.is_facilitatore());

drop policy if exists "facilitatore elimina sfondi vetrina" on storage.objects;
create policy "facilitatore elimina sfondi vetrina"
on storage.objects for delete
to authenticated
using (bucket_id = 'sfondi-vetrina' and public.is_facilitatore());

create or replace function vetrina_e_attiva()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select vetrina_attiva from impostazioni_sito where id = 1), false);
$$;

create or replace function vetrina_scheda(p_id uuid, p_con_audio boolean)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'slug', t.slug,
    'titolo', t.titolo,
    'descrizione', t.descrizione,
    'durata_minuti', t.durata_minuti,
    'sfondo', jsonb_strip_nulls(jsonb_build_object(
      'tipo', t.sfondo_tipo,
      'fonte', t.sfondo_fonte,
      'url', t.sfondo_url,
      'poster_url', t.sfondo_poster_url,
      'autore', t.sfondo_autore,
      'autore_link', t.sfondo_autore_link,
      'fuoco', t.sfondo_fuoco
    )),
    'autore', jsonb_strip_nulls(jsonb_build_object(
      'nome', a.nome,
      'link', a.link
    )),
    'licenza', t.licenza,
    'fonte_url', t.fonte_url,
    'voce', jsonb_strip_nulls(jsonb_build_object(
      'tipo', t.voce_tipo,
      'nome', t.voce_nome
    )),
    'tag', coalesce((
      select jsonb_object_agg(gruppo, voci)
      from (
        select tg.gruppo,
          jsonb_agg(
            jsonb_build_object('slug', tg.slug, 'etichetta', tg.etichetta)
            order by tg.ordine, tg.etichetta
          ) as voci
        from tracce_tag tt
        join tag tg on tg.id = tt.tag_id
        where tt.traccia_id = t.id
        group by tg.gruppo
      ) gruppi
    ), '{}'::jsonb),
    'in_evidenza_dal', t.in_evidenza_dal,
    'audio_url', case when p_con_audio then t.url else null end
  ))
  from tracce t
  left join autori a on a.id = t.autore_id
  where t.id = p_id
    and t.pubblica
    and t.slug is not null;
$$;

create or replace function vetrina_elenco()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not vetrina_e_attiva() then '[]'::jsonb
    else coalesce((
      select jsonb_agg(vetrina_scheda(t.id, false) order by t.in_evidenza_dal desc nulls last, t.titolo)
      from tracce t
      where t.pubblica and t.slug is not null
    ), '[]'::jsonb)
  end;
$$;

create or replace function vetrina_traccia(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not vetrina_e_attiva() then null
    else (
      select vetrina_scheda(t.id, true)
      from tracce t
      where t.pubblica
        and t.slug = nullif(trim(p_slug), '')
    )
  end;
$$;

create or replace function vetrina_in_evidenza()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not vetrina_e_attiva() then null
    else (
      select vetrina_scheda(t.id, false)
      from tracce t
      where t.pubblica
        and t.slug is not null
        and t.in_evidenza_dal is not null
        and t.in_evidenza_dal <= current_date
      order by t.in_evidenza_dal desc, t.titolo
      limit 1
    )
  end;
$$;

-- Iscrizioni aperte: stessa regola della pagina Iscrizione (cicli in reclutamento).
create or replace function vetrina_impostazioni()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'vetrina_attiva', coalesce(i.vetrina_attiva, false),
    'cta_titolo', i.cta_titolo,
    'cta_testo', i.cta_testo,
    'cta_testo_senza_ciclo', i.cta_testo_senza_ciclo,
    'iscrizioni_aperte', exists (
      select 1 from cicli c where c.stato = 'reclutamento'
    )
  )
  from impostazioni_sito i
  where i.id = 1;
$$;

-- Chiamata solo da porta (service_role), dopo il tetto per IP. Non è eseguibile da anon.
create or replace function registra_evento_vetrina(p_slug text, p_evento text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not vetrina_e_attiva() then
    return;
  end if;
  if p_evento not in ('avvio', 'completamento', 'cta', 'condivisione') then
    return;
  end if;

  select t.id into v_id
  from tracce t
  where t.pubblica
    and t.slug = nullif(trim(p_slug), '');

  if v_id is null then
    return;
  end if;

  insert into statistiche_vetrina (traccia_id, giorno, avvii, completamenti, clic_cta, condivisioni)
  values (
    v_id,
    current_date,
    case when p_evento = 'avvio' then 1 else 0 end,
    case when p_evento = 'completamento' then 1 else 0 end,
    case when p_evento = 'cta' then 1 else 0 end,
    case when p_evento = 'condivisione' then 1 else 0 end
  )
  on conflict (traccia_id, giorno) do update set
    avvii = statistiche_vetrina.avvii + case when p_evento = 'avvio' then 1 else 0 end,
    completamenti = statistiche_vetrina.completamenti + case when p_evento = 'completamento' then 1 else 0 end,
    clic_cta = statistiche_vetrina.clic_cta + case when p_evento = 'cta' then 1 else 0 end,
    condivisioni = statistiche_vetrina.condivisioni + case when p_evento = 'condivisione' then 1 else 0 end;
end;
$$;

revoke all on function vetrina_e_attiva() from public, anon, authenticated;
revoke all on function vetrina_scheda(uuid, boolean) from public, anon, authenticated;
revoke all on function vetrina_elenco() from public;
revoke all on function vetrina_traccia(text) from public;
revoke all on function vetrina_in_evidenza() from public;
revoke all on function vetrina_impostazioni() from public;
revoke all on function registra_evento_vetrina(text, text) from public, anon, authenticated;

grant execute on function vetrina_elenco() to anon, authenticated;
grant execute on function vetrina_traccia(text) to anon, authenticated;
grant execute on function vetrina_in_evidenza() to anon, authenticated;
grant execute on function vetrina_impostazioni() to anon, authenticated;
grant execute on function registra_evento_vetrina(text, text) to service_role;

notify pgrst, 'reload schema';
