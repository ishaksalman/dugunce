-- =============================================================================
-- DavetMekanı · 0012 · Yönetim paneli
--
-- Admin işlemleri doğrudan UPDATE ile de yapılabilirdi (RLS admin'e izin
-- veriyor), ama o zaman denetim izi uygulama katmanına kalırdı ve atlanabilirdi.
-- Bu fonksiyonlar değişikliği ve `admin_actions` kaydını TEK İŞLEMDE yazıyor.
--
-- Hepsi SECURITY DEFINER + baştan `is_admin()` kontrolü. Yetkisi olmayan
-- çağıran hata alır, sessizce boş sonuç değil.
-- =============================================================================

create or replace function public.assert_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Oturum gerekli.' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_admin() then
    raise exception 'Bu işlem için yönetici yetkisi gerekiyor.'
      using errcode = 'insufficient_privilege';
  end if;
  return v_uid;
end;
$$;

grant execute on function public.assert_admin() to authenticated;

-- --- Denetim izi yardımcısı -------------------------------------------------

create or replace function public.log_admin_action(
  p_actor uuid, p_entity_type text, p_entity_id uuid,
  p_action text, p_note text default null, p_meta jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.admin_actions (actor_id, entity_type, entity_id, action, note, meta)
  values (p_actor, p_entity_type, p_entity_id, p_action, p_note, coalesce(p_meta, '{}'::jsonb));
$$;

revoke all on function public.log_admin_action(uuid, text, uuid, text, text, jsonb)
  from public, anon, authenticated;

-- --- Yönetim özeti ----------------------------------------------------------

create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();
  return jsonb_build_object(
    'pending_venues',  (select count(*) from public.venues where status = 'PENDING_REVIEW'),
    'needs_review',    (select count(*) from public.venues where needs_review and status = 'PUBLISHED'),
    'published',       (select count(*) from public.venues where status = 'PUBLISHED'),
    'draft',           (select count(*) from public.venues where status = 'DRAFT'),
    'rejected',        (select count(*) from public.venues where status = 'REJECTED'),
    'suspended',       (select count(*) from public.venues where status = 'SUSPENDED'),
    'pending_reviews', (select count(*) from public.reviews where status = 'PENDING'),
    'total_users',     (select count(*) from public.profiles),
    'venue_owners',    (select count(*) from public.profiles where role = 'venue_owner'),
    'inquiries_7d',    (select count(*) from public.inquiries
                         where created_at > now() - interval '7 days'),
    'inquiries_total', (select count(*) from public.inquiries)
  );
end;
$$;

grant execute on function public.admin_stats() to authenticated;

-- --- Mekan listesi ----------------------------------------------------------

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
  city_name text, district_name text,
  owner_name text, owner_email text,
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
    c.name, d.name,
    p.full_name, u.email,
    (select i.url from public.venue_images i where i.venue_id = v.id
      order by i.is_cover desc, i.sort_order limit 1),
    v.view_count, v.inquiry_count, v.is_featured, v.featured_until,
    v.rejection_reason, v.published_at, v.created_at, v.updated_at,
    count(*) over ()
  from public.venues v
  join public.cities c    on c.id = v.city_id
  join public.districts d on d.id = v.district_id
  join public.profiles p  on p.id = v.owner_id
  left join auth.users u  on u.id = v.owner_id
  where (p_status is null or v.status = p_status)
    and (p_needs_review is null or v.needs_review = p_needs_review)
    and (p_query is null or btrim(p_query) = '' or
         public.slugify_tr(v.name) like '%' || public.slugify_tr(p_query) || '%' or
         public.slugify_tr(p.full_name) like '%' || public.slugify_tr(p_query) || '%')
  -- İnceleme bekleyenler en üstte: kuyruk bu ekranın asıl işi.
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

-- --- Mekan durumu -----------------------------------------------------------

create or replace function public.admin_set_venue_status(
  p_venue_id uuid,
  p_status   public.venue_status,
  p_reason   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.assert_admin();
  v_before public.venue_status;
begin
  select status into v_before from public.venues where id = p_venue_id;
  if v_before is null then
    raise exception 'Mekan bulunamadı.' using errcode = 'no_data_found';
  end if;

  -- Reddetme ve askıya alma gerekçesiz yapılamaz: mekan sahibi ne
  -- düzelteceğini bilmeli.
  if p_status in ('REJECTED', 'SUSPENDED') and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Gerekçe zorunlu.' using errcode = 'check_violation';
  end if;

  update public.venues
     set status = p_status,
         rejection_reason = case
           when p_status in ('REJECTED', 'SUSPENDED') then btrim(p_reason)
           else null end,
         needs_review = case when p_status = 'PUBLISHED' then false else needs_review end
   where id = p_venue_id;

  perform public.log_admin_action(
    v_admin, 'venue', p_venue_id, 'status:' || p_status::text, p_reason,
    jsonb_build_object('from', v_before, 'to', p_status));

  return jsonb_build_object('ok', true, 'from', v_before, 'to', p_status);
end;
$$;

grant execute on function public.admin_set_venue_status(
  uuid, public.venue_status, text) to authenticated;

-- --- Öne çıkarma ------------------------------------------------------------

create or replace function public.admin_set_venue_featured(
  p_venue_id uuid,
  p_featured boolean,
  p_until    timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.assert_admin();
begin
  if not exists (select 1 from public.venues where id = p_venue_id) then
    raise exception 'Mekan bulunamadı.' using errcode = 'no_data_found';
  end if;

  update public.venues
     set is_featured = p_featured,
         featured_until = case when p_featured then p_until else null end
   where id = p_venue_id;

  perform public.log_admin_action(
    v_admin, 'venue', p_venue_id,
    case when p_featured then 'featured:on' else 'featured:off' end,
    null, jsonb_build_object('until', p_until));

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_set_venue_featured(uuid, boolean, timestamptz)
  to authenticated;

-- --- Kullanıcılar -----------------------------------------------------------

create or replace function public.admin_list_users(
  p_role   public.user_role default null,
  p_query  text default null,
  p_limit  integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid, full_name text, email text, phone text,
  role public.user_role, is_active boolean,
  venue_count bigint, created_at timestamptz, total_count bigint
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
    p.id, p.full_name, u.email, p.phone, p.role, p.is_active,
    (select count(*) from public.venues v where v.owner_id = p.id),
    p.created_at,
    count(*) over ()
  from public.profiles p
  left join auth.users u on u.id = p.id
  where (p_role is null or p.role = p_role)
    and (p_query is null or btrim(p_query) = '' or
         public.slugify_tr(p.full_name) like '%' || public.slugify_tr(p_query) || '%' or
         u.email ilike '%' || p_query || '%')
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

grant execute on function public.admin_list_users(
  public.user_role, text, integer, integer) to authenticated;

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role    public.user_role
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.assert_admin();
  v_before public.user_role;
begin
  -- Admin kendi rolünü düşüremez: son admin sistemden kilitlenmesin.
  if p_user_id = v_admin then
    raise exception 'Kendi rolünüzü değiştiremezsiniz.'
      using errcode = 'insufficient_privilege';
  end if;

  select role into v_before from public.profiles where id = p_user_id;
  if v_before is null then
    raise exception 'Kullanıcı bulunamadı.' using errcode = 'no_data_found';
  end if;

  update public.profiles set role = p_role where id = p_user_id;
  perform public.log_admin_action(
    v_admin, 'profile', p_user_id, 'role:' || p_role::text, null,
    jsonb_build_object('from', v_before, 'to', p_role));

  return jsonb_build_object('ok', true, 'from', v_before, 'to', p_role);
end;
$$;

grant execute on function public.admin_set_user_role(uuid, public.user_role)
  to authenticated;

create or replace function public.admin_set_user_active(
  p_user_id uuid,
  p_active  boolean,
  p_reason  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.assert_admin();
begin
  if p_user_id = v_admin then
    raise exception 'Kendi hesabınızı kapatamazsınız.'
      using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Kullanıcı bulunamadı.' using errcode = 'no_data_found';
  end if;

  update public.profiles set is_active = p_active where id = p_user_id;
  perform public.log_admin_action(
    v_admin, 'profile', p_user_id,
    case when p_active then 'activate' else 'deactivate' end, p_reason);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_set_user_active(uuid, boolean, text)
  to authenticated;

-- --- Yorum moderasyonu ------------------------------------------------------

create or replace function public.admin_list_reviews(
  p_status public.review_status default null,
  p_limit  integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid, venue_id uuid, venue_name text, venue_slug text,
  author_name text, rating smallint, title text, body text,
  status public.review_status, admin_note text,
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
    r.id, r.venue_id, v.name, v.slug,
    p.full_name, r.rating, r.title, r.body,
    r.status, r.admin_note, r.created_at,
    count(*) over ()
  from public.reviews r
  join public.venues v   on v.id = r.venue_id
  join public.profiles p on p.id = r.user_id
  where (p_status is null or r.status = p_status)
  -- Bekleyenler önce; moderasyon kuyruğu.
  order by case when r.status = 'PENDING' then 0 else 1 end, r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

grant execute on function public.admin_list_reviews(
  public.review_status, integer, integer) to authenticated;

create or replace function public.admin_moderate_review(
  p_review_id uuid,
  p_status    public.review_status,
  p_note      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.assert_admin();
begin
  if not exists (select 1 from public.reviews where id = p_review_id) then
    raise exception 'Yorum bulunamadı.' using errcode = 'no_data_found';
  end if;

  -- Puan sayaçları `refresh_venue_rating` trigger'ı ile güncelleniyor;
  -- burada elle hesaplamıyoruz.
  update public.reviews
     set status = p_status, admin_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_review_id;

  perform public.log_admin_action(
    v_admin, 'review', p_review_id, 'moderate:' || p_status::text, p_note);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_moderate_review(
  uuid, public.review_status, text) to authenticated;
