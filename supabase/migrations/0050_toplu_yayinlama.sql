-- =============================================================================
-- Düğünce · 0050 · Mekan listesinde toplu yayınlama
--
-- İçe aktarma hacmi arttıkça (İstanbul, İzmir, Ankara — yüzlerce kayıt)
-- görsel indirmesi kısmi kalan ya da tamamlanma eşiğini yeni geçen taslak
-- mekanları tek tek "Yayınla" tıklayarak onaylamak admin için darboğaz oldu.
--
-- `admin_set_venue_status` İLE AYNI mantık, tek fark: birden fazla mekan
-- ID'si alıp döngüyle uyguluyor. Denetim izi YİNE HER MEKAN İÇİN AYRI
-- yazılıyor (tek bir toplu satır değil) — mevcut "bir işlem = bir kayıt"
-- kuralı (bkz. 0012_admin.sql) burada da korunuyor, aksi hâlde hangi
-- mekanın ne zaman yayına girdiğini tek tek göremeyiz.
--
-- Reddetme/askıya alma BİLEREK bu fonksiyona dahil edilmedi: ikisi de
-- gerekçe istiyor (veritabanı zorluyor) ve gerekçe mekana özel olmalı —
-- toplu bir "hepsi aynı gerekçeyle reddedildi" akışı yanlış bilgi üretir.
-- Bu yüzden yalnızca PUBLISHED hedefleniyor.
-- =============================================================================

create or replace function public.admin_bulk_set_venue_status(
  p_venue_ids uuid[],
  p_status    public.venue_status
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.assert_admin();
  v_id uuid;
  v_before public.venue_status;
  v_basarili integer := 0;
  v_atlanan integer := 0;
begin
  if p_status in ('REJECTED', 'SUSPENDED') then
    raise exception 'Toplu reddetme/askıya alma desteklenmiyor — gerekçe mekana özel olmalı.'
      using errcode = 'check_violation';
  end if;

  if p_venue_ids is null or array_length(p_venue_ids, 1) is null then
    return jsonb_build_object('basarili', 0, 'atlanan', 0);
  end if;

  foreach v_id in array p_venue_ids loop
    select status into v_before from public.venues where id = v_id;
    if v_before is null then
      v_atlanan := v_atlanan + 1;
      continue;
    end if;

    update public.venues
       set status = p_status,
           rejection_reason = null,
           needs_review = case when p_status = 'PUBLISHED' then false else needs_review end
     where id = v_id;

    perform public.log_admin_action(
      v_admin, 'venue', v_id, 'status:' || p_status::text, 'toplu yayınlama',
      jsonb_build_object('from', v_before, 'to', p_status));

    v_basarili := v_basarili + 1;
  end loop;

  return jsonb_build_object('basarili', v_basarili, 'atlanan', v_atlanan);
end;
$$;

grant execute on function public.admin_bulk_set_venue_status(
  uuid[], public.venue_status) to authenticated;
