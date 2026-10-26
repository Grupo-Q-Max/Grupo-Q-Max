export type Rarity = "LEGENDARY" | "EPIC" | "RARE" | "COMMON";

// Heurística por nome (não há campo de raridade no prêmio).
export function getPrizeRarity(prizeName = ""): Rarity {
  const lower = prizeName.toLowerCase();
  if (["iphone", "apple", "ouro", "mega", "notebook", "ipad", "especial", "premium"].some((k) => lower.includes(k))) {
    return "LEGENDARY";
  }
  if (["mochila", "garrafa", "kit", "fone", "alexa", "termo"].some((k) => lower.includes(k))) {
    return "EPIC";
  }
  return "COMMON";
}

export const RARITY: Record<Rarity, { stars: string; label: string; color: string; badge: string }> = {
  LEGENDARY: { stars: "★★★", label: "Lendário", color: "#FF8A3D", badge: "bg-[#2A1A0E] border-legendary text-[#FFB27F]" },
  EPIC: { stars: "★★", label: "Épico", color: "#A78BFA", badge: "bg-[#1F1A33] border-epic text-[#C9B8FF]" },
  RARE: { stars: "★", label: "Raro", color: "#6BB0FF", badge: "bg-[#0F2140] border-rare text-[#A9D0FF]" },
  COMMON: { stars: "", label: "Comum", color: "#18233B", badge: "bg-ink-800 border-ink-line text-[#C7D0DF]" },
};

// Selo de raridade: sempre cor + estrelas + nome.
export function RarityBadge({ rarity, prefix = "", className = "" }: { rarity: Rarity; prefix?: string; className?: string }) {
  const r = RARITY[rarity];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border-[1.5px] px-3.5 py-2 font-bold ${r.badge} ${className}`}>
      {r.stars && <span>{r.stars}</span>}
      {prefix}
      {prefix ? r.label.toLowerCase() : r.label}
    </span>
  );
}
