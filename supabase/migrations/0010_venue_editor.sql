-- =============================================================================
-- DavetMekanı · 0010 · Mekan düzenleme ekranı
--
-- Wizard'ın ihtiyacı olan her şeyi tek sorguda döndürür. `get_venue_detail`
-- (0005) yayındaki mekanın VİTRİN görünümü; bu ise sahibin DÜZENLEME
-- görünümü — taslakları da kapsar ve seçili özellik/etkinlik id'lerini verir.
-- =============================================================================

create or replace function public.get_venue_for_edit(p_venue_id uuid)
returns jsonb
language sql
stable
as $$
  select to_jsonb(d) from (
    select
      v.id, v.slug, v.name, v.status, v.needs_review, v.completion_score,
      v.rejection_reason, v.published_at,
      v.city_id, v.district_id, v.venue_type_id,
      v.address, v.latitude, v.longitude,
      v.short_description, v.description,
      v.min_capacity, v.max_capacity,
      v.starting_price, v.price_type, v.price_note,
      v.has_indoor, v.has_outdoor,
      v.contact_phone, v.contact_email, v.website_url, v.instagram_url,
      v.davetpro_business_id, v.davetpro_linked_at,

      jsonb_build_object('name', c.name, 'slug', c.slug) as city,
      jsonb_build_object('name', dt.name, 'slug', dt.slug) as district,

      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', i.id, 'url', i.url, 'storage_path', i.storage_path,
                 'alt', i.alt_text, 'is_cover', i.is_cover, 'sort_order', i.sort_order)
               order by i.is_cover desc, i.sort_order, i.created_at)
          from public.venue_images i where i.venue_id = v.id
      ), '[]'::jsonb) as images,

      -- Düzenleme ekranı slug değil ID ile çalışıyor: checkbox'lar id eşliyor.
      coalesce((
        select jsonb_agg(vf.feature_id)
          from public.venue_features vf where vf.venue_id = v.id
      ), '[]'::jsonb) as feature_ids,

      coalesce((
        select jsonb_agg(vet.event_type_id)
          from public.venue_event_types vet where vet.venue_id = v.id
      ), '[]'::jsonb) as event_type_ids

    from public.venues v
    join public.cities c     on c.id = v.city_id
    join public.districts dt on dt.id = v.district_id
    -- Sahiplik AÇIKÇA: RLS yayındaki mekanı herkese okutuyor, bu fonksiyon
    -- ise iletişim bilgisi ve taslak içeriği döndürüyor.
    where v.id = p_venue_id
      and (v.owner_id = auth.uid() or public.is_admin())
  ) d;
$$;

grant execute on function public.get_venue_for_edit(uuid) to authenticated;

-- --- Özellik ve etkinlik türü ataması ---------------------------------------
-- Tek tek insert/delete yerine "istenen kümeyi ver" yaklaşımı: arayüz
-- checkbox listesi gönderiyor, fark hesabı burada yapılıyor. Böylece
-- yarım kalmış bir istek tutarsız durum bırakmıyor.

create or replace function public.set_venue_features(
  p_venue_id uuid,
  p_feature_ids uuid[]
)
returns void
language plpgsql
security invoker
as $$
begin
  delete from public.venue_features
   where venue_id = p_venue_id
     and feature_id <> all (coalesce(p_feature_ids, '{}'));

  insert into public.venue_features (venue_id, feature_id)
  select p_venue_id, unnest(coalesce(p_feature_ids, '{}'))
  on conflict (venue_id, feature_id) do nothing;
end;
$$;

create or replace function public.set_venue_event_types(
  p_venue_id uuid,
  p_event_type_ids uuid[]
)
returns void
language plpgsql
security invoker
as $$
begin
  delete from public.venue_event_types
   where venue_id = p_venue_id
     and event_type_id <> all (coalesce(p_event_type_ids, '{}'));

  insert into public.venue_event_types (venue_id, event_type_id)
  select p_venue_id, unnest(coalesce(p_event_type_ids, '{}'))
  on conflict (venue_id, event_type_id) do nothing;
end;
$$;

grant execute on function public.set_venue_features(uuid, uuid[]) to authenticated;
grant execute on function public.set_venue_event_types(uuid, uuid[]) to authenticated;

-- --- Görsel sıralaması ------------------------------------------------------

create or replace function public.reorder_venue_images(
  p_venue_id uuid,
  p_image_ids uuid[]
)
returns void
language plpgsql
security invoker
as $$
declare
  i integer;
begin
  for i in 1 .. coalesce(array_length(p_image_ids, 1), 0) loop
    update public.venue_images
       set sort_order = i - 1
     where id = p_image_ids[i] and venue_id = p_venue_id;
  end loop;
end;
$$;

grant execute on function public.reorder_venue_images(uuid, uuid[]) to authenticated;

-- --- Benzersiz slug üretimi -------------------------------------------------
-- Mekan adı değişince slug'ı da güncellemek istiyoruz ama yayındaki bir
-- mekanın URL'ini kırmamalıyız. Bu yüzden slug YALNIZCA taslakken değişir.

create or replace function public.suggest_venue_slug(
  p_name text,
  p_venue_id uuid default null
)
returns text
language plpgsql
stable
as $$
declare
  v_base text := public.slugify_tr(p_name);
  v_slug text := v_base;
  n integer := 1;
begin
  if coalesce(v_base, '') = '' then
    v_base := 'mekan';
    v_slug := v_base;
  end if;

  while exists (
    select 1 from public.venues
     where slug = v_slug and (p_venue_id is null or id <> p_venue_id)
  ) loop
    n := n + 1;
    v_slug := v_base || '-' || n;
  end loop;

  return v_slug;
end;
$$;

grant execute on function public.suggest_venue_slug(text, uuid) to authenticated;
