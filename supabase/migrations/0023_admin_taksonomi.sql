-- =============================================================================
-- DavetMekanı · 0023 · Taksonomi yönetimi
--
-- Şehir / ilçe / etkinlik türü / mekan türü / özellik listesi component içine
-- gömülmüyor, hepsi DB'den geliyor. Şimdiye kadar bu satırları değiştirmenin
-- tek yolu `supabase/seed/` düzenleyip migration yazmaktı.
--
-- İki tasarım kararı:
--
-- 1. SİLME YOK, `is_active = false` var. Etkinlik türü / özellik silmek
--    `venue_event_types` ve `venue_features` üzerinden cascade ediyor —
--    mekan sahibinin girdiği veriyi sessizce yok eder. Pasif satır vitrinde
--    görünmüyor, mevcut bağlar duruyor, karar geri alınabiliyor.
--
-- 2. SLUG OLUŞTURDUKTAN SONRA DEĞİŞMEZ. Etkinlik türü slug'ı SEO landing
--    adreslerinin (`/istanbul-dugun-mekanlari`) parçası; özellik slug'ı ise
--    `venues.feature_slugs` okuma kopyasında duruyor. Değiştirmek gelen
--    bağlantıları kırar ve kopyaları bayatlatır.
--
-- İlçelerde `is_active` kolonu yok: ilçe eklenebiliyor, adı düzeltilebiliyor,
-- kaldırılamıyor. Mekan bir ilçeye bağlı ve ilçeyi silmek mekanı götürür.
-- =============================================================================

create or replace function public.admin_list_taxonomy()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();
  return jsonb_build_object(
    'event_types', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'name', e.name, 'slug', e.slug,
               'seo_noun', e.seo_noun, 'icon', e.icon,
               'sort_order', e.sort_order, 'is_active', e.is_active,
               'venue_count', (select count(*) from public.venue_event_types vet
                                where vet.event_type_id = e.id))
             order by e.sort_order, e.name)
        from public.event_types e), '[]'::jsonb),

    'venue_types', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'name', t.name, 'slug', t.slug,
               'sort_order', t.sort_order, 'is_active', t.is_active,
               'venue_count', (select count(*) from public.venues v
                                where v.venue_type_id = t.id))
             order by t.sort_order, t.name)
        from public.venue_types t), '[]'::jsonb),

    'features', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'kind', f.kind, 'group_name', f.group_name,
               'name', f.name, 'slug', f.slug, 'icon', f.icon,
               'is_filter', f.is_filter, 'sort_order', f.sort_order,
               'is_active', f.is_active,
               'venue_count', (select count(*) from public.venue_features vf
                                where vf.feature_id = f.id))
             order by f.kind, f.group_name, f.sort_order, f.name)
        from public.features f), '[]'::jsonb),

    'cities', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'slug', c.slug,
               'plate_code', c.plate_code, 'is_popular', c.is_popular,
               'venue_count', c.venue_count,
               'district_count', (select count(*) from public.districts d
                                   where d.city_id = c.id))
             order by c.plate_code)
        from public.cities c), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.admin_list_taxonomy() to authenticated;

-- --- İlçeler (şehre göre, ayrı çağrı: 423 satır listeyi şişiriyor) -----------

create or replace function public.admin_list_districts(p_city_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', d.id, 'name', d.name, 'slug', d.slug,
             'venue_count', d.venue_count)
           order by d.name)
      from public.districts d where d.city_id = p_city_id), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_list_districts(uuid) to authenticated;

-- --- Etkinlik türü ----------------------------------------------------------

create or replace function public.admin_upsert_event_type(
  p_id         uuid,
  p_name       text,
  p_seo_noun   text,
  p_icon       text default null,
  p_sort_order integer default 0,
  p_is_active  boolean default true
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
begin
  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Ad en az 2 karakter olmalı.' using errcode = 'check_violation';
  end if;
  -- seo_noun cümle içinde geçiyor ("İstanbul'da düğün için…"); küçük harf
  -- saklanıyor, başlıkta tr_capitalize() büyütüyor. Ters yön İ→i sorunu üretir.
  if length(btrim(coalesce(p_seo_noun, ''))) < 2 then
    raise exception 'SEO adı en az 2 karakter olmalı.' using errcode = 'check_violation';
  end if;

  if p_id is null then
    v_slug := public.slugify_tr(p_name);
    insert into public.event_types (name, slug, seo_noun, icon, sort_order, is_active)
    values (btrim(p_name), v_slug, lower(btrim(p_seo_noun)),
            nullif(btrim(coalesce(p_icon, '')), ''), p_sort_order, p_is_active)
    returning id into v_id;
    perform public.log_admin_action(v_admin, 'event_type', v_id, 'created',
      null, jsonb_build_object('slug', v_slug));
  else
    -- Slug'a DOKUNMUYORUZ: SEO landing adresleri ondan türüyor.
    update public.event_types
       set name       = btrim(p_name),
           seo_noun   = lower(btrim(p_seo_noun)),
           icon       = nullif(btrim(coalesce(p_icon, '')), ''),
           sort_order = p_sort_order,
           is_active  = p_is_active,
           updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Etkinlik türü bulunamadı.' using errcode = 'no_data_found';
    end if;
    perform public.log_admin_action(v_admin, 'event_type', v_id, 'updated',
      null, jsonb_build_object('is_active', p_is_active));
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

grant execute on function public.admin_upsert_event_type(uuid, text, text, text, integer, boolean)
  to authenticated;

-- --- Mekan türü -------------------------------------------------------------

create or replace function public.admin_upsert_venue_type(
  p_id         uuid,
  p_name       text,
  p_sort_order integer default 0,
  p_is_active  boolean default true
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
begin
  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Ad en az 2 karakter olmalı.' using errcode = 'check_violation';
  end if;

  if p_id is null then
    v_slug := public.slugify_tr(p_name);
    insert into public.venue_types (name, slug, sort_order, is_active)
    values (btrim(p_name), v_slug, p_sort_order, p_is_active)
    returning id into v_id;
    perform public.log_admin_action(v_admin, 'venue_type', v_id, 'created',
      null, jsonb_build_object('slug', v_slug));
  else
    update public.venue_types
       set name = btrim(p_name), sort_order = p_sort_order,
           is_active = p_is_active, updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Mekan türü bulunamadı.' using errcode = 'no_data_found';
    end if;
    perform public.log_admin_action(v_admin, 'venue_type', v_id, 'updated',
      null, jsonb_build_object('is_active', p_is_active));
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

grant execute on function public.admin_upsert_venue_type(uuid, text, integer, boolean)
  to authenticated;

-- --- Özellik / hizmet -------------------------------------------------------

create or replace function public.admin_upsert_feature(
  p_id         uuid,
  p_kind       public.feature_kind,
  p_group_name text,
  p_name       text,
  p_icon       text default null,
  p_is_filter  boolean default true,
  p_sort_order integer default 0,
  p_is_active  boolean default true
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
begin
  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Ad en az 2 karakter olmalı.' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(p_group_name, ''))) < 2 then
    raise exception 'Grup adı en az 2 karakter olmalı.' using errcode = 'check_violation';
  end if;

  if p_id is null then
    v_slug := public.slugify_tr(p_name);
    insert into public.features (kind, group_name, name, slug, icon, is_filter, sort_order, is_active)
    values (p_kind, btrim(p_group_name), btrim(p_name), v_slug,
            nullif(btrim(coalesce(p_icon, '')), ''), p_is_filter, p_sort_order, p_is_active)
    returning id into v_id;
    perform public.log_admin_action(v_admin, 'feature', v_id, 'created',
      null, jsonb_build_object('slug', v_slug, 'kind', p_kind));
  else
    -- Slug sabit: `venues.feature_slugs` okuma kopyası ona göre yazılıyor.
    update public.features
       set kind = p_kind, group_name = btrim(p_group_name), name = btrim(p_name),
           icon = nullif(btrim(coalesce(p_icon, '')), ''),
           is_filter = p_is_filter, sort_order = p_sort_order,
           is_active = p_is_active, updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Özellik bulunamadı.' using errcode = 'no_data_found';
    end if;
    perform public.log_admin_action(v_admin, 'feature', v_id, 'updated',
      null, jsonb_build_object('is_active', p_is_active));
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

grant execute on function public.admin_upsert_feature(uuid, public.feature_kind, text, text, text, boolean, integer, boolean)
  to authenticated;

-- --- Şehir: yalnızca "popüler" bayrağı ve sıra -------------------------------
-- Şehir adı/plaka/slug değişmez; 81 il sabit ve slug'lar SEO adreslerinde.

create or replace function public.admin_set_city_popular(
  p_city_id uuid,
  p_popular boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.assert_admin();
  v_id    uuid;
begin
  update public.cities
     set is_popular = p_popular, updated_at = now()
   where id = p_city_id
  returning id into v_id;
  if v_id is null then
    raise exception 'Şehir bulunamadı.' using errcode = 'no_data_found';
  end if;

  perform public.log_admin_action(v_admin, 'city', v_id,
    case when p_popular then 'popular:on' else 'popular:off' end);
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_set_city_popular(uuid, boolean) to authenticated;

-- --- İlçe: ekle / adını düzelt ----------------------------------------------

create or replace function public.admin_upsert_district(
  p_id      uuid,
  p_city_id uuid,
  p_name    text
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
begin
  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Ad en az 2 karakter olmalı.' using errcode = 'check_violation';
  end if;

  if p_id is null then
    if not exists (select 1 from public.cities where id = p_city_id) then
      raise exception 'Şehir bulunamadı.' using errcode = 'no_data_found';
    end if;
    v_slug := public.slugify_tr(p_name);
    insert into public.districts (city_id, name, slug)
    values (p_city_id, btrim(p_name), v_slug)
    returning id into v_id;
    perform public.log_admin_action(v_admin, 'district', v_id, 'created',
      null, jsonb_build_object('slug', v_slug, 'city_id', p_city_id));
  else
    -- Şehir değişmiyor: ilçeyi başka ile taşımak ona bağlı mekanların
    -- adresini ve `venues` bileşik FK'sını bozar.
    update public.districts
       set name = btrim(p_name), updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'İlçe bulunamadı.' using errcode = 'no_data_found';
    end if;
    perform public.log_admin_action(v_admin, 'district', v_id, 'renamed');
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

grant execute on function public.admin_upsert_district(uuid, uuid, text) to authenticated;
