-- Supabase ortamının test/geliştirme için taklidi.
-- Gerçek Supabase'de bu şema ve roller hazır gelir; PGlite'ta biz kuruyoruz.
--
-- Bu dosya IDEMPOTENT olmak zorunda: kalıcı geliştirme veritabanı her açılışta
-- yeniden çalıştırıyor (bkz. src/lib/db/pglite.ts).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key,
  email              text unique,
  -- Supabase'de signUp options.data buraya yazılır.
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Oturumdaki kullanıcı. Testlerde `select set_config('test.uid', ...)` ile
-- değiştiriliyor; gerçek ortamda JWT'den gelir.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- --- storage şeması ---------------------------------------------------------
-- Gerçek depolama davranışı taklit edilmiyor; amaç 0007'deki kova tanımının
-- ve politika ifadelerinin söz dizimiyle fonksiyon referanslarını doğrulamak.

create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text not null,
  owner      uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

-- "a/b/c.jpg" → {a,b}
create or replace function storage.foldername(p_name text)
returns text[]
language sql
immutable
as $fn$
  select (string_to_array(p_name, '/'))[
    1 : greatest(array_length(string_to_array(p_name, '/'), 1) - 1, 0)];
$fn$;

grant usage on schema storage to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
