import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finora Experience | Painel Administrativo",
  description: "Gestão e controle do ecossistema de eventos Finora.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-dvh bg-ink-950 text-ink-text antialiased"
      style={{ background: "#050811", color: "#F8FAFC", minHeight: "100vh" }}
    >
      {children}
    </div>
  );
}
