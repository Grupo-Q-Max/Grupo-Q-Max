import type { ReactNode } from "react";

type AccentTextProps = {
  children: ReactNode;
  tone?: "white" | "magenta";
  className?: string;
};

export function QmaxBrand({
  prefix,
}: {
  prefix?: "Grupo";
}) {
  return (
    <>
      {prefix ? `${prefix} ` : null}
      <span className="qmax-brand-word">Q-Max</span>
    </>
  );
}

export function QmaxBrandUppercase() {
  return (
    <span className="qmax-brand-word">
      Q-MAX
    </span>
  );
}

export function QmaxPunctuation({
  children = ".",
}: {
  children?: ReactNode;
}) {
  return (
    <span
      className="qmax-punctuation"
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

export function AccentText({
  children,
  tone = "white",
  className = "",
}: AccentTextProps) {
  return (
    <span
      className={[
        "qmax-accent-text",
        `qmax-accent-text--${tone}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}

export function QmaxInline({
  children,
}: {
  children: string;
}) {
  const parts = children
    .split(/(Q-Max|Q-MAX|QMAX|\bQ\b)/g)
    .filter(Boolean);

  return (
    <>
      {parts.map((part, index) => {
        const brand =
          /^(Q-Max|Q-MAX|QMAX|Q)$/.test(part);

        return brand ? (
          <span
            className="qmax-brand-word"
            key={`${part}-${index}`}
          >
            {part}
          </span>
        ) : (
          <span key={`${part}-${index}`}>
            {part}
          </span>
        );
      })}
    </>
  );
}
