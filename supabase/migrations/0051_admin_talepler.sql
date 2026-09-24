-- =============================================================================
-- Düğünce · 0051 · Yönetim: tüm taleplerin listesi
--
-- `get_owner_inquiries` RLS sayesinde teknik olarak admin'e de açıktı
-- (`v.owner_id = auth.uid() or public.is_admin()`) ama panelde onu çağıran
-- bir ekran hiç yazılmamıştı — admin'in Telegram bildirimi dışında talepleri
-- görecek hiçbir yeri yoktu, özellikle SAHİPSİZ mekanlara gelenler (owner_id
-- null olduğu için mekan sahibi diye kimse yok, admin görmezse kaybolur).
--
-- Ayrı bir fonksiyon (owner'ınkini değiştirmek yerine): `admin_list_venues`
-- ailesiyle aynı desen — security definer + assert_admin(), sahiplik
-- filtresi YOK (tüm talepler), `is_claimed` bayrağı ve "yalnızca sahipsiz"
-- filtresi eklendi.
-- =============================================================================

create or replace function public.admin_list_inquiries(
  p_status         public.inquiry_status default null,
  p_venue_id       uuid default null,
  p_unclaimed_only boolean default false,
  p_query          text default null,
  p_limit          integer default 25,
  p_offset         integer default 0
)
returns table (
  id              uuid,
  venue_id        uuid,
  venue_name      text,
  venue_slug      text,
  is_claimed      boolean,
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
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();
  return query
  select
    i.id, i.venue_id, v.name, v.slug, (v.owner_id is not null),
    i.full_name, i.phone, i.email,
    e.name, i.event_date, i.guest_count, i.message,
    i.status, i.owner_note, i.contacted_at, i.created_at,
    count(*) over () as total_count,
    (select count(*) from public.inquiries i2 where i2.status = 'NEW') as new_count
  from public.inquiries i
  join public.venues v on v.id = i.venue_id
  left join public.event_types e on e.id = i.event_type_id
  where (p_status is null or i.status = p_status)
    and (p_venue_id is null or i.venue_id = p_venue_id)
    and (not coalesce(p_unclaimed_only, false) or v.owner_id is null)
    and (p_query is null or btrim(p_query) = '' or
         public.slugify_tr(i.full_name) like '%' || public.slugify_tr(p_query) || '%' or
         i.phone like '%' || regexp_replace(p_query, '[^0-9]', '', 'g') || '%' or
         public.slugify_tr(v.name) like '%' || public.slugify_tr(p_query) || '%')
  order by i.created_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

grant execute on function public.admin_list_inquiries(
  public.inquiry_status, uuid, boolean, text, integer, integer) to authenticated;
