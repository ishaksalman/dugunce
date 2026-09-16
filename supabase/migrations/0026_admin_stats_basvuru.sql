-- =============================================================================
-- Düğünce · 0026 · Yönetim özetine sahiplenme başvuruları
--
-- Kenar çubuğundaki rozet buradan besleniyor; bekleyen başvuru gözden
-- kaçmasın. Ayrıca sahipsiz katalog kaydı sayısı: kaç profilin hâlâ sahibi
-- bekliyor, operasyonun ölçüsü bu.
-- =============================================================================

create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();
  return jsonb_build_object(
    'pending_venues',  (select count(*) from public.venues where status = 'PENDING_REVIEW'),
    'needs_review',    (select count(*) from public.venues where needs_review and status = 'PUBLISHED'),
    'published',       (select count(*) from public.venues where status = 'PUBLISHED'),
    'draft',           (select count(*) from public.venues where status = 'DRAFT'),
    'rejected',        (select count(*) from public.venues where status = 'REJECTED'),
    'suspended',       (select count(*) from public.venues where status = 'SUSPENDED'),
    'pending_reviews', (select count(*) from public.reviews where status = 'PENDING'),
    'pending_claims',  (select count(*) from public.venue_claims where status = 'PENDING'),
    'unclaimed',       (select count(*) from public.venues where owner_id is null),
    'total_users',     (select count(*) from public.profiles),
    'venue_owners',    (select count(*) from public.profiles where role = 'venue_owner'),
    'inquiries_7d',    (select count(*) from public.inquiries
                         where created_at > now() - interval '7 days'),
    'inquiries_total', (select count(*) from public.inquiries)
  );
end;
$$;

grant execute on function public.admin_stats() to authenticated;
