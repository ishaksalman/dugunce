"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { setUserActive, setUserRole } from "@/lib/actions/admin";
import type { UserRole } from "@/types/db";

export const ROL_ETIKET: Record<UserRole, string> = {
  customer: "Müşteri",
  venue_owner: "Mekan sahibi",
  admin: "Yönetici",
};

const ROLLER: UserRole[] = ["customer", "venue_owner", "admin"];

export function UserActions({
  userId,
  role,
  isActive,
  isSelf,
}: {
  userId: string;
  role: UserRole;
  isActive: boolean;
  /** Kendi hesabında rol ve durum değiştirme kapalı — son admin kilitlenmesin. */
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rol, setRol] = useState<UserRole>(role);

  if (isSelf) {
    return (
      <span className="text-xs text-muted-foreground">
        {ROL_ETIKET[role]} · kendi hesabınız
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={rol}
        disabled={pending}
        onValueChange={(next) => {
          const yeni = next as UserRole;
          const onceki = rol;
          setRol(yeni);
          startTransition(async () => {
            const r = await setUserRole({ userId, role: yeni });
            if (!r.ok) {
              setRol(onceki);
              toast.error(r.message);
              return;
            }
            toast.success(`Rol "${ROL_ETIKET[yeni]}" olarak güncellendi`);
            router.refresh();
          });
        }}
      >
        <SelectTrigger className="h-9 w-40" aria-label="Kullanıcı rolü">
          <SelectValue>{(v) => ROL_ETIKET[v as UserRole] ?? String(v)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ROLLER.map((r) => (
            <SelectItem key={r} value={r}>
              {ROL_ETIKET[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        variant="outline"
        className="h-9"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await setUserActive({ userId, active: !isActive });
            if (!r.ok) {
              toast.error(r.message);
              return;
            }
            toast.success(isActive ? "Hesap kapatıldı" : "Hesap açıldı");
            router.refresh();
          })
        }
      >
        {isActive ? "Hesabı kapat" : "Hesabı aç"}
      </Button>
    </div>
  );
}
