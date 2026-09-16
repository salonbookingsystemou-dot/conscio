-- Comunicazioni indirizzabili agli utenti in remoto di un ciclo.
-- Eseguire nell'SQL editor dopo le migrazioni già applicate.

alter table comunicazioni
  add column if not exists destinatari text;

update comunicazioni
  set destinatari = 'tutti'
  where destinatari is null;

alter table comunicazioni
  alter column destinatari set default 'tutti';

alter table comunicazioni
  alter column destinatari set not null;

alter table comunicazioni
  drop constraint if exists comunicazioni_destinatari_check;

alter table comunicazioni
  add constraint comunicazioni_destinatari_check
  check (destinatari in ('tutti', 'remoto'));

drop function if exists email_destinatari_ciclo(uuid);
drop function if exists email_destinatari_ciclo(uuid, boolean);

create or replace function email_destinatari_ciclo(
  p_ciclo_id uuid,
  p_includi_in_valutazione boolean default false,
  p_solo_remoto boolean default false
)
returns table (email text)
language sql
security definer
set search_path = public
as $$
  select distinct u.email
  from utenti u
  join iscrizioni i on i.utente_id = u.id
  where i.ciclo_id = p_ciclo_id
    and u.ruolo = 'partecipante'
    and u.email is not null
    and u.consenso_modulo_a = true
    and (
      u.stato_screening = 'idoneo'
      or i.esito_screening = 'idoneo'
      or (
        p_includi_in_valutazione
        and coalesce(i.esito_screening, u.stato_screening, 'in_attesa')
          in ('in_attesa', 'in_valutazione')
      )
    )
    and (
      not coalesce(p_solo_remoto, false)
      or coalesce(i.modalita_fruizione, 'presenza') = 'remoto'
    )
    and is_facilitatore();
$$;

create or replace function comunicazioni_del_partecipante(p_codice text)
returns table (
  id uuid,
  tipo text,
  oggetto text,
  testo text,
  data_invio timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_ciclo_id uuid;
  v_modalita text;
begin
  v_utente_id := assert_partecipante_noto(p_codice);

  select i.ciclo_id, coalesce(i.modalita_fruizione, 'presenza')
    into v_ciclo_id, v_modalita
  from iscrizioni i
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  return query
  select c.id, c.tipo, c.oggetto, c.testo, c.data_invio
  from comunicazioni c
  where c.ciclo_id = v_ciclo_id
    and (
      coalesce(c.destinatari, 'tutti') = 'tutti'
      or (c.destinatari = 'remoto' and v_modalita = 'remoto')
    )
  order by (c.tipo = 'reminder_t3') desc, c.data_invio desc;
end;
$$;

revoke all on function email_destinatari_ciclo(uuid, boolean, boolean) from public;
revoke all on function comunicazioni_del_partecipante(text) from public;
grant execute on function email_destinatari_ciclo(uuid, boolean, boolean) to authenticated;
grant execute on function comunicazioni_del_partecipante(text) to anon, authenticated;

notify pgrst, 'reload schema';
