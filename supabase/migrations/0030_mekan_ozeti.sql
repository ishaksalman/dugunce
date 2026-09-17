-- =============================================================================
-- Düğünce · 0030 · Mekan özeti (yapılandırılmış veriden)
--
-- Katalog kaydı açılır açılmaz detay sayfası dolu görünsün. Metin YALNIZCA
-- veritabanındaki olgulardan kuruluyor: ilçe, mekan türü, kapasite, açık/
-- kapalı alan, fiyat, etkinlik türleri, özellikler ve hizmetler.
--
-- BİLMEDİĞİMİZ HİÇBİR ŞEY YAZILMAZ. Kuruluş yılı yok — yazmıyoruz. Müşteri
-- memnuniyeti hakkında veri yok — "misafirler memnun" demiyoruz. Eksik alan
-- cümleyi düşürüyor, uydurmuyor.
--
-- Neden SQL: Türkçe ek mantığı (tr_locative) burada. İkinci bir kopyasını
-- TypeScript'te tutmak, iki tarafın sessizce ayrışması demek — slugify'da
-- bir kez yaşandı.
--
-- Bu metin `venues.description` KOLONUNA YAZILMAZ. Kolon mekan sahibinin
-- kendi anlatımı; tamamlanma oranı da onu ölçüyor. Otomatik metin yalnızca
-- açıklama boşken vitrinde gösteriliyor, sahibi yazınca kenara çekiliyor.
-- =============================================================================

create or replace function public.venue_auto_summary(p_venue_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
  v_cumleler text[] := '{}';
  v_parca    text;
  v_liste    text;
  v_adet     integer;
begin
  select
    ve.name, ve.min_capacity, ve.max_capacity, ve.has_indoor, ve.has_outdoor,
    ve.starting_price, ve.price_type, ve.address,
    c.name as city_name, d.name as district_name, vt.name as venue_type_name
    into v
    from public.venues ve
    join public.cities c     on c.id = ve.city_id
    join public.districts d  on d.id = ve.district_id
    left join public.venue_types vt on vt.id = ve.venue_type_id
   where ve.id = p_venue_id;

  if not found then return null; end if;

  -- --- 1) Kimlik ve konum ---------------------------------------------------
  v_parca := v.name || ', ' || public.tr_locative(v.city_name || ' ' || v.district_name);
  if v.venue_type_name is not null then
    v_parca := v_parca || ' bulunan bir ' || lower(v.venue_type_name) || '.';
  else
    v_parca := v_parca || ' bulunan bir davet mekanıdır.';
  end if;
  v_cumleler := v_cumleler || v_parca::text;

  -- --- 2) Kapasite ----------------------------------------------------------
  if v.min_capacity is not null and v.max_capacity is not null then
    v_cumleler := v_cumleler ||
      (v.min_capacity || ' ile ' || v.max_capacity ||
       ' kişi arasındaki davetlere ev sahipliği yapıyor.')::text;
  elsif v.max_capacity is not null then
    v_cumleler := v_cumleler ||
      (v.max_capacity || ' kişiye kadar davet ağırlayabiliyor.')::text;
  end if;

  -- --- 3) Açık / kapalı alan ------------------------------------------------
  -- DİKKAT: `text[] || 'düz metin'` ifadesinde literal `unknown` tipte kalıyor
  -- ve PostgreSQL onu dizi literali sanıp "malformed array literal" veriyor.
  -- Düz metin eklerken ::text cast'i ŞART.
  if v.has_indoor and v.has_outdoor then
    v_cumleler := v_cumleler ||
      'Hem kapalı hem açık alanı olduğu için yaz ve kış organizasyonlarına uygun.'::text;
  elsif v.has_outdoor then
    v_cumleler := v_cumleler || 'Açık alanda, bahçe düzeninde kutlama imkânı sunuyor.'::text;
  elsif v.has_indoor then
    v_cumleler := v_cumleler ||
      'Kapalı salonuyla hava koşullarından bağımsız bir kutlama sağlıyor.'::text;
  end if;

  -- --- 4) Etkinlik türleri --------------------------------------------------
  select count(*), string_agg(e.seo_noun, ', ' order by e.sort_order)
    into v_adet, v_liste
    from public.venue_event_types vet
    join public.event_types e on e.id = vet.event_type_id
   where vet.venue_id = p_venue_id and e.is_active;

  if coalesce(v_adet, 0) > 0 then
    v_cumleler := v_cumleler ||
      ('Mekan ' || v_liste || ' organizasyonları için tercih ediliyor.')::text;
  end if;

  -- --- 5) Hizmetler ---------------------------------------------------------
  select count(*), string_agg(lower(f.name), ', ' order by f.sort_order)
    into v_adet, v_liste
    from public.venue_features vf
    join public.features f on f.id = vf.feature_id
   where vf.venue_id = p_venue_id and f.is_active and f.kind = 'hizmet';

  if coalesce(v_adet, 0) > 0 then
    v_cumleler := v_cumleler || ('Sunulan hizmetler arasında ' || v_liste || ' yer alıyor.')::text;
  end if;

  -- --- 6) Özellikler --------------------------------------------------------
  select count(*), string_agg(lower(f.name), ', ' order by f.sort_order)
    into v_adet, v_liste
    from public.venue_features vf
    join public.features f on f.id = vf.feature_id
   where vf.venue_id = p_venue_id and f.is_active and f.kind = 'ozellik';

  if coalesce(v_adet, 0) > 0 then
    v_cumleler := v_cumleler || ('Mekanda ' || v_liste || ' bulunuyor.')::text;
  end if;

  -- --- 7) Fiyat -------------------------------------------------------------
  -- Yalnızca sahibi girdiyse. "Fiyat bilgisi yok" cümlesi kurmuyoruz.
  if v.starting_price is not null and v.price_type = 'kisi_basi' then
    v_cumleler := v_cumleler ||
      ('Fiyatlar kişi başı ' || trim(to_char(v.starting_price, '999G999G999')) ||
       ' TL''den başlıyor.')::text;
  elsif v.starting_price is not null then
    v_cumleler := v_cumleler ||
      ('Başlangıç fiyatı ' || trim(to_char(v.starting_price, '999G999G999')) || ' TL.')::text;
  end if;

  return array_to_string(v_cumleler, ' ');
end;
$$;

grant execute on function public.venue_auto_summary(uuid) to anon, authenticated;

-- --- Vitrine taşı -----------------------------------------------------------
-- Açıklama boşsa detay sayfası bunu gösteriyor; sahibi yazınca kenara çekiliyor.

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
      public.venue_auto_summary(v.id) as auto_summary,
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
