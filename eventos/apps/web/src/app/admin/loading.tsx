import { LoaderCircle } from "lucide-react";
import { FinoraLogo } from "@/components/brand/Brand";

export default function AdminLoading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper text-text" aria-busy="true">
      <FinoraLogo />
      <LoaderCircle size={28} className="animate-spin text-[#00E5FF]" />
      <span className="text-sm font-semibold text-slate-400">Carregando painel e métricas...</span>
    </main>
  );
}
