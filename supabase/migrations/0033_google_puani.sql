-- =============================================================================
-- Düğünce · 0033 · Google puanı (sayı olarak, metin değil)
--
-- Gösterilen: puan ve değerlendirme SAYISI. Gösterilmeyen: yorum METİNLERİ.
-- Sayı olgudur; yorum metni onu yazan kişinin eseridir ve telifi bizde değil.
--
-- ÜÇ KURAL:
--
-- 1. Bu puan bizim `rating_avg`'imize KARIŞMAZ. `aggregateRating`
--    yapılandırılmış verimiz yalnızca kendi onaylı yorumlarımızdan beslenir —
--    başkasının puanını kendi işaretlememizde göstermek Google'ın
--    yapılandırılmış veri politikasına aykırı ve manuel işlem sebebi.
--
-- 2. `google_rating_at` ZORUNLU. Google'ın önbellek kuralları verinin süresiz
--    saklanmasına izin vermiyor; bayat puanı güncelmiş gibi göstermek de
--    kullanıcıyı yanıltır. Vitrin bu tarihi yazıyor, eskiyince gizliyor.
--
-- 3. Kaynak her zaman AÇIKÇA "Google" diye etiketlenir.
-- =============================================================================

alter table public.venues
  add column if not exists google_rating numeric(2, 1)
    check (google_rating is null or google_rating between 0 and 5),
  add column if not exists google_rating_count integer
    check (google_rating_count is null or google_rating_count >= 0),
  add column if not exists google_rating_at timestamptz;

-- Puan varsa tarihi de olmak zorunda: "ne zamanki puan" sorusu cevapsız kalmasın.
alter table public.venues drop constraint if exists venues_google_rating_needs_date;
alter table public.venues
  add constraint venues_google_rating_needs_date
  check (google_rating is null or google_rating_at is not null);

comment on column public.venues.google_rating is
  'Google işletme puanı. Kendi rating_avg''imizle KARIŞTIRILMAZ ve '
  'aggregateRating yapılandırılmış verisine GİRMEZ.';
comment on column public.venues.google_rating_at is
  'Puanın okunduğu an. Vitrin bunu gösteriyor ve eskiyince puanı gizliyor.';

-- --- Kayıt açmada puan ------------------------------------------------------

create or replace function public.admin_create_venue(
  p_name        text,
  p_city_id     uuid,
  p_district_id uuid,
  p_category_id uuid default null,
  p_venue_type_id uuid default null,
  p_address     text default null,
  p_contact_phone text default null,
  p_website_url text default null,
  p_force       boolean default false,
  p_google_place_id text default null,
  p_google_maps_url text default null,
  p_latitude    numeric default null,
  p_longitude   numeric default null,
  p_google_rating numeric default null,
  p_google_rating_count integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.assert_admin();
  v_id    uuid;
  v_slug  text;
  v_kategori uuid := coalesce(
    p_category_id, (select id from public.business_categories where slug = 'mekan'));
  v_ek    integer := 0;
  v_ayni  text;
  v_tel   text := public.normalize_phone_tr(p_contact_phone);
  v_pid   text := nullif(btrim(coalesce(p_google_place_id, '')), '');
begin
  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'İşletme adı en az 2 karakter olmalı.' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.districts d
     where d.id = p_district_id and d.city_id = p_city_id
  ) then
    raise exception 'Seçilen ilçe bu şehre ait değil.' using errcode = 'foreign_key_violation';
  end if;

  v_slug := public.slugify_tr(p_name);

  if not coalesce(p_force, false) then
    if v_pid is not null then
      select v.name into v_ayni
        from public.venues v where v.google_place_id = v_pid limit 1;
      if v_ayni is not null then
        raise exception 'Bu Google kaydı zaten katalogda: %', v_ayni
          using errcode = 'unique_violation';
      end if;
    end if;

    select v.name into v_ayni
      from public.venues v
     where v.district_id = p_district_id
       and public.slugify_tr(v.name) = v_slug
     limit 1;
    if v_ayni is not null then
      raise exception 'Bu ilçede aynı adlı bir kayıt zaten var: %', v_ayni
        using errcode = 'unique_violation';
    end if;

    if v_tel is not null then
      select v.name into v_ayni
        from public.venues v where v.contact_phone_norm = v_tel limit 1;
      if v_ayni is not null then
        raise exception 'Bu telefon numarası başka bir kayıtta var: %', v_ayni
          using errcode = 'unique_violation';
      end if;
    end if;
  end if;

  while exists (select 1 from public.venues where slug =
                  v_slug || case when v_ek = 0 then '' else '-' || v_ek end) loop
    v_ek := v_ek + 1;
  end loop;
  v_slug := v_slug || case when v_ek = 0 then '' else '-' || v_ek end;

  insert into public.venues (
    owner_id, category_id, slug, name, city_id, district_id, venue_type_id,
    address, contact_phone, website_url, status,
    google_place_id, google_maps_url, latitude, longitude,
    google_rating, google_rating_count, google_rating_at)
  values (
    null, v_kategori, v_slug, btrim(p_name), p_city_id, p_district_id, p_venue_type_id,
    nullif(btrim(coalesce(p_address, '')), ''),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    nullif(btrim(coalesce(p_website_url, '')), ''),
    'DRAFT',
    v_pid,
    nullif(btrim(coalesce(p_google_maps_url, '')), ''),
    p_latitude, p_longitude,
    p_google_rating, p_google_rating_count,
    case when p_google_rating is not null then now() end)
  returning id into v_id;

  perform public.log_admin_action(v_admin, 'venue', v_id, 'created:catalog',
    null, jsonb_build_object('slug', v_slug, 'force', coalesce(p_force, false),
                             'place_id', v_pid));

  return jsonb_build_object('id', v_id, 'slug', v_slug);
end;
$$;

grant execute on function public.admin_create_venue(
  text, uuid, uuid, uuid, uuid, text, text, text, boolean, text, text,
  numeric, numeric, numeric, integer) to authenticated;

drop function if exists public.admin_create_venue(
  text, uuid, uuid, uuid, uuid, text, text, text, boolean, text, text, numeric, numeric);

-- --- Vitrine taşı -----------------------------------------------------------

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
      (v.owner_id is not null) as is_claimed,
      public.venue_auto_summary(v.id) as auto_summary,
      -- Google puanı: SAYI olarak, kaynağı ve okunduğu tarihle birlikte.
      -- Kendi rating_avg'imizle karıştırılmaz, aggregateRating'e girmez.
      v.google_rating, v.google_rating_count, v.google_rating_at,
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
