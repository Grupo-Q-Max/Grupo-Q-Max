import JSZip from "jszip";
import QRCode from "qrcode";
import { assetUrl } from "@/components/brand/Brand";

export type TicketExportItem = {
  code: string;
  participantName?: string | null;
  redeemedAt?: string | null;
};

/**
 * Carrega uma imagem do navegador como HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
    img.src = src;
  });
}

/**
 * Desenha um retângulo com bordas arredondadas no canvas
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/**
 * Desenha um bilhete dourado VIP no canvas em altíssima resolução (1400x620)
 */
export async function renderGoldenTicketCanvas(
  canvas: HTMLCanvasElement,
  ticket: TicketExportItem,
  eventName: string,
  eventSlug: string,
  logoImg?: HTMLImageElement | null
): Promise<void> {
  const width = 1400;
  const height = 620;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contexto 2D não suportado.");

  ctx.clearRect(0, 0, width, height);

  // 1. Moldura metálica externa (Gradiente Ouro Forte Vibrante)
  const pad = 6;
  const outerRadius = 32;
  const outerGrad = ctx.createLinearGradient(0, 0, width, height);
  outerGrad.addColorStop(0, "#FFF9B8");
  outerGrad.addColorStop(0.22, "#FFD700");
  outerGrad.addColorStop(0.48, "#FF9900");
  outerGrad.addColorStop(0.68, "#FFF085");
  outerGrad.addColorStop(0.88, "#CC7A00");
  outerGrad.addColorStop(1, "#FFD700");

  roundRect(ctx, 0, 0, width, height, outerRadius);
  ctx.fillStyle = outerGrad;
  ctx.fill();

  // 2. Fundo escuro interno do bilhete
  const innerRadius = 26;
  const innerX = pad;
  const innerY = pad;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  roundRect(ctx, innerX, innerY, innerW, innerH, innerRadius);
  ctx.fillStyle = "#090E1C";
  ctx.fill();

  // Borda dourada sutil interna
  ctx.strokeStyle = "rgba(255, 215, 0, 0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 3. Padrão geométrico de pontos no fundo (estilo cédula de segurança)
  ctx.save();
  ctx.fillStyle = "rgba(255, 215, 0, 0.08)";
  for (let x = innerX + 20; x < innerW; x += 22) {
    for (let y = innerY + 20; y < innerH; y += 22) {
      ctx.beginPath();
      ctx.arc(x, y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Divisão: Corpo Principal (Esquerda) vs Canhoto com QR (Direita)
  const stubWidth = 380;
  const stubX = width - stubWidth - pad;
  const mainWidth = stubX - innerX;

  // 4. Lado Esquerdo - Cabeçalho
  const headerY = innerY + 45;

  // A. Logo da Finora (A Libélula)
  let logoEndX = innerX + 45;
  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    const logoH = 46;
    const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
    ctx.drawImage(logoImg, innerX + 45, headerY - 26, logoW, logoH);
    logoEndX = innerX + 45 + logoW;
  }

  // Separador vertical fino
  ctx.strokeStyle = "rgba(212, 175, 55, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(logoEndX + 16, headerY - 14);
  ctx.lineTo(logoEndX + 16, headerY + 14);
  ctx.stroke();

  // Nome do evento no cabeçalho
  ctx.fillStyle = "#FFF085";
  ctx.font = "900 16px monospace, 'Courier New', Courier";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("FINORA EXPERIENCE", logoEndX + 28, headerY);

  // B. Badge "BILHETE DOURADO · VIP" em LINHA ÚNICA
  const badgeText = "BILHETE DOURADO · VIP";
  ctx.font = "900 14px monospace, 'Courier New', Courier";
  const badgeTextWidth = ctx.measureText(badgeText).width;
  const badgePaddingX = 20;
  const badgeH = 38;
  const badgeW = badgeTextWidth + badgePaddingX * 2 + 26; // Espaço para a coroa
  const badgeX = stubX - 45 - badgeW;
  const badgeY = headerY - badgeH / 2;

  // Fundo do badge com gradiente ouro forte
  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
  badgeGrad.addColorStop(0, "rgba(255, 215, 0, 0.35)");
  badgeGrad.addColorStop(1, "rgba(255, 153, 0, 0.45)");
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 19);
  ctx.fillStyle = badgeGrad;
  ctx.fill();
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Desenho da coroa dourada dentro do badge
  ctx.save();
  const crownX = badgeX + 18;
  const crownY = headerY;
  ctx.fillStyle = "#FFE57F";
  ctx.beginPath();
  // Mini coroa estilizada
  ctx.moveTo(crownX - 8, crownY + 7);
  ctx.lineTo(crownX + 8, crownY + 7);
  ctx.lineTo(crownX + 9, crownY - 3);
  ctx.lineTo(crownX + 4.5, crownY + 1.5);
  ctx.lineTo(crownX, crownY - 7);
  ctx.lineTo(crownX - 4.5, crownY + 1.5);
  ctx.lineTo(crownX - 9, crownY - 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Texto do badge
  ctx.fillStyle = "#FFF9B8";
  ctx.font = "900 14px monospace, 'Courier New', Courier";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, crownX + 16, headerY);

  // Linha divisória abaixo do cabeçalho
  ctx.strokeStyle = "rgba(255, 215, 0, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(innerX + 45, headerY + 34);
  ctx.lineTo(stubX - 45, headerY + 34);
  ctx.stroke();

  // 5. Conteúdo Central (Esquerda)
  const bodyY = headerY + 70;

  // Nome do evento / sub-selo
  ctx.fillStyle = "#FFD700";
  ctx.font = "900 16px monospace, 'Courier New', Courier";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(eventName.toUpperCase(), innerX + 45, bodyY);

  // Título Nobre com fonte maior
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 44px 'Segoe UI', Inter, -apple-system, sans-serif";
  ctx.fillText("Passe Oficial do Mentorado", innerX + 45, bodyY + 30);

  // Descrição
  ctx.fillStyle = "#C2CEE3";
  ctx.font = "600 17px 'Segoe UI', Inter, -apple-system, sans-serif";
  ctx.fillText(
    "Acesso exclusivo ao Pool de Prêmios VIP e cupom oficial registrado para o Grande Sorteio no Telão.",
    innerX + 45,
    bodyY + 92
  );

  // Destaque solicitado: Escaneie o QR CODE ao lado e concorra a um fotopolimerizador !
  const calloutY = bodyY + 130;
  const calloutW = stubX - innerX - 90;
  const calloutH = 50;
  const calloutGrad = ctx.createLinearGradient(innerX + 45, calloutY, innerX + 45 + calloutW, calloutY + calloutH);
  calloutGrad.addColorStop(0, "rgba(255, 215, 0, 0.3)");
  calloutGrad.addColorStop(0.5, "rgba(255, 153, 0, 0.25)");
  calloutGrad.addColorStop(1, "rgba(255, 215, 0, 0.3)");
  roundRect(ctx, innerX + 45, calloutY, calloutW, calloutH, 15);
  ctx.fillStyle = calloutGrad;
  ctx.fill();
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Texto do callout
  ctx.fillStyle = "#FFF9B8";
  ctx.font = "900 16px 'Segoe UI', Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("✦ ESCANEIE O QR CODE AO LADO E CONCORRA A UM FOTOPOLIMERIZADOR !", innerX + 62, calloutY + calloutH / 2);

  // Linha separadora antes do rodapé
  const footerLineY = height - 135;
  ctx.strokeStyle = "rgba(255, 215, 0, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(innerX + 45, footerLineY);
  ctx.lineTo(stubX - 45, footerLineY);
  ctx.stroke();

  // Rodapé: Portador Credenciado & Cupom Telão
  const footerY = footerLineY + 18;

  // Portador
  ctx.fillStyle = "#A7B2C6";
  ctx.font = "bold 13px monospace, 'Courier New', Courier";
  ctx.fillText("PORTADOR CREDENCIADO", innerX + 45, footerY);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 25px 'Segoe UI', Inter, -apple-system, sans-serif";
  ctx.fillText(ticket.participantName || "Mentorado Convidado", innerX + 45, footerY + 22);

  // Cupom Telão com fonte grande em destaque de ouro
  const cupomX = stubX - 45;
  ctx.textAlign = "right";
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 13px monospace, 'Courier New', Courier";
  ctx.fillText("CUPOM TELÃO", cupomX, footerY);

  const formattedTicket = ticket.code.startsWith("#") ? ticket.code : `#${ticket.code}`;
  ctx.fillStyle = "#FFD700";
  ctx.font = "900 42px monospace, 'Courier New', Courier";
  ctx.fillText(formattedTicket, cupomX, footerY + 20);

  // 6. Linha perfurada vertical e entalhes redondos estilo ingresso
  // Fundo gradiente do canhoto (direita)
  roundRect(ctx, stubX, innerY, stubWidth, innerH, innerRadius);
  ctx.save();
  ctx.clip();
  const stubGrad = ctx.createLinearGradient(stubX, innerY, stubX + stubWidth, innerY + innerH);
  stubGrad.addColorStop(0, "#111A2E");
  stubGrad.addColorStop(0.5, "#0C1222");
  stubGrad.addColorStop(1, "#080D1A");
  ctx.fillStyle = stubGrad;
  ctx.fillRect(stubX, innerY, stubWidth, innerH);
  ctx.restore();

  // Linha picotada
  ctx.save();
  ctx.strokeStyle = "rgba(255, 215, 0, 0.6)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(stubX, innerY + 36);
  ctx.lineTo(stubX, innerY + innerH - 36);
  ctx.stroke();
  ctx.restore();

  // Entalhe semicircular superior
  ctx.beginPath();
  ctx.arc(stubX, innerY, 22, 0, Math.PI);
  ctx.fillStyle = "#FFD700";
  ctx.fill();

  // Entalhe semicircular inferior
  ctx.beginPath();
  ctx.arc(stubX, innerY + innerH, 22, Math.PI, 0);
  ctx.fillStyle = "#FFD700";
  ctx.fill();

  // 7. Lado Direito (Canhoto de Segurança com QR Code)
  const stubCenterX = stubX + stubWidth / 2;

  // Header do Canhoto
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFD700";
  ctx.font = "900 14px monospace, 'Courier New', Courier";
  ctx.fillText("ESCANEAR PARA ATIVAR", stubCenterX, innerY + 45);

  // Gerar QR Code
  const origin =
    typeof window !== "undefined" && window.location.origin && !window.location.origin.includes("localhost")
      ? window.location.origin
      : "https://grupoqmax.com.br";
  const activationUrl = `${origin}/finora-experience/${eventSlug}/cadastro?vip=${encodeURIComponent(ticket.code)}`;

  // Criar QR Code como Canvas temporário de 190x190
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, activationUrl, {
    width: 190,
    margin: 1,
    color: {
      dark: "#080D1A",
      light: "#FFFFFF",
    },
  });

  // Moldura dourada mais forte para o QR Code
  const qrBoxSize = 210;
  const qrBoxX = stubCenterX - qrBoxSize / 2;
  const qrBoxY = innerY + 70;

  roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 22);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Desenhar QR Code dentro do box
  ctx.drawImage(qrCanvas, qrBoxX + 10, qrBoxY + 10, 190, 190);

  // Sub-legenda do QR
  ctx.fillStyle = "#C2CEE3";
  ctx.font = "600 13px 'Segoe UI', Inter, sans-serif";
  ctx.fillText("Abre cadastro com código pronto", stubCenterX, qrBoxY + qrBoxSize + 22);

  // Bloco Inferior: Código VIP com fonte gigante estilo cupom
  const codeBlockY = qrBoxY + qrBoxSize + 56;
  ctx.fillStyle = "#A7B2C6";
  ctx.font = "900 13px monospace, 'Courier New', Courier";
  ctx.fillText("BILHETE VIP", stubCenterX, codeBlockY);

  ctx.fillStyle = "#FFD700";
  ctx.font = "900 46px monospace, 'Courier New', Courier";
  ctx.fillText(formattedTicket, stubCenterX, codeBlockY + 42);

  // Selo de Válido / Resgatado
  ctx.fillStyle = ticket.redeemedAt ? "#F59E0B" : "#34D399";
  ctx.font = "bold 15px 'Segoe UI', Inter, sans-serif";
  ctx.fillText(
    ticket.redeemedAt ? "● Resgatado" : "✔ Válido p/ 1 Giro",
    stubCenterX,
    codeBlockY + 82
  );
}

/**
 * Exporta todos os bilhetes em lote em um arquivo ZIP contendo as imagens PNG
 */
export async function exportAllTicketsToZip(
  codes: TicketExportItem[],
  eventName: string,
  eventSlug: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (!codes || codes.length === 0) {
    throw new Error("Nenhum bilhete para exportar.");
  }

  const zip = new JSZip();
  const folder = zip.folder(`bilhetes-vip-${eventSlug}`);

  // Tenta carregar o logo da Finora uma única vez
  let logoImg: HTMLImageElement | null = null;
  try {
    logoImg = await loadImage(assetUrl("/brands/finora-symbol.png"));
  } catch {
    console.warn("Logo finora-symbol não pôde ser carregada para o canvas, prosseguindo sem ela.");
  }

  // Canvas reutilizável offscreen
  const canvas = document.createElement("canvas");
  const total = codes.length;

  for (let i = 0; i < total; i++) {
    const item = codes[i];
    await renderGoldenTicketCanvas(canvas, item, eventName, eventSlug, logoImg);

    // Converte para Blob PNG
    const dataUrl = canvas.toDataURL("image/png");
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");

    const cleanCode = item.code.replace(/\W+/g, "");
    folder?.file(`bilhete-vip-${cleanCode}.png`, base64Data, { base64: true });

    if (onProgress) {
      onProgress(i + 1, total);
    }

    // Pequeno intervalo para liberar o event loop do navegador e manter UI fluida
    if (i % 10 === 0) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  // Adiciona também um arquivo README / lista de códigos no ZIP
  const listContent = [
    `=== BILHETES DOURADOS VIP - ${eventName.toUpperCase()} ===`,
    `Total de Bilhetes: ${codes.length}`,
    `Data de Exportação: ${new Date().toLocaleString("pt-BR")}`,
    "",
    "CÓDIGO | LINK DE ATIVAÇÃO | SITUAÇÃO",
    "-".repeat(60),
    ...codes.map((c) => {
      const origin =
        typeof window !== "undefined" && window.location.origin && !window.location.origin.includes("localhost")
          ? window.location.origin
          : "https://grupoqmax.com.br";
      const link = `${origin}/finora-experience/${eventSlug}/cadastro?vip=${encodeURIComponent(c.code)}`;
      const status = c.redeemedAt ? "Usado" : "Disponível";
      return `${c.code.padEnd(8)} | ${link} | ${status}`;
    }),
  ].join("\n");

  folder?.file("lista-bilhetes.txt", listContent);

  // Gera o arquivo ZIP final e dispara o download no navegador
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const fileName = `bilhetes-vip-${eventSlug}-${total}-bilhetes.zip`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
