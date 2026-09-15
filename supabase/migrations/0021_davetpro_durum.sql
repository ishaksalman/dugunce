-- =============================================================================
-- Düğünce · 0021 · DavetPro bağlantı durumu
--
-- Panelde mekan sahibine "taleplerin DavetPro'ya aktarılıyor mu, kaçı
-- gitti, bekleyen var mı" bilgisini göstermek için.
-- =============================================================================

create or replace function public.get_davetpro_status(p_venue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_business uuid;
  v_linked timestamptz;
begin
  select owner_id, davetpro_business_id, davetpro_linked_at
    into v_owner, v_business, v_linked
    from public.venues where id = p_venue_id;

  if v_owner is null then
    return null;
  end if;
  -- Sahiplik AÇIKÇA: venues politikası yayındaki mekanı herkese okutuyor.
  if v_owner <> auth.uid() and not public.is_admin() then
    return null;
  end if;

  return jsonb_build_object(
    'linked', v_business is not null,
    'linked_at', v_linked,
    'toplam_talep', (select count(*) from public.inquiries i where i.venue_id = p_venue_id),
    'aktarilan',    (select count(*) from public.davetpro_sync_jobs j
                      where j.venue_id = p_venue_id and j.status = 'sent'),
    'bekleyen',     (select count(*) from public.davetpro_sync_jobs j
                      where j.venue_id = p_venue_id and j.status = 'pending'),
    'basarisiz',    (select count(*) from public.davetpro_sync_jobs j
                      where j.venue_id = p_venue_id and j.status = 'abandoned'),
    'son_hata',     (select j.last_error from public.davetpro_sync_jobs j
                      where j.venue_id = p_venue_id and j.last_error is not null
                      order by j.updated_at desc limit 1)
  );
end;
$$;

grant execute on function public.get_davetpro_status(uuid) to authenticated;
