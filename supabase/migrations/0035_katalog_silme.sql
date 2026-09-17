-- =============================================================================
-- Düğünce · 0035 · Katalog kaydını silme
--
-- Kural şuydu: "mekan silinmez, SUSPENDED yapılır — gelen teklif talepleri ve
-- yorumlar öksüz kalmasın." Bu kural gerçek, geçmişi olan mekanlar için
-- doğru ve DEĞİŞMİYOR.
--
-- Ama toplu katalog girişi yeni bir durum yarattı: yönetimin yanlışlıkla
-- açtığı kayıt. Google araması "düğün salonu" derken "Turlar" ve "Kafe"
-- kategorili işletmeler de geliyor. Bunlar askıya alınacak mekan değil,
-- hiç olmaması gereken kayıt. Askıda tutmak katalogda çöp biriktirmek olur.
--
-- Silme YALNIZCA güvenli olduğunda: sahipsiz, hiç yayınlanmamış, teklif
-- talebi ve yorumu olmayan kayıt. Bu dördü de kaydın "geçmişi yok"
-- demenin bileşenleri. Biri bile doğru değilse askıya alma kullanılır.
-- =============================================================================

create or replace function public.admin_delete_venue(p_venue_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.assert_admin();
  v        public.venues;
  v_talep  integer;
  v_yorum  integer;
begin
  select * into v from public.venues where id = p_venue_id;
  if not found then
    raise exception 'Mekan bulunamadı.' using errcode = 'no_data_found';
  end if;

  if v.owner_id is not null then
    raise exception 'Sahiplenilmiş mekan silinemez; askıya alın.'
      using errcode = 'check_violation';
  end if;
  if v.published_at is not null then
    raise exception 'Yayınlanmış mekan silinemez; askıya alın.'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_talep from public.inquiries where venue_id = p_venue_id;
  if v_talep > 0 then
    raise exception 'Bu mekana % teklif talebi gelmiş; silinemez, askıya alın.', v_talep
      using errcode = 'check_violation';
  end if;

  select count(*) into v_yorum from public.reviews where venue_id = p_venue_id;
  if v_yorum > 0 then
    raise exception 'Bu mekanın % yorumu var; silinemez, askıya alın.', v_yorum
      using errcode = 'check_violation';
  end if;

  -- Denetim izi SİLMEDEN ÖNCE: sonradan "bu kayıt neydi" diye bakılabilsin.
  -- entity_id'nin FK'sı yok, kayıt gidince iz kalıyor.
  perform public.log_admin_action(
    v_admin, 'venue', p_venue_id, 'deleted:catalog', null,
    jsonb_build_object('name', v.name, 'slug', v.slug,
                       'place_id', v.google_place_id,
                       'phone', v.contact_phone));

  delete from public.venues where id = p_venue_id;

  return jsonb_build_object('ok', true, 'name', v.name);
end;
$$;

grant execute on function public.admin_delete_venue(uuid) to authenticated;

-- --- Listeye "silinebilir mi" bilgisi ---------------------------------------
-- Arayüz düğmeyi buna bakarak gösteriyor; kural tek yerde kalsın.

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
  can_delete boolean,
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
    (v.owner_id is null
      and v.published_at is null
      and not exists (select 1 from public.inquiries q where q.venue_id = v.id)
      and not exists (select 1 from public.reviews r where r.venue_id = v.id)),
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
