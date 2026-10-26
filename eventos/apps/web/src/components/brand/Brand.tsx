import type { CSSProperties } from "react";

// Identidade do evento vinda do banco: rota pública (slug), nome e cores.
export type EventTheme = {
  route: string;
  label: string;
  accent?: string | null;
  accentInk?: string | null;
  experience?: "ROLETA" | "COFRE";
};

type EventRecordLike = {
  slug: string;
  name: string;
  accent_color?: string | null;
  accent_ink_color?: string | null;
  experience?: "ROLETA" | "COFRE";
};

// route: segmento da URL acessada (pode ser endereço antigo, ex. /clinicorp).
export function eventThemeOf(event: EventRecordLike, route = event.slug): EventTheme {
  return {
    route,
    label: event.name,
    accent: event.accent_color,
    accentInk: event.accent_ink_color,
    experience: event.experience,
  };
}

// Cores do banco como CSS vars: inline vence os [data-event] padrão de globals.css.
export function eventStyle(theme?: Pick<EventTheme, "accent" | "accentInk">): CSSProperties | undefined {
  if (!theme?.accent) return undefined;
  return {
    "--event-accent": theme.accent,
    "--event-accent-ink": theme.accentInk || theme.accent,
  } as CSSProperties;
}

// Resolução correta de assets estáticos respeitando o basePath do Next.js (/finora-experience)
export function assetUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (cleanPath.startsWith("/finora-experience/")) return cleanPath;
  return `/finora-experience${cleanPath}`;
}

// Marca Grupo Q-Max padronizada com o projeto institucional
export function QmaxBrandLogo({
  className = "",
  variant = "white",
  height,
}: {
  className?: string;
  variant?: "white" | "dark" | "text";
  height?: number;
}) {
  if (variant === "text") {
    return (
      <span className={`font-display font-extrabold tracking-[-0.03em] leading-none inline-flex items-center gap-1.5 ${className}`}>
        <span>Grupo</span>
        <span className="text-[#d90f81]">Q-Max</span>
      </span>
    );
  }

  const src = assetUrl(variant === "dark" ? "/brands/grupo-qmax-dark.png" : "/brands/grupo-qmax-white.png");

  return (
    <span className={`inline-flex items-center select-none ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Grupo Q-Max"
        style={height ? { height: `${height}px` } : undefined}
        className="h-7 w-auto object-contain max-h-12 max-w-[180px]"
        loading="eager"
      />
    </span>
  );
}

// Wordmark Finora com precisão tipográfica institucional e logo oficial
export function FinoraLogo({
  className = "",
  variant = "horizontal",
  height,
}: {
  className?: string;
  variant?: "horizontal" | "symbol" | "text";
  height?: number;
}) {
  if (variant === "text") {
    return (
      <span className={`font-display font-extrabold tracking-[-0.03em] leading-none inline-flex items-center ${className}`}>
        <span className="text-white">finora</span>
        <span className="text-[#d90f81] ml-0.5">.</span>
      </span>
    );
  }

  const src = assetUrl(variant === "symbol" ? "/brands/finora-symbol.png" : "/brands/finora-logo-horizontal.png");

  return (
    <span className={`inline-flex items-center select-none ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Finora"
        style={height ? { height: `${height}px` } : undefined}
        className="h-8 w-auto object-contain max-h-16 max-w-[190px]"
        loading="eager"
      />
    </span>
  );
}

// Selo do evento em mono caixa alta, na cor de destaque do evento.
export function EventTag({
  label,
  tone = "stage",
  className = "",
}: {
  label: string;
  tone?: "stage" | "paper";
  className?: string;
}) {
  const color = tone === "stage" ? "border-accent text-accent" : "border-accent-ink text-accent-ink";
  return (
    <span
      className={`font-mono text-[11px] tracking-[0.08em] uppercase px-2.5 py-1 rounded-full border ${color} ${className}`}
    >
      {label}
    </span>
  );
}

// Barra de progresso de passos (cadastro → validação).
export function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-1.5" aria-label={`Passo ${step} de ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1 flex-1 rounded ${i < step ? "bg-text" : "bg-[#D5DCE6]"}`} />
        ))}
      </div>
    </div>
  );
}
