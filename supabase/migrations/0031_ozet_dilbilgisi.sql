-- =============================================================================
-- Düğünce · 0031 · Özet metninin Türkçesini düzelt
--
-- 0030 üç hata üretiyordu:
--
--   1. "İstanbul Beylikdüzü'de"  →  doğrusu "Beylikdüzü'nde"
--      `tr_locative` ünlüyle biten sözcüğe kaynaştırma 'n'si koymuyor. Bu
--      kural aslında ALGORİTMİK DEĞİL: "Ankara'da" doğru ama "Beylikdüzü'nde"
--      doğru — fark, sondaki ünlünün iyelik eki olup olmaması ve bunu ad
--      listesine bakmadan bilmek mümkün değil.
--
--      Çözüm: ilçe adına ek TAKMIYORUZ. "İstanbul'un Beylikdüzü ilçesinde"
--      kalıbında ek "ilçe" sözcüğüne geliyor ve o sabit. Şehir tarafında
--      tamlayan eki gerekiyor ki O algoritmik: ünlüyle bitene kaynaştırma
--      'n'si girer (Ankara'nın), ünsüzle bitene girmez (İstanbul'un).
--
--   2. "1,250 TL"  →  to_char'ın 'G' ayracı yerel ayara bakıyor ve virgül
--      basıyor. Türkçede binlik ayracı nokta.
--
--   3. "…bulunan bir kır bahçesi."  →  yüklemsiz. Ek fiil (-dır/-dir/-tır…)
--      ünlü ve ünsüz uyumu istiyor; onun yerine gerçek bir yüklem kuruyoruz.
-- =============================================================================

create or replace function public.tr_genitive(p_word text)
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

  -- Türkçe küçültme: İ→i, I→ı (lower() yerelleştirmeye göre bozuyor)
  v_lower := lower(translate(v_word, 'İIÇĞÖŞÜ', 'iıçğöşü'));

  for i in reverse length(v_lower)..1 loop
    v_ch := substr(v_lower, i, 1);
    if v_ch in ('a','e','ı','i','o','ö','u','ü') then
      v_last_vowel := v_ch;
      exit;
    end if;
  end loop;

  v_last_char := substr(v_lower, length(v_lower), 1);

  -- Dört biçimli ünlü uyumu
  v_ek := case
    when v_last_vowel in ('a','ı') then 'ın'
    when v_last_vowel in ('e','i') then 'in'
    when v_last_vowel in ('o','u') then 'un'
    when v_last_vowel in ('ö','ü') then 'ün'
    else 'in'
  end;

  -- Ünlüyle bitiyorsa kaynaştırma 'n'si: Ankara'nın, Bursa'nın, Ordu'nun.
  -- Tamlayan ekinde bu kural istisnasız — iyelikli locative'in aksine.
  if v_last_char in ('a','e','ı','i','o','ö','u','ü') then
    v_ek := 'n' || v_ek;
  end if;

  return v_word || '''' || v_ek;
end;
$$;

grant execute on function public.tr_genitive(text) to anon, authenticated;

-- --- Türkçe para biçimi ------------------------------------------------------

create or replace function public.tr_money(p_amount numeric)
returns text
language sql
immutable
as $$
  -- to_char'ın 'G' ayracı yerel ayara bağlı; binlik ayracını kendimiz koyuyoruz.
  select replace(to_char(p_amount, 'FM999,999,999'), ',', '.');
$$;

grant execute on function public.tr_money(numeric) to anon, authenticated;

-- --- Özet -------------------------------------------------------------------

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
  v_liste    text;
  v_adet     integer;
begin
  select
    ve.name, ve.min_capacity, ve.max_capacity, ve.has_indoor, ve.has_outdoor,
    ve.starting_price, ve.price_type,
    c.name as city_name, d.name as district_name, vt.name as venue_type_name
    into v
    from public.venues ve
    join public.cities c     on c.id = ve.city_id
    join public.districts d  on d.id = ve.district_id
    left join public.venue_types vt on vt.id = ve.venue_type_id
   where ve.id = p_venue_id;

  if not found then return null; end if;

  -- --- 1) Kimlik ve konum ---------------------------------------------------
  -- Ek ilçe adına DEĞİL "ilçe" sözcüğüne geliyor; ilçe adının iyelikli olup
  -- olmadığını bilmek zorunda kalmıyoruz.
  v_cumleler := v_cumleler || (
    v.name || ', ' || public.tr_genitive(v.city_name) || ' ' || v.district_name ||
    ' ilçesinde ' ||
    coalesce('bir ' || lower(v.venue_type_name), 'davet mekanı') ||
    ' olarak hizmet veriyor.')::text;

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
    v_cumleler := v_cumleler ||
      ('Sunulan hizmetler arasında ' || v_liste || ' yer alıyor.')::text;
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
  if v.starting_price is not null and v.price_type = 'kisi_basi' then
    v_cumleler := v_cumleler ||
      ('Fiyatlar kişi başı ' || public.tr_money(v.starting_price) ||
       ' TL''den başlıyor.')::text;
  elsif v.starting_price is not null then
    v_cumleler := v_cumleler ||
      ('Başlangıç fiyatı ' || public.tr_money(v.starting_price) || ' TL.')::text;
  end if;

  return array_to_string(v_cumleler, ' ');
end;
$$;

grant execute on function public.venue_auto_summary(uuid) to anon, authenticated;
