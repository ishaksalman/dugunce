-- =============================================================================
-- DavetMekanı · 0016 · Türkçe başlık büyütmesi (her kelime)
--
-- `tr_capitalize` yalnızca ilk harfi büyütüyordu; çok kelimeli etkinlik
-- adlarında "Doğum günü Mekanları" ve "Kurumsal etkinlik Mekanları" gibi
-- yanlış başlıklar üretiyordu. Başlıkta her kelime büyük olmalı.
-- =============================================================================

create or replace function public.tr_capitalize(p_text text)
returns text
language plpgsql
immutable
as $$
declare
  v      text := btrim(p_text);
  kelime text;
  ilk    text;
  sonuc  text := '';
begin
  if coalesce(v, '') = '' then return ''; end if;

  foreach kelime in array regexp_split_to_array(v, '\s+') loop
    if kelime = '' then continue; end if;
    ilk := substr(kelime, 1, 1);
    -- Türkçe: 'i' → 'İ', 'ı' → 'I'. upper() yerelleştirmeye göre 'I' üretir.
    if ilk = 'i' then
      ilk := 'İ';
    elsif ilk = 'ı' then
      ilk := 'I';
    else
      ilk := upper(ilk);
    end if;
    sonuc := sonuc || case when sonuc = '' then '' else ' ' end
             || ilk || substr(kelime, 2);
  end loop;

  return sonuc;
end;
$$;

-- Mevcut satırların başlıklarını da düzelt: `refresh_seo_pages` yalnızca
-- yeni satır ekliyor (on conflict do nothing), eskileri güncellemiyor.
update public.seo_pages s
   set title = c.name || ' ' || public.tr_capitalize(e.seo_noun)
               || ' Mekanları — Fiyatları ve Kapasiteleri',
       h1    = c.name || ' ' || public.tr_capitalize(e.seo_noun) || ' Mekanları'
  from public.cities c, public.event_types e
 where s.kind = 'sehir_etkinlik' and s.city_id = c.id and s.event_type_id = e.id;

update public.seo_pages s
   set title = public.tr_capitalize(e.seo_noun)
               || ' Mekanları — Fiyatları, Kapasiteleri ve Hizmetleri',
       h1    = public.tr_capitalize(e.seo_noun) || ' Mekanları'
  from public.event_types e
 where s.kind = 'etkinlik' and s.event_type_id = e.id;

update public.seo_pages s
   set title = d.name || ' ' || public.tr_capitalize(e.seo_noun)
               || ' Mekanları — ' || c.name,
       h1    = d.name || ' ' || public.tr_capitalize(e.seo_noun) || ' Mekanları'
  from public.districts d, public.cities c, public.event_types e
 where s.kind = 'ilce_etkinlik' and s.district_id = d.id
   and s.city_id = c.id and s.event_type_id = e.id;
