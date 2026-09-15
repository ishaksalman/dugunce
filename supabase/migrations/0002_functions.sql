-- =============================================================================
-- Düğünce · 0002 · Fonksiyonlar ve trigger'lar
--
--  * Yetki yardımcıları (0003'teki politikalar bunlara dayanır)
--  * Türkçe slug üretimi
--  * Denormalize kolonların (feature_slugs / event_type_slugs) senkronu
--  * Sayaçlar ve profil tamamlanma oranı
--  * Listeleme sorgusu: search_venues()
-- =============================================================================

-- --- Ortak: updated_at ------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger cities_touch          before update on public.cities              for each row execute function public.touch_updated_at();
create trigger districts_touch       before update on public.districts           for each row execute function public.touch_updated_at();
create trigger event_types_touch     before update on public.event_types         for each row execute function public.touch_updated_at();
create trigger venue_types_touch     before update on public.venue_types         for each row execute function public.touch_updated_at();
create trigger features_touch        before update on public.features            for each row execute function public.touch_updated_at();
create trigger profiles_touch        before update on public.profiles            for each row execute function public.touch_updated_at();
create trigger venues_touch          before update on public.venues              for each row execute function public.touch_updated_at();
create trigger availability_touch    before update on public.venue_availability  for each row execute function public.touch_updated_at();

-- --- Yetki yardımcıları -----------------------------------------------------
-- SECURITY DEFINER şart: politikalar profiles'ı okuyacak, profiles'ın kendi
-- politikası da bunu çağıracak → invoker olsaydı sonsuz özyineleme olurdu.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- Trigger'lar için: "bu çağrı sunucu tarafından mı geliyor?"
-- Supabase'de service_role RLS'i atlar ama trigger'lar yine çalışır. Sunucu
-- eylemlerinin (ör. mekan sahibi rolüne yükseltme, admin atama, DavetPro
-- bağlama) trigger tarafından engellenmemesi gerekiyor.
-- DİKKAT: bu yalnızca GUARD TRIGGER'larında kullanılır, RLS politikalarında
-- ASLA kullanılmaz — politikalarda anon/authenticated dışındaki roller zaten
-- RLS'e takılmıyor.
--
-- SECURITY INVOKER olmak ZORUNDA. SECURITY DEFINER'da `current_user`
-- fonksiyonun sahibini döner, çağıranı değil — o durumda bu fonksiyon
-- herkes için true döner ve bütün guard'lar sessizce devre dışı kalır.
create or replace function public.is_privileged()
returns boolean
language sql
stable
security invoker
as $$
  select public.is_admin() or current_user not in ('anon', 'authenticated');
$$;

create or replace function public.owns_venue(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.venues
    where id = p_venue_id and owner_id = auth.uid()
  );
$$;

-- --- Türkçe slug ------------------------------------------------------------
-- Beylikdüzü → beylikduzu, Şişli → sisli, Iğdır → igdir.
-- DİKKAT: lower() öncesi translate ediyoruz. Postgres 'İ' harfini bazı
-- yerelleştirmelerde 'i̇' (i + birleşen nokta) yapıyor; bu da slug'a
-- görünmez karakter sokar.

create or replace function public.slugify_tr(input text)
returns text
language sql
immutable
strict
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(
          translate(
            input,
            'ÇĞİIÖŞÜÂÎÛçğıiöşüâîû',
            'CGIIOSUAIUcgiiosuaiu'
          )
        ),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-{2,}', '-', 'g'
    )
  );
$$;

-- --- Denormalize kolonların senkronu ---------------------------------------
-- venues.feature_slugs / event_type_slugs yalnızca hız içindir. Kaynak
-- doğruluk join tablosundadır; buradaki trigger'lar kopyayı taze tutar.
-- Uygulama kodu bu kolonlara ASLA doğrudan yazmaz.

create or replace function public.sync_venue_feature_slugs()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := coalesce(new.venue_id, old.venue_id);
begin
  update public.venues v
     set feature_slugs = coalesce(
           (select array_agg(f.slug order by f.slug)
              from public.venue_features vf
              join public.features f on f.id = vf.feature_id
             where vf.venue_id = v_id),
           '{}'
         )
   where v.id = v_id;
  return null;
end;
$$;

create trigger venue_features_sync
  after insert or update or delete on public.venue_features
  for each row execute function public.sync_venue_feature_slugs();

create or replace function public.sync_venue_event_slugs()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := coalesce(new.venue_id, old.venue_id);
begin
  update public.venues v
     set event_type_slugs = coalesce(
           (select array_agg(e.slug order by e.slug)
              from public.venue_event_types vet
              join public.event_types e on e.id = vet.event_type_id
             where vet.venue_id = v_id),
           '{}'
         )
   where v.id = v_id;
  return null;
end;
$$;

create trigger venue_event_types_sync
  after insert or update or delete on public.venue_event_types
  for each row execute function public.sync_venue_event_slugs();

-- Taksonomi slug'ı değişirse tüm kopyalar bayatlar. Admin ekranı bunu
-- yapabildiği için toplu yeniden hesap gerekiyor.
create or replace function public.resync_slugs_after_taxonomy_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'features' then
    update public.venues v
       set feature_slugs = coalesce(
             (select array_agg(f.slug order by f.slug)
                from public.venue_features vf
                join public.features f on f.id = vf.feature_id
               where vf.venue_id = v.id),
             '{}')
     where exists (
       select 1 from public.venue_features vf
        where vf.venue_id = v.id and vf.feature_id = new.id);
  else
    update public.venues v
       set event_type_slugs = coalesce(
             (select array_agg(e.slug order by e.slug)
                from public.venue_event_types vet
                join public.event_types e on e.id = vet.event_type_id
               where vet.venue_id = v.id),
             '{}')
     where exists (
       select 1 from public.venue_event_types vet
        where vet.venue_id = v.id and vet.event_type_id = new.id);
  end if;
  return null;
end;
$$;

create trigger features_slug_resync
  after update of slug on public.features
  for each row when (old.slug is distinct from new.slug)
  execute function public.resync_slugs_after_taxonomy_change();

create trigger event_types_slug_resync
  after update of slug on public.event_types
  for each row when (old.slug is distinct from new.slug)
  execute function public.resync_slugs_after_taxonomy_change();

-- --- Şehir / ilçe mekan sayaçları -------------------------------------------
-- Yalnızca PUBLISHED mekanlar sayılır; SEO landing eşiği (min 3 mekan)
-- bu sayaçlara bakıyor.

create or replace function public.refresh_location_venue_counts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ids uuid[] := array_remove(array[new.city_id, old.city_id], null);
  dids uuid[] := array_remove(array[new.district_id, old.district_id], null);
begin
  update public.cities c
     set venue_count = (
           select count(*) from public.venues v
            where v.city_id = c.id and v.status = 'PUBLISHED')
   where c.id = any (ids);

  update public.districts d
     set venue_count = (
           select count(*) from public.venues v
            where v.district_id = d.id and v.status = 'PUBLISHED')
   where d.id = any (dids);

  return null;
end;
$$;

create trigger venues_location_counts
  after insert or delete on public.venues
  for each row execute function public.refresh_location_venue_counts();

create trigger venues_location_counts_upd
  after update of status, city_id, district_id on public.venues
  for each row execute function public.refresh_location_venue_counts();

-- --- Profil tamamlanma oranı ------------------------------------------------
-- Panelde "Profilini tamamla" yönlendirmesi ve yayına gönderme eşiği için.

-- Satır üzerinden hesaplar. BEFORE trigger'lar tabloya bakamaz (satır henüz
-- eski değerleri taşır), bu yüzden asıl mantık NEW kaydını alan bu sürümde.
create or replace function public.venue_completion_of(v public.venues)
returns smallint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select least(100, greatest(0,
      (case when v.venue_type_id is not null then 10 else 0 end)
    + (case when length(coalesce(v.description, '')) >= 200 then 15 else 0 end)
    + (case when coalesce(v.short_description, '') <> '' then 5 else 0 end)
    + (case when v.min_capacity is not null and v.max_capacity is not null then 10 else 0 end)
    + (case when v.starting_price is not null then 10 else 0 end)
    + (case when coalesce(v.contact_phone, '') <> '' then 10 else 0 end)
    + (case when v.latitude is not null and v.longitude is not null then 10 else 0 end)
    + (case when (select count(*) from public.venue_images i where i.venue_id = v.id) >= 5 then 20 else 0 end)
    + (case when (select count(*) from public.venue_event_types t where t.venue_id = v.id) > 0 then 5 else 0 end)
    + (case when (select count(*) from public.venue_features f where f.venue_id = v.id) >= 3 then 5 else 0 end)
  ))::smallint;
$$;

create or replace function public.compute_venue_completion(p_venue_id uuid)
returns smallint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.venue_completion_of(v) from public.venues v where v.id = p_venue_id;
$$;

-- Yalnızca ALT tablolardan (görsel / özellik / etkinlik türü) tetiklenir;
-- hepsinde `venue_id` kolonu var. venues'un kendi güncellemesinde skoru
-- guard_venue_update zaten hesaplıyor (0003) — buradan ikinci kez update
-- etmek hem gereksiz hem özyineleme riski.
create or replace function public.refresh_venue_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := coalesce(new.venue_id, old.venue_id);
  score smallint;
begin
  score := public.compute_venue_completion(v_id);
  update public.venues set completion_score = score
   where id = v_id and completion_score is distinct from score;
  return null;
end;
$$;

create trigger venue_images_completion
  after insert or delete on public.venue_images
  for each row execute function public.refresh_venue_completion();

create trigger venue_features_completion
  after insert or delete on public.venue_features
  for each row execute function public.refresh_venue_completion();

create trigger venue_event_types_completion
  after insert or delete on public.venue_event_types
  for each row execute function public.refresh_venue_completion();

-- --- Kapak görseli tekilliği ------------------------------------------------
-- Kısmi unique indeks çakışmayı engelliyor ama hata veriyor; kullanıcı
-- "bunu kapak yap" dediğinde eskisinin düşmesini bekliyor.

create or replace function public.enforce_single_cover()
returns trigger
language plpgsql
as $$
begin
  if new.is_cover then
    update public.venue_images
       set is_cover = false
     where venue_id = new.venue_id
       and id <> new.id
       and is_cover;
  end if;
  return new;
end;
$$;

create trigger venue_images_single_cover
  before insert or update of is_cover on public.venue_images
  for each row when (new.is_cover)
  execute function public.enforce_single_cover();

-- --- Listeleme sorgusu ------------------------------------------------------
-- Tek RPC; hem /api/venues hem SEO landing sayfaları bunu çağırır.
-- SECURITY INVOKER: RLS devrede kalsın. Yine de status filtresi açıkça
-- yazılıyor — mekan sahibi kendi taslağını genel aramada görmemeli.

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
    case when p_sort = 'onerilen'          then v.is_featured::int    end desc nulls last,
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
