"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer";
import { InquiryForm } from "./inquiry-form";
import { formatStartingPrice } from "@/lib/format";
import type { EventType, PriceType } from "@/types/db";

/**
 * Mobilde ekranın altında sabit duran teklif çubuğu. Masaüstünde detay
 * sayfasının sağ sütunundaki kart bu işi görüyor, o yüzden lg'de gizli.
 */
export function StickyInquiryBar({
  venueId,
  venueName,
  startingPrice,
  priceType,
  eventTypes,
}: {
  venueId: string;
  venueName: string;
  startingPrice: number | null;
  priceType: PriceType;
  eventTypes: EventType[];
}) {
  const [open, setOpen] = useState(false);
  const price = formatStartingPrice(startingPrice, priceType);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur lg:hidden">
      <div className="container-page flex items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="tabular truncate text-sm font-medium">{price.primary}</p>
          {price.secondary ? (
            <p className="text-xs text-muted-foreground">{price.secondary}</p>
          ) : null}
        </div>
        <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
          <DrawerTrigger
            render={
              <Button size="lg" className="h-11 shrink-0 px-5">
                Teklif Al
              </Button>
            }
          />
          <DrawerContent className="max-h-[92vh]">
            <DrawerHeader className="border-b">
              <DrawerTitle>{venueName} — Teklif Al</DrawerTitle>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-4 py-5">
              <InquiryForm
                venueId={venueId}
                venueName={venueName}
                eventTypes={eventTypes}
                compact
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}
