-- =============================================================================
-- Düğünce · 0015 · SEO landing sayfalarının üretimi
--
-- İndekslenen tek liste yüzeyi bu sayfalar. `/mekanlar?filtre=` her zaman
-- noindex; sonsuz permütasyon duplicate content üretir.
--
-- THIN CONTENT KORUMASI: bir sayfa ancak yeterli mekan varsa `is_active`
-- olur. Altındakiler 200 döner (kullanıcı boş sayfa görmesin) ama noindex
-- alır ve sitemap'e girmez. 81 il × 9 etkinlik × ilçeler = binlerce boş
-- sayfa üretmiyoruz.
-- =============================================================================

-- --- Türkçe bulunma hâli eki ------------------------------------------------
-- "İstanbul'da", "Bursa'da", "Uşak'ta", "İzmir'de".
-- Ünlü uyumu (kalın/ince) + ünsüz benzeşmesi (sert ünsüzden sonra t).

create or replace function public.tr_locative(p_word text)
returns text
language plpgsql
immutable
as $$
declare
  v_word  text := btrim(p_word);
  v_lower text;
  v_ch    text;
  v_last_vowel text := '';
  v_last_char  text;
  i integer;
  v_ek text;
begin
  if coalesce(v_word, '') = '' then return ''; end if;

  -- Türkçe küçültme: İ→i, I→ı (lower() bunları yerelleştirmeye göre bozuyor)
  v_lower := lower(translate(v_word, 'İIÇĞÖŞÜ', 'iıçğöşü'));

  for i in reverse length(v_lower)..1 loop
    v_ch := substr(v_lower, i, 1);
    if v_ch in ('a','e','ı','i','o','ö','u','ü') then
      v_last_vowel := v_ch;
      exit;
    end if;
  end loop;

  v_last_char := substr(v_lower, length(v_lower), 1);

  -- Kalın ünlüler → -da/-ta, ince ünlüler → -de/-te
  if v_last_vowel in ('a','ı','o','u') then
    v_ek := 'da';
  else
    v_ek := 'de';
  end if;

  -- Sert ünsüzle bitiyorsa d→t (fıstıkçı şahap)
  if v_last_char in ('f','s','t','k','ç','ş','h','p') then
    v_ek := translate(v_ek, 'd', 't');
  end if;

  -- Özel isim: kesme işareti
  return v_word || '''' || v_ek;
end;
$$;

grant execute on function public.tr_locative(text) to anon, authenticated;

-- --- Sayfa üretimi ----------------------------------------------------------
-- Yalnızca EN AZ BİR yayınlanmış mekanı olan kombinasyonlar için satır
-- açılıyor; hiç mekanı olmayan kombinasyon 404 olmalı, ortada içerik yok.
--
-- Başlık ve açıklama üretilirken ELLE DÜZENLENMİŞ metinler korunuyor:
-- yönetici bir sayfanın metnini değiştirdiyse otomatik üretim ezmez.

create or replace function public.refresh_seo_pages(p_min_venues smallint default 3)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_created integer := 0;
  v_activated integer := 0;
  v_deactivated integer := 0;
begin
  -- --- Etkinlik türü sayfaları: /dugun-mekanlari ---------------------------
  insert into public.seo_pages (path, kind, event_type_id, title, meta_description, h1, min_venue_count)
  select
    e.slug || '-mekanlari',
    'etkinlik',
    e.id,
    public.tr_capitalize(e.seo_noun) || ' Mekanları — Fiyatları, Kapasiteleri ve Hizmetleri',
    'Türkiye genelinde ' || e.seo_noun || ' mekanları. Kapasite, fiyat ve '
      || 'hizmetleri karşılaştırın, mekanlardan ücretsiz teklif alın.',
    public.tr_capitalize(e.seo_noun) || ' Mekanları',
    p_min_venues
  from public.event_types e
  where e.is_active
  on conflict (path) do nothing;

  -- --- Şehir sayfaları: /istanbul-davet-mekanlari --------------------------
  insert into public.seo_pages (path, kind, city_id, title, meta_description, h1, min_venue_count)
  select
    c.slug || '-davet-mekanlari',
    'sehir',
    c.id,
    c.name || ' Davet Mekanları — Düğün, Nişan ve Kına Salonları',
    public.tr_locative(c.name) || ' düğün, nişan, kına ve tüm özel günleriniz '
      || 'için davet mekanları. Kapasite ve fiyatları karşılaştırın.',
    c.name || ' Davet Mekanları',
    p_min_venues
  from public.cities c
  where exists (
    select 1 from public.venues v where v.city_id = c.id and v.status = 'PUBLISHED'
  )
  on conflict (path) do nothing;

  -- --- Şehir × etkinlik: /istanbul-dugun-mekanlari -------------------------
  insert into public.seo_pages
    (path, kind, city_id, event_type_id, title, meta_description, h1, min_venue_count)
  select
    c.slug || '-' || e.slug || '-mekanlari',
    'sehir_etkinlik',
    c.id, e.id,
    c.name || ' ' || public.tr_capitalize(e.seo_noun) || ' Mekanları — Fiyatları ve Kapasiteleri',
    public.tr_locative(c.name) || ' ' || e.seo_noun || ' için mekan arayanlara: '
      || 'kapasite, fiyat ve hizmetleri karşılaştırın, ücretsiz teklif alın.',
    c.name || ' ' || public.tr_capitalize(e.seo_noun) || ' Mekanları',
    p_min_venues
  from public.cities c
  cross join public.event_types e
  where e.is_active
    and exists (
      select 1 from public.venues v
       where v.city_id = c.id and v.status = 'PUBLISHED'
         and v.event_type_slugs @> array[e.slug]
    )
  on conflict (path) do nothing;

  -- --- İlçe × etkinlik: /istanbul-beylikduzu-dugun-mekanlari ---------------
  insert into public.seo_pages
    (path, kind, city_id, district_id, event_type_id, title, meta_description, h1, min_venue_count)
  select
    c.slug || '-' || d.slug || '-' || e.slug || '-mekanlari',
    'ilce_etkinlik',
    c.id, d.id, e.id,
    d.name || ' ' || public.tr_capitalize(e.seo_noun) || ' Mekanları — ' || c.name,
    public.tr_locative(d.name) || ' ' || e.seo_noun || ' mekanları. '
      || c.name || ' ' || d.name || ' bölgesindeki mekanların kapasite ve '
      || 'fiyatlarını karşılaştırın.',
    d.name || ' ' || public.tr_capitalize(e.seo_noun) || ' Mekanları',
    p_min_venues
  from public.districts d
  join public.cities c on c.id = d.city_id
  cross join public.event_types e
  where e.is_active
    and exists (
      select 1 from public.venues v
       where v.district_id = d.id and v.status = 'PUBLISHED'
         and v.event_type_slugs @> array[e.slug]
    )
  on conflict (path) do nothing;

  get diagnostics v_created = row_count;

  -- --- Aktiflik: eşiği geçen açılır, düşen kapanır -------------------------
  with sayim as (
    select
      s.id,
      (select count(*)
         from public.venues v
        where v.status = 'PUBLISHED'
          and (s.city_id is null or v.city_id = s.city_id)
          and (s.district_id is null or v.district_id = s.district_id)
          and (s.event_type_id is null or v.event_type_slugs @> array[
                (select e.slug from public.event_types e where e.id = s.event_type_id)])
      ) as n
    from public.seo_pages s
  )
  update public.seo_pages s
     set is_active = (sayim.n >= s.min_venue_count)
    from sayim
   where sayim.id = s.id
     and s.is_active is distinct from (sayim.n >= s.min_venue_count);

  get diagnostics v_activated = row_count;

  select count(*) into v_deactivated from public.seo_pages where not is_active;

  return jsonb_build_object(
    'ok', true,
    'total',       (select count(*) from public.seo_pages),
    'active',      (select count(*) from public.seo_pages where is_active),
    'inactive',    v_deactivated,
    'changed',     v_activated
  );
end;
$$;

grant execute on function public.refresh_seo_pages(smallint) to authenticated;

-- --- Landing sayfası çözümü -------------------------------------------------
-- Yol ayrıştırılmıyor, tabloya bakılıyor: `path` tekil anahtar. Ayrıştırma
-- yapsaydık "davet" hem etkinlik türü hem şehir sayfası ekinde geçtiği için
-- belirsizlik olurdu.

create or replace function public.get_seo_page(p_path text)
returns jsonb
language sql
stable
as $$
  select to_jsonb(x) from (
    select
      s.id, s.path, s.kind, s.title, s.meta_description, s.h1,
      s.intro_html, s.faq, s.is_active, s.min_venue_count, s.updated_at,
      c.slug as city_slug, c.name as city_name,
      d.slug as district_slug, d.name as district_name,
      e.slug as event_slug, e.name as event_name, e.seo_noun as event_noun
    from public.seo_pages s
    left join public.cities c      on c.id = s.city_id
    left join public.districts d   on d.id = s.district_id
    left join public.event_types e on e.id = s.event_type_id
    where s.path = p_path
  ) x;
$$;

grant execute on function public.get_seo_page(text) to anon, authenticated;

-- --- Sitemap için aktif sayfalar --------------------------------------------

create or replace function public.list_active_seo_pages()
returns table (path text, updated_at timestamptz, kind public.seo_page_kind)
language sql
stable
as $$
  select s.path, s.updated_at, s.kind
    from public.seo_pages s
   where s.is_active
   order by
     -- Genel sayfalar önce; sitemap'te öncelik sırası olarak okunuyor.
     case s.kind when 'etkinlik' then 0 when 'sehir' then 1
                 when 'sehir_etkinlik' then 2 else 3 end,
     s.path;
$$;

grant execute on function public.list_active_seo_pages() to anon, authenticated;
