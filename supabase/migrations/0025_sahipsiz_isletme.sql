-- =============================================================================
-- Düğünce · 0025 · Sahipsiz işletme ve kategori
--
-- Strateji: yönetim katalogu kendisi doldurur → profil Google'a düşer →
-- işletme sahibi profili SAHİPLENİR → talep almaya başlar.
--
-- Bu zincir şemaya takılıyordu: `venues.owner_id` NOT NULL idi, yani her
-- kaydın bir sahibi olmak zorundaydı. Admin mekan eklediğinde kayıt
-- admin'in üstüne yazılıyordu.
--
-- Kategori: `venue_types` (salon/otel/kır) mekanın ALT TÜRÜ. Kategori ise
-- işletmenin ne olduğu — düğün mekanı, fotoğrafçı, gelinlik… `path_prefix`
-- kategorinin kendi adres alanı: bugün /mekanlar/…, yarın /fotografcilar/…
--
-- `district_id` BİLEREK not null kaldı. İlçesiz işletme (ör. fotoğrafçı)
-- ancak ikinci kategori geldiğinde anlam kazanıyor; bugün nullable yapmak
-- vitrin sorgularını LEFT JOIN'e çevirmek ve ilçesiz kaydın adresini
-- (/mekanlar/{sehir}/{ilce}/{slug}) tanımsız bırakmak demek. Kullanıcısı
-- olmayan bir tuzak açmıyoruz.
-- =============================================================================

-- --- İşletme kategorisi ------------------------------------------------------

create table if not exists public.business_categories (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name         text not null check (length(btrim(name)) between 2 and 60),
  plural_name  text not null check (length(btrim(plural_name)) between 2 and 60),
  -- Kategorinin adres alanı: /{path_prefix}/{sehir}/{ilce}/{slug}
  path_prefix  text not null unique check (path_prefix ~ '^[a-z0-9-]+$'),
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

insert into public.business_categories (slug, name, plural_name, path_prefix, sort_order)
values ('mekan', 'Düğün Mekanı', 'Düğün Mekanları', 'mekanlar', 10)
on conflict (slug) do nothing;

alter table public.business_categories enable row level security;

create policy business_categories_read on public.business_categories
  for select using (true);
create policy business_categories_write on public.business_categories
  for all using (public.is_admin()) with check (public.is_admin());

-- RLS politikası tek başına yetmiyor: tablo GRANT'i ayrı. `guard_venue_insert`
-- SECURITY INVOKER olduğu için kategoriyi ÇAĞIRANIN yetkisiyle okuyor.
grant select on public.business_categories to anon, authenticated;
grant insert, update, delete on public.business_categories to authenticated;

-- Sahiplenme başvuruları: okuma RLS ile sınırlı, yazma yalnızca fonksiyondan.


-- --- venues: kategori --------------------------------------------------------

alter table public.venues
  add column if not exists category_id uuid references public.business_categories (id)
    on delete restrict;

update public.venues v
   set category_id = (select id from public.business_categories where slug = 'mekan')
 where v.category_id is null;

alter table public.venues alter column category_id set not null;

-- Varsayılan DEFAULT ile verilemiyor (PostgreSQL DEFAULT'ta alt sorguya izin
-- vermiyor). `guard_venue_insert` dolduruyor — slug'ı da zaten orası
-- üretiyor, böylece hangi yoldan insert edilirse edilsin kategori doluyor.

create index if not exists venues_category_idx on public.venues (category_id);

-- --- venues: sahipsiz kayıt --------------------------------------------------
-- RLS zaten doğru davranıyor: `owner_id = auth.uid()` NULL sahipte hiçbir
-- kullanıcıyla eşleşmiyor, yani sahipsiz taslağı yalnızca admin görüyor
-- ve düzenliyor. guard_venue_insert de admin'in verdiği owner_id'ye
-- dokunmuyor (yalnızca ayrıcalıksız çağıranınkini auth.uid() yapıyor).

alter table public.venues alter column owner_id drop not null;

comment on column public.venues.owner_id is
  'NULL = sahiplenilmemiş katalog kaydı. Yönetim ekledi, işletme henüz '
  'sahiplenmedi. Sahiplik yalnızca admin_review_claim() ile veriliyor.';

-- --- Sahiplenme talebi -------------------------------------------------------

do $$ begin
  create type public.claim_status as enum ('PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null;
end $$;

create table if not exists public.venue_claims (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues (id) on delete cascade,
  claimant_id  uuid not null references public.profiles (id) on delete cascade,
  status       public.claim_status not null default 'PENDING',
  -- Başvuranın "burası benim" gerekçesi: kurumsal e-posta, vergi no, vb.
  note         text check (note is null or length(note) <= 1000),
  contact_phone text check (contact_phone is null or length(btrim(contact_phone)) between 7 and 20),
  -- Reddetme gerekçesiz yapılamaz; başvuran ne eksik bilmeli.
  review_note  text check (review_note is null or length(review_note) <= 1000),
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint venue_claims_review_needs_reason
    check (status <> 'REJECTED' or coalesce(btrim(review_note), '') <> '')
);

-- Aynı kişi aynı mekan için birden fazla BEKLEYEN başvuru açamaz.
create unique index if not exists venue_claims_tek_bekleyen
  on public.venue_claims (venue_id, claimant_id) where status = 'PENDING';

create index if not exists venue_claims_bekleyenler_idx
  on public.venue_claims (created_at desc) where status = 'PENDING';

alter table public.venue_claims enable row level security;

-- Başvuran kendi başvurusunu görür; yazma yalnızca fonksiyon üzerinden.
create policy venue_claims_read on public.venue_claims
  for select using (claimant_id = auth.uid() or public.is_admin());

grant select on public.venue_claims to authenticated;

-- --- Yönetim: katalog kaydı açma --------------------------------------------

create or replace function public.admin_create_venue(
  p_name        text,
  p_city_id     uuid,
  p_district_id uuid,
  p_category_id uuid default null,
  p_venue_type_id uuid default null,
  p_address     text default null,
  p_contact_phone text default null,
  p_website_url text default null
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

  -- Slug çakışabilir: aynı adlı iki salon olağan. Sonuna sayı ekliyoruz.
  v_slug := public.slugify_tr(p_name);
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
    null, jsonb_build_object('slug', v_slug));

  return jsonb_build_object('id', v_id, 'slug', v_slug);
end;
$$;

grant execute on function public.admin_create_venue(
  text, uuid, uuid, uuid, uuid, text, text, text) to authenticated;

-- --- Sahiplenme başvurusu ----------------------------------------------------

create or replace function public.claim_venue(
  p_venue_id uuid,
  p_note     text default null,
  p_phone    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'Oturum gerekli.' using errcode = 'insufficient_privilege';
  end if;

  select owner_id into v_owner from public.venues where id = p_venue_id;
  if not found then
    raise exception 'İşletme bulunamadı.' using errcode = 'no_data_found';
  end if;
  -- Sahibi olan profil sahiplenilemez; itiraz varsa destek üzerinden.
  if v_owner is not null then
    raise exception 'Bu profil zaten sahiplenilmiş.' using errcode = 'unique_violation';
  end if;

  insert into public.venue_claims (venue_id, claimant_id, note, contact_phone)
  values (p_venue_id, v_uid, nullif(btrim(coalesce(p_note, '')), ''),
          nullif(btrim(coalesce(p_phone, '')), ''))
  on conflict (venue_id, claimant_id) where status = 'PENDING' do nothing
  returning id into v_id;

  if v_id is null then
    raise exception 'Bu işletme için bekleyen bir başvurunuz zaten var.'
      using errcode = 'unique_violation';
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

grant execute on function public.claim_venue(uuid, text, text) to authenticated;

-- --- Yönetim: başvuru inceleme ----------------------------------------------

create or replace function public.admin_review_claim(
  p_claim_id uuid,
  p_approve  boolean,
  p_note     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.assert_admin();
  v_claim public.venue_claims;
begin
  select * into v_claim from public.venue_claims where id = p_claim_id;
  if not found then
    raise exception 'Başvuru bulunamadı.' using errcode = 'no_data_found';
  end if;
  if v_claim.status <> 'PENDING' then
    raise exception 'Bu başvuru zaten sonuçlanmış.' using errcode = 'check_violation';
  end if;
  if not p_approve and coalesce(btrim(coalesce(p_note, '')), '') = '' then
    raise exception 'Reddetme gerekçesi zorunlu.' using errcode = 'check_violation';
  end if;

  if p_approve then
    -- Yarış durumu: iki başvuru arka arkaya onaylanmasın.
    if exists (select 1 from public.venues
                where id = v_claim.venue_id and owner_id is not null) then
      raise exception 'Bu profil arada sahiplenilmiş.' using errcode = 'unique_violation';
    end if;

    update public.venues
       set owner_id = v_claim.claimant_id, updated_at = now()
     where id = v_claim.venue_id;

    -- Sahiplenen kişi mekan sahibi rolüne geçer; admin DÜŞÜRÜLMEZ.
    update public.profiles
       set role = 'venue_owner', updated_at = now()
     where id = v_claim.claimant_id and role = 'customer';

    -- Aynı mekana bekleyen diğer başvurular kapanır.
    update public.venue_claims
       set status = 'REJECTED',
           review_note = 'Profil başka bir başvuruyla sahiplenildi.',
           reviewed_by = v_admin, reviewed_at = now(), updated_at = now()
     where venue_id = v_claim.venue_id and status = 'PENDING' and id <> p_claim_id;
  end if;

  update public.venue_claims
     set status = (case when p_approve then 'APPROVED' else 'REJECTED' end)::public.claim_status,
         review_note = nullif(btrim(coalesce(p_note, '')), ''),
         reviewed_by = v_admin, reviewed_at = now(), updated_at = now()
   where id = p_claim_id;

  perform public.log_admin_action(
    v_admin, 'venue_claim', p_claim_id,
    case when p_approve then 'approved' else 'rejected' end,
    p_note, jsonb_build_object('venue_id', v_claim.venue_id,
                               'claimant_id', v_claim.claimant_id));

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_review_claim(uuid, boolean, text) to authenticated;

-- --- Yönetim: bekleyen başvurular -------------------------------------------

create or replace function public.admin_list_claims(
  p_status public.claim_status default 'PENDING',
  p_limit  integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid, venue_id uuid, venue_name text, venue_slug text,
  city_name text, district_name text,
  claimant_name text, claimant_email text, claimant_phone text,
  note text, status public.claim_status, review_note text,
  created_at timestamptz, total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();
  return query
  select
    cl.id, cl.venue_id, v.name, v.slug, c.name, d.name,
    p.full_name, u.email::text, cl.contact_phone,
    cl.note, cl.status, cl.review_note, cl.created_at,
    count(*) over ()
  from public.venue_claims cl
  join public.venues v    on v.id = cl.venue_id
  join public.cities c    on c.id = v.city_id
  join public.districts d on d.id = v.district_id
  join public.profiles p  on p.id = cl.claimant_id
  left join auth.users u  on u.id = cl.claimant_id
  where p_status is null or cl.status = p_status
  order by cl.created_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

grant execute on function public.admin_list_claims(public.claim_status, integer, integer)
  to authenticated;

-- --- Yönetim listesi sahipsiz kaydı DÜŞÜRMEMELİ ------------------------------
-- `join public.profiles on p.id = v.owner_id` INNER idi: sahipsiz kayıt
-- yönetim listesinden tamamen kayboluyordu. Katalog kayıtlarının tamamı
-- sahipsiz doğduğu için bu, ekranı işlevsiz bırakırdı.

drop function if exists public.admin_list_venues(
  public.venue_status, text, boolean, integer, integer);

create or replace function public.admin_list_venues(
  p_status public.venue_status default null,
  p_query  text default null,
  p_needs_review boolean default null,
  p_limit  integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, name text, status public.venue_status,
  needs_review boolean, completion_score smallint,
  city_name text, city_slug text,
  district_name text, district_slug text,
  owner_name text, owner_email text, is_claimed boolean,
  cover_url text, view_count integer, inquiry_count integer,
  is_featured boolean, featured_until timestamptz,
  rejection_reason text, published_at timestamptz,
  created_at timestamptz, updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();
  return query
  select
    v.id, v.slug, v.name, v.status, v.needs_review, v.completion_score,
    c.name, c.slug, d.name, d.slug,
    p.full_name, u.email::text, (v.owner_id is not null),
    (select i.url from public.venue_images i where i.venue_id = v.id
      order by i.is_cover desc, i.sort_order limit 1),
    v.view_count, v.inquiry_count, v.is_featured, v.featured_until,
    v.rejection_reason, v.published_at, v.created_at, v.updated_at,
    count(*) over ()
  from public.venues v
  join public.cities c    on c.id = v.city_id
  join public.districts d on d.id = v.district_id
  left join public.profiles p on p.id = v.owner_id
  left join auth.users u  on u.id = v.owner_id
  where (p_status is null or v.status = p_status)
    and (p_needs_review is null or v.needs_review = p_needs_review)
    and (p_query is null or btrim(p_query) = '' or
         public.slugify_tr(v.name) like '%' || public.slugify_tr(p_query) || '%' or
         public.slugify_tr(coalesce(p.full_name, '')) like '%' || public.slugify_tr(p_query) || '%')
  order by
    case when v.status = 'PENDING_REVIEW' then 0
         when v.needs_review then 1 else 2 end,
    v.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

grant execute on function public.admin_list_venues(
  public.venue_status, text, boolean, integer, integer) to authenticated;

-- --- Vitrin: profil sahiplenilmiş mi ----------------------------------------
-- Detay sayfası "İşletme sahibi misiniz? Profilinizi sahiplenin" çağrısını
-- buna bakarak gösteriyor. owner_id'nin KENDİSİ dışarı verilmiyor.

create or replace function public.get_venue_detail(p_slug text)
returns jsonb
language sql
stable
as $$
  select to_jsonb(d) from (
    select
      v.id,
      v.slug,
      v.name,
      v.address,
      v.latitude,
      v.longitude,
      v.short_description,
      v.description,
      v.min_capacity,
      v.max_capacity,
      v.starting_price,
      v.price_type,
      v.price_note,
      v.has_indoor,
      v.has_outdoor,
      v.contact_phone,
      v.contact_email,
      v.website_url,
      v.instagram_url,
      v.google_maps_url,
      (v.owner_id is not null) as is_claimed,
      v.rating_avg,
      v.rating_count,
      v.favorite_count,
      v.is_featured,
      v.published_at,
      v.updated_at,

      jsonb_build_object('name', c.name, 'slug', c.slug) as city,
      jsonb_build_object('name', dt.name, 'slug', dt.slug) as district,
      case when vt.id is null then null
           else jsonb_build_object('name', vt.name, 'slug', vt.slug) end as venue_type,

      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', i.id, 'url', i.url, 'alt', i.alt_text,
                 'width', i.width, 'height', i.height, 'blur', i.blur_data_url)
               order by i.is_cover desc, i.sort_order, i.created_at)
          from public.venue_images i where i.venue_id = v.id
      ), '[]'::jsonb) as images,

      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'kind', f.kind, 'group', f.group_name, 'name', f.name,
                 'slug', f.slug, 'icon', f.icon, 'note', vf.note)
               order by f.sort_order)
          from public.venue_features vf
          join public.features f on f.id = vf.feature_id
         where vf.venue_id = v.id and f.is_active
      ), '[]'::jsonb) as features,

      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'name', e.name, 'slug', e.slug, 'seo_noun', e.seo_noun)
               order by e.sort_order)
          from public.venue_event_types vet
          join public.event_types e on e.id = vet.event_type_id
         where vet.venue_id = v.id and e.is_active
      ), '[]'::jsonb) as event_types

    from public.venues v
    join public.cities c     on c.id = v.city_id
    join public.districts dt on dt.id = v.district_id
    left join public.venue_types vt on vt.id = v.venue_type_id
    -- Yayında olmayan mekan detay sayfasından görünmez. Mekan sahibinin
    -- önizlemesi ayrı bir yoldan gelecek (panel), bu genel sorgu değil.
    where v.slug = p_slug and v.status = 'PUBLISHED'
  ) d;
$$;

-- --- Yorumlar ---------------------------------------------------------------
-- Yalnızca onaylanmışlar. Yorum sahibinin adı gösteriliyor ama profil
-- tablosuna genel okuma yetkisi vermiyoruz; ad bu fonksiyondan geliyor.

create or replace function public.get_venue_reviews(
  p_venue_id uuid,
  p_limit    integer default 10,
  p_offset   integer default 0
)
returns table (
  id           uuid,
  rating       smallint,
  title        text,
  body         text,
  event_date   date,
  author_name  text,
  created_at   timestamptz,
  total_count  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    r.id, r.rating, r.title, r.body, r.event_date,
    -- Soyadı baş harfe indiriliyor: "Ayşe Yılmaz" → "Ayşe Y."
    case
      when position(' ' in btrim(p.full_name)) > 0
        then split_part(btrim(p.full_name), ' ', 1) || ' ' ||
             upper(left(split_part(btrim(p.full_name), ' ', 2), 1)) || '.'
      else btrim(p.full_name)
    end as author_name,
    r.created_at,
    count(*) over () as total_count
  from public.reviews r
  join public.profiles p on p.id = r.user_id
  join public.venues v on v.id = r.venue_id
  where r.venue_id = p_venue_id
    and r.status = 'APPROVED'
    and v.status = 'PUBLISHED'
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.get_venue_detail(text) to anon, authenticated;

-- --- Kategori varsayılanı ----------------------------------------------------
-- 0003'teki gövdenin aynısı; yalnızca kategori doldurma eklendi.

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

  if new.category_id is null then
    new.category_id := (select id from public.business_categories where slug = 'mekan');
  end if;

  if coalesce(btrim(new.slug), '') = '' then
    new.slug := public.slugify_tr(new.name);
  end if;

  new.completion_score := public.venue_completion_of(new);
  return new;
end;
$$;
