-- =============================================================================
-- Düğünce · 0049 · Rehber (blog) — SEO için içerik sayfaları
--
-- Amaç: /rehber altında admin'in yazdığı, arama motorunun indekslediği
-- makaleler. Mekan/etkinlik landing sayfalarından (seo_pages) FARKLI bir
-- yüzey — onlar veriden (mekan sayısı) üretiliyor, bunlar admin'in elle
-- yazdığı serbest metin. Sahiplik/owner_id kavramı yok: tek yazar admin.
--
-- İçerik markdown olarak saklanıyor (`content_md`), render anında HTML'e
-- çevriliyor (`lib/markdown.ts`) — zengin metin editörü (Tiptap vb.) yerine
-- düz bir textarea + markdown seçildi: bu boyutta bir özellik için ekstra
-- bağımlılık/karmaşıklık gerekmiyor, `.icerik` CSS'i (hakkımızda/gizlilik
-- sayfalarında zaten var) render edilen HTML'i olduğu gibi karşılıyor.
--
-- Diğer admin_* fonksiyonlarıyla AYNI desen: yazma yalnızca RPC üzerinden,
-- her işlem admin_actions'a yazılıyor. Venues'teki "silinmez, askıya alınır"
-- kısıtı burada YOK — blog yazısının bir talep/yorum geçmişi olmuyor, admin
-- yanlışlıkla açtığı taslağı doğrudan silebiliyor.
-- =============================================================================

create type public.blog_post_status as enum ('DRAFT', 'PUBLISHED');

create table public.blog_posts (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null check (length(btrim(title)) between 3 and 200),
  excerpt          text check (excerpt is null or length(excerpt) <= 300),
  content_md       text not null check (length(btrim(content_md)) > 0),
  cover_image_url  text,
  status           public.blog_post_status not null default 'DRAFT',
  author_id        uuid references public.profiles (id) on delete set null,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index blog_posts_status_idx on public.blog_posts (status, published_at desc);

create trigger blog_posts_touch before update on public.blog_posts
  for each row execute function public.touch_updated_at();

alter table public.blog_posts enable row level security;

create policy blog_posts_read on public.blog_posts
  for select using (status = 'PUBLISHED' or public.is_admin());

-- Uygulama katmanı buraya hiç dokunmuyor — yalnızca admin_* fonksiyonları
-- (security definer) yazıyor. Politika savunma katmanı.
create policy blog_posts_write on public.blog_posts
  for all using (public.is_admin()) with check (public.is_admin());

-- RLS satırları filtreliyor ama tablo düzeyinde ayrıca SELECT yetkisi
-- gerekiyor (bkz. 0003_rls.sql, aynı desen). Yazma yalnızca admin_*
-- fonksiyonlarından (security definer) geliyor, o yüzden insert/update/delete
-- authenticated'e AÇILMIYOR.
grant select on public.blog_posts to anon, authenticated;

-- --- Herkese açık okumalar ---------------------------------------------------

create or replace function public.get_blog_post(p_slug text)
returns jsonb
language sql
stable
as $$
  select to_jsonb(d) from (
    select id, slug, title, excerpt, content_md, cover_image_url, published_at
      from public.blog_posts
     where slug = p_slug and status = 'PUBLISHED'
  ) d;
$$;

grant execute on function public.get_blog_post(text) to anon, authenticated;

create or replace function public.list_blog_posts(
  p_limit  integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, title text, excerpt text, cover_image_url text,
  published_at timestamptz, total_count bigint
)
language sql
stable
as $$
  select id, slug, title, excerpt, cover_image_url, published_at,
         count(*) over () as total_count
    from public.blog_posts
   where status = 'PUBLISHED'
   order by published_at desc
   limit greatest(1, least(coalesce(p_limit, 20), 50))
   offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.list_blog_posts(integer, integer) to anon, authenticated;

create or replace function public.list_blog_post_slugs()
returns table (slug text)
language sql
stable
as $$
  select slug from public.blog_posts where status = 'PUBLISHED';
$$;

grant execute on function public.list_blog_post_slugs() to anon, authenticated;

-- --- Yönetim ------------------------------------------------------------

create or replace function public.admin_list_blog_posts(
  p_status public.blog_post_status default null,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, title text, status public.blog_post_status,
  cover_image_url text, published_at timestamptz,
  created_at timestamptz, updated_at timestamptz, total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();
  return query
  select b.id, b.slug, b.title, b.status, b.cover_image_url,
         b.published_at, b.created_at, b.updated_at,
         count(*) over ()
    from public.blog_posts b
   where p_status is null or b.status = p_status
   order by b.updated_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 100))
   offset greatest(0, coalesce(p_offset, 0));
end;
$$;

grant execute on function public.admin_list_blog_posts(
  public.blog_post_status, integer, integer) to authenticated;

create or replace function public.admin_get_blog_post(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();
  return (
    select to_jsonb(d) from (
      select id, slug, title, excerpt, content_md, cover_image_url, status, published_at
        from public.blog_posts where id = p_id
    ) d
  );
end;
$$;

grant execute on function public.admin_get_blog_post(uuid) to authenticated;

-- Oluşturma ve güncellemeyi TEK fonksiyonda topluyoruz (p_id null ise yeni
-- kayıt): admin_create_venue/admin_upsert_* ailesiyle aynı desen. Slug
-- YALNIZCA taslakken (mevcut durum DRAFT) admin'in gönderdiği değere göre
-- güncellenir — yayındaki bir yazının adresini değiştirmek SEO'yu kırar
-- (venues'teki "slug yalnızca taslakken adla birlikte değişir" kuralıyla
-- birebir aynı gerekçe).
create or replace function public.admin_upsert_blog_post(
  p_id              uuid,
  p_slug            text,
  p_title           text,
  p_excerpt         text,
  p_content_md      text,
  p_cover_image_url text,
  p_status          public.blog_post_status
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.assert_admin();
  v_id uuid;
  v_before_status public.blog_post_status;
  v_slug text := nullif(btrim(coalesce(p_slug, '')), '');
begin
  if length(btrim(coalesce(p_title, ''))) < 3 then
    raise exception 'Başlık en az 3 karakter olmalı.' using errcode = 'check_violation';
  end if;
  if v_slug is null then
    raise exception 'Slug boş olamaz.' using errcode = 'check_violation';
  end if;

  if p_id is not null then
    select status into v_before_status from public.blog_posts where id = p_id;
    if v_before_status is null then
      raise exception 'Yazı bulunamadı.' using errcode = 'no_data_found';
    end if;

    update public.blog_posts
       set slug            = case when v_before_status = 'DRAFT' then v_slug else slug end,
           title            = btrim(p_title),
           excerpt          = nullif(btrim(coalesce(p_excerpt, '')), ''),
           content_md       = p_content_md,
           cover_image_url  = nullif(btrim(coalesce(p_cover_image_url, '')), ''),
           status           = p_status,
           published_at     = case
                                 when p_status = 'PUBLISHED' and published_at is null then now()
                                 when p_status = 'DRAFT' then null
                                 else published_at
                               end
     where id = p_id
     returning id into v_id;

    perform public.log_admin_action(v_admin, 'blog_post', v_id, 'updated',
      null, jsonb_build_object('slug', v_slug, 'status', p_status));
  else
    insert into public.blog_posts (
      slug, title, excerpt, content_md, cover_image_url, status, author_id, published_at)
    values (
      v_slug, btrim(p_title), nullif(btrim(coalesce(p_excerpt, '')), ''), p_content_md,
      nullif(btrim(coalesce(p_cover_image_url, '')), ''), p_status, v_admin,
      case when p_status = 'PUBLISHED' then now() else null end)
    returning id into v_id;

    perform public.log_admin_action(v_admin, 'blog_post', v_id, 'created',
      null, jsonb_build_object('slug', v_slug, 'status', p_status));
  end if;

  return jsonb_build_object('id', v_id, 'slug', (select slug from public.blog_posts where id = v_id));
end;
$$;

grant execute on function public.admin_upsert_blog_post(
  uuid, text, text, text, text, text, public.blog_post_status) to authenticated;

create or replace function public.admin_delete_blog_post(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.assert_admin();
  v_slug text;
begin
  select slug into v_slug from public.blog_posts where id = p_id;
  if v_slug is null then
    raise exception 'Yazı bulunamadı.' using errcode = 'no_data_found';
  end if;

  delete from public.blog_posts where id = p_id;

  perform public.log_admin_action(v_admin, 'blog_post', p_id, 'deleted',
    null, jsonb_build_object('slug', v_slug));
end;
$$;

grant execute on function public.admin_delete_blog_post(uuid) to authenticated;
