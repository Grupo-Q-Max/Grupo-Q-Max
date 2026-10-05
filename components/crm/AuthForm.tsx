"use client";

import { useState } from "react";
import { Target } from "lucide-react";

const MODES = {
  login: { endpoint: "/api/auth", submit: "Entrar", busy: "Entrando...", switchText: "Não tem conta?", switchLabel: "Cadastre-se", switchHref: "/register" },
  register: { endpoint: "/api/auth/register", submit: "Criar conta", busy: "Criando...", switchText: "Já tem conta?", switchLabel: "Entrar", switchHref: "/login" },
  verify: { endpoint: "/api/auth/verify", submit: "Confirmar e entrar", busy: "Confirmando...", switchText: "Link expirou?", switchLabel: "Cadastre-se de novo", switchHref: "/register" },
};

/**
 * CRM login / sign-up / e-mail confirmation form. The proxy sends to /login with `?next=` the page the member
 * tried to open; the confirmation e-mail links to /verify with `?token=`.
 */
export function AuthForm({ mode }: { mode: keyof typeof MODES }) {
  const text = MODES[mode];
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    const params = new URLSearchParams(location.search);
    const res = await fetch(text.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "verify" ? { ...fields, token: params.get("token") } : fields),
    }).catch(() => null);

    if (res?.ok && mode === "register") {
      setSentTo(String(fields.email));
      return;
    }
    if (res?.ok) {
      const next = params.get("next");
      // only same-site paths: never redirect to another origin
      location.href = next?.startsWith("/") && !next.startsWith("//") ? next : "/crm";
      return;
    }
    setError((await res?.json().catch(() => null))?.error ?? "Não foi possível continuar. Tente novamente.");
    setLoading(false);
  }

  if (sentTo) {
    return (
      <main className="crm-login">
        <div className="crm-login__card" role="status">
          <div className="crm-login__brand">
            <Target size={28} />
            <span>Q-Max CRM</span>
          </div>
          <p className="crm-login__notice">
            Enviamos um link de confirmação para <strong>{sentTo}</strong>. Abra o e-mail e confirme para ativar seu
            acesso. O link vale por 24 horas.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="crm-login">
      <form className="crm-login__card" onSubmit={submit}>
        <div className="crm-login__brand">
          <Target size={28} />
          <span>Q-Max CRM</span>
        </div>
        {mode === "register" && (
          <label>
            <span>Nome</span>
            <input name="name" autoComplete="name" required autoFocus />
          </label>
        )}
        {mode === "verify" ? (
          <p className="crm-login__notice">Digite a senha que você criou no cadastro para confirmar seu e-mail.</p>
        ) : (
          <label>
            <span>E-mail{mode === "register" && " (@grupoqmax.com.br)"}</span>
            <input name="email" type="email" autoComplete="email" required autoFocus={mode === "login"} />
          </label>
        )}
        <label>
          <span>Senha</span>
          <input
            name="password"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            autoFocus={mode === "verify"}
            minLength={mode === "register" ? 8 : undefined}
            required
          />
        </label>
        {error && (
          <p className="crm-login__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading}>
          {loading ? text.busy : text.submit}
        </button>
        <p className="crm-login__switch">
          {text.switchText} <a href={text.switchHref}>{text.switchLabel}</a>
        </p>
      </form>
    </main>
  );
}
