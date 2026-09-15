-- =============================================================================
-- Düğünce · 0018 · Eşik altındaki landing sayfasının çözülebilmesi
--
-- Tasarım: yeterli mekanı olmayan sayfa 200 döner ama `noindex` alır ve
-- sitemap'e girmez. Kullanıcı bir yerden o bağlantıya geldiyse boş sayfa
-- değil, yakın alternatifleri görmeli.
--
-- `get_seo_page` SECURITY INVOKER olduğu için RLS devreye giriyordu
-- (`seo_pages_read`: yalnızca is_active). Pasif sayfa null dönüyor ve
-- rota 404 veriyordu.
--
-- DEFINER yapıyoruz: fonksiyon yalnızca sunum verisi döndürüyor (başlık,
-- metin, taksonomi) — gizli bir şey yok. Tabloya doğrudan SELECT hâlâ
-- kısıtlı; `is_active` alanı da dönüyor ki çağıran noindex kararını
-- verebilsin.
-- =============================================================================

create or replace function public.get_seo_page(p_path text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select to_jsonb(x) from (
    select
      s.id, s.path, s.kind, s.title, s.meta_description, s.h1,
      s.intro_html, s.faq, s.is_active, s.min_venue_count, s.updated_at,
      c.slug as city_slug, c.name as city_name,
      d.slug as district_slug, d.name as district_name,
      e.slug as event_slug, e.name as event_name, e.seo_noun as event_noun
    from public.seo_pages s
    left join public.cities c      on c.id = s.city_id
    left join public.districts d   on d.id = s.district_id
    left join public.event_types e on e.id = s.event_type_id
    where s.path = p_path
  ) x;
$$;

grant execute on function public.get_seo_page(text) to anon, authenticated;
