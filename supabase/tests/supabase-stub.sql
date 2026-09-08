-- Supabase ortamının test için taklidi.
-- Gerçek Supabase'de bu şema/roller hazır gelir; PGlite'ta biz kuruyoruz.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema if not exists auth;

create table auth.users (
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
