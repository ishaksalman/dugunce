-- =============================================================================
-- DavetMekanı · 0004 · Talepler, favoriler, yorumlar, SEO ve gelir modeli
--
-- Bu dosyadaki tabloların bir kısmının MVP'de arayüzü yok (plans,
-- subscriptions, advertisements). Şimdiden duruyorlar çünkü sonradan
-- eklenen para tabloları hep mevcut veriyi taşımayı gerektiriyor.
-- =============================================================================

create type public.inquiry_status as enum (
  'NEW',
  'CONTACTED',
  'QUOTED',
  'ACCEPTED',
  'REJECTED',
  'CLOSED'
);

create type public.review_status as enum ('PENDING', 'APPROVED', 'REJECTED');

create type public.seo_page_kind as enum (
  'etkinlik',
  'sehir',
  'sehir_etkinlik',
  'ilce_etkinlik'
);

-- --- Teklif talepleri (lead) ------------------------------------------------
-- Platformun asıl ürünü bu. Üye olmayan da gönderebilir; user_id o yüzden
-- nullable. İleride DavetPro'nun leads tablosuna aktarılacak.

create table public.inquiries (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues (id) on delete cascade,
  -- Üye gönderdiyse dolu; talep geçmişi bu alandan geliyor.
  user_id       uuid references public.profiles (id) on delete set null,

  full_name     text not null check (length(btrim(full_name)) between 2 and 120),
  phone         text not null check (length(btrim(phone)) between 7 and 20),
  email         text,

  event_type_id uuid references public.event_types (id) on delete set null,
  event_date    date,
  guest_count   integer check (guest_count is null or guest_count between 1 and 100000),
  message       text check (message is null or length(message) <= 2000),

  status        public.inquiry_status not null default 'NEW',
  source        text not null default 'web',
  -- Mekan sahibinin kendi notu; talep sahibi göremez.
  owner_note    text check (owner_note is null or length(owner_note) <= 2000),
  contacted_at  timestamptz,

  -- Ham IP/UA ASLA saklanmıyor. Yalnızca hız sınırı ve spam tespiti için
  -- tuzlanmış özet. Bkz. lib/rate-limit.ts
  ip_hash       text,
  ua_hash       text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index inquiries_venue_idx  on public.inquiries (venue_id, status, created_at desc);
create index inquiries_user_idx   on public.inquiries (user_id, created_at desc);
create index inquiries_status_idx on public.inquiries (status, created_at desc);
-- Hız sınırı sorgusu: aynı IP aynı mekana bugün kaç kez yazdı.
create index inquiries_ratelimit_idx on public.inquiries (ip_hash, venue_id, created_at desc);

create trigger inquiries_touch before update on public.inquiries
  for each row execute function public.touch_updated_at();

-- --- Favoriler --------------------------------------------------------------
-- Üye olmayan kullanıcının favorileri localStorage'da; giriş yapınca
-- syncLocalFavorites() ile buraya taşınır.

create table public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  venue_id   uuid not null references public.venues (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

create index favorites_venue_idx on public.favorites (venue_id);
create index favorites_user_idx  on public.favorites (user_id, created_at desc);

-- --- Yorumlar ---------------------------------------------------------------
-- MVP'de doğrulama yok, admin onayı var. İleride `inquiry_id` üzerinden
-- "gerçekten bu mekanla iletişime geçmiş mi" kontrolüne bağlanacak;
-- kolon şimdiden duruyor ki geçmiş yorumlar da eşleştirilebilsin.

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  inquiry_id  uuid references public.inquiries (id) on delete set null,

  rating      smallint not null check (rating between 1 and 5),
  title       text check (title is null or length(btrim(title)) between 3 and 120),
  body        text not null check (length(btrim(body)) between 20 and 4000),
  event_date  date,

  status      public.review_status not null default 'PENDING',
  admin_note  text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Bir kullanıcı bir mekana bir kez yorum yazar.
  unique (venue_id, user_id)
);

create index reviews_venue_idx     on public.reviews (venue_id, status, created_at desc);
create index reviews_moderation_idx on public.reviews (status, created_at)
  where status = 'PENDING';

create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();

-- --- Bildirimler ------------------------------------------------------------

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id)
  where read_at is null;

-- --- Görüntülenme -----------------------------------------------------------
-- Görüntüleme başına satır YAZILMAZ. Günlük toplam tutulur; hem tablo
-- şişmez hem "son 30 gün" grafiği tek sorguyla çıkar.

create table public.venue_views (
  venue_id uuid not null references public.venues (id) on delete cascade,
  day      date not null,
  count    integer not null default 0,
  primary key (venue_id, day)
);

-- --- SEO landing sayfaları --------------------------------------------------
-- Thin content koruması burada: is_active yalnızca yeterli mekan varsa true.

create table public.seo_pages (
  id               uuid primary key default gen_random_uuid(),
  path             text not null unique check (path ~ '^[a-z0-9-]+$'),
  kind             public.seo_page_kind not null,

  city_id          uuid references public.cities (id) on delete cascade,
  district_id      uuid references public.districts (id) on delete cascade,
  event_type_id    uuid references public.event_types (id) on delete cascade,

  title            text not null check (length(btrim(title)) between 10 and 160),
  meta_description text check (meta_description is null or length(meta_description) <= 320),
  h1               text not null,
  intro_html       text,
  faq              jsonb not null default '[]'::jsonb,

  is_active        boolean not null default false,
  min_venue_count  smallint not null default 3,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Sayfa tipi ile dolu olması gereken alanlar tutarlı olmalı.
  constraint seo_pages_shape check (
    case kind
      when 'etkinlik'       then city_id is null and district_id is null and event_type_id is not null
      when 'sehir'          then city_id is not null and district_id is null
      when 'sehir_etkinlik' then city_id is not null and district_id is null and event_type_id is not null
      when 'ilce_etkinlik'  then city_id is not null and district_id is not null and event_type_id is not null
    end
  )
);

create index seo_pages_active_idx on public.seo_pages (is_active, kind) where is_active;

create trigger seo_pages_touch before update on public.seo_pages
  for each row execute function public.touch_updated_at();

-- --- Gelir modeli (şema hazır, MVP'de arayüz yok) ---------------------------

create table public.plans (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name          text not null,
  price_monthly numeric(12, 2) not null default 0 check (price_monthly >= 0),
  -- Aylık ücretsiz teklif talebi hakkı; null = sınırsız.
  lead_quota    integer check (lead_quota is null or lead_quota >= 0),
  features      jsonb not null default '[]'::jsonb,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  venue_id             uuid not null references public.venues (id) on delete cascade,
  plan_id              uuid not null references public.plans (id) on delete restrict,
  status               text not null default 'active',
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz,
  cancel_at            timestamptz,
  -- Ödeme sağlayıcısı sonra seçilecek; referans opak tutuluyor.
  provider             text,
  provider_ref         text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Bir mekanın aynı anda tek aktif aboneliği olur.
  unique (venue_id)
);

create table public.advertisements (
  id               uuid primary key default gen_random_uuid(),
  slot             text not null,
  title            text not null,
  image_url        text not null,
  target_url       text not null,
  -- Boş bırakılırsa her şehirde/etkinlikte gösterilir.
  city_id          uuid references public.cities (id) on delete cascade,
  event_type_id    uuid references public.event_types (id) on delete cascade,
  starts_at        timestamptz not null default now(),
  ends_at          timestamptz,
  is_active        boolean not null default false,
  impression_count integer not null default 0,
  click_count      integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index advertisements_slot_idx on public.advertisements (slot, is_active, starts_at);

-- --- Admin denetim izi ------------------------------------------------------
-- Kim neyi neden onayladı/reddetti. Silinmez.

create table public.admin_actions (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id   uuid not null,
  action      text not null,
  note        text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index admin_actions_entity_idx on public.admin_actions (entity_type, entity_id, created_at desc);

create trigger plans_touch          before update on public.plans          for each row execute function public.touch_updated_at();
create trigger subscriptions_touch  before update on public.subscriptions  for each row execute function public.touch_updated_at();
create trigger advertisements_touch before update on public.advertisements for each row execute function public.touch_updated_at();

-- =============================================================================
-- SAYAÇLAR
-- Uygulama kodu bu alanlara asla elle yazmaz.
-- =============================================================================

create or replace function public.refresh_venue_favorite_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := coalesce(new.venue_id, old.venue_id);
begin
  update public.venues
     set favorite_count = (select count(*) from public.favorites where venue_id = v_id)
   where id = v_id;
  return null;
end;
$$;

create trigger favorites_count
  after insert or delete on public.favorites
  for each row execute function public.refresh_venue_favorite_count();

create or replace function public.refresh_venue_inquiry_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := coalesce(new.venue_id, old.venue_id);
begin
  update public.venues
     set inquiry_count = (select count(*) from public.inquiries where venue_id = v_id)
   where id = v_id;
  return null;
end;
$$;

create trigger inquiries_count
  after insert or delete on public.inquiries
  for each row execute function public.refresh_venue_inquiry_count();

-- Puan yalnızca ONAYLANMIŞ yorumlardan hesaplanır. Bekleyen bir yorum
-- puanı oynatırsa moderasyon anlamsızlaşır.
create or replace function public.refresh_venue_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := coalesce(new.venue_id, old.venue_id);
begin
  update public.venues v
     set rating_count = coalesce(agg.n, 0),
         rating_avg   = coalesce(round(agg.avg_rating, 1), 0)
    from (
      select count(*) as n, avg(rating)::numeric as avg_rating
        from public.reviews
       where venue_id = v_id and status = 'APPROVED'
    ) agg
   where v.id = v_id;
  return null;
end;
$$;

create trigger reviews_rating
  after insert or delete on public.reviews
  for each row execute function public.refresh_venue_rating();

create trigger reviews_rating_upd
  after update of status, rating on public.reviews
  for each row execute function public.refresh_venue_rating();

-- --- Görüntülenme kaydı -----------------------------------------------------
-- Anonim kullanıcı venues tablosuna yazamaz; sayaç bu fonksiyon üzerinden
-- artıyor. SECURITY DEFINER, ama tek yaptığı iki sayaç artırmak.

create or replace function public.record_venue_view(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Yayında olmayan mekan için sayaç tutmuyoruz.
  if not exists (
    select 1 from public.venues where id = p_venue_id and status = 'PUBLISHED'
  ) then
    return;
  end if;

  insert into public.venue_views (venue_id, day, count)
  values (p_venue_id, current_date, 1)
  on conflict (venue_id, day) do update set count = public.venue_views.count + 1;

  update public.venues set view_count = view_count + 1 where id = p_venue_id;
end;
$$;

-- --- Talep güncelleme kilidi ------------------------------------------------
-- Mekan sahibi bir talebin yalnızca durumunu ve kendi notunu değiştirebilir;
-- talep sahibinin yazdığı hiçbir alana dokunamaz.

-- SECURITY INVOKER: guard yalnızca NEW/OLD üzerinde oynuyor, yükseltilmiş
-- yetkiye ihtiyacı yok. DEFINER olsaydı içeriden çağrılan is_privileged()
-- çağıranın değil fonksiyon sahibinin rolünü görür ve guard hep bypass olurdu.
create or replace function public.guard_inquiry_update()
returns trigger
language plpgsql
security invoker
as $$
begin
  if not public.is_privileged() then
    new.venue_id      := old.venue_id;
    new.user_id       := old.user_id;
    new.full_name     := old.full_name;
    new.phone         := old.phone;
    new.email         := old.email;
    new.event_type_id := old.event_type_id;
    new.event_date    := old.event_date;
    new.guest_count   := old.guest_count;
    new.message       := old.message;
    new.source        := old.source;
    new.ip_hash       := old.ip_hash;
    new.ua_hash       := old.ua_hash;
    new.created_at    := old.created_at;
  end if;

  -- "İletişime geçildi" damgasını veritabanı atar.
  if new.status <> 'NEW' and old.status = 'NEW' then
    new.contacted_at := coalesce(new.contacted_at, now());
  end if;
  return new;
end;
$$;

create trigger inquiries_guard_update
  before update on public.inquiries
  for each row execute function public.guard_inquiry_update();

-- --- Yorum kilidi -----------------------------------------------------------

-- SECURITY INVOKER: guard yalnızca NEW/OLD üzerinde oynuyor, yükseltilmiş
-- yetkiye ihtiyacı yok. DEFINER olsaydı içeriden çağrılan is_privileged()
-- çağıranın değil fonksiyon sahibinin rolünü görür ve guard hep bypass olurdu.
create or replace function public.guard_review_write()
returns trigger
language plpgsql
security invoker
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_privileged() then
      new.user_id := auth.uid();
      new.status  := 'PENDING';   -- kimse kendi yorumunu onaylayamaz
      new.admin_note := null;
    end if;
  else
    if not public.is_privileged() then
      new.status     := old.status;
      new.admin_note := old.admin_note;
      new.user_id    := old.user_id;
      new.venue_id   := old.venue_id;
      -- Onaylandıktan sonra metin değiştirilemez; yoksa moderasyon delinir.
      if old.status = 'APPROVED' then
        raise exception 'Onaylanmış yorum düzenlenemez.'
          using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger reviews_guard
  before insert or update on public.reviews
  for each row execute function public.guard_review_write();

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.inquiries      enable row level security;
alter table public.favorites      enable row level security;
alter table public.reviews        enable row level security;
alter table public.notifications  enable row level security;
alter table public.venue_views    enable row level security;
alter table public.seo_pages      enable row level security;
alter table public.plans          enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.advertisements enable row level security;
alter table public.admin_actions  enable row level security;

-- Talepler: herkes gönderebilir (üyelik zorunlu değil), ama yalnızca
-- mekan sahibi / talebi açan / admin okuyabilir.
create policy inquiries_insert on public.inquiries
  for insert with check (
    exists (select 1 from public.venues v where v.id = venue_id and v.status = 'PUBLISHED')
    and (user_id is null or user_id = auth.uid())
  );

create policy inquiries_read on public.inquiries
  for select using (
    user_id = auth.uid()
    or public.owns_venue(venue_id)
    or public.is_admin()
  );

create policy inquiries_update on public.inquiries
  for update using (public.owns_venue(venue_id) or public.is_admin())
  with check (public.owns_venue(venue_id) or public.is_admin());

create policy inquiries_delete on public.inquiries
  for delete using (public.is_admin());

-- Favoriler: tamamen kişisel.
create policy favorites_all on public.favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Yorumlar: onaylı olanı herkes görür; kendi yorumunu ve mekanına gelenleri
-- sahibi bekleme aşamasında da görür.
create policy reviews_read on public.reviews
  for select using (
    status = 'APPROVED'
    or user_id = auth.uid()
    or public.owns_venue(venue_id)
    or public.is_admin()
  );

create policy reviews_insert on public.reviews
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.venues v where v.id = venue_id and v.status = 'PUBLISHED')
  );

create policy reviews_update on public.reviews
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy reviews_delete on public.reviews
  for delete using (user_id = auth.uid() or public.is_admin());

create policy notifications_read on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_admin on public.notifications
  for all using (public.is_admin()) with check (public.is_admin());

-- Görüntülenme: kimse doğrudan yazamaz, record_venue_view() üzerinden.
create policy venue_views_read on public.venue_views
  for select using (public.owns_venue(venue_id) or public.is_admin());

create policy seo_pages_read on public.seo_pages
  for select using (is_active or public.is_admin());
create policy seo_pages_write on public.seo_pages
  for all using (public.is_admin()) with check (public.is_admin());

create policy plans_read on public.plans
  for select using (is_active or public.is_admin());
create policy plans_write on public.plans
  for all using (public.is_admin()) with check (public.is_admin());

create policy subscriptions_read on public.subscriptions
  for select using (public.owns_venue(venue_id) or public.is_admin());
create policy subscriptions_write on public.subscriptions
  for all using (public.is_admin()) with check (public.is_admin());

create policy advertisements_read on public.advertisements
  for select using (
    (is_active and starts_at <= now() and (ends_at is null or ends_at > now()))
    or public.is_admin()
  );
create policy advertisements_write on public.advertisements
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_actions_all on public.admin_actions
  for all using (public.is_admin()) with check (public.is_admin());

-- --- Yetkiler ---------------------------------------------------------------

grant select on public.seo_pages, public.plans, public.advertisements
  to anon, authenticated;
grant insert on public.inquiries to anon, authenticated;
grant select, update on public.inquiries to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.venue_views to authenticated;
grant select, insert, update, delete on
  public.seo_pages, public.plans, public.subscriptions,
  public.advertisements, public.admin_actions
to authenticated;

grant execute on function public.record_venue_view(uuid) to anon, authenticated;
