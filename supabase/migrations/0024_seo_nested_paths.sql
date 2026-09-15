-- =============================================================================
-- Düğünce · 0024 · Landing adresleri iç içe yapıya geçiyor
--
--   /istanbul-dugun-mekanlari            →  /istanbul/dugun-mekanlari
--   /istanbul-beylikduzu-dugun-mekanlari →  /istanbul/beylikduzu/dugun-mekanlari
--
-- Neden: kategori genişleyince (fotoğrafçı, gelinlik…) düz slug'da şehirle
-- kategori birbirinden ayırt edilemiyor. Şehir bir ad alanı olmalı.
-- Yayına çıkmadan yapılıyor: 301 yönlendirme ve indeks kaybı yok.
--
-- Bu arada ortaya çıkan bir tutarsızlık da kapanıyor: `sehir` sayfası ile
-- `davet` etkinliğinin şehir sayfası AYNI adrese düşüyordu. Bugün de öyleydi
-- ama görünmüyordu — `on conflict (path) do nothing` ikincisini sessizce
-- yutuyordu. Artık açıkça üretilmiyor.
-- =============================================================================

-- --- Yol biçimi artık `/` içerebiliyor --------------------------------------
alter table public.seo_pages drop constraint if exists seo_pages_path_check;
alter table public.seo_pages
  add constraint seo_pages_path_check
  check (path ~ '^[a-z0-9-]+(/[a-z0-9-]+)*$');

-- --- Mevcut satırların yolunu taşı ------------------------------------------
-- Eşleme `path` üzerinden DEĞİL, sayfayı tanımlayan kolonlar üzerinden:
-- elle düzenlenmiş başlık ve metinler yerinde kalsın.
-- Sıra önemli: en uzun yol ilk, `unique(path)` çakışmasın.

update public.seo_pages p
   set path = c.slug || '/' || d.slug || '/' || e.slug || '-mekanlari',
       updated_at = now()
  from public.cities c, public.districts d, public.event_types e
 where p.kind = 'ilce_etkinlik'
   and c.id = p.city_id and d.id = p.district_id and e.id = p.event_type_id;

update public.seo_pages p
   set path = c.slug || '/' || e.slug || '-mekanlari',
       updated_at = now()
  from public.cities c, public.event_types e
 where p.kind = 'sehir_etkinlik'
   and c.id = p.city_id and e.id = p.event_type_id;

update public.seo_pages p
   set path = c.slug || '/davet-mekanlari',
       updated_at = now()
  from public.cities c
 where p.kind = 'sehir' and c.id = p.city_id;

-- `etkinlik` sayfaları tek segment (/dugun-mekanlari) — değişmiyor.

-- --- Üretici ----------------------------------------------------------------
-- 0015'teki gövdenin aynısı; yalnızca dört yol formülü ve davet istisnası
-- değişti. Dönüş şekli ve yetkiler korundu (yönetim ekranı okuyor).

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

  -- --- Şehir: /istanbul/davet-mekanlari -------------------------------------
  insert into public.seo_pages (path, kind, city_id, title, meta_description, h1, min_venue_count)
  select
    c.slug || '/davet-mekanlari',
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

  -- --- Şehir × etkinlik: /istanbul/dugun-mekanlari --------------------------
  insert into public.seo_pages
    (path, kind, city_id, event_type_id, title, meta_description, h1, min_venue_count)
  select
    c.slug || '/' || e.slug || '-mekanlari',
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
    -- `davet` şehir düzeyinde ÜRETİLMİYOR: `sehir` sayfası birebir aynı
    -- adrese ve aynı içeriğe düşüyor. Önceden `on conflict do nothing`
    -- bunu sessizce yutuyordu; artık kural.
    and e.slug <> 'davet'
    and exists (
      select 1 from public.venues v
       where v.city_id = c.id and v.status = 'PUBLISHED'
         and v.event_type_slugs @> array[e.slug]
    )
  on conflict (path) do nothing;

  -- --- İlçe × etkinlik: /istanbul/beylikduzu/dugun-mekanlari ----------------
  -- İlçede `davet` ÜRETİLİYOR: ilçenin ayrı bir "davet" sayfası yok.
  insert into public.seo_pages
    (path, kind, city_id, district_id, event_type_id, title, meta_description, h1, min_venue_count)
  select
    c.slug || '/' || d.slug || '/' || e.slug || '-mekanlari',
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

-- --- Aktif sayfa listesi ----------------------------------------------------
-- İç bağlantı blokları etiket için sayfa yolunu tirelerinden ayırıp
-- "istanbul dugun mekanlari" yazıyordu. Artık h1 ve slug'lar da dönüyor.
-- Sıralama ve güvenlik kipi 0015'teki gibi: sitemap önceliği bu sıradan
-- okunuyor, RLS anonim kullanıcıya zaten yalnızca aktifleri veriyor.

drop function if exists public.list_active_seo_pages();

create or replace function public.list_active_seo_pages()
returns table (
  path text, updated_at timestamptz, kind public.seo_page_kind,
  h1 text, city_slug text, district_slug text, event_slug text
)
language sql
stable
as $$
  select
    s.path, s.updated_at, s.kind, s.h1,
    c.slug, d.slug, e.slug
    from public.seo_pages s
    left join public.cities c      on c.id = s.city_id
    left join public.districts d   on d.id = s.district_id
    left join public.event_types e on e.id = s.event_type_id
   where s.is_active
   order by
     -- Genel sayfalar önce; sitemap'te öncelik sırası olarak okunuyor.
     case s.kind when 'etkinlik' then 0 when 'sehir' then 1
                 when 'sehir_etkinlik' then 2 else 3 end,
     s.path;
$$;

grant execute on function public.list_active_seo_pages() to anon, authenticated;
