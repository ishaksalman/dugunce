-- =============================================================================
-- Düğünce · 0028 · Katalogda mükerrer kayıt engeli
--
-- Operasyon şöyle yürüyor: yönetim Google Maps'te salonları geziyor, birini
-- seçip sisteme ekliyor. Bu akışta en olası hata AYNI SALONU İKİ KEZ eklemek.
--
-- 0025'teki davranış bunu görünmez kılıyordu: slug çakışınca sonuna sessizce
-- sayı ekleniyordu (bahce-davet, bahce-davet-2). Amaç zincir salonlardı ama
-- sonuç, kazara tekrar eklemenin hiçbir uyarı vermemesiydi.
--
-- Yeni kural: AYNI İLÇEDE aynı adlı kayıt varsa hata ver. Farklı ilçede
-- serbest — "Divan" üç ilçede olabilir, o gerçekten üç ayrı salon.
-- Kasıtlı ekleme için `p_force`.
-- =============================================================================

create or replace function public.admin_find_similar_venues(
  p_name    text,
  p_city_id uuid default null
)
returns table (
  id uuid, name text, district_name text, status public.venue_status,
  is_claimed boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text := public.slugify_tr(coalesce(p_name, ''));
begin
  perform public.assert_admin();
  if length(v_slug) < 3 then
    return;
  end if;
  return query
  select v.id, v.name, d.name, v.status, (v.owner_id is not null)
    from public.venues v
    join public.districts d on d.id = v.district_id
   where (p_city_id is null or v.city_id = p_city_id)
     -- İki yönlü içerme: "vadi" → "Vadi Kır Düğün Evi" de bulunur,
     -- "Vadi Kır Düğün Evi Beşiktaş" → "Vadi Kır Düğün Evi" de.
     and (public.slugify_tr(v.name) like '%' || v_slug || '%'
          or v_slug like '%' || public.slugify_tr(v.name) || '%')
   order by v.name
   limit 10;
end;
$$;

grant execute on function public.admin_find_similar_venues(text, uuid) to authenticated;

-- --- Kayıt açma: mükerrer kontrolü ------------------------------------------

create or replace function public.admin_create_venue(
  p_name        text,
  p_city_id     uuid,
  p_district_id uuid,
  p_category_id uuid default null,
  p_venue_type_id uuid default null,
  p_address     text default null,
  p_contact_phone text default null,
  p_website_url text default null,
  p_force       boolean default false
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

  -- AYNI İLÇEDE aynı ad: neredeyse her zaman kazara tekrar ekleme.
  if not coalesce(p_force, false) then
    select v.name into v_ayni
      from public.venues v
     where v.district_id = p_district_id
       and public.slugify_tr(v.name) = v_slug
     limit 1;
    if v_ayni is not null then
      raise exception 'Bu ilçede aynı adlı bir kayıt zaten var: %', v_ayni
        using errcode = 'unique_violation';
    end if;
  end if;

  -- Farklı ilçede aynı ad serbest (zincir salon); slug tekil olmak zorunda.
  while exists (select 1 from public.venues where slug =
                  v_slug || case when v_ek = 0 then '' else '-' || v_ek end) loop
    v_ek := v_ek + 1;
  end loop;
  v_slug := v_slug || case when v_ek = 0 then '' else '-' || v_ek end;

  -- owner_id AÇIKÇA null: sahiplenilmemiş katalog kaydı.
  insert into public.venues (
    owner_id, category_id, slug, name, city_id, district_id, venue_type_id,
    address, contact_phone, website_url, status)
  values (
    null, v_kategori, v_slug, btrim(p_name), p_city_id, p_district_id, p_venue_type_id,
    nullif(btrim(coalesce(p_address, '')), ''),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    nullif(btrim(coalesce(p_website_url, '')), ''),
    'DRAFT')
  returning id into v_id;

  perform public.log_admin_action(v_admin, 'venue', v_id, 'created:catalog',
    null, jsonb_build_object('slug', v_slug, 'force', coalesce(p_force, false)));

  return jsonb_build_object('id', v_id, 'slug', v_slug);
end;
$$;

grant execute on function public.admin_create_venue(
  text, uuid, uuid, uuid, uuid, text, text, text, boolean) to authenticated;

-- Eski 8 parametreli imza kalmasın; çağıranlar yenisini kullanıyor.
drop function if exists public.admin_create_venue(
  text, uuid, uuid, uuid, uuid, text, text, text);
