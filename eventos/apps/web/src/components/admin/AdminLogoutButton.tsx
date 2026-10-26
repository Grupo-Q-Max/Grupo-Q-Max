"use client";

import {
  LogOut,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  useState,
} from "react";

export default function AdminLogoutButton() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] = useState(false);

  async function logout() {
    setLoading(true);

    try {
      await fetch(
        "/finora-experience/api/admin-auth/logout",
        {
          method: "POST",
        },
      );
    }
    finally {
      router.replace(
        "/admin/login",
      );

      router.refresh();
    }
  }

  return (
    <button
      type="button"
      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-300 transition-all hover:border-rose-500/30 hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-60"
      onClick={logout}
      disabled={loading}
    >
      <LogOut
        size={16}
      />

      <span>
        {loading
          ? "Saindo..."
          : "Sair do painel"}
      </span>
    </button>
  );
}
