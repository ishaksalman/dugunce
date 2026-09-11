-- =============================================================================
-- DavetMekanı · 0020 · Veri saklama süreleri
--
-- Gizlilik metninde ilan ettiğimiz süreleri KOD ZORLUYOR. Metinde yazıp
-- uygulamamak KVKK açısından da dürüstlük açısından da sorun.
--
-- /gizlilik sayfasındaki süreler burayla AYNI olmalı; birini değiştirirken
-- diğerini de değiştirin.
-- =============================================================================

create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_anonim integer;
  v_silinen integer;
  v_gorunum integer;
begin
  -- 90 gün: hız sınırı özetleri bu süreden sonra işe yaramıyor. Talebin
  -- kendisi duruyor, yalnızca teknik iz siliniyor.
  update public.inquiries
     set ip_hash = null, ua_hash = null
   where created_at < now() - interval '90 days'
     and (ip_hash is not null or ua_hash is not null);
  get diagnostics v_anonim = row_count;

  -- 3 yıl: teklif talepleri. Mekanın dönüş yapması ve uyuşmazlık hâlinde
  -- kanıt için makul süre.
  delete from public.inquiries where created_at < now() - interval '3 years';
  get diagnostics v_silinen = row_count;

  -- 2 yıl: günlük görüntülenme toplamları. Kişisel veri değil ama sonsuza
  -- kadar tutmanın da bir faydası yok.
  delete from public.venue_views where day < current_date - interval '2 years';
  get diagnostics v_gorunum = row_count;

  return jsonb_build_object(
    'anonimlestirilen_talep', v_anonim,
    'silinen_talep', v_silinen,
    'silinen_gorunum', v_gorunum
  );
end;
$$;

revoke all on function public.purge_expired_data() from public, anon, authenticated;
