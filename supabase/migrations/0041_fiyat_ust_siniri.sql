-- =============================================================================
-- Düğünce · 0041 · get_venue_detail: price_max vitrine çıkıyor
--
-- 0040 `venues.price_max` kolonunu ekledi (katalog kaynağı çoğu zaman tekil
-- fiyat değil ARALIK veriyor). Bu dosya EN SON sürümden (0034) türetilip
-- yalnızca `v.price_max`'ı select listesine ekliyor — başka hiçbir şey
-- değişmiyor.
-- =============================================================================

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
      v.contact_email,
      v.website_url,
      v.instagram_url,
      v.google_maps_url,
      (v.owner_id is not null) as is_claimed,
      public.venue_auto_summary(v.id) as auto_summary,
      -- Google puanı: SAYI olarak, kaynağı ve okunduğu tarihle birlikte.
      -- Kendi rating_avg'imizle karıştırılmaz, aggregateRating'e girmez.
      -- Bayat puan HİÇ dışarı verilmiyor: tazelik kararı burada, çünkü
      -- sayfa prerender ediliyor ve bileşende now() okumak build anında
      -- donuyordu.
      case when public.venue_google_rating_fresh(v.google_rating_at)
           then v.google_rating end as google_rating,
      case when public.venue_google_rating_fresh(v.google_rating_at)
           then v.google_rating_count end as google_rating_count,
      case when public.venue_google_rating_fresh(v.google_rating_at)
           then v.google_rating_at end as google_rating_at,
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

grant execute on function public.get_venue_detail(text) to anon, authenticated;
