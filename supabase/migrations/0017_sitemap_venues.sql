-- =============================================================================
-- DavetMekanı · 0017 · Sitemap için mekan yolları
--
-- PostgREST'in iç içe select'i (venues → cities/districts) elle yazılan
-- `Database` tipiyle ifade edilmesi zor bir şekil üretiyor. Sitemap'in
-- ihtiyacı üç kolon; RPC hem tipli hem daha ucuz.
-- =============================================================================

create or replace function public.list_venue_sitemap()
returns table (path text, updated_at timestamptz)
language sql
stable
as $$
  select
    '/mekanlar/' || c.slug || '/' || d.slug || '/' || v.slug,
    greatest(v.updated_at, coalesce(v.published_at, v.updated_at))
  from public.venues v
  join public.cities c    on c.id = v.city_id
  join public.districts d on d.id = v.district_id
  where v.status = 'PUBLISHED'
  order by v.updated_at desc
  limit 50000;
$$;

grant execute on function public.list_venue_sitemap() to anon, authenticated;
