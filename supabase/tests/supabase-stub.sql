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
