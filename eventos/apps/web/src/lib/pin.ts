// PIN de retirada (id da participação) lido de QR, leitor ou URL do bilhete.
export function pinFromQr(raw: string): string | null {
  const text = (raw || "").trim();
  if (!text) return null;

  // 1. PIN direto: "0042", "#0042", "PIN_0042", "PIN-0042", "BILHETE-0042"
  const directMatch = text.match(/^(?:(?:PIN|BILHETE|TICKET|CUPOM|ID)[_\s:-]*)?#?(\d{1,6})$/i);
  if (directMatch) return directMatch[1];

  // 2. Parâmetro em URL: ?pin=42, ?participation=42, ?p=42, etc.
  const urlParamMatch = text.match(/[?&](?:pin|participation|participation_id|participant_id|id|p)=(\d{1,6})(?:&|$|[#&])/i);
  if (urlParamMatch) return urlParamMatch[1];

  // 3. Caminho em URL: /v/42 ou /participantes/42 ou /participations/42
  const urlPathMatch = text.match(/\/(?:v|p|participantes|participations|bilhete)\/(\d{1,6})(?:[/?#]|$)/i);
  if (urlPathMatch) return urlPathMatch[1];

  return null;
}
