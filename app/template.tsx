"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

export default function Template({ children }: { children: React.ReactNode }) {
  // The CRM is a working tool: no page-enter fade, it delays every navigation
  if (usePathname()?.startsWith("/crm")) return children;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: [0.25, 0.1, 0.25, 1], duration: 0.6 }}
    >
      {children}
    </motion.div>
  );
}
