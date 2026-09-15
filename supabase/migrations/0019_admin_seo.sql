-- =============================================================================
-- Düğünce · 0019 · SEO sayfalarının yönetimi
--
-- Otomatik üretim (`refresh_seo_pages`) yalnızca YENİ satır ekliyor ve
-- aktifliği eşiğe göre güncelliyor. Yönetici bir sayfanın metnini elle
-- düzenlediğinde o metin korunmalı — üretim onu ezmez.
-- =============================================================================

create or replace function public.admin_list_seo_pages(
  p_kind   public.seo_page_kind default null,
  p_active boolean default null,
  p_query  text default null,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid, path text, kind public.seo_page_kind,
  title text, meta_description text, h1 text, intro_html text,
  is_active boolean, min_venue_count smallint,
  venue_count bigint, updated_at timestamptz, total_count bigint
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
    s.id, s.path, s.kind, s.title, s.meta_description, s.h1, s.intro_html,
    s.is_active, s.min_venue_count,
    (select count(*)
       from public.venues v
      where v.status = 'PUBLISHED'
        and (s.city_id is null or v.city_id = s.city_id)
        and (s.district_id is null or v.district_id = s.district_id)
        and (s.event_type_id is null or v.event_type_slugs @> array[
              (select e.slug from public.event_types e where e.id = s.event_type_id)])
    ),
    s.updated_at,
    count(*) over ()
  from public.seo_pages s
  where (p_kind is null or s.kind = p_kind)
    and (p_active is null or s.is_active = p_active)
    and (p_query is null or btrim(p_query) = '' or s.path like '%' || p_query || '%')
  -- Aktifler önce, sonra tipe ve yola göre.
  order by s.is_active desc,
           case s.kind when 'etkinlik' then 0 when 'sehir' then 1
                       when 'sehir_etkinlik' then 2 else 3 end,
           s.path
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

grant execute on function public.admin_list_seo_pages(
  public.seo_page_kind, boolean, text, integer, integer) to authenticated;

create or replace function public.admin_update_seo_page(
  p_id uuid,
  p_title text default null,
  p_meta_description text default null,
  p_h1 text default null,
  p_intro_html text default null,
  p_min_venue_count smallint default null,
  p_is_active boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.assert_admin();
begin
  if not exists (select 1 from public.seo_pages where id = p_id) then
    raise exception 'Sayfa bulunamadı.' using errcode = 'no_data_found';
  end if;

  -- null gelen alan DEĞİŞTİRİLMEZ; kısmi güncelleme.
  update public.seo_pages
     set title            = coalesce(nullif(btrim(p_title), ''), title),
         meta_description = coalesce(nullif(btrim(p_meta_description), ''), meta_description),
         h1               = coalesce(nullif(btrim(p_h1), ''), h1),
         intro_html       = case when p_intro_html is null then intro_html
                                 else nullif(btrim(p_intro_html), '') end,
         min_venue_count  = coalesce(p_min_venue_count, min_venue_count),
         is_active        = coalesce(p_is_active, is_active)
   where id = p_id;

  perform public.log_admin_action(v_admin, 'seo_page', p_id, 'update');
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_update_seo_page(
  uuid, text, text, text, text, smallint, boolean) to authenticated;

-- Yönetici panelinden yeniden üretim tetiklenebilsin.
create or replace function public.admin_refresh_seo_pages(p_min_venues smallint default 3)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.assert_admin();
  v_sonuc jsonb;
begin
  v_sonuc := public.refresh_seo_pages(p_min_venues);
  perform public.log_admin_action(v_admin, 'seo_page', v_admin, 'refresh', null, v_sonuc);
  return v_sonuc;
end;
$$;

grant execute on function public.admin_refresh_seo_pages(smallint) to authenticated;
