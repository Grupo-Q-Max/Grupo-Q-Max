import { Gift, PackageCheck, Percent, Layers, Box, Settings } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import PrizeCreateControl from "@/components/admin/PrizeCreateControl";
import PrizeEditControl from "@/components/admin/PrizeEditControl";
import StockControl from "@/components/admin/StockControl";
import StockHistory from "@/components/admin/StockHistory";
import { getPrizes, getEvents } from "@/lib/api";

export default async function PrizesPage(props: { searchParams: Promise<{ event?: string }> }) {
  const searchParams = await props.searchParams;
  const events = await getEvents();
  const eventId = searchParams.event ? Number(searchParams.event) : (events[0]?.id || 1);
  const selectedEvent = events.find((e: any) => e.id === eventId) || events[0];

  const prizes = await getPrizes(eventId);

  const totalProbability = prizes
    .filter((prize: any) => prize.active && !prize.is_vip)
    .reduce((total: number, prize: any) => total + Number(prize.probability), 0);

  const totalStock = prizes.reduce(
    (total: number, prize: any) => total + prize.available_stock,
    0
  );

  return (
    <div className="adminShell">
      <AdminSidebar />
      <main className="adminMain adminPaper flex h-screen flex-col overflow-hidden bg-paper text-text">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 space-y-8">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-line">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6F0FF] border border-[#B9D4F7] text-finora-600 text-xs font-bold uppercase tracking-widest mb-3">
                <Gift size={14} />
                Gestão de Prêmios
              </div>
              <h1 className="font-display text-[30px] font-bold tracking-[-0.02em] mb-1">
                Prêmios e Estoque
              </h1>
              <p className="text-text-2 text-sm">
                Gerencie recompensas, reposição de estoque e probabilidade do evento <strong className="text-text">{selectedEvent?.name || "Evento Principal"}</strong>.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <StockControl eventId={eventId} />
              <PrizeCreateControl eventId={eventId} />
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface border border-line rounded-2xl p-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#E6F0FF] border border-[#B9D4F7] flex items-center justify-center text-finora-600 shrink-0">
                <Layers size={24} />
              </div>
              <div>
                <span className="text-xs font-bold text-text-2 uppercase tracking-wider block mb-1">
                  Total de Prêmios
                </span>
                <strong className="text-2xl font-black text-text block">
                  {prizes.length}
                </strong>
              </div>
            </div>

            <div className="bg-surface border border-line rounded-2xl p-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#E3F6EA] border border-[#B7E4C7] flex items-center justify-center text-[#0F7A3D] shrink-0">
                <Box size={24} />
              </div>
              <div>
                <span className="text-xs font-bold text-text-2 uppercase tracking-wider block mb-1">
                  Estoque Disponível
                </span>
                <strong className="text-2xl font-black text-text block">
                  {totalStock}
                </strong>
              </div>
            </div>

            <div className="bg-surface border border-line rounded-2xl p-5 flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${totalProbability === 100 ? "bg-[#E6F0FF] border-[#B9D4F7] text-finora-600" : "bg-[#FDE8EC] border-[#F5C2CD] text-[#A3112F]"}`}>
                <Percent size={24} />
              </div>
              <div>
                <span className="text-xs font-bold text-text-2 uppercase tracking-wider block mb-1">
                  Probabilidade Ativa (sem VIP)
                </span>
                <div className="flex items-center gap-2">
                  <strong className={`text-2xl font-black ${totalProbability === 100 ? "text-text" : "text-[#A3112F]"}`}>
                    {totalProbability}%
                  </strong>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${totalProbability === 100 ? "bg-[#E6F0FF] text-finora-600 border-[#B9D4F7]" : "bg-[#FDE8EC] text-[#A3112F] border-[#F5C2CD]"}`}>
                    {totalProbability === 100 ? "Válido" : "Inválido"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-line bg-surface flex items-center justify-between">
              <h2 className="text-base font-bold text-text flex items-center gap-2">
                <Settings size={18} className="text-finora-600" />
                Inventário do Evento
              </h2>
            </div>
            
            <div className="divide-y divide-line">
              {prizes.map((prize: any) => (
                <div key={prize.id} className="p-4 sm:p-6 hover:bg-white/[0.04] transition-all flex flex-col md:flex-row md:items-center gap-4 md:gap-6 group">
                  <div className="w-14 h-14 rounded-2xl bg-surface border border-line-strong flex items-center justify-center text-text-2 shrink-0 group-hover:scale-105 group-hover:border-finora-500/50 group-hover:text-finora-400 transition-all">
                    <Gift size={28} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <strong className="text-lg font-bold text-text truncate">
                        {prize.name}
                      </strong>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${prize.active ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-surface text-text-2 border border-line-strong"}`}>
                        {prize.active ? "Ativo" : "Inativo"}
                      </span>
                      {prize.is_vip && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/40">VIP</span>
                      )}
                    </div>
                    <p className="text-sm text-text-2 line-clamp-1">
                      {prize.description || "Sem descrição informada."}
                    </p>
                    <StockHistory prizeId={prize.id} />
                  </div>

                  <div className="flex items-center justify-between md:justify-start gap-6 sm:gap-10 bg-paper/60 p-3 rounded-xl border border-line">
                    <div className="text-center px-2">
                      <span className="text-[10px] font-bold text-text-2 uppercase tracking-widest block mb-1">
                        Estoque
                      </span>
                      <strong className={`text-lg font-black ${prize.available_stock === 0 ? "text-rose-400" : prize.available_stock <= 5 ? "text-amber-400" : "text-text"}`}>
                        {prize.available_stock}
                      </strong>
                    </div>
                    
                    <div className="w-px h-8 bg-line-strong"></div>

                    <div className="text-center px-2">
                      <span className="text-[10px] font-bold text-text-2 uppercase tracking-widest block mb-1">
                        Chance
                      </span>
                      <strong className="text-lg font-black text-finora-400">
                        {Number(prize.probability)}%
                      </strong>
                    </div>
                  </div>

                  <div className="shrink-0 flex justify-end mt-2 md:mt-0">
                    <PrizeEditControl
                      prize={prize}
                      otherActiveProbability={
                        prizes
                          .filter((item: any) => item.active && item.id !== prize.id && Boolean(item.is_vip) === Boolean(prize.is_vip))
                          .reduce((total: number, item: any) => total + Number(item.probability), 0)
                      }
                    />
                  </div>
                </div>
              ))}
              
              {prizes.length === 0 && (
                <div className="p-12 text-center">
                  <Gift size={48} className="mx-auto text-text-2 mb-4" />
                  <h3 className="text-lg font-bold text-text mb-2">Nenhum prêmio cadastrado</h3>
                  <p className="text-text-2 text-sm">Clique em "Adicionar Prêmio" no topo da página para começar.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
