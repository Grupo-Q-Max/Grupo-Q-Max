"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Gift, LoaderCircle, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getApiBaseUrl } from "@/lib/api-client";
import { PaperShell } from "@/components/form/Paper";
import type { EventTheme } from "@/components/brand/Brand";

type ValidatedParticipant = {
  id?: number;
  fullName: string;
  cpfLastDigits: string;
  clinicName?: string | null;
};

function ValidationLogic() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [participant, setParticipant] = useState<ValidatedParticipant | null>(null);
  const [event, setEvent] = useState<EventTheme | undefined>();
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Link de confirmação inválido ou incompleto.");
      return;
    }

    async function validate() {
      try {
        const apiUrl = getApiBaseUrl();
        const response = await fetch(`${apiUrl}/participants/validate-whatsapp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          if (data.participant) {
            setParticipant(data.participant);
          }
          if (data.event) {
            setEvent({ route: data.event.slug, label: data.event.name, accent: data.event.accentColor, accentInk: data.event.accentInkColor });
          }
        } else {
          setStatus("error");
          setErrorMsg(data.message || "Erro ao validar participação.");
        }
      } catch {
        setStatus("error");
        setErrorMsg("Ocorreu um erro de conexão. Tente novamente.");
      }
    }

    validate();
  }, [token]);

  const firstName = participant?.fullName?.split(" ")[0];
  const pin = String(participant?.id ?? 0).padStart(4, "0");

  const badge =
    status === "success" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F7EE] px-3 py-1.5 text-[13px] font-bold text-[#11632F]">
        <Check size={14} strokeWidth={2.6} /> Validado
      </span>
    ) : status === "error" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDE8EC] px-3 py-1.5 text-[13px] font-bold text-[#A3112F]">
        <X size={14} strokeWidth={2.6} /> Não validado
      </span>
    ) : (
      <span />
    );

  return (
    <PaperShell event={event} right={badge}>
      {status === "loading" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-text-2">
          <LoaderCircle size={36} className="animate-spin text-finora-600" />
          <span className="text-[17px]">Validando seu WhatsApp…</span>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col gap-3 px-5 pt-7">
          <h1 className="font-display text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em]">Não deu para validar</h1>
          <p className="text-[17px] leading-[1.45] text-[#36404F]">{errorMsg}</p>
          <p className="text-[15px] text-text-2">Procure a equipe Finora no estande para ajudar com seu cadastro.</p>
        </div>
      )}

      {status === "success" && (
        <>
          <div className="flex flex-col gap-1.5 px-5 pt-6">
            <span className="text-base text-text-2">Tudo certo{firstName ? `, ${firstName}` : ""}.</span>
            <h1 className="font-display text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em]">
              Mostre este código no tablet do estande
            </h1>
          </div>

          <div className="m-5 flex flex-col overflow-hidden rounded-card bg-ink-950 text-ink-text">
            <div className="flex flex-col gap-1.5 p-6">
              <span className="font-mono text-xs tracking-[0.08em] text-ink-text-2">SEU CÓDIGO</span>
              <span className="font-mono text-[34px] font-semibold tracking-[0.04em] text-accent">
                #{pin}
              </span>
              {participant?.clinicName && <span className="text-sm text-ink-text-2">{participant.clinicName}</span>}
            </div>
            {/* QR só com os dígitos do PIN: câmera do balcão e leitor USB digitam o mesmo que o operador. */}
            <div className="flex flex-col items-center gap-2 border-t-[1.5px] border-dashed border-ink-line px-6 py-5">
              <div className="rounded-2xl bg-white p-3">
                <QRCodeSVG value={pin} size={168} level="M" title={`PIN ${pin}`} />
              </div>
              <span className="text-[13px] text-ink-text-2">Mostre no balcão para retirar o prêmio</span>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t-[1.5px] border-dashed border-ink-line px-6 py-4.5">
              <div className="flex flex-col gap-1">
                <span className="text-[13px] text-ink-text-2">Roleta</span>
                <strong>Liberado para girar</strong>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[13px] text-ink-text-2">Sorteio Geral</span>
                <strong>Cupom garantido</strong>
              </div>
            </div>
          </div>

          <div className="px-5">
            <div className="flex items-start gap-3.5 rounded-2xl border border-line bg-surface p-4">
              <Gift size={22} className="mt-0.5 flex-none text-accent-ink" />
              <div className="flex flex-col gap-1">
                <strong>Sorteio Geral no encerramento</strong>
                <span className="text-sm leading-[1.4] text-text-2">
                  Você não precisa estar presente; avisamos pelo WhatsApp.
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </PaperShell>
  );
}

export default function ValidarWhatsappPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-paper" />}>
      <ValidationLogic />
    </Suspense>
  );
}
