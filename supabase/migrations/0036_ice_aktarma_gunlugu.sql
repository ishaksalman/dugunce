-- =============================================================================
-- Düğünce · 0036 · Kaynak izleme ve içe aktarma günlüğü
--
-- Katalog kaydı artık birden çok yoldan geliyor: elle giriş, Google Places
-- dökümü, işletmenin kendi verdiği bağlantı. Üçünde de şu üç soru sorulacak:
--
--   1. Bu kaydı nereden aldık?          → source / source_url
--   2. Bu kaynağı daha önce işledik mi?  → source_url tekilliği (devam etme)
--   3. O işte ne oldu?                   → import_items (kaç görsel, ne hata)
--
-- İçe aktarma yarıda kalabiliyor: 50 kayıtlık iş 20'de kesilirse baştan
-- başlamak hem yavaş hem de mükerrer üretme riski. `source_url` tekil ve
-- `admin_import_islenmis_mi()` bunu sorguluyor.
--
-- Görsel hatası işletmeyi DÜŞÜRMEZ: 8 görselin 2'si inse bile kayıt açılır,
-- durumu `partial` olur ve hangi görselin düştüğü yazılır.
-- =============================================================================

-- --- Kaynak alanları ---------------------------------------------------------

alter table public.venues
  add column if not exists source text,
  add column if not exists source_url text,
  add column if not exists source_last_checked timestamptz;

comment on column public.venues.source is
  'Kaydın geldiği yer: "elle", "google-places", "isletme" vb.';
comment on column public.venues.source_url is
  'Kaynaktaki kanonik adres. Tekil: aynı kaynak sayfası iki kez içe '
  'aktarılamaz — yarıda kalan işin kaldığı yerden devam etmesini sağlıyor.';

create unique index if not exists venues_source_url_uniq
  on public.venues (source_url) where source_url is not null;

-- --- İçe aktarma günlüğü -----------------------------------------------------

do $$ begin
  create type public.import_status as enum
    ('imported', 'duplicate', 'partial', 'failed', 'needs_review');
exception when duplicate_object then null;
end $$;

create table if not exists public.import_runs (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,
  note        text,
  started_by  uuid references public.profiles (id) on delete set null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.import_items (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.import_runs (id) on delete cascade,
  source_url  text,
  name        text,
  -- Kayıt silinirse günlük kalsın: ne olduğunu sonradan okuyabilmek için.
  venue_id    uuid references public.venues (id) on delete set null,
  status      public.import_status not null,
  image_total    integer not null default 0,
  image_ok       integer not null default 0,
  image_failed   integer not null default 0,
  error       text,
  created_at  timestamptz not null default now()
);

create index if not exists import_items_run_idx
  on public.import_items (run_id, created_at desc);
create index if not exists import_items_source_idx
  on public.import_items (source_url) where source_url is not null;

alter table public.import_runs  enable row level security;
alter table public.import_items enable row level security;

create policy import_runs_read on public.import_runs
  for select using (public.is_admin());
create policy import_items_read on public.import_items
  for select using (public.is_admin());

grant select on public.import_runs, public.import_items to authenticated;

-- --- İş başlat / bitir -------------------------------------------------------

create or replace function public.admin_start_import_run(
  p_source text,
  p_note   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.assert_admin();
  v_id    uuid;
begin
  insert into public.import_runs (source, note, started_by)
  values (btrim(p_source), nullif(btrim(coalesce(p_note, '')), ''), v_admin)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.admin_start_import_run(text, text) to authenticated;

create or replace function public.admin_finish_import_run(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();
  update public.import_runs set finished_at = now()
   where id = p_run_id and finished_at is null;
end;
$$;

grant execute on function public.admin_finish_import_run(uuid) to authenticated;

-- --- Satır kaydı -------------------------------------------------------------

create or replace function public.admin_log_import_item(
  p_run_id     uuid,
  p_status     public.import_status,
  p_source_url text default null,
  p_name       text default null,
  p_venue_id   uuid default null,
  p_image_total  integer default 0,
  p_image_ok     integer default 0,
  p_image_failed integer default 0,
  p_error      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  perform public.assert_admin();
  insert into public.import_items (
    run_id, status, source_url, name, venue_id,
    image_total, image_ok, image_failed, error)
  values (
    p_run_id, p_status, nullif(btrim(coalesce(p_source_url, '')), ''),
    nullif(btrim(coalesce(p_name, '')), ''), p_venue_id,
    greatest(0, coalesce(p_image_total, 0)),
    greatest(0, coalesce(p_image_ok, 0)),
    greatest(0, coalesce(p_image_failed, 0)),
    nullif(btrim(coalesce(p_error, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.admin_log_import_item(
  uuid, public.import_status, text, text, uuid, integer, integer, integer, text)
  to authenticated;

-- --- Devam etme: bu kaynak daha önce işlendi mi ------------------------------
-- İki yere birden bakıyor: kayıt hâlâ duruyorsa `venues.source_url`,
-- kayıt silinmiş olsa bile günlükte başarılı satır varsa `import_items`.

create or replace function public.admin_import_islenmis_mi(p_source_urls text[])
returns table (source_url text, islenmis boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();
  return query
  select u.url,
         exists (select 1 from public.venues v where v.source_url = u.url)
      or exists (select 1 from public.import_items i
                  where i.source_url = u.url
                    and i.status in ('imported', 'partial'))
    from unnest(p_source_urls) as u(url);
end;
$$;

grant execute on function public.admin_import_islenmis_mi(text[]) to authenticated;

-- --- Günlük listesi ----------------------------------------------------------

create or replace function public.admin_list_import_items(
  p_run_id uuid default null,
  p_status public.import_status default null,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid, run_id uuid, source text, source_url text, name text,
  venue_id uuid, venue_slug text, status public.import_status,
  image_total integer, image_ok integer, image_failed integer,
  error text, created_at timestamptz, total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();
  return query
  select i.id, i.run_id, r.source, i.source_url, i.name,
         i.venue_id, v.slug, i.status,
         i.image_total, i.image_ok, i.image_failed,
         i.error, i.created_at, count(*) over ()
    from public.import_items i
    join public.import_runs r on r.id = i.run_id
    left join public.venues v on v.id = i.venue_id
   where (p_run_id is null or i.run_id = p_run_id)
     and (p_status is null or i.status = p_status)
   order by i.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

grant execute on function public.admin_list_import_items(
  uuid, public.import_status, integer, integer) to authenticated;
