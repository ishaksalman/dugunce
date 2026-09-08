-- =============================================================================
-- DavetMekanı · 0008 · Mekan sahibinin talep listesi
--
-- Talepler RLS ile zaten korunuyor (sahip yalnızca kendi mekanının
-- taleplerini görüyor). Bu fonksiyon mekan adı ve etkinlik türünü tek
-- sorguda getiriyor; PostgREST'te iç içe select ile aynı şeyi yapmak
-- tip tarafında dağınık duruyor.
-- =============================================================================

create or replace function public.get_owner_inquiries(
  p_status   public.inquiry_status default null,
  p_venue_id uuid    default null,
  p_query    text    default null,
  p_limit    integer default 25,
  p_offset   integer default 0
)
returns table (
  id              uuid,
  venue_id        uuid,
  venue_name      text,
  full_name       text,
  phone           text,
  email           text,
  event_type_name text,
  event_date      date,
  guest_count     integer,
  message         text,
  status          public.inquiry_status,
  owner_note      text,
  contacted_at    timestamptz,
  created_at      timestamptz,
  total_count     bigint,
  new_count       bigint
)
language sql
stable
as $$
  select
    i.id, i.venue_id, v.name, i.full_name, i.phone, i.email,
    e.name, i.event_date, i.guest_count, i.message,
    i.status, i.owner_note, i.contacted_at, i.created_at,
    count(*) over () as total_count,
    -- Filtreden bağımsız "yeni" sayacı; sekme rozetinde kullanılıyor.
    (select count(*) from public.inquiries i2
       join public.venues v2 on v2.id = i2.venue_id
      where v2.owner_id = auth.uid() and i2.status = 'NEW') as new_count
  from public.inquiries i
  join public.venues v on v.id = i.venue_id
  left join public.event_types e on e.id = i.event_type_id
  -- Sahiplik AÇIKÇA yazılı: RLS'e ek bir kemer. get_owner_stats'ta olduğu
  -- gibi, fonksiyonun kendi koşulu olmadan yayındaki mekan üzerinden
  -- sızıntı riski doğuyor.
  where (v.owner_id = auth.uid() or public.is_admin())
    and (p_status is null or i.status = p_status)
    and (p_venue_id is null or i.venue_id = p_venue_id)
    and (p_query is null or btrim(p_query) = '' or
         public.slugify_tr(i.full_name) like '%' || public.slugify_tr(p_query) || '%' or
         i.phone like '%' || regexp_replace(p_query, '[^0-9]', '', 'g') || '%')
  order by i.created_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.get_owner_inquiries(
  public.inquiry_status, uuid, text, integer, integer
) to authenticated;
