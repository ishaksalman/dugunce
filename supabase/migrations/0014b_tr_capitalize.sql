-- =============================================================================
-- Düğünce · 0016 · Türkçe baş harf büyütme ve başlık düzeltmesi
--
-- `event_types.seo_noun` iki bağlamda kullanılıyor:
--   başlıkta  → "İstanbul Düğün Mekanları"   (büyük)
--   cümlede   → "İstanbul'da düğün için…"    (küçük)
--
-- Alan KÜÇÜK harfle saklanıp başlıkta büyütülüyor. Ters yön (büyük saklayıp
-- küçültmek) Türkçede "İ→i" sorununu doğuruyor: lower('İ') bazı
-- yerelleştirmelerde birleşen noktalı bir karakter üretiyor.
-- =============================================================================

create or replace function public.tr_capitalize(p_text text)
returns text
language plpgsql
immutable
as $$
declare
  v text := btrim(p_text);
  v_ilk text;
begin
  if coalesce(v, '') = '' then return ''; end if;
  v_ilk := substr(v, 1, 1);
  -- 'i' → 'İ', 'ı' → 'I'; diğerleri normal upper()
  if v_ilk = 'i' then
    v_ilk := 'İ';
  elsif v_ilk = 'ı' then
    v_ilk := 'I';
  else
    v_ilk := upper(v_ilk);
  end if;
  return v_ilk || substr(v, 2);
end;
$$;

grant execute on function public.tr_capitalize(text) to anon, authenticated;
