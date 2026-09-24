-- =============================================================================
-- Düğünce · 0043 · "Öne çıkan" süresi GERÇEKTEN sona eriyor
--
-- `featured_until` 0001'den beri şemada duruyordu ama HİÇBİR YERDE
-- okunmuyordu — admin "30 gün öne çıkar" dediğinde tarih yazılıyordu, ama
-- ne arama sıralaması ne de "Öne Çıkan" rozeti bu tarihe bakıyordu.
-- Sonuç: süre bitince mekan sonsuza kadar öne çıkmış kalıyordu, admin elle
-- kaldırmadıkça. Bunu ücretli bir ürün olarak satmadan önce düzeltilmesi
-- gereken bir hataydı — aksi hâlde "1 aylık öne çıkarma" satıp süresiz
-- vermiş oluyorduk.
--
-- Çözüm `venue_google_rating_fresh()` (0034) ile AYNI desen: tazelik/geçerlilik
-- kararı SQL'de, okuma anında `now()` ile — cron/scheduled job gerekmiyor.
-- `featured_until` NULL ise (admin süre vermeden öne çıkardıysa) süresiz
-- kabul ediliyor; yalnızca geçmiş bir tarih varsa etkisiz sayılıyor.
--
-- `is_featured` HAM kolonu admin tarafında (admin_list_venues) hâlâ olduğu
-- gibi kalıyor — admin "ben bunu açmıştım" bilgisini kaybetmemeli, arayüz
-- `featured_until` ile "süresi doldu" rozetini kendi hesaplıyor. Yalnızca
-- HERKESE AÇIK yüzeylerde (arama, favoriler, mekan detayı) etkin/geçerli
-- değer dönüyor.
-- =============================================================================

create or replace function public.venue_featured_active(
  p_is_featured boolean,
  p_featured_until timestamptz
)
returns boolean
language sql
stable
as $$
  select coalesce(p_is_featured, false)
     and (p_featured_until is null or p_featured_until > now());
$$;

grant execute on function public.venue_featured_active(boolean, timestamptz)
  to anon, authenticated;

-- --- Arama: sıralama VE dönen rozet değeri etkin duruma göre -----------------
-- EN SON sürümden (0002) türetildi, tek değişiklik is_featured'ın nasıl
-- hesaplandığı.

create or replace function public.search_venues(
  p_city_slug       text    default null,
  p_district_slug   text    default null,
  p_event_type_slug text    default null,
  p_venue_type_slug text    default null,
  p_guest_count     integer default null,
  p_min_capacity    integer default null,
  p_max_capacity    integer default null,
  p_min_price       numeric default null,
  p_max_price       numeric default null,
  p_has_indoor      boolean default null,
  p_has_outdoor     boolean default null,
  p_feature_slugs   text[]  default null,
  p_query           text    default null,
  p_sort            text    default 'onerilen',
  p_limit           integer default 24,
  p_offset          integer default 0
)
returns table (
  id                uuid,
  slug              text,
  name              text,
  city_name         text,
  city_slug         text,
  district_name     text,
  district_slug     text,
  venue_type_name   text,
  min_capacity      integer,
  max_capacity      integer,
  starting_price    numeric,
  price_type        public.price_type,
  rating_avg        numeric,
  rating_count      integer,
  is_featured       boolean,
  cover_url         text,
  cover_blur        text,
  feature_slugs     text[],
  total_count       bigint
)
language sql
stable
as $$
  select
    v.id, v.slug, v.name,
    c.name, c.slug,
    d.name, d.slug,
    vt.name,
    v.min_capacity, v.max_capacity,
    v.starting_price, v.price_type,
    v.rating_avg, v.rating_count,
    public.venue_featured_active(v.is_featured, v.featured_until),
    img.url, img.blur_data_url,
    v.feature_slugs,
    count(*) over () as total_count
  from public.venues v
  join public.cities c    on c.id = v.city_id
  join public.districts d on d.id = v.district_id
  left join public.venue_types vt on vt.id = v.venue_type_id
  left join lateral (
    select i.url, i.blur_data_url
      from public.venue_images i
     where i.venue_id = v.id
     order by i.is_cover desc, i.sort_order, i.created_at
     limit 1
  ) img on true
  where v.status = 'PUBLISHED'
    and (p_city_slug       is null or c.slug = p_city_slug)
    and (p_district_slug   is null or d.slug = p_district_slug)
    and (p_venue_type_slug is null or vt.slug = p_venue_type_slug)
    and (p_event_type_slug is null or v.event_type_slugs @> array[p_event_type_slug])
    and (p_feature_slugs   is null or v.feature_slugs @> p_feature_slugs)
    -- "150 kişilik etkinlik" → mekanın aralığı bu sayıyı kapsamalı.
    and (p_guest_count is null
         or (coalesce(v.min_capacity, 0) <= p_guest_count
             and coalesce(v.max_capacity, 2147483647) >= p_guest_count))
    -- Kapasite aralığı filtresi: mekanın aralığıyla kesişim aranır.
    and (p_min_capacity is null or coalesce(v.max_capacity, 2147483647) >= p_min_capacity)
    and (p_max_capacity is null or coalesce(v.min_capacity, 0) <= p_max_capacity)
    and (p_min_price is null or v.starting_price >= p_min_price)
    and (p_max_price is null or v.starting_price <= p_max_price)
    and (p_has_indoor  is null or v.has_indoor  = p_has_indoor)
    and (p_has_outdoor is null or v.has_outdoor = p_has_outdoor)
    and (p_query is null or btrim(p_query) = '' or
         public.slugify_tr(v.name) like '%' || public.slugify_tr(p_query) || '%')
  order by
    case when p_sort = 'onerilen' then
      public.venue_featured_active(v.is_featured, v.featured_until)::int
    end desc nulls last,
    case when p_sort = 'onerilen'          then v.rating_avg          end desc nulls last,
    case when p_sort = 'onerilen'          then v.view_count          end desc nulls last,
    case when p_sort = 'cok-goruntulenen'  then v.view_count          end desc nulls last,
    case when p_sort = 'cok-favorilenen'   then v.favorite_count      end desc nulls last,
    case when p_sort = 'fiyat-artan'       then v.starting_price      end asc  nulls last,
    case when p_sort = 'fiyat-azalan'      then v.starting_price      end desc nulls last,
    case when p_sort = 'yeni'              then v.published_at        end desc nulls last,
    -- Sayfalama kaymasın diye kararlı son anahtar.
    v.id
  limit  greatest(1, least(coalesce(p_limit, 24), 48))
  offset greatest(0, coalesce(p_offset, 0));
$$;

-- --- Favoriler: aynı düzeltme --------------------------------------------
-- EN SON sürümden (0011) türetildi.

create or replace function public.get_venues_by_ids(p_ids uuid[])
returns table (
  id                uuid,
  slug              text,
  name              text,
  city_name         text,
  city_slug         text,
  district_name     text,
  district_slug     text,
  venue_type_name   text,
  min_capacity      integer,
  max_capacity      integer,
  starting_price    numeric,
  price_type        public.price_type,
  rating_avg        numeric,
  rating_count      integer,
  is_featured       boolean,
  cover_url         text,
  cover_blur        text,
  feature_slugs     text[],
  total_count       bigint
)
language sql
stable
as $$
  select
    v.id, v.slug, v.name,
    c.name, c.slug,
    d.name, d.slug,
    vt.name,
    v.min_capacity, v.max_capacity,
    v.starting_price, v.price_type,
    v.rating_avg, v.rating_count,
    public.venue_featured_active(v.is_featured, v.featured_until),
    img.url, img.blur_data_url,
    v.feature_slugs,
    count(*) over () as total_count
  from public.venues v
  join public.cities c    on c.id = v.city_id
  join public.districts d on d.id = v.district_id
  left join public.venue_types vt on vt.id = v.venue_type_id
  left join lateral (
    select i.url, i.blur_data_url
      from public.venue_images i
     where i.venue_id = v.id
     order by i.is_cover desc, i.sort_order, i.created_at
     limit 1
  ) img on true
  -- Yayından kalkmış bir mekan favorilerde görünmemeli.
  where v.status = 'PUBLISHED'
    and v.id = any (coalesce(p_ids, '{}'))
  -- Sıra istemciden gelen listeye göre: kullanıcı en son eklediğini üstte görsün.
  order by array_position(p_ids, v.id)
  limit 200;
$$;

-- --- Mekan detayı: aynı düzeltme -------------------------------------------
-- EN SON sürümden (0042) türetildi, yalnızca is_featured hesaplanışı değişti.

create or replace function public.get_venue_detail(p_slug text)
returns jsonb
language sql
stable
as $$
  select to_jsonb(d) from (
    select
      v.id,
      v.slug,
      v.name,
      v.address,
      v.latitude,
      v.longitude,
      v.short_description,
      v.description,
      v.min_capacity,
      v.max_capacity,
      v.starting_price,
      v.price_max,
      v.price_type,
      v.price_note,
      v.has_indoor,
      v.has_outdoor,
      v.contact_phone,
      v.contact_phone_norm,
      v.contact_email,
      v.website_url,
      v.instagram_url,
      v.google_maps_url,
      (v.owner_id is not null) as is_claimed,
      public.venue_auto_summary(v.id) as auto_summary,
      case when public.venue_google_rating_fresh(v.google_rating_at)
           then v.google_rating end as google_rating,
      case when public.venue_google_rating_fresh(v.google_rating_at)
           then v.google_rating_count end as google_rating_count,
      case when public.venue_google_rating_fresh(v.google_rating_at)
           then v.google_rating_at end as google_rating_at,
      v.rating_avg,
      v.rating_count,
      v.favorite_count,
      public.venue_featured_active(v.is_featured, v.featured_until) as is_featured,
      v.published_at,
      v.updated_at,

      jsonb_build_object('name', c.name, 'slug', c.slug) as city,
      jsonb_build_object('name', dt.name, 'slug', dt.slug) as district,
      case when vt.id is null then null
           else jsonb_build_object('name', vt.name, 'slug', vt.slug) end as venue_type,

      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', i.id, 'url', i.url, 'alt', i.alt_text,
                 'width', i.width, 'height', i.height, 'blur', i.blur_data_url)
               order by i.is_cover desc, i.sort_order, i.created_at)
          from public.venue_images i where i.venue_id = v.id
      ), '[]'::jsonb) as images,

      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'kind', f.kind, 'group', f.group_name, 'name', f.name,
                 'slug', f.slug, 'icon', f.icon, 'note', vf.note)
               order by f.sort_order)
          from public.venue_features vf
          join public.features f on f.id = vf.feature_id
         where vf.venue_id = v.id and f.is_active
      ), '[]'::jsonb) as features,

      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'name', e.name, 'slug', e.slug, 'seo_noun', e.seo_noun)
               order by e.sort_order)
          from public.venue_event_types vet
          join public.event_types e on e.id = vet.event_type_id
         where vet.venue_id = v.id and e.is_active
      ), '[]'::jsonb) as event_types

    from public.venues v
    join public.cities c     on c.id = v.city_id
    join public.districts dt on dt.id = v.district_id
    left join public.venue_types vt on vt.id = v.venue_type_id
    where v.slug = p_slug and v.status = 'PUBLISHED'
  ) d;
$$;

grant execute on function public.get_venue_detail(text) to anon, authenticated;

-- --- Yönetim listesi: etkinlik durumunu HESAPLANMIŞ döndür -------------------
-- Arayüz "süresi doldu mu" diye `Date.now()` ile hesaplıyordu — React'in saf
-- render kuralına aykırı (lint yakaladı, tıpkı google_rating_fresh'te
-- olduğu gibi, bkz. 0034). Karar burada, sorgu anında `now()` ile.
-- `is_featured` HAM kolon olarak kalıyor (admin "ben açmıştım" bilgisini
-- kaybetmesin); `featured_active` yeni, hesaplanmış alan.
--
-- EN SON sürümden (0035) türetildi. RETURNS TABLE'a kolon eklemek
-- `create or replace` ile olmuyor (dönüş tipi değişiyor) — önce düşürülüyor.

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
  owner_name text, owner_email text, is_claimed boolean,
  cover_url text, view_count integer, inquiry_count integer,
  is_featured boolean, featured_until timestamptz, featured_active boolean,
  rejection_reason text, published_at timestamptz,
  created_at timestamptz, updated_at timestamptz,
  can_delete boolean,
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
    p.full_name, u.email::text, (v.owner_id is not null),
    (select i.url from public.venue_images i where i.venue_id = v.id
      order by i.is_cover desc, i.sort_order limit 1),
    v.view_count, v.inquiry_count, v.is_featured, v.featured_until,
    public.venue_featured_active(v.is_featured, v.featured_until),
    v.rejection_reason, v.published_at, v.created_at, v.updated_at,
    (v.owner_id is null
      and v.published_at is null
      and not exists (select 1 from public.inquiries q where q.venue_id = v.id)
      and not exists (select 1 from public.reviews r where r.venue_id = v.id)),
    count(*) over ()
  from public.venues v
  join public.cities c    on c.id = v.city_id
  join public.districts d on d.id = v.district_id
  left join public.profiles p on p.id = v.owner_id
  left join auth.users u  on u.id = v.owner_id
  where (p_status is null or v.status = p_status)
    and (p_needs_review is null or v.needs_review = p_needs_review)
    and (p_query is null or btrim(p_query) = '' or
         public.slugify_tr(v.name) like '%' || public.slugify_tr(p_query) || '%' or
         public.slugify_tr(coalesce(p.full_name, '')) like '%' || public.slugify_tr(p_query) || '%')
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
