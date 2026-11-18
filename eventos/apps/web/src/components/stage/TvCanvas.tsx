"use client";

import { useEffect, useState, type ReactNode } from "react";

// Palco de TV desenhado em 1920×1080 e escalado para caber na tela.
export default function TvCanvas({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-ink-950 text-ink-text select-none">
      <div className="flex-none" style={{ width: 1920 * scale, height: 1080 * scale }}>
        <div
          className={`relative h-[1080px] w-[1920px] origin-top-left ${className}`}
          style={{
            transform: `scale(${scale})`,
            ...style,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-3 rounded-full bg-[#3A0D1A] px-5.5 py-3 text-2xl font-bold text-[#FF9DB1]">
      <span className="size-3.5 animate-pulse rounded-full bg-[#FF4D73]" />
      Ao vivo
    </span>
  );
}
