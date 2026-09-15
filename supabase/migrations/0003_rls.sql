-- =============================================================================
-- Düğünce · 0003 · RLS politikaları ve yayın hattı kilidi
--
-- Üç katmanlı savunmanın en dıştaki değil, EN İÇTEKİ katmanı burası.
-- Uygulama kodundaki guard'lar kullanıcıya nazik hata mesajı vermek içindir;
-- yetkiyi bu dosya belirler.
--
-- En kritik kural: MEKAN SAHİBİ KENDİ MEKANINI YAYINA ALAMAZ.
-- Bunu politika değil trigger zorlar — politika kolon bazlı kısıt koyamaz.
-- =============================================================================

-- --- Kayıt olunca profil oluştur -------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 'Yeni kullanıcı'),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- Rol yükseltme kilidi ---------------------------------------------------
-- Kullanıcı kendi profilini güncelleyebilir ama rolünü değiştiremez.
-- 'customer' → 'venue_owner' yükseltmesi yalnızca sunucu tarafındaki
-- mekan oluşturma akışından (service role) veya admin tarafından yapılır.

-- SECURITY INVOKER: guard yalnızca NEW/OLD üzerinde oynuyor, yükseltilmiş
-- yetkiye ihtiyacı yok. DEFINER olsaydı içeriden çağrılan is_privileged()
-- çağıranın değil fonksiyon sahibinin rolünü görür ve guard hep bypass olurdu.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security invoker
as $$
begin
  if new.role is distinct from old.role and not public.is_privileged() then
    raise exception 'Rol değiştirme yetkiniz yok.'
      using errcode = 'insufficient_privilege';
  end if;
  -- Kullanıcı kendini pasife/aktife alamaz; bu bir moderasyon aracı.
  if new.is_active is distinct from old.is_active and not public.is_privileged() then
    raise exception 'Hesap durumunu değiştirme yetkiniz yok.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- --- Mekan: ekleme kilidi ---------------------------------------------------

-- SECURITY INVOKER: guard yalnızca NEW/OLD üzerinde oynuyor, yükseltilmiş
-- yetkiye ihtiyacı yok. DEFINER olsaydı içeriden çağrılan is_privileged()
-- çağıranın değil fonksiyon sahibinin rolünü görür ve guard hep bypass olurdu.
create or replace function public.guard_venue_insert()
returns trigger
language plpgsql
security invoker
as $$
begin
  if not public.is_privileged() then
    -- Yeni mekan her zaman taslak olarak doğar, kimse kendine yayın veremez.
    new.status         := 'DRAFT';
    new.is_featured    := false;
    new.featured_until := null;
    new.published_at   := null;
    new.owner_id       := auth.uid();
    -- DavetPro bağlantısı yalnızca sunucu tarafındaki entegrasyon akışından.
    new.davetpro_business_id := null;
    new.davetpro_venue_id    := null;
    new.davetpro_linked_at   := null;
  end if;

  if coalesce(btrim(new.slug), '') = '' then
    new.slug := public.slugify_tr(new.name);
  end if;

  new.completion_score := public.venue_completion_of(new);
  return new;
end;
$$;

create trigger venues_guard_insert
  before insert on public.venues
  for each row execute function public.guard_venue_insert();

-- --- Mekan: yayın hattı kilidi ---------------------------------------------

-- SECURITY INVOKER: guard yalnızca NEW/OLD üzerinde oynuyor, yükseltilmiş
-- yetkiye ihtiyacı yok. DEFINER olsaydı içeriden çağrılan is_privileged()
-- çağıranın değil fonksiyon sahibinin rolünü görür ve guard hep bypass olurdu.
create or replace function public.guard_venue_update()
returns trigger
language plpgsql
security invoker
as $$
declare
  admin boolean := public.is_privileged();
  score smallint;
begin
  if not admin then
    -- Sahibin dokunamayacağı alanlar: her koşulda eski değere sabitlenir.
    new.is_featured          := old.is_featured;
    new.featured_until       := old.featured_until;
    new.view_count           := old.view_count;
    new.favorite_count       := old.favorite_count;
    new.inquiry_count        := old.inquiry_count;
    new.rating_avg           := old.rating_avg;
    new.rating_count         := old.rating_count;
    new.owner_id             := old.owner_id;
    new.davetpro_business_id := old.davetpro_business_id;
    new.davetpro_venue_id    := old.davetpro_venue_id;
    new.davetpro_linked_at   := old.davetpro_linked_at;
    new.rejection_reason     := old.rejection_reason;

    if new.status is distinct from old.status then
      if old.status in ('DRAFT', 'REJECTED') and new.status = 'PENDING_REVIEW' then
        score := public.venue_completion_of(new);
        if score < 60 then
          raise exception
            'Yayına göndermek için profil tamamlanma oranı en az %%60 olmalı (şu an %%%s).', score
            using errcode = 'check_violation';
        end if;
      elsif old.status = 'PENDING_REVIEW' and new.status = 'DRAFT' then
        -- İncelemeden geri çekme serbest.
        null;
      else
        raise exception 'Bu durum geçişi için yetkiniz yok: % → %', old.status, new.status
          using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;

  -- published_at'i uygulama değil veritabanı yönetir.
  if new.status = 'PUBLISHED' and old.status <> 'PUBLISHED' then
    new.published_at := coalesce(new.published_at, now());
    new.needs_review := false;
    new.rejection_reason := null;
  elsif new.status <> 'PUBLISHED' and old.status = 'PUBLISHED' then
    new.published_at := null;
  end if;

  -- Yayındaki mekanda kritik alan değiştiyse mekan yayında KALIR, ama
  -- admin kuyruğuna işaretlenir. Kullanıcıyı düzenleme yaptı diye
  -- yayından düşürmek kötü bir deneyim.
  if not admin
     and new.status = 'PUBLISHED'
     and (new.name        is distinct from old.name
       or new.city_id     is distinct from old.city_id
       or new.district_id is distinct from old.district_id
       or new.max_capacity is distinct from old.max_capacity
       or new.min_capacity is distinct from old.min_capacity) then
    new.needs_review := true;
  end if;

  new.completion_score := public.venue_completion_of(new);
  return new;
end;
$$;

create trigger venues_guard_update
  before update on public.venues
  for each row execute function public.guard_venue_update();

-- =============================================================================
-- RLS POLİTİKALARI
-- =============================================================================

alter table public.cities             enable row level security;
alter table public.districts          enable row level security;
alter table public.event_types        enable row level security;
alter table public.venue_types        enable row level security;
alter table public.features           enable row level security;
alter table public.profiles           enable row level security;
alter table public.venues             enable row level security;
alter table public.venue_images       enable row level security;
alter table public.venue_features     enable row level security;
alter table public.venue_event_types  enable row level security;
alter table public.venue_availability enable row level security;

-- --- Taksonomi: herkes okur, yalnızca admin yazar ---------------------------

create policy cities_read       on public.cities      for select using (true);
create policy cities_write      on public.cities      for all using (public.is_admin()) with check (public.is_admin());
create policy districts_read    on public.districts   for select using (true);
create policy districts_write   on public.districts   for all using (public.is_admin()) with check (public.is_admin());
create policy event_types_read  on public.event_types for select using (true);
create policy event_types_write on public.event_types for all using (public.is_admin()) with check (public.is_admin());
create policy venue_types_read  on public.venue_types for select using (true);
create policy venue_types_write on public.venue_types for all using (public.is_admin()) with check (public.is_admin());
create policy features_read     on public.features    for select using (true);
create policy features_write    on public.features    for all using (public.is_admin()) with check (public.is_admin());

-- --- Profiller --------------------------------------------------------------
-- Profiller herkese açık DEĞİL. Mekan detayında sahibin adı gösterilmiyor;
-- iletişim mekanın kendi alanları üzerinden kuruluyor.

create policy profiles_read_own on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_delete_admin on public.profiles
  for delete using (public.is_admin());

-- --- Mekanlar ---------------------------------------------------------------

create policy venues_read on public.venues
  for select using (
    status = 'PUBLISHED'
    or owner_id = auth.uid()
    or public.is_admin()
  );

create policy venues_insert on public.venues
  for insert with check (
    (owner_id = auth.uid() and status = 'DRAFT')
    or public.is_admin()
  );

create policy venues_update on public.venues
  for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Mekan sahibi silemez. İçerik silmek yerine SUSPENDED yapılır; gelen
-- teklif talepleri ve yorumlar öksüz kalmasın.
create policy venues_delete on public.venues
  for delete using (public.is_admin());

-- --- Mekana bağlı kayıtlar --------------------------------------------------
-- Okuma: mekan görünüyorsa alt kayıtları da görünür.
-- Yazma: yalnızca sahibi veya admin.

create policy venue_images_read on public.venue_images
  for select using (exists (
    select 1 from public.venues v
     where v.id = venue_id
       and (v.status = 'PUBLISHED' or v.owner_id = auth.uid() or public.is_admin())
  ));

create policy venue_images_write on public.venue_images
  for all using (public.owns_venue(venue_id) or public.is_admin())
  with check (public.owns_venue(venue_id) or public.is_admin());

create policy venue_features_read on public.venue_features
  for select using (exists (
    select 1 from public.venues v
     where v.id = venue_id
       and (v.status = 'PUBLISHED' or v.owner_id = auth.uid() or public.is_admin())
  ));

create policy venue_features_write on public.venue_features
  for all using (public.owns_venue(venue_id) or public.is_admin())
  with check (public.owns_venue(venue_id) or public.is_admin());

create policy venue_event_types_read on public.venue_event_types
  for select using (exists (
    select 1 from public.venues v
     where v.id = venue_id
       and (v.status = 'PUBLISHED' or v.owner_id = auth.uid() or public.is_admin())
  ));

create policy venue_event_types_write on public.venue_event_types
  for all using (public.owns_venue(venue_id) or public.is_admin())
  with check (public.owns_venue(venue_id) or public.is_admin());

create policy venue_availability_read on public.venue_availability
  for select using (exists (
    select 1 from public.venues v
     where v.id = venue_id
       and (v.status = 'PUBLISHED' or v.owner_id = auth.uid() or public.is_admin())
  ));

create policy venue_availability_write on public.venue_availability
  for all using (public.owns_venue(venue_id) or public.is_admin())
  with check (public.owns_venue(venue_id) or public.is_admin());

-- --- Şema yetkileri ---------------------------------------------------------
-- Supabase bunları varsayılan olarak zaten verir; açıkça yazmak hem testlerin
-- gerçek ortamla aynı davranmasını sağlıyor hem de neyin kime açık olduğunu
-- tek yerde okunur kılıyor. RLS zaten üstte devrede.

grant usage on schema public to anon, authenticated, service_role;

grant select on
  public.cities, public.districts, public.event_types, public.venue_types,
  public.features, public.venues, public.venue_images, public.venue_features,
  public.venue_event_types, public.venue_availability
to anon, authenticated;

grant insert, update, delete on
  public.venues, public.venue_images, public.venue_features,
  public.venue_event_types, public.venue_availability, public.profiles
to authenticated;

grant select on public.profiles to authenticated;

grant insert, update, delete on
  public.cities, public.districts, public.event_types, public.venue_types,
  public.features
to authenticated;

grant execute on function public.search_venues(
  text, text, text, text, integer, integer, integer, numeric, numeric,
  boolean, boolean, text[], text, text, integer, integer
) to anon, authenticated;
grant execute on function public.slugify_tr(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_privileged() to anon, authenticated;
grant execute on function public.venue_completion_of(public.venues) to authenticated;
grant execute on function public.compute_venue_completion(uuid) to authenticated;
grant execute on function public.owns_venue(uuid) to anon, authenticated;
