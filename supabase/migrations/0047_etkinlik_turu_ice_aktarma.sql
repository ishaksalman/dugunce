-- =============================================================================
-- Düğünce · 0047 · admin_create_venue: p_event_type_slugs
--
-- İçe aktarma hattı (dugun.com kazıması) hiçbir zaman etkinlik türü
-- taşımıyordu — ne kazıyıcı tipi (DugunComRecord) ne sürücü ekranının
-- şeması (aktarSchema) ne de bu fonksiyon böyle bir alan alıyordu. Sonuç:
-- içe aktarılan HER mekan `venue_event_types` boş açılıyordu. İki somut
-- zarar: (1) detay sayfasındaki "Düğün/Nişan/Kına" rozetleri hiç
-- görünmüyordu, (2) daha önemlisi — SEO landing sayfaları
-- (`/istanbul/dugun-mekanlari`) bir mekanı yalnızca `venue_event_types`
-- bağlıysa sayıyor (bkz. CLAUDE.md, en az 3 mekan eşiği); bağlı olmayan
-- mekanlar bu sayıma hiç girmiyordu.
--
-- `p_feature_slugs` ile BİREBİR aynı desen: yalnızca taksonomideki AKTİF
-- slug'lar yazılır, karşılığı olmayan sessizce atlanır — var olmayan bir
-- etkinlik türü uydurulmaz.
--
-- EN SON sürümden (0044) türetildi — tek değişiklik p_event_type_slugs.
-- =============================================================================

drop function if exists public.admin_create_venue(
  text, uuid, uuid, uuid, uuid, text, text, text, boolean, text, text,
  numeric, numeric, numeric, integer, text, text,
  integer, integer, numeric, numeric, text, text, boolean, boolean, text[], text);

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
  p_google_rating_count integer default null,
  p_source      text default null,
  p_source_url  text default null,
  p_min_capacity  integer default null,
  p_max_capacity  integer default null,
  p_starting_price numeric default null,
  p_price_max   numeric default null,
  p_price_type  text default null,
  p_price_note  text default null,
  p_has_indoor  boolean default null,
  p_has_outdoor boolean default null,
  p_feature_slugs text[] default null,
  p_instagram_url text default null,
  p_event_type_slugs text[] default null
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
  v_web   text := nullif(btrim(coalesce(p_website_url, '')), '');
  v_kurl  text := nullif(btrim(coalesce(p_source_url, '')), '');
  v_price_type public.price_type :=
    case when p_price_type in ('kisi_basi', 'paket', 'gunluk', 'belirtilmemis')
      then p_price_type::public.price_type
      else 'belirtilmemis'::public.price_type
    end;
  v_price_note text := nullif(left(btrim(coalesce(p_price_note, '')), 500), '');
  v_eklenen_ozellik integer := 0;
  v_eklenen_etkinlik integer := 0;
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

  -- Kaynak adresi force'un DIŞINDA (0039): aynı sayfanın iki kayıt
  -- üretmesi bir karar değil, veri hatası. `venues_source_url_uniq` zaten
  -- engelliyor; burada ham kısıt hatası yerine anlaşılır mesaj veriyoruz.
  if v_kurl is not null and exists (
    select 1 from public.venues v where v.source_url = v_kurl
  ) then
    raise exception 'Bu kaynak adresi zaten işlenmiş.'
      using errcode = 'unique_violation';
  end if;

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

    -- Aynı web sitesi: zayıf sinyal (zincir tek site kullanabiliyor) ama
    -- telefon yokken elimizde kalan tek şey olabiliyor.
    if v_web is not null then
      select v.name into v_ayni
        from public.venues v where v.website_url = v_web limit 1;
      if v_ayni is not null then
        raise exception 'Bu web sitesi başka bir kayıtta var: %', v_ayni
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
    address, contact_phone, website_url, instagram_url, status,
    google_place_id, google_maps_url, latitude, longitude,
    google_rating, google_rating_count, google_rating_at,
    source, source_url, source_last_checked,
    min_capacity, max_capacity, starting_price, price_max, price_type, price_note,
    has_indoor, has_outdoor)
  values (
    null, v_kategori, v_slug, btrim(p_name), p_city_id, p_district_id, p_venue_type_id,
    nullif(btrim(coalesce(p_address, '')), ''),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    nullif(btrim(coalesce(p_website_url, '')), ''),
    nullif(btrim(coalesce(p_instagram_url, '')), ''),
    'DRAFT',
    v_pid,
    nullif(btrim(coalesce(p_google_maps_url, '')), ''),
    p_latitude, p_longitude,
    p_google_rating, p_google_rating_count,
    case when p_google_rating is not null then now() end,
    nullif(btrim(coalesce(p_source, '')), ''), v_kurl,
    case when v_kurl is not null then now() end,
    p_min_capacity, p_max_capacity, p_starting_price, p_price_max, v_price_type, v_price_note,
    coalesce(p_has_indoor, false), coalesce(p_has_outdoor, false))
  returning id into v_id;

  if p_feature_slugs is not null and array_length(p_feature_slugs, 1) > 0 then
    insert into public.venue_features (venue_id, feature_id)
    select v_id, f.id
      from public.features f
     where f.slug = any(p_feature_slugs)
       and f.is_active
    on conflict (venue_id, feature_id) do nothing;
    get diagnostics v_eklenen_ozellik = row_count;
  end if;

  if p_event_type_slugs is not null and array_length(p_event_type_slugs, 1) > 0 then
    insert into public.venue_event_types (venue_id, event_type_id)
    select v_id, e.id
      from public.event_types e
     where e.slug = any(p_event_type_slugs)
       and e.is_active
    on conflict (venue_id, event_type_id) do nothing;
    get diagnostics v_eklenen_etkinlik = row_count;
  end if;

  perform public.log_admin_action(v_admin, 'venue', v_id, 'created:catalog',
    null, jsonb_build_object('slug', v_slug, 'force', coalesce(p_force, false),
                             'place_id', v_pid, 'feature_count', v_eklenen_ozellik,
                             'event_type_count', v_eklenen_etkinlik));

  return jsonb_build_object('id', v_id, 'slug', v_slug);
end;
$$;

grant execute on function public.admin_create_venue(
  text, uuid, uuid, uuid, uuid, text, text, text, boolean, text, text,
  numeric, numeric, numeric, integer, text, text,
  integer, integer, numeric, numeric, text, text, boolean, boolean, text[], text, text[]) to authenticated;
