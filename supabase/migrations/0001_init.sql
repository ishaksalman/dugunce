-- =============================================================================
-- DavetMekanı · 0001 · Enum'lar, taksonomi ve çekirdek tablolar
--
-- Bu dosya yalnızca *yapı* kurar: tip, tablo, kısıt, indeks.
-- Fonksiyon ve trigger'lar 0002'de, RLS 0003'te.
--
-- Tasarım notları:
--  * Mekanın vitrin verisi burada; rezervasyon/ödeme DavetPro'nun işi.
--  * `feature_slugs` / `event_type_slugs` denormalize kopyalardır — kaynak
--    doğruluk her zaman join tablosundadır, trigger senkron tutar (0002).
--  * DavetPro'ya FK YOK. Yalnızca opak referans kolonları.
-- =============================================================================

create extension if not exists "pgcrypto";

-- --- Enum'lar ---------------------------------------------------------------

create type public.user_role as enum ('customer', 'venue_owner', 'admin');

-- Mekanın yayın hattı. Geçiş kuralları 0003'teki trigger ile zorlanır.
create type public.venue_status as enum (
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'SUSPENDED'
);

create type public.price_type as enum (
  'kisi_basi',
  'paket',
  'gunluk',
  'belirtilmemis'
);

-- Özellik (otopark, klima...) ile hizmet (catering, DJ...) aynı mekanizmayı
-- kullanır; arayüzde bu alana göre ayrı gruplanır.
create type public.feature_kind as enum ('ozellik', 'hizmet');

create type public.availability_status as enum ('musait', 'opsiyonlu', 'dolu');

-- --- Taksonomi: şehir / ilçe ------------------------------------------------

create table public.cities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 2 and 60),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  plate_code  smallint not null unique check (plate_code between 1 and 81),
  -- Ana sayfada "popüler şehirler" bloğunda gösterilir.
  is_popular  boolean not null default false,
  sort_order  integer not null default 0,
  latitude    numeric(9, 6),
  longitude   numeric(9, 6),
  -- Yayınlanmış mekan sayısı; trigger ile güncellenir (0002).
  venue_count integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index cities_popular_idx on public.cities (is_popular, sort_order)
  where is_popular;

create table public.districts (
  id          uuid primary key default gen_random_uuid(),
  city_id     uuid not null references public.cities (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 60),
  slug        text not null check (slug ~ '^[a-z0-9-]+$'),
  venue_count integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Aynı slug farklı şehirlerde olabilir (ör. "merkez"), şehir içinde olamaz.
  unique (city_id, slug),
  unique (city_id, name),
  -- venues, ilçenin şehriyle tutarlı olsun diye bileşik FK hedefi.
  unique (id, city_id)
);

create index districts_city_idx on public.districts (city_id, name);

-- --- Taksonomi: etkinlik türü / mekan türü / özellik ------------------------

create table public.event_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(btrim(name)) between 2 and 60),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  -- SEO başlığında kullanılan tekil isim: "düğün" → "İstanbul Düğün Mekanları"
  seo_noun    text not null,
  icon        text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Mekanın fiziksel tipi: kır bahçesi, balo salonu, otel, tekne...
create table public.venue_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(btrim(name)) between 2 and 60),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.features (
  id          uuid primary key default gen_random_uuid(),
  kind        public.feature_kind not null,
  -- Filtre panelinde ve detay sayfasında başlık olarak kullanılır.
  group_name  text not null,
  name        text not null check (length(btrim(name)) between 2 and 60),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  icon        text,
  -- Filtre panelinde öne çıkarılacak mı (ilk 8 kutucuk).
  is_filter   boolean not null default true,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index features_kind_idx on public.features (kind, sort_order);

-- --- Kullanıcı profilleri ---------------------------------------------------
-- Ziyaretçinin kaydı yoktur. 'customer' → 'venue_owner' yükseltmesi mekan
-- oluşturma akışında otomatik; 'admin' yalnızca elle verilir (bkz. 0003).

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (length(btrim(full_name)) between 2 and 120),
  phone       text check (phone is null or length(btrim(phone)) between 7 and 20),
  role        public.user_role not null default 'customer',
  avatar_url  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role) where role <> 'customer';

-- --- Mekanlar ---------------------------------------------------------------

create table public.venues (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles (id) on delete cascade,

  -- SEO kimliği. Şehir+ilçe ile birlikte URL'i oluşturur:
  -- /mekanlar/{sehir}/{ilce}/{slug}
  slug              text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name              text not null check (length(btrim(name)) between 2 and 120),

  city_id           uuid not null references public.cities (id) on delete restrict,
  district_id       uuid not null,
  venue_type_id     uuid references public.venue_types (id) on delete set null,

  address           text,
  latitude          numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude         numeric(9, 6) check (longitude is null or longitude between -180 and 180),

  -- Kart üzerinde gösterilen kısa metin; detayda uzun açıklama.
  short_description text check (short_description is null or length(short_description) <= 200),
  description       text check (description is null or length(description) <= 8000),

  min_capacity      integer check (min_capacity is null or min_capacity > 0),
  max_capacity      integer check (max_capacity is null or max_capacity > 0),

  -- "₺75.000'den başlayan fiyatlarla". Para her yerde numeric, float yok.
  starting_price    numeric(12, 2) check (starting_price is null or starting_price >= 0),
  price_type        public.price_type not null default 'belirtilmemis',
  -- Fiyatın neye göre değiştiğini mekan sahibi buraya yazar.
  price_note        text check (price_note is null or length(price_note) <= 500),

  has_indoor        boolean not null default false,
  has_outdoor       boolean not null default false,

  contact_phone     text check (contact_phone is null or length(btrim(contact_phone)) between 7 and 20),
  contact_email     text,
  website_url       text,
  instagram_url     text,

  status            public.venue_status not null default 'DRAFT',
  published_at      timestamptz,
  rejection_reason  text,
  -- Yayındaki mekanda kritik alan değişince admin kuyruğuna düşer, ama
  -- mekan yayında kalır (kullanıcıyı cezalandırmamak için).
  needs_review      boolean not null default false,

  is_featured       boolean not null default false,
  featured_until    timestamptz,

  view_count        integer not null default 0,
  favorite_count    integer not null default 0,
  inquiry_count     integer not null default 0,
  rating_avg        numeric(2, 1) not null default 0 check (rating_avg between 0 and 5),
  rating_count      integer not null default 0,
  -- Panelde "profil tamamlanma oranı" olarak gösterilir (0-100).
  completion_score  smallint not null default 0 check (completion_score between 0 and 100),

  -- Filtreleme için denormalize kopyalar. GIN indeksli; trigger doldurur.
  feature_slugs     text[] not null default '{}',
  event_type_slugs  text[] not null default '{}',

  -- --- DavetPro köprüsü ----------------------------------------------------
  -- Ayrı veritabanı, ayrı deploy. Buradaki alanlar yalnızca opak referans;
  -- foreign key YOK, join YOK. Senkron HTTP üzerinden yapılır.
  davetpro_business_id uuid,
  davetpro_venue_id    uuid unique,
  davetpro_linked_at   timestamptz,
  sync_source          text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint venues_capacity_order
    check (min_capacity is null or max_capacity is null or max_capacity >= min_capacity),
  -- İlçe, mekanın şehrine ait olmak zorunda. Uygulama katmanına bırakılmaz.
  constraint venues_district_belongs_to_city
    foreign key (district_id, city_id)
    references public.districts (id, city_id) on delete restrict,
  -- Yayına çıkmış bir mekanın yayın tarihi olmak zorunda.
  constraint venues_published_needs_date
    check (status <> 'PUBLISHED' or published_at is not null)
);

-- Filtreleme indeksleri. Public sorguların tamamı status='PUBLISHED' ile
-- başladığı için her bileşik indeks status ile başlıyor.
create index venues_owner_idx     on public.venues (owner_id, status);
create index venues_location_idx  on public.venues (status, city_id, district_id);
create index venues_price_idx     on public.venues (status, starting_price);
create index venues_capacity_idx  on public.venues (status, min_capacity, max_capacity);
create index venues_ranking_idx   on public.venues (status, is_featured desc, rating_avg desc, view_count desc);
create index venues_created_idx   on public.venues (status, created_at desc);
create index venues_features_idx  on public.venues using gin (feature_slugs);
create index venues_events_idx    on public.venues using gin (event_type_slugs);
-- Admin onay kuyruğu.
create index venues_review_queue_idx on public.venues (status, created_at)
  where status = 'PENDING_REVIEW';

-- --- Mekan görselleri -------------------------------------------------------

create table public.venue_images (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues (id) on delete cascade,
  -- Supabase Storage yolu; `url` bundan türetilen public URL.
  storage_path  text not null,
  url           text not null,
  width         integer check (width is null or width > 0),
  height        integer check (height is null or height > 0),
  -- next/image placeholder="blur" için.
  blur_data_url text,
  alt_text      text check (alt_text is null or length(alt_text) <= 160),
  sort_order    integer not null default 0,
  is_cover      boolean not null default false,
  created_at    timestamptz not null default now()
);

create index venue_images_venue_idx on public.venue_images (venue_id, sort_order);
-- Bir mekanın en fazla bir kapak görseli olabilir.
create unique index venue_images_single_cover_idx on public.venue_images (venue_id)
  where is_cover;

-- --- Mekan ↔ özellik / etkinlik türü ----------------------------------------

create table public.venue_features (
  venue_id   uuid not null references public.venues (id) on delete cascade,
  feature_id uuid not null references public.features (id) on delete cascade,
  -- "Otopark: 80 araçlık" gibi mekana özel detay.
  note       text check (note is null or length(note) <= 200),
  primary key (venue_id, feature_id)
);

create index venue_features_feature_idx on public.venue_features (feature_id);

create table public.venue_event_types (
  venue_id      uuid not null references public.venues (id) on delete cascade,
  event_type_id uuid not null references public.event_types (id) on delete cascade,
  primary key (venue_id, event_type_id)
);

create index venue_event_types_event_idx on public.venue_event_types (event_type_id);

-- --- Müsaitlik --------------------------------------------------------------
-- MVP'de arayüzü yok. Şema şimdiden duruyor çünkü DavetPro'dan gelecek
-- "dolu tarihler" senkronunun hedefi burası olacak.

create table public.venue_availability (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  date       date not null,
  status     public.availability_status not null default 'dolu',
  note       text check (note is null or length(note) <= 200),
  -- DavetPro'dan mı geldi, mekan sahibi mi girdi.
  source     text not null default 'manuel',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, date)
);

create index venue_availability_lookup_idx on public.venue_availability (venue_id, date);
