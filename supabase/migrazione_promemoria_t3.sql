-- Promemoria email per il follow-up T3: all'apertura (fine + 28 giorni)
-- e 7 giorni prima della chiusura (fine + 49). Usato da promemoria-questionari.
-- Richiede migrazione_dati_progressi.sql (periodo_del_partecipante e nuove finestre).
-- Solo modifiche aggiuntive.

create table if not exists public.promemoria_questionari (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references public.utenti(id) on delete cascade,
  timepoint text not null check (timepoint in ('T3')),
  tipo text not null check (tipo in ('apertura', 'chiusura')),
  -- Data di fine del percorso a cui si riferisce il promemoria
  riferimento date not null,
  inviata_il timestamptz not null default now(),
  unique (utente_id, timepoint, tipo, riferimento)
);

alter table public.promemoria_questionari enable row level security;

drop policy if exists "facilitatore legge promemoria questionari" on public.promemoria_questionari;
create policy "facilitatore legge promemoria questionari" on public.promemoria_questionari
  for select using (is_facilitatore());

-- Chi deve ricevere oggi un promemoria T3.
-- apertura: da fine + 28 a fine + 48 · chiusura: da fine + 49 a fine + 56.
-- Una sola email per tipo e percorso; nessuna a chi ha già compilato T3.
create or replace function public.candidati_promemoria_t3()
returns table (
  utente_id uuid,
  email text,
  codice text,
  tipo text,
  riferimento date,
  chiude_il date
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not (is_facilitatore() or auth.role() = 'service_role') then
    raise exception 'NON_AUTORIZZATO';
  end if;

  return query
  with base as (
    select u.id, u.email, u.codice_partecipante, p.fine as rif
    from utenti u
    cross join lateral periodo_del_partecipante(u.id) p
    where u.ruolo = 'partecipante'
      and u.email is not null
      and u.consenso_modulo_a = true
      and u.stato_screening is distinct from 'ritirato'
      and exists (
        select 1 from iscrizioni i
        where i.utente_id = u.id
          and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
          and i.esito_screening is distinct from 'ritirato'
      )
      and p.fine is not null
  )
  select b.id, b.email, b.codice_partecipante, t.tipo, b.rif, b.rif + 56
  from base b
  cross join lateral (
    values ('apertura'::text, b.rif + 28, b.rif + 48),
           ('chiusura'::text, b.rif + 49, b.rif + 56)
  ) as t(tipo, dal, al)
  where current_date between t.dal and t.al
    and not exists (
      select 1 from risposte r
      where r.utente_id = b.id and r.timepoint = 'T3'
    )
    and not exists (
      select 1 from promemoria_questionari n
      where n.utente_id = b.id
        and n.timepoint = 'T3'
        and n.tipo = t.tipo
        and n.riferimento = b.rif
    );
end;
$function$;

revoke all on function public.candidati_promemoria_t3() from public, anon;
grant execute on function public.candidati_promemoria_t3() to authenticated, service_role;
