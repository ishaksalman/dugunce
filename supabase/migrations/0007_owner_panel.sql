-- =============================================================================
-- Düğünce · 0007 · Mekan sahibi paneli
--
--  * Fotoğraf kovası ve yükleme yetkileri
--  * customer → venue_owner rol yükseltmesi
--  * Panel istatistikleri
-- =============================================================================

-- --- Fotoğraf kovası --------------------------------------------------------
-- Herkese açık okuma: mekan görselleri zaten vitrinde gösteriliyor, imzalı
-- URL üretmenin maliyeti anlamsız. Yazma yetkisi klasör bazlı: dosya yolu
-- `{venue_id}/{dosya}` biçiminde ve kullanıcı yalnızca kendi mekanının
-- klasörüne yazabiliyor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'venue-images',
  'venue-images',
  true,
  8 * 1024 * 1024,                              -- 8 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Yolun ilk klasörü mekan id'si mi ve bu mekan çağıranın mı?
create or replace function public.owns_storage_path(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  begin
    v_id := (storage.foldername(p_name))[1]::uuid;
  exception when others then
    -- Klasör adı uuid değilse yetki yok; hata fırlatmak yerine reddediyoruz.
    return false;
  end;
  return public.owns_venue(v_id) or public.is_admin();
end;
$$;

grant execute on function public.owns_storage_path(text) to authenticated;

drop policy if exists "venue images herkese açık" on storage.objects;
create policy "venue images herkese açık" on storage.objects
  for select using (bucket_id = 'venue-images');

drop policy if exists "sahip kendi mekanının görselini yükler" on storage.objects;
create policy "sahip kendi mekanının görselini yükler" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'venue-images' and public.owns_storage_path(name));

drop policy if exists "sahip kendi mekanının görselini günceller" on storage.objects;
create policy "sahip kendi mekanının görselini günceller" on storage.objects
  for update to authenticated
  using (bucket_id = 'venue-images' and public.owns_storage_path(name))
  with check (bucket_id = 'venue-images' and public.owns_storage_path(name));

drop policy if exists "sahip kendi mekanının görselini siler" on storage.objects;
create policy "sahip kendi mekanının görselini siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'venue-images' and public.owns_storage_path(name));

-- --- Rol yükseltme ----------------------------------------------------------
-- Kullanıcı kendi rolünü değiştiremiyor (0003, guard_profile_role). Mekan
-- oluşturma akışında bu tek yönlü yükseltmeye izin veriyoruz: müşteri →
-- mekan sahibi. Admin'e yükseltme buradan MÜMKÜN DEĞİL.

create or replace function public.become_venue_owner()
returns public.user_role
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_role_value public.user_role;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.' using errcode = 'insufficient_privilege';
  end if;

  select role into current_role_value from public.profiles where id = auth.uid();

  if current_role_value is null then
    raise exception 'Profil bulunamadı.' using errcode = 'no_data_found';
  end if;

  -- Yalnızca müşteri yükseltilir. venue_owner zaten öyle, admin düşürülmez.
  if current_role_value = 'customer' then
    update public.profiles set role = 'venue_owner' where id = auth.uid();
    return 'venue_owner';
  end if;

  return current_role_value;
end;
$$;

grant execute on function public.become_venue_owner() to authenticated;

-- --- Panel istatistikleri ---------------------------------------------------
-- Dashboard'daki kutucuklar tek sorgudan besleniyor.
--
-- DİKKAT: RLS tek başına YETMİYOR. `venues` politikası yayındaki mekanı
-- herkese okutuyor, yani sahiplik kontrolü olmadan giriş yapmış herhangi biri
-- rakibinin talep sayısını, dönüşüm oranını ve bekleyen yorumlarını görebilir.
-- Sahiplik koşulu bu yüzden sorguda AÇIKÇA yazılı.

create or replace function public.get_owner_stats(p_venue_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'view_count',        v.view_count,
    'favorite_count',    v.favorite_count,
    'inquiry_count',     v.inquiry_count,
    'rating_avg',        v.rating_avg,
    'rating_count',      v.rating_count,
    'completion_score',  v.completion_score,
    'status',            v.status,
    'needs_review',      v.needs_review,
    -- Görüntülenmeden talebe dönüşüm. Bölme sıfıra karşı korunuyor.
    'conversion_rate',   case when v.view_count > 0
                              then round((v.inquiry_count::numeric / v.view_count) * 100, 1)
                              else 0 end,
    'new_inquiries',     (select count(*) from public.inquiries i
                           where i.venue_id = v.id and i.status = 'NEW'),
    'pending_reviews',   (select count(*) from public.reviews r
                           where r.venue_id = v.id and r.status = 'PENDING'),
    'image_count',       (select count(*) from public.venue_images im
                           where im.venue_id = v.id),
    -- Son 30 günün günlük görüntülenmesi; grafik için.
    'daily_views',       coalesce((
                           select jsonb_agg(jsonb_build_object('day', d.day, 'count', d.count)
                                            order by d.day)
                             from public.venue_views d
                            where d.venue_id = v.id
                              and d.day >= current_date - interval '30 days'), '[]'::jsonb)
  )
  from public.venues v
  where v.id = p_venue_id
    and (v.owner_id = auth.uid() or public.is_admin());
$$;

grant execute on function public.get_owner_stats(uuid) to authenticated;

-- --- Sahibin mekan listesi --------------------------------------------------
-- Panelde "Mekanım" ekranı. RLS zaten sahibe kendi taslaklarını gösteriyor.

create or replace function public.get_my_venues()
returns table (
  id               uuid,
  slug             text,
  name             text,
  status           public.venue_status,
  needs_review     boolean,
  completion_score smallint,
  city_name        text,
  city_slug        text,
  district_name    text,
  district_slug    text,
  cover_url        text,
  view_count       integer,
  inquiry_count    integer,
  new_inquiries    bigint,
  rejection_reason text,
  updated_at       timestamptz
)
language sql
stable
as $$
  select
    v.id, v.slug, v.name, v.status, v.needs_review, v.completion_score,
    c.name, c.slug, d.name, d.slug,
    (select i.url from public.venue_images i
      where i.venue_id = v.id
      order by i.is_cover desc, i.sort_order, i.created_at limit 1),
    v.view_count, v.inquiry_count,
    (select count(*) from public.inquiries iq
      where iq.venue_id = v.id and iq.status = 'NEW'),
    v.rejection_reason,
    v.updated_at
  from public.venues v
  join public.cities c    on c.id = v.city_id
  join public.districts d on d.id = v.district_id
  where v.owner_id = auth.uid()
  order by v.created_at desc;
$$;

grant execute on function public.get_my_venues() to authenticated;
