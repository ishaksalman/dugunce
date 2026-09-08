"use client";

import { useMemo, useState } from "react";
import { StepForm } from "../form-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/shared/icon";
import { saveVenueServices } from "@/lib/actions/venue";
import type { EventType, Feature, VenueForEdit } from "@/types/db";

/**
 * Özellik ve etkinlik türü seçimi.
 *
 * Seçimler React state'te tutuluyor ve gizli input'a JSON olarak yazılıyor;
 * FormData çoklu checkbox'ı düz metin dizisi olarak veriyor ve boş seçim
 * durumunda alanı hiç göndermiyor — "hepsini kaldır" işlemi kaybolurdu.
 */
export function ServicesStep({
  venue,
  features,
  eventTypes,
}: {
  venue: VenueForEdit;
  features: Feature[];
  eventTypes: EventType[];
}) {
  const [featureIds, setFeatureIds] = useState<string[]>(venue.feature_ids);
  const [eventIds, setEventIds] = useState<string[]>(venue.event_type_ids);

  const gruplar = useMemo(() => {
    const map = new Map<string, Feature[]>();
    for (const f of features) {
      const liste = map.get(f.group_name) ?? [];
      liste.push(f);
      map.set(f.group_name, liste);
    }
    return [...map.entries()];
  }, [features]);

  const toggle = (
    liste: string[],
    setter: (v: string[]) => void,
    id: string,
    secili: boolean,
  ) => setter(secili ? [...liste, id] : liste.filter((x) => x !== id));

  return (
    <StepForm
      action={() =>
        saveVenueServices(venue.id, { featureIds, eventTypeIds: eventIds })
      }
    >
      {() => (
        <>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">
              Hangi etkinliklere ev sahipliği yapıyorsunuz?
            </legend>
            <p className="mb-3 text-xs text-muted-foreground">
              Seçtikleriniz &quot;İstanbul düğün mekanları&quot; gibi sayfalarda
              listelenmenizi sağlar.
            </p>
            <div className="flex flex-wrap gap-2">
              {eventTypes.map((e) => {
                const secili = eventIds.includes(e.id);
                return (
                  <label
                    key={e.id}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors ${
                      secili
                        ? "border-primary bg-secondary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Checkbox
                      checked={secili}
                      onCheckedChange={(v) =>
                        toggle(eventIds, setEventIds, e.id, Boolean(v))
                      }
                    />
                    {e.name}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {gruplar.map(([grup, items]) => (
            <fieldset key={grup}>
              <legend className="mb-2 text-sm font-medium">{grup}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((f) => {
                  const secili = featureIds.includes(f.id);
                  return (
                    <label
                      key={f.id}
                      className="flex cursor-pointer items-center gap-2.5 py-1 text-sm"
                    >
                      <Checkbox
                        checked={secili}
                        onCheckedChange={(v) =>
                          toggle(featureIds, setFeatureIds, f.id, Boolean(v))
                        }
                      />
                      <Icon name={f.icon} className="size-4 text-muted-foreground" />
                      {f.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <p className="tabular text-xs text-muted-foreground">
            {featureIds.length} özellik · {eventIds.length} etkinlik türü seçili
          </p>
        </>
      )}
    </StepForm>
  );
}
