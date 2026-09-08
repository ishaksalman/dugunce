import "server-only";
import { cache } from "react";
import { getDataSource } from "@/lib/db";
import type { Feature } from "@/types/db";

/**
 * Taksonomi nadiren değişiyor ve neredeyse her sayfada gerekiyor.
 * `cache()` istek başına tekilleştiriyor; ISR de sayfa düzeyinde tutuyor.
 */
export const getCities = cache(async (popularOnly = false) => {
  const db = await getDataSource();
  return db.listCities({ popularOnly });
});

export const getDistricts = cache(async (citySlug: string) => {
  const db = await getDataSource();
  return db.listDistricts(citySlug);
});

export const getEventTypes = cache(async () => {
  const db = await getDataSource();
  return db.listEventTypes();
});

export const getVenueTypes = cache(async () => {
  const db = await getDataSource();
  return db.listVenueTypes();
});

export const getFeatures = cache(async () => {
  const db = await getDataSource();
  return db.listFeatures();
});

/** Filtre panelinde gruplanmış gösterim için. */
export const getFilterFeatureGroups = cache(async () => {
  const features = await getFeatures();
  const groups = new Map<string, Feature[]>();
  for (const f of features) {
    if (!f.is_filter) continue;
    const list = groups.get(f.group_name) ?? [];
    list.push(f);
    groups.set(f.group_name, list);
  }
  return [...groups.entries()].map(([name, items]) => ({ name, items }));
});
