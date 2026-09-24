-- =============================================================================
-- Düğünce · 0045 · create_inquiry: sahiplenme durumu ve mekan bilgisi dönüyor
--
-- Sahiplenilmemiş bir mekana talep geldiğinde kimse görmüyordu (owner_id
-- NULL, `/panel/talepler` kimseye ait değil). Şimdi böyle bir talep
-- geldiğinde admin'e Telegram bildirimi gidiyor (bkz. lib/telegram.ts,
-- lib/actions/inquiry.ts) — bunun için `create_inquiry`'nin mekan adını,
-- şehir/ilçesini ve sahiplenme durumunu da dönmesi gerekiyor; eskiden
-- yalnızca {ok, id} veriyordu.
--
-- EN SON sürümden (0006, tek tanım) türetildi.
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
  v_venue record;
begin
  -- Yayında olmayan mekana talep gönderilemez.
  select v.name, v.owner_id, c.name as city_name, d.name as district_name
    into v_venue
    from public.venues v
    join public.cities c on c.id = v.city_id
    join public.districts d on d.id = v.district_id
   where v.id = p_venue_id and v.status = 'PUBLISHED';

  if v_venue is null then
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

  return jsonb_build_object(
    'ok', true, 'id', v_id,
    'venue_name', v_venue.name,
    'city_name', v_venue.city_name,
    'district_name', v_venue.district_name,
    'is_claimed', v_venue.owner_id is not null);
end;
$$;

grant execute on function public.create_inquiry(
  uuid, text, text, text, uuid, date, integer, text, text, text, integer, integer
) to anon, authenticated;
