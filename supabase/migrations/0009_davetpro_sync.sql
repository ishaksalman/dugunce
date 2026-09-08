-- =============================================================================
-- DavetMekanı · 0009 · DavetPro'ya talep aktarımı
--
-- Kontrat: docs/DAVETPRO-ENTEGRASYON.md
--
-- İlke: aktarım kullanıcı akışını ASLA bloklamaz. Talep her koşulda buraya
-- kaydedilir; DavetPro'ya gönderim ayrı bir kuyruktan yürür ve başarısız
-- olursa yeniden denenir.
-- =============================================================================

create type public.sync_status as enum ('pending', 'sent', 'failed', 'abandoned');

create table public.davetpro_sync_jobs (
  id              uuid primary key default gen_random_uuid(),
  inquiry_id      uuid not null references public.inquiries (id) on delete cascade,
  venue_id        uuid not null references public.venues (id) on delete cascade,
  -- DavetPro'nun işletme ve salon id'leri: OPAK referans, foreign key yok.
  business_id     uuid not null,
  davetpro_venue_id uuid,

  status          public.sync_status not null default 'pending',
  attempts        smallint not null default 0,
  last_error      text,
  next_attempt_at timestamptz not null default now(),
  sent_at         timestamptz,
  -- DavetPro'nun oluşturduğu lead; teşhis için tutuluyor.
  davetpro_lead_id uuid,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Bir talep bir kez kuyruğa girer. Geçmiş aktarımı ikinci kez çalıştırılsa
  -- bile yeni iş üretmez.
  unique (inquiry_id)
);

create index davetpro_sync_due_idx
  on public.davetpro_sync_jobs (next_attempt_at)
  where status = 'pending';
create index davetpro_sync_venue_idx on public.davetpro_sync_jobs (venue_id, status);

create trigger davetpro_sync_touch before update on public.davetpro_sync_jobs
  for each row execute function public.touch_updated_at();

alter table public.davetpro_sync_jobs enable row level security;

-- Sahibi kendi mekanının aktarım durumunu görebilir; yazma yalnızca sunucuda.
create policy davetpro_sync_read on public.davetpro_sync_jobs
  for select using (public.owns_venue(venue_id) or public.is_admin());

grant select on public.davetpro_sync_jobs to authenticated;

-- --- Mekanı DavetPro'ya bağla -----------------------------------------------
-- Bağlantı kurulduğu anda o mekanın TÜM geçmiş talepleri kuyruğa alınır.
-- Kullanıcının geçmişini kaybetmemesi geçişi erteletmemek için kritik.

create or replace function public.link_venue_to_davetpro(
  p_venue_id          uuid,
  p_business_id       uuid,
  p_davetpro_venue_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_queued integer;
begin
  select owner_id into v_owner from public.venues where id = p_venue_id;

  if v_owner is null then
    raise exception 'Mekan bulunamadı.' using errcode = 'no_data_found';
  end if;
  if v_owner <> auth.uid() and not public.is_admin() then
    raise exception 'Bu mekanı bağlama yetkiniz yok.' using errcode = 'insufficient_privilege';
  end if;

  update public.venues
     set davetpro_business_id = p_business_id,
         davetpro_venue_id    = p_davetpro_venue_id,
         davetpro_linked_at   = now(),
         sync_source          = 'davetpro'
   where id = p_venue_id;

  -- Geçmiş talepler. `on conflict do nothing` sayesinde bağlantı tekrar
  -- kurulsa bile ikinci kez kuyruğa girmezler.
  insert into public.davetpro_sync_jobs
    (inquiry_id, venue_id, business_id, davetpro_venue_id)
  select i.id, i.venue_id, p_business_id, p_davetpro_venue_id
    from public.inquiries i
   where i.venue_id = p_venue_id
  on conflict (inquiry_id) do nothing;

  get diagnostics v_queued = row_count;

  return jsonb_build_object(
    'ok', true,
    'venue_id', p_venue_id,
    'queued_inquiries', v_queued
  );
end;
$$;

grant execute on function public.link_venue_to_davetpro(uuid, uuid, uuid) to authenticated;

-- --- Bağlantıyı kaldır ------------------------------------------------------

create or replace function public.unlink_venue_from_davetpro(p_venue_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.venues where id = p_venue_id;
  if v_owner is null then
    raise exception 'Mekan bulunamadı.' using errcode = 'no_data_found';
  end if;
  if v_owner <> auth.uid() and not public.is_admin() then
    raise exception 'Yetkiniz yok.' using errcode = 'insufficient_privilege';
  end if;

  update public.venues
     set davetpro_business_id = null,
         davetpro_venue_id    = null,
         davetpro_linked_at   = null,
         sync_source          = null
   where id = p_venue_id;

  -- Gönderilmemiş işleri iptal et; gönderilmiş olanların kaydı kalsın
  -- (DavetPro'da o lead'ler duruyor, izini kaybetmeyelim).
  update public.davetpro_sync_jobs
     set status = 'abandoned'
   where venue_id = p_venue_id and status in ('pending', 'failed');

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.unlink_venue_from_davetpro(uuid) to authenticated;

-- --- Yeni talep geldiğinde otomatik kuyruğa al ------------------------------
-- Mekan bağlıysa talep oluşur oluşmaz iş kaydı düşer. Gönderimi ayrı bir
-- işleyici yapar; trigger içinden HTTP çağrısı yapmıyoruz.

create or replace function public.enqueue_inquiry_sync()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business uuid;
  v_dp_venue uuid;
begin
  select davetpro_business_id, davetpro_venue_id
    into v_business, v_dp_venue
    from public.venues where id = new.venue_id;

  if v_business is null then
    return null;   -- mekan DavetPro'ya bağlı değil
  end if;

  insert into public.davetpro_sync_jobs
    (inquiry_id, venue_id, business_id, davetpro_venue_id)
  values (new.id, new.venue_id, v_business, v_dp_venue)
  on conflict (inquiry_id) do nothing;

  return null;
end;
$$;

create trigger inquiries_enqueue_sync
  after insert on public.inquiries
  for each row execute function public.enqueue_inquiry_sync();

-- --- İşleyici için sıradaki işler -------------------------------------------
-- service_role çağırır. `for update skip locked`: iki işleyici aynı anda
-- koşarsa aynı işi iki kez göndermezler.

create or replace function public.claim_davetpro_sync_jobs(p_limit integer default 50)
returns table (
  job_id            uuid,
  inquiry_id        uuid,
  business_id       uuid,
  davetpro_venue_id uuid,
  full_name         text,
  phone             text,
  email             text,
  event_type_slug   text,
  event_date        date,
  guest_count       integer,
  message           text,
  inquiry_created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with secilen as (
    select j.id
      from public.davetpro_sync_jobs j
     where j.status = 'pending' and j.next_attempt_at <= now()
     order by j.next_attempt_at
     limit greatest(1, least(coalesce(p_limit, 50), 200))
     for update skip locked
  )
  select
    j.id, i.id, j.business_id, j.davetpro_venue_id,
    i.full_name, i.phone, i.email, e.slug,
    i.event_date, i.guest_count, i.message, i.created_at
  from public.davetpro_sync_jobs j
  join secilen s on s.id = j.id
  join public.inquiries i on i.id = j.inquiry_id
  left join public.event_types e on e.id = i.event_type_id;
end;
$$;

revoke all on function public.claim_davetpro_sync_jobs(integer)
  from public, anon, authenticated;

-- --- İş sonucunu işaretle ---------------------------------------------------

create or replace function public.complete_davetpro_sync_job(
  p_job_id  uuid,
  p_ok      boolean,
  p_lead_id uuid default null,
  p_error   text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempts smallint;
  -- Yeniden deneme aralıkları: 1 dk, 5 dk, 30 dk, 2 sa, 12 sa.
  v_backoff interval[] := array['1 minute','5 minutes','30 minutes','2 hours','12 hours']::interval[];
begin
  if p_ok then
    update public.davetpro_sync_jobs
       set status = 'sent', sent_at = now(), davetpro_lead_id = p_lead_id,
           last_error = null
     where id = p_job_id;
    return;
  end if;

  update public.davetpro_sync_jobs
     set attempts = attempts + 1, last_error = left(coalesce(p_error, ''), 500)
   where id = p_job_id
  returning attempts into v_attempts;

  if v_attempts >= array_length(v_backoff, 1) then
    -- Beş denemeden sonra bırakıyoruz; admin panelinde görünür.
    update public.davetpro_sync_jobs set status = 'abandoned' where id = p_job_id;
  else
    update public.davetpro_sync_jobs
       set status = 'pending', next_attempt_at = now() + v_backoff[v_attempts]
     where id = p_job_id;
  end if;
end;
$$;

revoke all on function public.complete_davetpro_sync_job(uuid, boolean, uuid, text)
  from public, anon, authenticated;
