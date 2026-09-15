-- =============================================================================
-- Düğünce · 0022 · Google işletme bağlantısı
--
-- Kolonlar 0011'de açılmıştı ama hiçbir yerden okunmuyor/yazılmıyordu.
-- Burada iki şey yapıyoruz:
--   1. Adresin gerçekten Google'a gittiğini veritabanında garanti altına al.
--   2. Hem düzenleme hem vitrin görünümüne kolonu ekle.
--
-- Neden kısıt veritabanında: bu bağlantı herkese açık mekan sayfasında
-- <a href> olarak basılıyor. Mekan sahibi oraya istediği adresi yazabilseydi
-- vitrinimiz spam/oltalama yönlendirmesine dönerdi. Zod tarafındaki kontrol
-- kullanıcıya nazik hata vermek için; asıl kapı bu kısıt.
-- =============================================================================

-- Mevcut satırlarda veri yok (kolon hiç doldurulmadı), yine de temkinli ol.
update public.venues
   set google_maps_url = null
 where google_maps_url is not null
   and google_maps_url !~* '^https://((www\.)?google\.[a-z.]{2,6}/maps|maps\.google\.[a-z.]{2,6}/|maps\.app\.goo\.gl/|goo\.gl/maps/)';

alter table public.venues
  drop constraint if exists venues_google_maps_url_check;

alter table public.venues
  add constraint venues_google_maps_url_check check (
    google_maps_url is null
    or google_maps_url ~* '^https://((www\.)?google\.[a-z.]{2,6}/maps|maps\.google\.[a-z.]{2,6}/|maps\.app\.goo\.gl/|goo\.gl/maps/)'
  );

-- --- Düzenleme görünümü ------------------------------------------------------
create or replace function public.get_venue_for_edit(p_venue_id uuid)
returns jsonb
language sql
stable
as $$
  select to_jsonb(d) from (
    select
      v.id, v.slug, v.name, v.status, v.needs_review, v.completion_score,
      v.rejection_reason, v.published_at,
      v.city_id, v.district_id, v.venue_type_id,
      v.address, v.latitude, v.longitude, v.google_maps_url,
      v.short_description, v.description,
      v.min_capacity, v.max_capacity,
      v.starting_price, v.price_type, v.price_note,
      v.has_indoor, v.has_outdoor,
      v.contact_phone, v.contact_email, v.website_url, v.instagram_url,
      v.davetpro_business_id, v.davetpro_linked_at,

      jsonb_build_object('name', c.name, 'slug', c.slug) as city,
      jsonb_build_object('name', dt.name, 'slug', dt.slug) as district,

      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', i.id, 'url', i.url, 'storage_path', i.storage_path,
                 'alt', i.alt_text, 'is_cover', i.is_cover, 'sort_order', i.sort_order)
               order by i.is_cover desc, i.sort_order, i.created_at)
          from public.venue_images i where i.venue_id = v.id
      ), '[]'::jsonb) as images,

      -- Düzenleme ekranı slug değil ID ile çalışıyor: checkbox'lar id eşliyor.
      coalesce((
        select jsonb_agg(vf.feature_id)
          from public.venue_features vf where vf.venue_id = v.id
      ), '[]'::jsonb) as feature_ids,

      coalesce((
        select jsonb_agg(vet.event_type_id)
          from public.venue_event_types vet where vet.venue_id = v.id
      ), '[]'::jsonb) as event_type_ids

    from public.venues v
    join public.cities c     on c.id = v.city_id
    join public.districts dt on dt.id = v.district_id
    -- Sahiplik AÇIKÇA: RLS yayındaki mekanı herkese okutuyor, bu fonksiyon
    -- ise iletişim bilgisi ve taslak içeriği döndürüyor.
    where v.id = p_venue_id
      and (v.owner_id = auth.uid() or public.is_admin())
  ) d;
$$;

grant execute on function public.get_venue_for_edit(uuid) to authenticated;

-- --- Vitrin görünümü ---------------------------------------------------------
-- Tek fark: google_maps_url. Google PUANI ve yorum metni burada YOK ve
-- olmayacak; onlar Google'ın kendi sayfasında kalır (lisans ve tazelik).
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
      v.price_type,
      v.price_note,
      v.has_indoor,
      v.has_outdoor,
      v.contact_phone,
      v.contact_email,
      v.website_url,
      v.instagram_url,
      v.google_maps_url,
      v.rating_avg,
      v.rating_count,
      v.favorite_count,
      v.is_featured,
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
    -- Yayında olmayan mekan detay sayfasından görünmez. Mekan sahibinin
    -- önizlemesi ayrı bir yoldan gelecek (panel), bu genel sorgu değil.
    where v.slug = p_slug and v.status = 'PUBLISHED'
  ) d;
$$;

-- --- Yorumlar ---------------------------------------------------------------
-- Yalnızca onaylanmışlar. Yorum sahibinin adı gösteriliyor ama profil
-- tablosuna genel okuma yetkisi vermiyoruz; ad bu fonksiyondan geliyor.

create or replace function public.get_venue_reviews(
  p_venue_id uuid,
  p_limit    integer default 10,
  p_offset   integer default 0
)
returns table (
  id           uuid,
  rating       smallint,
  title        text,
  body         text,
  event_date   date,
  author_name  text,
  created_at   timestamptz,
  total_count  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    r.id, r.rating, r.title, r.body, r.event_date,
    -- Soyadı baş harfe indiriliyor: "Ayşe Yılmaz" → "Ayşe Y."
    case
      when position(' ' in btrim(p.full_name)) > 0
        then split_part(btrim(p.full_name), ' ', 1) || ' ' ||
             upper(left(split_part(btrim(p.full_name), ' ', 2), 1)) || '.'
      else btrim(p.full_name)
    end as author_name,
    r.created_at,
    count(*) over () as total_count
  from public.reviews r
  join public.profiles p on p.id = r.user_id
  join public.venues v on v.id = r.venue_id
  where r.venue_id = p_venue_id
    and r.status = 'APPROVED'
    and v.status = 'PUBLISHED'
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.get_venue_detail(text) to anon, authenticated;
