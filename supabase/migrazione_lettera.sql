-- «Restiamo in contatto» (18/10/2026): avviso del prossimo ciclo e lettera settimanale.
-- Gli iscritti alla lettera NON sono partecipanti: nessun collegamento con utenti, iscrizioni,
-- codici, risposte o log_pratica. iscritti_lettera si legge e si scrive solo dalle Edge Function
-- (service role); il facilitatore vede solo conteggi e lo storico degli invii.

create extension if not exists citext with schema extensions;

create table if not exists public.iscritti_lettera (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique,
  avviso_ciclo boolean not null default false,
  avviso_ciclo_consenso_il timestamptz,
  lettera boolean not null default false,
  lettera_consenso_il timestamptz,
  versione_testo text not null,            -- data dell'informativa accettata, es. '2026-10-18'
  stato text not null default 'in_attesa'
    check (stato in ('in_attesa', 'confermato', 'cancellato')),
  token_conferma_hash text,                -- sha256 del token, mai il token
  token_conferma_scade timestamptz,
  conferma_inviata_il timestamptz,         -- per non reinviare la conferma più di una volta ogni 10 minuti
  token_uscita uuid not null default gen_random_uuid() unique,
  confermato_il timestamptz,
  cancellato_il timestamptz,
  ultimo_ciclo_avvisato uuid references public.cicli(id) on delete set null,
  creato_il timestamptz not null default now()
);

create index if not exists iscritti_lettera_token_conferma_idx
  on public.iscritti_lettera (token_conferma_hash) where token_conferma_hash is not null;

create table if not exists public.lettere_inviate (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'lettera' check (tipo in ('lettera', 'avviso_ciclo')),
  ciclo_id uuid references public.cicli(id) on delete set null,
  oggetto text not null,
  corpo text not null,
  destinatari int not null,
  falliti int not null default 0,
  inviata_il timestamptz not null default now(),
  inviata_da uuid references auth.users(id)
);

alter table public.iscritti_lettera enable row level security;
alter table public.lettere_inviate enable row level security;

-- Nessuna policy su iscritti_lettera: anon e authenticated non leggono né scrivono.
revoke all on table public.iscritti_lettera from public, anon, authenticated;

drop policy if exists "facilitatore legge lettere inviate" on public.lettere_inviate;
create policy "facilitatore legge lettere inviate" on public.lettere_inviate
  for select using (is_facilitatore());
revoke all on table public.lettere_inviate from public, anon, authenticated;
grant select on table public.lettere_inviate to authenticated;

-- Conteggi per l'area facilitatore. Mai le email.
-- Con p_ciclo_id dice anche quanti riceverebbero l'avviso di quel ciclo.
create or replace function public.lettera_conteggi(p_ciclo_id uuid default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_facilitatore() then
    raise exception 'NON_AUTORIZZATO';
  end if;
  return (
    select json_build_object(
      'lettera', count(*) filter (where stato = 'confermato' and lettera),
      'avviso_ciclo', count(*) filter (where stato = 'confermato' and avviso_ciclo),
      'in_attesa', count(*) filter (where stato = 'in_attesa'),
      'cancellati_30_giorni', count(*) filter (
        where stato = 'cancellato' and cancellato_il >= now() - interval '30 days'
      ),
      'avviso_da_inviare', case when p_ciclo_id is null then null else count(*) filter (
        where stato = 'confermato' and avviso_ciclo
          and ultimo_ciclo_avvisato is distinct from p_ciclo_id
      ) end
    )
    from iscritti_lettera
  );
end;
$$;

revoke all on function public.lettera_conteggi(uuid) from public, anon;
grant execute on function public.lettera_conteggi(uuid) to authenticated;

-- Pulizia, chiamata da porta a ogni iscrizione: le richieste non confermate scadute spariscono.
create or replace function public.pulisci_iscritti_lettera()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  delete from iscritti_lettera
  where stato = 'in_attesa' and token_conferma_scade < now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.pulisci_iscritti_lettera() from public, anon, authenticated;
grant execute on function public.pulisci_iscritti_lettera() to service_role;
