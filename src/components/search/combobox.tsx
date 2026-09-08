"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  hint?: string;
}

/** Aksanları ve Türkçe harfleri normalize eder: "şişli" ≈ "sisli" ≈ "SISLI". */
function fold(s: string): string {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
  };
  return s.toLocaleLowerCase("tr").replace(/[çğıöşüâîû]/g, (c) => map[c] ?? c);
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = "Ara…",
  emptyText = "Sonuç bulunamadı",
  allLabel,
  className,
  id,
}: {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Seçimi temizleyen ilk satırın metni (ör. "Tüm şehirler"). */
  allLabel?: string;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    if (!q.trim()) return options;
    const needle = fold(q.trim());
    return options.filter((o) => fold(o.label).includes(needle));
  }, [options, q]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQ("");
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id ?? "combobox"}-liste`}
            className={cn(
              "flex h-12 w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 text-left text-sm",
              "transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              className,
            )}
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        }
      />
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] gap-0 p-0">
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <ul
        id={`${id ?? "combobox"}-liste`}
        role="listbox"
        className="max-h-72 overflow-y-auto p-1"
      >
        {allLabel ? (
          <Row
            selected={!value}
            onSelect={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            {allLabel}
          </Row>
        ) : null}
        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</li>
        ) : (
          filtered.map((o) => (
            <Row
              key={o.value}
              selected={o.value === value}
              onSelect={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className="truncate">{o.label}</span>
              {o.hint ? (
                <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground tabular">
                  {o.hint}
                </span>
              ) : null}
            </Row>
          ))
        )}
      </ul>
      </PopoverContent>
    </Popover>
  );
}

function Row({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
      >
        <Check className={cn("size-4 shrink-0", selected ? "opacity-100" : "opacity-0")} aria-hidden />
        {children}
      </button>
    </li>
  );
}
