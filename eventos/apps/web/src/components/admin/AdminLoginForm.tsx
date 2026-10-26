"use client";

import { Eye, EyeOff, LoaderCircle, Lock, User, AlertCircle, ArrowRight } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/finora-experience/api/admin-auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "Não foi possível entrar. Verifique usuário e senha.");
      }

      const next = searchParams.get("next");
      let destination =
        next && next.startsWith("/admin") && !next.startsWith("/admin/login")
          ? next
          : "/admin/";

      if (!destination.endsWith("/")) {
        destination += "/";
      }

      router.replace(destination);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível entrar."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      {/* Campo Usuário / Email */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="l-user" className="text-xs font-bold tracking-wider uppercase text-text-2">
          Usuário ou E-mail
        </label>
        <div className="relative flex items-center">
          <div className="pointer-events-none absolute left-4 text-text-2">
            <User size={18} />
          </div>
          <input
            id="l-user"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin@finora.com.br"
            autoComplete="username"
            autoFocus
            required
            className="h-13 w-full rounded-2xl border border-line-strong bg-surface pr-4 pl-11 text-base font-medium text-text placeholder:text-text-2/40 outline-none transition-all duration-150 focus:border-finora-600 focus:ring-4 focus:ring-finora-300/30"
          />
        </div>
      </div>

      {/* Campo Senha */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="l-pw" className="text-xs font-bold tracking-wider uppercase text-text-2">
            Senha
          </label>
        </div>
        <div className="relative flex items-center">
          <div className="pointer-events-none absolute left-4 text-text-2">
            <Lock size={18} />
          </div>
          <input
            id="l-pw"
            type={visible ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            autoComplete="current-password"
            required
            className="h-13 w-full rounded-2xl border border-line-strong bg-surface pr-12 pl-11 text-base font-medium text-text placeholder:text-text-2/40 outline-none transition-all duration-150 focus:border-finora-600 focus:ring-4 focus:ring-finora-300/30"
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-2 flex size-9 items-center justify-center rounded-xl text-text-2 transition-colors hover:bg-paper hover:text-text cursor-pointer"
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {/* Alerta de erro */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/15 p-3.5 text-xs font-semibold text-rose-200 animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={16} className="shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Botão de Entrar */}
      <button
        type="submit"
        disabled={loading || !username.trim() || !password}
        className="group relative mt-2 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-finora-600 via-finora-500 to-[#00E5FF] text-base font-bold text-white shadow-[0_4px_25px_rgba(34,195,220,0.35)] transition-all duration-200 hover:shadow-[0_4px_30px_rgba(34,195,220,0.55)] hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
      >
        {loading ? (
          <>
            <LoaderCircle size={18} className="animate-spin" />
            <span>Autenticando…</span>
          </>
        ) : (
          <>
            <span>Acessar Painel</span>
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </>
        )}
      </button>

      {/* Dica amigável com credenciais disponíveis */}
      <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-xs text-slate-400">
        <span className="font-bold text-white">Usuários autorizados:</span>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px]">
          <li><code className="font-mono text-[#00E5FF]">admin@finora.com.br</code> (Master)</li>
          <li><code className="font-mono text-[#00E5FF]">rodrigo@finora.com.br</code> (Super Admin)</li>
        </ul>
      </div>
    </form>
  );
}
