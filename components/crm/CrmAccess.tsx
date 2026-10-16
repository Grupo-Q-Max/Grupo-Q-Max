"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Permission } from "@/lib/crm-permissions";

const PermissionsContext = createContext<ReadonlySet<Permission>>(new Set());
const ViewerContext = createContext<{ memberId: string | null; isAdmin: boolean }>({ memberId: null, isAdmin: false });

/** Permissions of the signed-in user, loaded by app/crm/layout.tsx. Only hides UI: the API checks them again. */
export function CrmAccessProvider({
  permissions,
  memberId,
  isAdmin,
  children,
}: {
  permissions: Permission[];
  memberId: string | null;
  isAdmin: boolean;
  children: ReactNode;
}) {
  const value = useMemo(() => new Set(permissions), [permissions]);
  const viewer = useMemo(() => ({ memberId, isAdmin }), [memberId, isAdmin]);
  return (
    <PermissionsContext value={value}>
      <ViewerContext value={viewer}>{children}</ViewerContext>
    </PermissionsContext>
  );
}

/** `const can = useCan(); can("deal.delete")` */
export function useCan() {
  const permissions = useContext(PermissionsContext);
  return (permission: Permission) => permissions.has(permission);
}

/** Signed-in member and whether they are a CRM admin (e.g. to show edit on others' comments). */
export const useViewer = () => useContext(ViewerContext);
