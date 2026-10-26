import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-100 relative overflow-hidden">
      {/* Luz ambiente de fundo */}
      <div className="absolute w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -top-20 -left-20" />
      <div className="absolute w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20" />

      <div className="relative z-10 max-w-md flex flex-col items-center bg-slate-900/80 border border-slate-800 p-8 rounded-2xl shadow-2xl backdrop-blur-md">
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 mb-6 border border-slate-700">
          <ShieldAlert size={32} />
        </div>

        <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase mb-2">
          Finora Experience • 404
        </span>

        <h1 className="text-2xl font-bold text-white mb-2">
          Página não encontrada
        </h1>

        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          O link que você tentou acessar não existe, expirou ou foi movido para um novo endereço.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-500/25"
          >
            <ArrowLeft size={16} />
            Escolher o evento
          </Link>
          <Link
            href="/admin"
            className="flex items-center justify-center py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-all border border-slate-700"
          >
            Painel Admin
          </Link>
        </div>
      </div>

      <footer className="mt-8 text-xs text-slate-500 relative z-10">
        Finora Experience • Estandes & Eventos Corporativos
      </footer>
    </main>
  );
}
