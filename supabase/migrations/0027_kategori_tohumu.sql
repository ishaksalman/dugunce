-- =============================================================================
-- Düğünce · 0027 · Planlanan işletme kategorileri
--
-- Ana sayfadaki "Ne arıyorsun?" seçimi kategorilerden besleniyor. Kategori
-- listesi component içine GÖMÜLMEZ (şehir/etkinlik türü gibi) — burada
-- duruyor ki ikinci kategori açılırken tek yapılacak iş `is_active = true`.
--
-- Bunlar PASİF doğuyor: vitrinde "yakında" olarak görünüyor, tıklanabilir
-- değil ve hiçbir mekan bunlara bağlanamıyor. Ölü bağlantı üretmiyoruz.
--
-- `path_prefix` şimdiden ayrılıyor: kategori kendi adres alanına sahip
-- (/mekanlar/…, /fotografcilar/…). Sonradan vermek, kategori yayına
-- girdiğinde adres şemasını yeniden tartışmak demek.
-- =============================================================================

insert into public.business_categories (slug, name, plural_name, path_prefix, sort_order, is_active)
values
  ('fotografci',   'Fotoğrafçı',      'Düğün Fotoğrafçıları', 'fotografcilar',  20, false),
  ('gelinlik',     'Gelinlik',        'Gelinlik',             'gelinlik',       30, false),
  ('organizasyon', 'Organizasyon',    'Düğün Organizasyonu',  'organizasyon',   40, false),
  ('sac-makyaj',   'Saç & Makyaj',    'Gelin Saçı ve Makyajı','sac-makyaj',     50, false),
  ('muzik',        'Müzik',           'Düğün Müziği',         'muzik',          60, false)
on conflict (slug) do nothing;

comment on column public.business_categories.is_active is
  'false = planlanan kategori. Ana sayfada "yakında" olarak görünür, '
  'tıklanamaz ve mekan bağlanamaz. Yayına almak için true yeter.';
