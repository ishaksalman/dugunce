# Düğünce ↔ DavetPro Entegrasyon Kontratı

Sürüm 1 · Bu belge iki depo arasındaki **sözleşmedir**. Bir tarafı
değiştirirken diğerini kırmamak için önce burayı güncelleyin.

- Düğünce: `~/Desktop/davet/davetmekani` — pazaryeri, müşteri tarafı
- DavetPro: `~/Desktop/davet/davetpro` — işletme yönetimi, operasyon tarafı

## Marka adı ve kontrat adları

Ürünün adı **Düğünce** (alan adı `dugunce.com`). Kontrattaki şu adlar
BİLEREK `davetmekani` olarak kaldı:

- uç nokta yolu `/api/integrations/davetmekani/…`
- gövde alanı `davetmekani_venue_id`
- imza `iss` değeri ve DavetPro'daki `leads.external_source` = `"davetmekani"`
- depo dizini `~/Desktop/davet/davetmekani`

Bunlar marka yüzeyi değil, iki tarafın üzerinde anlaştığı **tanımlayıcılar**.
`external_source` üstelik DavetPro'da kayıtlı veri: değiştirmek mevcut
lead'lerin kaynağını kopuk bırakır. Yeniden adlandırmak isterseniz iki depoda
aynı anda yapılması ve DavetPro'da veri göçü yazılması gerekir — ayrı bir iş.

## Temel ilkeler

1. **İki ayrı veritabanı, iki ayrı Supabase projesi.** Cross-DB foreign key,
   paylaşılan tablo veya paylaşılan şema **yoktur**. İletişim yalnızca HTTP.
2. **Her alanın tek sahibi var.** Aynı veri iki yerde düzenlenmez.
3. **Tek yön kuralı.** Bir veri A'dan B'ye akıyorsa, B onu değiştirip geri
   göndermez.
4. **Idempotency zorunlu.** Aynı isteği iki kez göndermek ikinci bir kayıt
   üretmemeli. Ağ hatası ve yeniden deneme normaldir.

## Veri sahipliği

| Veri | Sahibi | Yön |
|---|---|---|
| Vitrin içeriği (foto, açıklama, fiyat, SEO) | **Düğünce** | senkron yok |
| Teklif talebi (lead) | Düğünce üretir | **→ DavetPro** |
| Rezervasyon, ödeme, sözleşme, teklif | **DavetPro** | Düğünce görmez |
| Dolu tarihler | **DavetPro** | → Düğünce *(v2)* |

## Kimlik doğrulama

Paylaşımlı gizli anahtar: **`DAVETPRO_INTEGRATION_SECRET`** (her iki tarafta
aynı, en az 32 bayt rastgele). Uygulama:

```
X-Dm-Timestamp: <unix saniye>
X-Dm-Signature: sha256=<hex HMAC>

HMAC girdisi: `${timestamp}.${ham istek gövdesi}`
```

Alıcı taraf:
- İmzayı **sabit zamanlı** karşılaştırır (`timingSafeEqual`).
- `timestamp` 5 dakikadan eskiyse reddeder (replay koruması).
- İmza geçersizse **401**, gövde bozuksa **400** döner; ikisini ayırt eder.

## Tip eşlemesi

Düğünce `event_types.slug` → DavetPro `organization_type`:

| Düğünce | DavetPro |
|---|---|
| `dugun` | `dugun` |
| `nisan` | `nisan` |
| `kina` | `kina` |
| `soz` | `soz` |
| `sunnet` | `sunnet` |
| `davet` | `davet` |
| `kurumsal-etkinlik` | `kurumsal` |
| `dogum-gunu` | `diger` |
| `mezuniyet` | `diger` |
| *(boş)* | `dugun` *(DavetPro varsayılanı)* |

Eşlenmemiş bir slug gelirse **`diger`** kullanılır ve DavetPro tarafında
uyarı loglanır — sessizce düşürülmez.

Düğünce `inquiry_status` → DavetPro `lead_status`: **eşleme yok.**
Aktarılan her talep DavetPro'da `yeni` olarak başlar; durum yönetimi
aktarımdan sonra tamamen DavetPro'nun işidir (tek yön kuralı).

---

## Uç nokta 1 — Talep aktarımı

`POST {DAVETPRO_URL}/api/integrations/davetmekani/leads`

Canlı gönderim ve geçmiş toplu aktarım **aynı uç noktayı** kullanır; tek
fark istek gövdesindeki kayıt sayısıdır.

```jsonc
{
  "v": 1,
  "business_id": "uuid",          // DavetPro işletmesi
  "leads": [{
    "external_id":       "uuid",  // Düğünce inquiries.id — IDEMPOTENCY ANAHTARI
    "davetpro_venue_id": "uuid",  // null olabilir (işletmeye bağlanır, salona değil)
    "full_name":         "Ayşe Yılmaz",
    "phone":             "05321112233",
    "email":             "ayse@ornek.com",   // null olabilir
    "event_type_slug":   "dugun",            // null olabilir
    "event_date":        "2027-06-12",       // null olabilir
    "guest_count":       320,                // null olabilir
    "message":           "…",                // null olabilir
    "created_at":        "2026-09-08T14:00:00Z"
  }]
}
```

Yanıt:

```jsonc
{
  "ok": true,
  "results": [
    { "external_id": "uuid", "lead_id": "uuid", "created": true  },
    { "external_id": "uuid", "lead_id": "uuid", "created": false }  // zaten vardı
  ]
}
```

**Kurallar**

- Toplu istekte en fazla **200** kayıt.
- `created: false` hata değildir; idempotency çalışmış demektir.
- DavetPro tarafında müşteri kaydı `(business_id, phone)` ile **bul-veya-oluştur**
  edilir; aynı kişi ikinci bir müşteri kaydı üretmez.
- Kısmi başarı yoktur: istek tek transaction'da işlenir.

---

## Uç nokta 2 — Bağlama kodu doğrulama

Mekan sahibinin **her iki üründe de hesabı varken** kullandığı akış.

```
DavetPro › Ayarlar › "Düğünce'de yayınla"  (0040: yalnızca yönetici)
  → tek kullanımlık kod üretir (6 haneli, 15 dk TTL, business_id + venue_id taşır)
Düğünce › Panel › "DavetPro hesabımı bağla" → kod girilir
  → Düğünce bu uç noktayı çağırır
```

`POST {DAVETPRO_URL}/api/integrations/davetmekani/verify-link`

```jsonc
// istek
{ "v": 1, "code": "A7K2M9" }

// yanıt
{ "ok": true, "business_id": "uuid", "business_name": "Gül Organizasyon",
  "venue_id": "uuid", "venue_name": "Gül Düğün Salonu" }
```

Kod tüketilir (tek kullanımlık). Geçersiz/süresi dolmuş kod → **410**.

---

## Uç nokta 3 — DavetPro'ya geçiş (handoff)

Mekan sahibinin **yalnızca Düğünce hesabı varken** kullandığı akış.
Amaç: kullanıcının verilerini yeniden yazmasını önlemek.

```
Düğünce › Panel › "DavetPro'ya geç"
  → imzalı handoff jetonu üretir
  → kullanıcı {DAVETPRO_URL}/isletme-kur?handoff=<jeton> adresine gider
  → DavetPro imzayı doğrular, formu ön doldurur, e-postayı doğrulanmış sayar
  → kullanıcı SADECE parola belirler
  → DavetPro işletmeyi ve salonları oluşturur
  → DavetPro callback ile eşleşmeyi Düğünce'ye bildirir
  → Düğünce geçmiş talepleri aktarır
```

Handoff jetonu (base64url gövde + `.` + imza), **TTL 15 dakika**:

```jsonc
{
  "v": 1,
  "iss": "davetmekani",
  "iat": 1788883726,
  "exp": 1788884626,
  "user": {
    "email": "ayse@ornek.com",     // Düğünce'de DOĞRULANMIŞ adres
    "full_name": "Ayşe Yılmaz",
    "phone": "05321112233"
  },
  "business_name": "Bahçe Davet",
  "venues": [{
    "davetmekani_venue_id": "uuid",
    "name": "Bahçe Davet",
    "city": "İstanbul",
    "district": "Beylikdüzü",
    "min_capacity": 100,
    "max_capacity": 500,
    "phone": "0850 000 00 00"
  }],
  "callback_url": "https://dugunce.com/api/integrations/davetpro/link-complete"
}
```

**E-posta doğrulaması:** DavetPro, jetondaki e-postayı doğrulanmış kabul
eder — Düğünce zaten doğrulamıştır ve jeton imzalıdır. Kullanıcıyı
ikinci kez doğrulatmak geçişi anlamsız yere zorlaştırır.

Callback (DavetPro → Düğünce), aynı HMAC şemasıyla imzalı:

`POST {callback_url}`

```jsonc
{
  "v": 1,
  "business_id": "uuid",
  "mappings": [
    { "davetmekani_venue_id": "uuid", "davetpro_venue_id": "uuid" }
  ]
}
```

Düğünce bu çağrıyı alınca:
1. `venues.davetpro_business_id` / `davetpro_venue_id` / `davetpro_linked_at` yazar,
2. **o mekanın tüm geçmiş taleplerini** Uç Nokta 1 üzerinden aktarır,
3. panelde mekanı "DavetPro'ya bağlı" olarak işaretler.

---

## Hata ve yeniden deneme

- Gönderen taraf **kullanıcı akışını bloklamaz.** Talep her koşulda
  Düğünce'ye kaydedilir; DavetPro'ya aktarım başarısız olursa kuyruğa
  yazılır ve tekrar denenir.
- Yeniden deneme: 1 dk, 5 dk, 30 dk, 2 sa, 12 sa. Beş denemeden sonra durur
  ve admin panelinde görünür.
- `external_id` sayesinde tekrar deneme çift kayıt üretmez.

## Ortam değişkenleri

| Değişken | Düğünce | DavetPro |
|---|---|---|
| `DAVETPRO_INTEGRATION_SECRET` | ✓ | ✓ *(aynı değer)* |
| `DAVETPRO_URL` | ✓ | — |
| `DAVETMEKANI_URL` | — | ✓ |

## Sürüm 2'ye bırakılanlar

- Dolu tarihlerin DavetPro → Düğünce akışı (`venue_availability`)
- DavetPro'da verilen teklifin Düğünce'de talep sahibine gösterilmesi
- Bağlantı koparma (unlink) ve veri sahipliğinin geri devri
