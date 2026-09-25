"use client";

import { createContext, useContext, ReactNode } from "react";

export interface SiteSettings {
  siteName: string;
  tagline: string;
  whatsapp: string;
  phone: string;
  email: string;
  address: string;
  adminPassword?: string;
}

const SettingsContext = createContext<SiteSettings | null>(null);

export function SettingsProvider({
  settings,
  children,
}: {
  settings: SiteSettings;
  children: ReactNode;
}) {
  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
