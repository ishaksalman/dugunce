-- =============================================================================
-- Düğünce · 0006 · Teklif talebi oluşturma
--
-- Talep, doğrudan INSERT ile değil bu fonksiyon üzerinden açılıyor. Sebep:
-- hız sınırı için mevcut talepleri saymak gerekiyor, ama anonim kullanıcıya
-- `inquiries` üzerinde SELECT yetkisi vermek istemiyoruz (başkalarının
-- iletişim bilgilerini okuyabilirdi). SECURITY DEFINER fonksiyon sayımı
-- ve eklemeyi tek işlemde yapıyor, dışarıya yalnızca sonucu veriyor.
-- =============================================================================

create or replace function public.create_inquiry(
  p_venue_id      uuid,
  p_full_name     text,
  p_phone         text,
  p_email         text    default null,
  p_event_type_id uuid    default null,
  p_event_date    date    default null,
  p_guest_count   integer default null,
  p_message       text    default null,
  p_ip_hash       text    default null,
  p_ua_hash       text    default null,
  p_max_per_hour  integer default 3,
  p_max_per_venue_per_day integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  n_hour integer;
  n_venue integer;
begin
  -- Yayında olmayan mekana talep gönderilemez.
  if not exists (
    select 1 from public.venues where id = p_venue_id and status = 'PUBLISHED'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'venue_not_found');
  end if;

  -- Hız sınırı yalnızca ip_hash varsa uygulanabilir. Yoksa (proxy başlığı
  -- gelmediyse) talebi reddetmiyoruz; spam koruması eksik kalmasın diye
  -- uygulama katmanı ip_hash'i her zaman göndermeli.
  if p_ip_hash is not null then
    select count(*) into n_hour
      from public.inquiries
     where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
    if n_hour >= p_max_per_hour then
      return jsonb_build_object('ok', false, 'reason', 'rate_limited_hour');
    end if;

    select count(*) into n_venue
      from public.inquiries
     where ip_hash = p_ip_hash
       and venue_id = p_venue_id
       and created_at > now() - interval '1 day';
    if n_venue >= p_max_per_venue_per_day then
      return jsonb_build_object('ok', false, 'reason', 'rate_limited_venue');
    end if;
  end if;

  insert into public.inquiries (
    venue_id, user_id, full_name, phone, email,
    event_type_id, event_date, guest_count, message, ip_hash, ua_hash
  ) values (
    p_venue_id, auth.uid(), btrim(p_full_name), btrim(p_phone),
    nullif(btrim(coalesce(p_email, '')), ''),
    p_event_type_id, p_event_date, p_guest_count,
    nullif(btrim(coalesce(p_message, '')), ''),
    p_ip_hash, p_ua_hash
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.create_inquiry(
  uuid, text, text, text, uuid, date, integer, text, text, text, integer, integer
) to anon, authenticated;
