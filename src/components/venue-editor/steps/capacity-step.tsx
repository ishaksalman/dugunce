"use client";

import { Field, StepForm, inputClass } from "../form-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { saveVenueCapacity } from "@/lib/actions/venue";
import type { VenueForEdit } from "@/types/db";

export function CapacityStep({ venue }: { venue: VenueForEdit }) {
  return (
    <StepForm action={(data) => saveVenueCapacity(venue.id, data)}>
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="kap-min"
              label="Minimum kapasite"
              error={errors.minCapacity}
              hint="Kabul ettiğiniz en küçük organizasyon."
            >
              <input
                id="kap-min"
                name="minCapacity"
                type="number"
                min={1}
                defaultValue={venue.min_capacity ?? ""}
                placeholder="100"
                className={`${inputClass(errors.minCapacity)} tabular`}
              />
            </Field>
            <Field
              id="kap-max"
              label="Maksimum kapasite"
              error={errors.maxCapacity}
              hint="Tek oturumda ağırlayabildiğiniz en fazla kişi."
            >
              <input
                id="kap-max"
                name="maxCapacity"
                type="number"
                min={1}
                defaultValue={venue.max_capacity ?? ""}
                placeholder="500"
                className={`${inputClass(errors.maxCapacity)} tabular`}
              />
            </Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium">Alan tipi</legend>
            <p className="mb-2 text-xs text-muted-foreground">
              Filtrelerde &quot;açık alan&quot; / &quot;kapalı alan&quot; aramalarında
              bunlarla eşleşiyorsunuz.
            </p>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox name="hasOutdoor" value="true" defaultChecked={venue.has_outdoor} />
              Açık alanım var
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox name="hasIndoor" value="true" defaultChecked={venue.has_indoor} />
              Kapalı alanım var
            </label>
          </fieldset>
        </>
      )}
    </StepForm>
  );
}
