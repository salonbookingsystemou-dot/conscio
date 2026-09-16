-- Promemoria email per iscritti «solo da remoto» che non partono.
-- Eseguire nell'SQL editor dopo le migrazioni già applicate.
-- Poi: supabase functions deploy notifica-inattivita --no-verify-jwt
-- Secret: CRON_SECRET (oltre a RESEND_API_KEY).

alter table iscrizioni
  add column if not exists idoneo_il timestamptz;

update iscrizioni
  set idoneo_il = coalesce(idoneo_il, data_iscrizione)
  where esito_screening = 'idoneo'
    and idoneo_il is null;

create table if not exists notifiche_inattivita (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references utenti(id) on delete cascade,
  iscrizione_id uuid references iscrizioni(id) on delete set null,
  tipo text not null check (tipo in ('non_avviato', 'onboarding_senza_ascolto')),
  inviata_il timestamptz not null default now(),
  unique (utente_id, tipo)
);

alter table notifiche_inattivita enable row level security;

drop policy if exists "facilitatore legge notifiche inattivita" on notifiche_inattivita;
create policy "facilitatore legge notifiche inattivita" on notifiche_inattivita
  for select using (is_facilitatore());

create or replace function imposta_esito_screening(p_iscrizione_id uuid, p_esito text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_ciclo_id uuid;
  v_esito_attuale text;
  v_modalita text;
begin
  if not is_facilitatore() then
    raise exception 'NON_AUTORIZZATO';
  end if;

  if p_esito not in ('in_attesa', 'in_valutazione', 'idoneo', 'da_ricontattare') then
    raise exception 'ESITO_NON_VALIDO';
  end if;

  select utente_id, ciclo_id, esito_screening, coalesce(modalita_fruizione, 'presenza')
    into v_utente_id, v_ciclo_id, v_esito_attuale, v_modalita
  from iscrizioni
  where id = p_iscrizione_id;

  if v_utente_id is null then
    raise exception 'ISCRIZIONE_NON_TROVATA';
  end if;

  if p_esito = 'idoneo'
     and v_esito_attuale is distinct from 'idoneo'
     and v_modalita = 'presenza' then
    perform assicura_posto_presenza(v_ciclo_id, p_iscrizione_id);
  end if;

  update iscrizioni
    set esito_screening = p_esito,
        idoneo_il = case
          when p_esito = 'idoneo' then coalesce(idoneo_il, now())
          else idoneo_il
        end
    where id = p_iscrizione_id;
  update utenti
    set stato_screening = p_esito
    where id = v_utente_id and ruolo = 'partecipante';

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function candidati_inattivita_remoto()
returns table (
  utente_id uuid,
  iscrizione_id uuid,
  email text,
  codice text,
  tipo text,
  da_quando timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_facilitatore() or auth.role() = 'service_role') then
    raise exception 'NON_AUTORIZZATO';
  end if;

  return query
  select
    u.id,
    i.id,
    u.email,
    u.codice_partecipante,
    'non_avviato'::text,
    coalesce(i.idoneo_il, i.data_iscrizione)
  from utenti u
  join iscrizioni i on i.utente_id = u.id
  where i.ciclo_id is null
    and i.modalita_fruizione = 'remoto'
    and u.ruolo = 'partecipante'
    and u.email is not null
    and u.consenso_modulo_a = true
    and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
    and i.esito_screening is distinct from 'ritirato'
    and u.stato_screening is distinct from 'ritirato'
    and coalesce(u.onboarding_completato, false) is not true
    and coalesce(i.idoneo_il, i.data_iscrizione) <= now() - interval '7 days'
    and not exists (
      select 1 from notifiche_inattivita n
      where n.utente_id = u.id and n.tipo = 'non_avviato'
    )
  union all
  select
    u.id,
    i.id,
    u.email,
    u.codice_partecipante,
    'onboarding_senza_ascolto'::text,
    u.onboarding_completato_il
  from utenti u
  join iscrizioni i on i.utente_id = u.id
  where i.ciclo_id is null
    and i.modalita_fruizione = 'remoto'
    and u.ruolo = 'partecipante'
    and u.email is not null
    and u.consenso_modulo_a = true
    and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
    and i.esito_screening is distinct from 'ritirato'
    and u.stato_screening is distinct from 'ritirato'
    and u.onboarding_completato is true
    and u.onboarding_completato_il <= now() - interval '7 days'
    and not exists (
      select 1 from log_pratica lp
      where lp.utente_id = u.id and lp.tipo = 'ascolto'
    )
    and not exists (
      select 1 from notifiche_inattivita n
      where n.utente_id = u.id and n.tipo = 'onboarding_senza_ascolto'
    );
end;
$$;

revoke all on function candidati_inattivita_remoto() from public;
grant execute on function candidati_inattivita_remoto() to authenticated, service_role;
grant execute on function imposta_esito_screening(uuid, text) to authenticated;

notify pgrst, 'reload schema';
