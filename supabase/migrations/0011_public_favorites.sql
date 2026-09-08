-- =============================================================================
-- DavetMekanı · 0011 · Üyeliksiz favoriler
--
-- Müşteri üyeliği MVP'den çıkarıldı: asıl huni (keşif → detay → teklif) baştan
-- sona anonim çalışıyor ve her hesap taşınması gereken bir yükümlülük.
-- Favoriler tarayıcıda (localStorage) tutuluyor; bu fonksiyon o listedeki
-- id'ler için kart verisini döndürüyor.
--
-- `favorites` tablosu ve `customer` rolü ŞEMADA KALIYOR — ileride hesaba
-- bağlı favori istenirse localStorage listesi oraya taşınacak.
-- =============================================================================

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
    v.is_featured,
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

grant execute on function public.get_venues_by_ids(uuid[]) to anon, authenticated;

-- --- Google işletme bağlantısı ---------------------------------------------
-- Kendi yorum sistemimiz yerine mekanın Google değerlendirmelerine
-- yönlendiriyoruz. Yalnızca yer kimliği saklanıyor; puan ve yorum metni
-- saklanmıyor (üçüncü taraf içeriğini önbelleğe almanın kendi kuralları var).
--
-- DİKKAT: Google puanı bizim `aggregateRating` yapılandırılmış verimize
-- ASLA girmez. O işaretleme kendi topladığımız değerlendirmeler için.

alter table public.venues
  add column if not exists google_place_id text,
  add column if not exists google_maps_url text;

comment on column public.venues.google_place_id is
  'Google Places yer kimliği. Saklanması serbest; puan/yorum metni saklanmaz.';
comment on column public.venues.google_maps_url is
  'Mekanın Google işletme sayfası. Detayda "Google yorumlarını oku" bağlantısı.';
