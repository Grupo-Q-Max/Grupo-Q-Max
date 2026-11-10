import { CloudOff } from "lucide-react";
import { PaperHeading, StickyActions, primaryButton } from "@/components/form/Paper";

// Cadastro feito sem internet: fica no aparelho e é enviado quando a rede voltar.
export default function OfflineSaved({ name, onNew }: { name: string; onNew: () => void }) {
  return (
    <>
      <PaperHeading eyebrow="Modo Estande Conectado" title="Cadastro Salvo com Sucesso!">
        <p className="text-[17px] leading-[1.45] text-slate-300">
          Tudo certo, {name.split(" ")[0]}! Seu cadastro está garantido neste aparelho e seu giro já está liberado. Dirija-se ao balcão para girar a roleta.
        </p>
      </PaperHeading>
      <div className="px-5">
        <div className="flex items-start gap-3.5 rounded-2xl border border-line bg-surface p-4">
          <CloudOff size={22} className="mt-0.5 flex-none text-accent-ink" />
          <span className="text-sm leading-[1.4] text-text-2">Não precisa cadastrar de novo. Se a mensagem demorar, procure a equipe no estande.</span>
        </div>
      </div>
      <div className="flex-1" />
      <StickyActions>
        <button type="button" onClick={onNew} className={primaryButton}>
          Novo cadastro
        </button>
      </StickyActions>
    </>
  );
}
