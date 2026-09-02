-- Destinatari email: solo consenso A + idonei (screening può includere in valutazione).
-- Retention: separa l’email dai record dopo chiusura ciclo + periodo di grazia.

drop function if exists email_destinatari_ciclo(uuid);

create or replace function email_destinatari_ciclo(
  p_ciclo_id uuid,
  p_includi_in_valutazione boolean default false
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
    and is_facilitatore();
$$;

create or replace function separa_email_cicli_conclusi(p_giorni_grazia int default 90)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  if not is_facilitatore() then
    raise exception 'NON_AUTORIZZATO';
  end if;

  update utenti u
  set email = null
  where u.ruolo = 'partecipante'
    and u.email is not null
    and not exists (
      select 1
      from iscrizioni i
      join cicli c on c.id = i.ciclo_id
      where i.utente_id = u.id
        and (
          c.stato in ('reclutamento', 'attivo')
          or coalesce(c.data_fine, c.data_inizio + 62)
            >= (current_date - greatest(coalesce(p_giorni_grazia, 90), 0))
        )
    );

  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'email_separate', v_n);
end;
$$;

revoke all on function email_destinatari_ciclo(uuid, boolean) from public;
revoke all on function separa_email_cicli_conclusi(int) from public;
grant execute on function email_destinatari_ciclo(uuid, boolean) to authenticated;
grant execute on function separa_email_cicli_conclusi(int) to authenticated;

notify pgrst, 'reload schema';
