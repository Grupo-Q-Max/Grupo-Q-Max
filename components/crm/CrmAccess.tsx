"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Permission } from "@/lib/crm-permissions";

const PermissionsContext = createContext<ReadonlySet<Permission>>(new Set());

/** Permissions of the signed-in user, loaded by app/crm/layout.tsx. Only hides UI: the API checks them again. */
export function CrmAccessProvider({ permissions, children }: { permissions: Permission[]; children: ReactNode }) {
  const value = useMemo(() => new Set(permissions), [permissions]);
  return <PermissionsContext value={value}>{children}</PermissionsContext>;
}

/** `const can = useCan(); can("deal.delete")` */
export function useCan() {
  const permissions = useContext(PermissionsContext);
  return (permission: Permission) => permissions.has(permission);
}
