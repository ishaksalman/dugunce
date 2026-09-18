-- =============================================================================
-- Düğünce · 0037 · Mükerrer kontrolüne web sitesi ve kaynak adresi
--
-- Sinyaller güçlüden zayıfa: kaynak adresi → place_id → ad+ilçe → telefon
-- → web sitesi. İlki hariç hepsi `p_force` ile geçilebiliyor.
--
-- Kaynak adresi force ile de geçilmiyor: aynı sayfayı iki kez işlemek bir
-- KARAR değil, bir hatadır. Zincir salonların aynı telefonu paylaşması
-- gerçek bir durum; aynı kaynak sayfasının iki kayıt üretmesi değil.
-- =============================================================================

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
  p_source      text default null,
  p_source_url  text default null
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
    -- 0) Kaynak adresi — aynı sayfayı iki kez işlemenin kesin işareti.
    --    force ile bile geçilmiyor: bu bir veri hatası, karar değil.
    if v_kurl is not null and exists (
      select 1 from public.venues v where v.source_url = v_kurl
    ) then
      raise exception 'Bu kaynak adresi zaten işlenmiş.'
        using errcode = 'unique_violation';
    end if;

    -- 1) Google Place ID — en güçlü sinyal, şehir/ilçeden bağımsız.
    if v_pid is not null then
      select v.name into v_ayni
        from public.venues v where v.google_place_id = v_pid limit 1;
      if v_ayni is not null then
        raise exception 'Bu Google kaydı zaten katalogda: %', v_ayni
          using errcode = 'unique_violation';
      end if;
    end if;

    -- 2) Aynı ilçede aynı ad.
    select v.name into v_ayni
      from public.venues v
     where v.district_id = p_district_id
       and public.slugify_tr(v.name) = v_slug
     limit 1;
    if v_ayni is not null then
      raise exception 'Bu ilçede aynı adlı bir kayıt zaten var: %', v_ayni
        using errcode = 'unique_violation';
    end if;

    -- 3) Aynı telefon (ülke genelinde).
    if v_tel is not null then
      select v.name into v_ayni
        from public.venues v where v.contact_phone_norm = v_tel limit 1;
      if v_ayni is not null then
        raise exception 'Bu telefon numarası başka bir kayıtta var: %', v_ayni
          using errcode = 'unique_violation';
      end if;
    end if;

    -- 4) Aynı web sitesi. Zayıf sinyal (zincirler tek site kullanabiliyor)
    --    ama telefon yokken tek elimizde kalan olabiliyor.
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
    address, contact_phone, website_url, status,
    google_place_id, google_maps_url, latitude, longitude,
    source, source_url, source_last_checked)
  values (
    null, v_kategori, v_slug, btrim(p_name), p_city_id, p_district_id, p_venue_type_id,
    nullif(btrim(coalesce(p_address, '')), ''),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    nullif(btrim(coalesce(p_website_url, '')), ''),
    'DRAFT',
    v_pid,
    nullif(btrim(coalesce(p_google_maps_url, '')), ''),
    p_latitude, p_longitude,
    nullif(btrim(coalesce(p_source, '')), ''), v_kurl,
    case when v_kurl is not null then now() end)
  returning id into v_id;

  perform public.log_admin_action(v_admin, 'venue', v_id, 'created:catalog',
    null, jsonb_build_object('slug', v_slug, 'force', coalesce(p_force, false),
                             'place_id', v_pid));

  return jsonb_build_object('id', v_id, 'slug', v_slug);
end;
$$;

grant execute on function public.admin_create_venue(
  text, uuid, uuid, uuid, uuid, text, text, text, boolean, text, text,
  numeric, numeric, text, text) to authenticated;

drop function if exists public.admin_create_venue(
  text, uuid, uuid, uuid, uuid, text, text, text, boolean, text, text,
  numeric, numeric);
