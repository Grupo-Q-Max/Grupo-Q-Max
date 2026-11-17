"use client";

import { useSyncExternalStore } from "react";
import { legal } from "@/data/site";

/**
 * Cookie/tracking consent kept in the visitor's browser (LGPD Art. 7, I and Art. 8).
 * Optional categories start off and only turn on after an explicit choice in the banner.
 * The stored version is the privacy policy version: when it changes, the banner asks again.
 */
export type ConsentCategory = "analytics" | "embeds";

export interface ConsentState {
  necessary: true;
  analytics: boolean;
  embeds: boolean;
  timestamp: string;
  version: string;
}

export const CONSENT_STORAGE_KEY = "qmax_cookie_consent_v2";
export const CONSENT_EVENT = "qmax-consent-change";
const LEGACY_KEYS = ["qmax_cookie_consent_v1"];

let cached: { raw: string | null; value: ConsentState | null } = { raw: null, value: null };

export function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === cached.raw) return cached.value;
  let value: ConsentState | null = null;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<ConsentState>) : null;
    if (parsed && parsed.version === legal.privacyVersion) {
      value = {
        necessary: true,
        analytics: parsed.analytics === true,
        embeds: parsed.embeds === true,
        timestamp: String(parsed.timestamp ?? ""),
        version: legal.privacyVersion,
      };
    }
  } catch {
    value = null;
  }
  cached = { raw, value };
  return value;
}

export function hasConsent(category: ConsentCategory): boolean {
  return readConsent()?.[category] === true;
}

export function saveConsent(choice: { analytics: boolean; embeds: boolean }): ConsentState {
  const state: ConsentState = {
    necessary: true,
    analytics: choice.analytics,
    embeds: choice.embeds,
    timestamp: new Date().toISOString(),
    version: legal.privacyVersion,
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
    for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
    // Old builds also wrote a "qmax_cookie_consent" cookie; it is not needed, the choice lives in localStorage
    document.cookie = "qmax_cookie_consent=; max-age=0; path=/";
  } catch {
    // Storage blocked: the choice still applies to this page view
  }
  if (!state.analytics) removeAnalyticsCookies();
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
  return state;
}

/** Deletes Google Analytics cookies after the visitor withdraws consent (LGPD Art. 8, §5). */
function removeAnalyticsCookies() {
  const host = window.location.hostname;
  const domains = ["", host, `.${host}`, `.${host.split(".").slice(-3).join(".")}`];
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (!name || !(name === "_ga" || name.startsWith("_ga_") || name === "_gid")) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; max-age=0; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CONSENT_STORAGE_KEY) onChange();
  };
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Current consent, re-rendering when it changes. Null until the visitor chooses (and on the server). */
export function useConsentState(): ConsentState | null {
  return useSyncExternalStore(subscribe, readConsent, () => null);
}

export function useConsent(category: ConsentCategory): boolean {
  return useConsentState()?.[category] === true;
}
