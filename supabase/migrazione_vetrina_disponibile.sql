-- La vetrina è il player delle tracce di libreria con la spunta.
-- Non dipende dal ciclo, né da sfondo, autore, licenza o revisione.

alter table tracce drop constraint if exists tracce_pubblicabile;
alter table tracce add constraint tracce_pubblicabile check (
  not pubblica or slug is not null
);

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
      select jsonb_agg(vetrina_scheda(t.id, true) order by t.titolo)
      from tracce t
      where t.pubblica and t.slug is not null
    ), '[]'::jsonb)
  end;
$$;

notify pgrst, 'reload schema';
