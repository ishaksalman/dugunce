-- =============================================================================
-- Düğünce · 0013 · Yönetim listesine şehir/ilçe slug'ı
--
-- Yayındaki bir mekanın vitrin sayfasına bağlantı verebilmek için gerekiyor.
-- (İnceleme bekleyen mekanlar zaten vitrinde görünmüyor; onlar için yönetim
-- içindeki inceleme ekranı kullanılıyor.)
-- =============================================================================

drop function if exists public.admin_list_venues(
  public.venue_status, text, boolean, integer, integer);

create or replace function public.admin_list_venues(
  p_status public.venue_status default null,
  p_query  text default null,
  p_needs_review boolean default null,
  p_limit  integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, name text, status public.venue_status,
  needs_review boolean, completion_score smallint,
  city_name text, city_slug text,
  district_name text, district_slug text,
  owner_name text, owner_email text,
  cover_url text, view_count integer, inquiry_count integer,
  is_featured boolean, featured_until timestamptz,
  rejection_reason text, published_at timestamptz,
  created_at timestamptz, updated_at timestamptz,
  total_count bigint
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
    v.id, v.slug, v.name, v.status, v.needs_review, v.completion_score,
    c.name, c.slug, d.name, d.slug,
    p.full_name, u.email,
    (select i.url from public.venue_images i where i.venue_id = v.id
      order by i.is_cover desc, i.sort_order limit 1),
    v.view_count, v.inquiry_count, v.is_featured, v.featured_until,
    v.rejection_reason, v.published_at, v.created_at, v.updated_at,
    count(*) over ()
  from public.venues v
  join public.cities c    on c.id = v.city_id
  join public.districts d on d.id = v.district_id
  join public.profiles p  on p.id = v.owner_id
  left join auth.users u  on u.id = v.owner_id
  where (p_status is null or v.status = p_status)
    and (p_needs_review is null or v.needs_review = p_needs_review)
    and (p_query is null or btrim(p_query) = '' or
         public.slugify_tr(v.name) like '%' || public.slugify_tr(p_query) || '%' or
         public.slugify_tr(p.full_name) like '%' || public.slugify_tr(p_query) || '%')
  order by
    case when v.status = 'PENDING_REVIEW' then 0
         when v.needs_review then 1 else 2 end,
    v.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

grant execute on function public.admin_list_venues(
  public.venue_status, text, boolean, integer, integer) to authenticated;
