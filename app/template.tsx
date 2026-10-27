"use client";

import { usePathname } from "next/navigation";

export default function Template({ children }: { children: React.ReactNode }) {
  // The CRM is a working tool: no page-enter fade, it delays every navigation
  if (usePathname()?.startsWith("/crm")) return children;

  // CSS fade (qmax-overrides.css): starts on first paint, without waiting for hydration or framer-motion
  return <div className="qmax-page-enter">{children}</div>;
}
