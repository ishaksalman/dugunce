-- =============================================================================
-- Düğünce · 0029 · Telefon normalizasyonu ve ikinci mükerrer sinyali
--
-- 0028 adı karşılaştırıyor. Ad, aynı salonu farklı yazan girişi kaçırıyor:
-- "Boğaz Kır Düğün Evi" ile "Boğaz Kır Davet" ayrı kayıt sanılıyor.
-- Telefon bu boşluğu kapatıyor — AMA ham hâliyle işe yaramaz:
--
--   0212 111 22 33   +90 212 111 22 33   (0212) 111-22-33   02121112233
--
-- Dördü aynı numara, dördü farklı metin. Normalize edilmeden yapılan
-- telefon kontrolü hiçbir şey yakalamaz ve yakaladığını sanmak daha kötü.
--
-- Telefon adın YERİNE geçmiyor: katalog kaydı çoğu zaman telefonsuz açılıyor
-- (önce ad + ilçe, iletişim sonra). Boş kolonda tekillik hiçbir şey ifade
-- etmez. İkisi birlikte çalışıyor.
-- =============================================================================

create or replace function public.normalize_phone_tr(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when p_phone is null then null
    else (
      with rakam as (
        select regexp_replace(p_phone, '[^0-9]', '', 'g') as d
      )
      select case
        -- +90 212 111 22 33 → 2121112233
        when length(d) = 12 and left(d, 2) = '90' then right(d, 10)
        -- 0212 111 22 33 → 2121112233
        when length(d) = 11 and left(d, 1) = '0'  then right(d, 10)
        when length(d) = 10 then d
        -- Tanımadığımız biçim: olduğu gibi bırak, uydurma yapma.
        else nullif(d, '')
      end from rakam
    )
  end;
$$;

comment on function public.normalize_phone_tr(text) is
  'Türkiye telefon numarasını 10 haneye indirger (alan kodu + numara). '
  'Tanımadığı biçimi olduğu gibi bırakır.';

-- Üretilmiş kolon: uygulama kodu buraya ASLA yazmaz, tıpkı feature_slugs gibi.
alter table public.venues
  add column if not exists contact_phone_norm text
  generated always as (public.normalize_phone_tr(contact_phone)) stored;

create index if not exists venues_phone_norm_idx
  on public.venues (contact_phone_norm) where contact_phone_norm is not null;

-- --- Benzer kayıt aramasına telefonu ekle -----------------------------------

drop function if exists public.admin_find_similar_venues(text, uuid);

create or replace function public.admin_find_similar_venues(
  p_name    text,
  p_city_id uuid default null,
  p_phone   text default null
)
returns table (
  id uuid, name text, district_name text, status public.venue_status,
  is_claimed boolean, eslesme text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug  text := public.slugify_tr(coalesce(p_name, ''));
  v_tel   text := public.normalize_phone_tr(p_phone);
begin
  perform public.assert_admin();
  if length(v_slug) < 3 and v_tel is null then
    return;
  end if;

  return query
  select v.id, v.name, d.name, v.status, (v.owner_id is not null),
         -- Hangi sinyal eşleşti: arayüz "telefon aynı" diyebilsin.
         case when v_tel is not null and v.contact_phone_norm = v_tel
              then 'telefon' else 'ad' end
    from public.venues v
    join public.districts d on d.id = v.district_id
   where
     -- Telefon eşleşmesi ŞEHİRDEN bağımsız: aynı numara farklı ilçede
     -- girildiyse de bu bir mükerrer sinyalidir.
     (v_tel is not null and v.contact_phone_norm = v_tel)
     or (
       length(v_slug) >= 3
       and (p_city_id is null or v.city_id = p_city_id)
       and (public.slugify_tr(v.name) like '%' || v_slug || '%'
            or v_slug like '%' || public.slugify_tr(v.name) || '%')
     )
   order by (case when v_tel is not null and v.contact_phone_norm = v_tel
                  then 0 else 1 end), v.name
   limit 10;
end;
$$;

grant execute on function public.admin_find_similar_venues(text, uuid, text)
  to authenticated;

-- --- Kayıt açmada telefon kontrolü ------------------------------------------

create or replace function public.admin_create_venue(
  p_name        text,
  p_city_id     uuid,
  p_district_id uuid,
  p_category_id uuid default null,
  p_venue_type_id uuid default null,
  p_address     text default null,
  p_contact_phone text default null,
  p_website_url text default null,
  p_force       boolean default false
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
  v_ayni  text;
  v_tel   text := public.normalize_phone_tr(p_contact_phone);
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

  v_slug := public.slugify_tr(p_name);

  if not coalesce(p_force, false) then
    -- 1) Aynı ilçede aynı ad.
    select v.name into v_ayni
      from public.venues v
     where v.district_id = p_district_id
       and public.slugify_tr(v.name) = v_slug
     limit 1;
    if v_ayni is not null then
      raise exception 'Bu ilçede aynı adlı bir kayıt zaten var: %', v_ayni
        using errcode = 'unique_violation';
    end if;

    -- 2) Aynı telefon (ülke genelinde). Adı farklı yazılmış aynı salonu
    --    yakalayan sinyal bu. Santral paylaşan gerçek durumlar için
    --    p_force var — bu yüzden kısıt değil, kontrol.
    if v_tel is not null then
      select v.name into v_ayni
        from public.venues v
       where v.contact_phone_norm = v_tel
       limit 1;
      if v_ayni is not null then
        raise exception 'Bu telefon numarası başka bir kayıtta var: %', v_ayni
          using errcode = 'unique_violation';
      end if;
    end if;
  end if;

  while exists (select 1 from public.venues where slug =
                  v_slug || case when v_ek = 0 then '' else '-' || v_ek end) loop
    v_ek := v_ek + 1;
  end loop;
  v_slug := v_slug || case when v_ek = 0 then '' else '-' || v_ek end;

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
    null, jsonb_build_object('slug', v_slug, 'force', coalesce(p_force, false)));

  return jsonb_build_object('id', v_id, 'slug', v_slug);
end;
$$;

grant execute on function public.admin_create_venue(
  text, uuid, uuid, uuid, uuid, text, text, text, boolean) to authenticated;
