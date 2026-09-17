-- =============================================================================
-- Düğünce · 0032 · Google Place ID ile mükerrer engeli
--
-- 0028 adı, 0029 telefonu karşılaştırıyor. İkisi de dolaylı sinyal: ad farklı
-- yazılabilir, telefon paylaşılabilir ya da boş olabilir.
--
-- `placeId` (ChIJ…) işletmenin Google'daki KANONİK kimliği. Aynı işletme iki
-- kez girilirse placeId birebir aynı olur. Üstelik Google'ın şartları
-- place_id'yi süresiz saklamaya AÇIKÇA izin veriyor — diğer alanların aksine.
--
-- Kolon 0011'de açılmıştı ve bugüne kadar hiç yazılmadı.
--
-- Kısıt değil KONTROL: `p_force` ile geçilebiliyor. Google'da iki ayrı kayıt
-- olan ama bizde tek olması gereken (ya da tersi) durumlar var.
-- =============================================================================

-- Aynı placeId iki kayda yazılamasın. Kısmi: çoğu kayıtta bu alan boş.
create unique index if not exists venues_google_place_id_uniq
  on public.venues (google_place_id) where google_place_id is not null;

comment on column public.venues.google_place_id is
  'Google Places kanonik kimliği (ChIJ…). Mükerrer kontrolünün en güçlü '
  'sinyali. Google şartları bu alanı süresiz saklamaya izin veriyor; '
  'puan, yorum ve fotoğraf için AYNI ŞEY GEÇERLİ DEĞİL.';

-- --- Benzer kayıt aramasına placeId ekle ------------------------------------

drop function if exists public.admin_find_similar_venues(text, uuid, text);

create or replace function public.admin_find_similar_venues(
  p_name     text,
  p_city_id  uuid  default null,
  p_phone    text  default null,
  p_place_id text  default null
)
returns table (
  id uuid, name text, district_name text, status public.venue_status,
  is_claimed boolean, eslesme text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug  text := public.slugify_tr(coalesce(p_name, ''));
  v_tel   text := public.normalize_phone_tr(p_phone);
  v_pid   text := nullif(btrim(coalesce(p_place_id, '')), '');
begin
  perform public.assert_admin();
  if length(v_slug) < 3 and v_tel is null and v_pid is null then
    return;
  end if;

  return query
  select v.id, v.name, d.name, v.status, (v.owner_id is not null),
         case
           when v_pid is not null and v.google_place_id = v_pid then 'place_id'
           when v_tel is not null and v.contact_phone_norm = v_tel then 'telefon'
           else 'ad'
         end
    from public.venues v
    join public.districts d on d.id = v.district_id
   where
     (v_pid is not null and v.google_place_id = v_pid)
     or (v_tel is not null and v.contact_phone_norm = v_tel)
     or (
       length(v_slug) >= 3
       and (p_city_id is null or v.city_id = p_city_id)
       and (public.slugify_tr(v.name) like '%' || v_slug || '%'
            or v_slug like '%' || public.slugify_tr(v.name) || '%')
     )
   order by
     -- En güçlü sinyal başta: place_id > telefon > ad.
     (case when v_pid is not null and v.google_place_id = v_pid then 0
           when v_tel is not null and v.contact_phone_norm = v_tel then 1
           else 2 end),
     v.name
   limit 10;
end;
$$;

grant execute on function public.admin_find_similar_venues(text, uuid, text, text)
  to authenticated;

-- --- Kayıt açmada placeId --------------------------------------------------

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
  p_longitude   numeric default null
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
  end if;

  while exists (select 1 from public.venues where slug =
                  v_slug || case when v_ek = 0 then '' else '-' || v_ek end) loop
    v_ek := v_ek + 1;
  end loop;
  v_slug := v_slug || case when v_ek = 0 then '' else '-' || v_ek end;

  insert into public.venues (
    owner_id, category_id, slug, name, city_id, district_id, venue_type_id,
    address, contact_phone, website_url, status,
    google_place_id, google_maps_url, latitude, longitude)
  values (
    null, v_kategori, v_slug, btrim(p_name), p_city_id, p_district_id, p_venue_type_id,
    nullif(btrim(coalesce(p_address, '')), ''),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    nullif(btrim(coalesce(p_website_url, '')), ''),
    'DRAFT',
    v_pid,
    nullif(btrim(coalesce(p_google_maps_url, '')), ''),
    p_latitude, p_longitude)
  returning id into v_id;

  perform public.log_admin_action(v_admin, 'venue', v_id, 'created:catalog',
    null, jsonb_build_object('slug', v_slug, 'force', coalesce(p_force, false),
                             'place_id', v_pid));

  return jsonb_build_object('id', v_id, 'slug', v_slug);
end;
$$;

grant execute on function public.admin_create_venue(
  text, uuid, uuid, uuid, uuid, text, text, text, boolean, text, text, numeric, numeric)
  to authenticated;

drop function if exists public.admin_create_venue(
  text, uuid, uuid, uuid, uuid, text, text, text, boolean);
