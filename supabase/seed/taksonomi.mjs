/**
 * Etkinlik türleri, mekan türleri ve özellik/hizmet listesi.
 * Bu veri hiçbir component'in içine gömülmez — arayüz her zaman DB'den okur.
 */

/** `seo_noun` başlık üretiminde kullanılır: "İstanbul {seo_noun} Mekanları". */
export const ETKINLIK_TURLERI = [
  { ad: "Düğün",              slug: "dugun",              seoAd: "Düğün",              ikon: "heart",     sira: 1 },
  { ad: "Nişan",              slug: "nisan",              seoAd: "Nişan",              ikon: "gem",       sira: 2 },
  { ad: "Kına Gecesi",        slug: "kina",               seoAd: "Kına",               ikon: "flame",     sira: 3 },
  { ad: "Söz",                slug: "soz",                seoAd: "Söz",                ikon: "handshake", sira: 4 },
  { ad: "Sünnet",             slug: "sunnet",             seoAd: "Sünnet",             ikon: "star",      sira: 5 },
  { ad: "Doğum Günü",         slug: "dogum-gunu",         seoAd: "Doğum Günü",         ikon: "cake",      sira: 6 },
  { ad: "Kurumsal Etkinlik",  slug: "kurumsal-etkinlik",  seoAd: "Kurumsal Etkinlik",  ikon: "briefcase", sira: 7 },
  { ad: "Mezuniyet",          slug: "mezuniyet",          seoAd: "Mezuniyet",          ikon: "graduation-cap", sira: 8 },
  { ad: "Diğer Davetler",     slug: "davet",              seoAd: "Davet",              ikon: "party-popper",   sira: 9 },
];

export const MEKAN_TURLERI = [
  { ad: "Kır Bahçesi",     slug: "kir-bahcesi",     sira: 1 },
  { ad: "Balo Salonu",     slug: "balo-salonu",     sira: 2 },
  { ad: "Düğün Salonu",    slug: "dugun-salonu",    sira: 3 },
  { ad: "Otel",            slug: "otel",            sira: 4 },
  { ad: "Restoran",        slug: "restoran",        sira: 5 },
  { ad: "Teras",           slug: "teras",           sira: 6 },
  { ad: "Kokteyl Bahçesi", slug: "kokteyl-bahcesi", sira: 7 },
  { ad: "Konak / Köşk",    slug: "konak-kosk",      sira: 8 },
  { ad: "Çiftlik",         slug: "ciftlik",         sira: 9 },
  { ad: "Plaj / Beach Club", slug: "plaj-beach-club", sira: 10 },
  { ad: "Tekne",           slug: "tekne",           sira: 11 },
  { ad: "Kültür Merkezi",  slug: "kultur-merkezi",  sira: 12 },
];

/**
 * `tur` alanı özellik/hizmet ayrımını yapar; ikisi aynı tabloda çünkü
 * mekanizmaları birebir aynı (filtrede kutucuk, detayda liste).
 * `filtrede: false` olanlar yalnızca detay sayfasında görünür — filtre
 * panelini 25 kutucukla boğmuyoruz.
 */
export const OZELLIKLER = [
  // --- Alan ve imkanlar ----------------------------------------------------
  { tur: "ozellik", grup: "Alan ve İmkanlar", ad: "Otopark",             slug: "otopark",             ikon: "car",          filtrede: true,  sira: 1 },
  { tur: "ozellik", grup: "Alan ve İmkanlar", ad: "Vale",                slug: "vale",                ikon: "car-front",    filtrede: true,  sira: 2 },
  { tur: "ozellik", grup: "Alan ve İmkanlar", ad: "Bahçe",               slug: "bahce",               ikon: "trees",        filtrede: true,  sira: 3 },
  { tur: "ozellik", grup: "Alan ve İmkanlar", ad: "Havuz",               slug: "havuz",               ikon: "waves",        filtrede: true,  sira: 4 },
  { tur: "ozellik", grup: "Alan ve İmkanlar", ad: "Deniz Manzarası",     slug: "deniz-manzarasi",     ikon: "sailboat",     filtrede: true,  sira: 5 },
  { tur: "ozellik", grup: "Alan ve İmkanlar", ad: "Teras",               slug: "teras-alani",         ikon: "sun",          filtrede: false, sira: 6 },
  { tur: "ozellik", grup: "Alan ve İmkanlar", ad: "Çocuk Oyun Alanı",    slug: "cocuk-oyun-alani",    ikon: "baby",         filtrede: false, sira: 7 },
  { tur: "ozellik", grup: "Alan ve İmkanlar", ad: "Misafir Konaklama",   slug: "konaklama",           ikon: "bed-double",   filtrede: false, sira: 8 },

  // --- Teknik donanım ------------------------------------------------------
  { tur: "ozellik", grup: "Teknik Donanım",   ad: "Sahne",               slug: "sahne",               ikon: "mic-vocal",    filtrede: true,  sira: 10 },
  { tur: "ozellik", grup: "Teknik Donanım",   ad: "Ses Sistemi",         slug: "ses-sistemi",         ikon: "speaker",      filtrede: true,  sira: 11 },
  { tur: "ozellik", grup: "Teknik Donanım",   ad: "Işıklandırma",        slug: "isiklandirma",        ikon: "lightbulb",    filtrede: true,  sira: 12 },
  { tur: "ozellik", grup: "Teknik Donanım",   ad: "Projeksiyon / Ekran", slug: "projeksiyon",         ikon: "monitor",      filtrede: false, sira: 13 },
  { tur: "ozellik", grup: "Teknik Donanım",   ad: "Jeneratör",           slug: "jenerator",           ikon: "zap",          filtrede: false, sira: 14 },

  // --- Konfor ve erişim ----------------------------------------------------
  { tur: "ozellik", grup: "Konfor ve Erişim", ad: "Klima",               slug: "klima",               ikon: "air-vent",     filtrede: true,  sira: 20 },
  { tur: "ozellik", grup: "Konfor ve Erişim", ad: "Gelin Odası",         slug: "gelin-odasi",         ikon: "door-open",    filtrede: true,  sira: 21 },
  { tur: "ozellik", grup: "Konfor ve Erişim", ad: "Engelli Erişimi",     slug: "engelli-erisimi",     ikon: "accessibility", filtrede: true, sira: 22 },
  { tur: "ozellik", grup: "Konfor ve Erişim", ad: "Asansör",             slug: "asansor",             ikon: "move-vertical", filtrede: false, sira: 23 },
  { tur: "ozellik", grup: "Konfor ve Erişim", ad: "Wi-Fi",               slug: "wifi",                ikon: "wifi",         filtrede: false, sira: 24 },

  // --- Yemek ve ikram ------------------------------------------------------
  { tur: "hizmet",  grup: "Yemek ve İkram",   ad: "Yemekli Menü",        slug: "yemekli",             ikon: "utensils",     filtrede: true,  sira: 30 },
  { tur: "hizmet",  grup: "Yemek ve İkram",   ad: "Catering",            slug: "catering",            ikon: "chef-hat",     filtrede: true,  sira: 31 },
  { tur: "hizmet",  grup: "Yemek ve İkram",   ad: "Alkol Servisi",       slug: "alkol-servisi",       ikon: "wine",         filtrede: true,  sira: 32 },
  { tur: "hizmet",  grup: "Yemek ve İkram",   ad: "Pasta",               slug: "pasta",               ikon: "cake-slice",   filtrede: false, sira: 33 },
  { tur: "hizmet",  grup: "Yemek ve İkram",   ad: "Masa / Sandalye",     slug: "masa-sandalye",       ikon: "armchair",     filtrede: false, sira: 34 },

  // --- Eğlence -------------------------------------------------------------
  { tur: "hizmet",  grup: "Eğlence",          ad: "DJ",                  slug: "dj",                  ikon: "disc-3",       filtrede: true,  sira: 40 },
  { tur: "hizmet",  grup: "Eğlence",          ad: "Canlı Müzik",         slug: "canli-muzik",         ikon: "music",        filtrede: true,  sira: 41 },
  { tur: "hizmet",  grup: "Eğlence",          ad: "Havai Fişek",         slug: "havai-fisek",         ikon: "sparkles",     filtrede: false, sira: 42 },

  // --- Organizasyon --------------------------------------------------------
  { tur: "hizmet",  grup: "Organizasyon",     ad: "Organizasyon Hizmeti", slug: "organizasyon",       ikon: "clipboard-list", filtrede: true, sira: 50 },
  { tur: "hizmet",  grup: "Organizasyon",     ad: "Fotoğraf Çekimi",     slug: "fotograf",            ikon: "camera",       filtrede: true,  sira: 51 },
  { tur: "hizmet",  grup: "Organizasyon",     ad: "Video Çekimi",        slug: "video",               ikon: "video",        filtrede: true,  sira: 52 },
  { tur: "hizmet",  grup: "Organizasyon",     ad: "Dekorasyon",          slug: "dekorasyon",          ikon: "flower-2",     filtrede: true,  sira: 53 },
  { tur: "hizmet",  grup: "Organizasyon",     ad: "Nikah Masası",        slug: "nikah-masasi",        ikon: "scroll-text",  filtrede: false, sira: 54 },
  { tur: "hizmet",  grup: "Organizasyon",     ad: "Gelin Arabası",       slug: "gelin-arabasi",       ikon: "car-taxi-front", filtrede: false, sira: 55 },
];
