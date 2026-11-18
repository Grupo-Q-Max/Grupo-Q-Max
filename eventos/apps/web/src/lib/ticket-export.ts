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
 * Traça o contorno do bilhete com os recortes semicirculares (notches) do canhoto
 */
function traceNotchedTicketPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  stubX: number,
  notchR: number
) {
  ctx.beginPath();
  // Canto superior esquerdo até antes do entalhe
  ctx.moveTo(x + radius, y);
  ctx.lineTo(stubX - notchR, y);

  // Entalhe semicircular superior (corta para dentro do bilhete)
  ctx.arc(stubX, y, notchR, Math.PI, 0, true);

  // Continua até o canto superior direito
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);

  // Lado direito até o canto inferior direito
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);

  // Lado inferior até antes do entalhe
  ctx.lineTo(stubX + notchR, y + h);

  // Entalhe semicircular inferior (corta para dentro do bilhete)
  ctx.arc(stubX, y + h, notchR, 0, Math.PI, true);

  // Continua até o canto inferior esquerdo
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);

  // Lado esquerdo até o início
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/**
 * Desenha a libélula oficial da Finora em traço vetorial de luxo dourado/branco
 */
function drawFinoraDragonflyVector(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Asas superiores esquerdas e direitas (elipses anguladas)
  ctx.fillStyle = "rgba(255, 235, 130, 0.85)";
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 1.6;

  // Asa sup esq
  ctx.save();
  ctx.rotate(-0.55);
  ctx.beginPath();
  ctx.ellipse(-size * 0.45, -size * 0.15, size * 0.42, size * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Asa sup dir
  ctx.save();
  ctx.rotate(0.55);
  ctx.beginPath();
  ctx.ellipse(size * 0.45, -size * 0.15, size * 0.42, size * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Asas inferiores
  ctx.fillStyle = "rgba(255, 215, 0, 0.7)";
  // Asa inf esq
  ctx.save();
  ctx.rotate(-0.25);
  ctx.beginPath();
  ctx.ellipse(-size * 0.38, size * 0.16, size * 0.32, size * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Asa inf dir
  ctx.save();
  ctx.rotate(0.25);
  ctx.beginPath();
  ctx.ellipse(size * 0.38, size * 0.16, size * 0.32, size * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Corpo central e cauda da libélula
  const bodyGrad = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.55);
  bodyGrad.addColorStop(0, "#FFF9B8");
  bodyGrad.addColorStop(0.5, "#FFD700");
  bodyGrad.addColorStop(1, "#CC7A00");

  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  // Cabeça
  ctx.arc(0, -size * 0.32, size * 0.09, 0, Math.PI * 2);
  ctx.fill();

  // Tórax e cauda segmentada
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.1, size * 0.07, size * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-size * 0.045, size * 0.04);
  ctx.lineTo(size * 0.045, size * 0.04);
  ctx.lineTo(size * 0.02, size * 0.55);
  ctx.lineTo(-size * 0.02, size * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Desenha um bilhete dourado VIP no canvas em altíssima resolução (1500x680)
 * com moldura ouro pura, entalhes de picote reais e visual de luxo idêntico ao modelo
 */
export async function renderGoldenTicketCanvas(
  canvas: HTMLCanvasElement,
  ticket: TicketExportItem,
  eventName: string,
  eventSlug: string,
  logoImg?: HTMLImageElement | null
): Promise<void> {
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {}
  }

  const width = 1480;
  const height = 660;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contexto 2D não suportado.");

  ctx.clearRect(0, 0, width, height);

  // Parâmetros do cartão e margens de corte / respiro
  const marginX = 22;
  const marginY = 22;
  const cardW = width - marginX * 2;
  const cardH = height - marginY * 2;
  const cardX = marginX;
  const cardY = marginY;

  const outerRadius = 32;
  const stubWidth = 390;
  const stubX = cardX + cardW - stubWidth;
  const notchR = 26; // Raio do entalhe de picote

  // 1. Sombra suave externa do cartão
  ctx.save();
  ctx.shadowColor = "rgba(255, 185, 0, 0.45)";
  ctx.shadowBlur = 32;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 10;
  traceNotchedTicketPath(ctx, cardX, cardY, cardW, cardH, outerRadius, stubX, notchR);
  ctx.fillStyle = "#FFD700";
  ctx.fill();
  ctx.restore();

  // 2. Moldura Metálica Ouro Puro Vibrante (Gradiente multi-stop)
  const goldGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  goldGrad.addColorStop(0, "#FFF9B8");
  goldGrad.addColorStop(0.2, "#FFD700");
  goldGrad.addColorStop(0.45, "#FF9900");
  goldGrad.addColorStop(0.65, "#FFF085");
  goldGrad.addColorStop(0.85, "#CC7A00");
  goldGrad.addColorStop(1, "#FFD700");

  traceNotchedTicketPath(ctx, cardX, cardY, cardW, cardH, outerRadius, stubX, notchR);
  ctx.fillStyle = goldGrad;
  ctx.fill();

  // 3. Fundo Escuro Interno com Entalhes Perfeitos
  const borderWidth = 12; // Espessura da borda dourada rica
  const innerX = cardX + borderWidth;
  const innerY = cardY + borderWidth;
  const innerW = cardW - borderWidth * 2;
  const innerH = cardH - borderWidth * 2;
  const innerRadius = outerRadius - 6;
  const innerNotchR = notchR + 1;

  ctx.save();
  traceNotchedTicketPath(ctx, innerX, innerY, innerW, innerH, innerRadius, stubX, innerNotchR);
  ctx.clip();

  // A. Lado Esquerdo / Principal: Dark Blue Luxury (#090E1C)
  ctx.fillStyle = "#090E1C";
  ctx.fillRect(innerX, innerY, stubX - innerX, innerH);

  // B. Lado Direito / Canhoto: Gradiente azul noite profundo
  const stubGrad = ctx.createLinearGradient(stubX, innerY, innerX + innerW, innerY + innerH);
  stubGrad.addColorStop(0, "#111A2E");
  stubGrad.addColorStop(0.5, "#0C1222");
  stubGrad.addColorStop(1, "#080D1A");
  ctx.fillStyle = stubGrad;
  ctx.fillRect(stubX, innerY, innerX + innerW - stubX, innerH);

  // C. Padrão de segurança pontilhado dourado sutil no lado principal
  ctx.fillStyle = "rgba(255, 215, 0, 0.08)";
  for (let px = innerX + 24; px < stubX - 10; px += 20) {
    for (let py = innerY + 20; py < innerY + innerH; py += 20) {
      ctx.beginPath();
      ctx.arc(px, py, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();

  // 4. Contorno interno dourado fino para realce
  traceNotchedTicketPath(ctx, innerX, innerY, innerW, innerH, innerRadius, stubX, innerNotchR);
  ctx.strokeStyle = "rgba(255, 215, 0, 0.55)";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // 5. Linha Perfurada de Picote (Dashed Gold Tear-Line)
  ctx.save();
  ctx.strokeStyle = "rgba(255, 215, 0, 0.65)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([9, 9]);
  ctx.beginPath();
  ctx.moveTo(stubX, innerY + innerNotchR + 10);
  ctx.lineTo(stubX, innerY + innerH - innerNotchR - 10);
  ctx.stroke();
  ctx.restore();

  // ========================================================
  // LADO ESQUERDO: CORPO PRINCIPAL DO BILHETE
  // ========================================================
  const contentLeft = innerX + 44;
  const headerY = innerY + 44;

  // A. Logo Finora: Libélula vetorial dourada de altíssima definição
  drawFinoraDragonflyVector(ctx, contentLeft + 18, headerY, 32);

  // Separador vertical fino
  ctx.strokeStyle = "rgba(255, 215, 0, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(contentLeft + 48, headerY - 14);
  ctx.lineTo(contentLeft + 48, headerY + 14);
  ctx.stroke();

  // Wordmark Finora (limpo, dourado e sem cortes: apenas FINORA)
  ctx.fillStyle = "#FFD700";
  ctx.font = "900 18px monospace, 'Courier New', Courier";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("FINORA", contentLeft + 62, headerY);

  // B. Badge Nobre "BILHETE DOURADO · VIP"
  const badgeText = "BILHETE DOURADO · VIP";
  ctx.font = "900 13px monospace, 'Courier New', Courier";
  const badgeTextWidth = ctx.measureText(badgeText).width;
  const badgeH = 38;
  const badgeW = badgeTextWidth + 56;
  const badgeX = stubX - 44 - badgeW;
  const badgeY = headerY - badgeH / 2;

  // Fundo com gradiente e borda dourada
  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
  badgeGrad.addColorStop(0, "rgba(255, 215, 0, 0.35)");
  badgeGrad.addColorStop(1, "rgba(255, 153, 0, 0.45)");
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 19);
  ctx.fillStyle = badgeGrad;
  ctx.fill();
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Mini coroa dourada dentro do badge
  const crownX = badgeX + 20;
  const crownY = headerY;
  ctx.fillStyle = "#FFE57F";
  ctx.beginPath();
  ctx.moveTo(crownX - 8, crownY + 7);
  ctx.lineTo(crownX + 8, crownY + 7);
  ctx.lineTo(crownX + 9, crownY - 3);
  ctx.lineTo(crownX + 4.5, crownY + 1.5);
  ctx.lineTo(crownX, crownY - 7);
  ctx.lineTo(crownX - 4.5, crownY + 1.5);
  ctx.lineTo(crownX - 9, crownY - 3);
  ctx.closePath();
  ctx.fill();

  // Texto do badge
  ctx.fillStyle = "#FFF9B8";
  ctx.font = "900 13px monospace, 'Courier New', Courier";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, crownX + 16, headerY);

  // Linha divisória fina abaixo do cabeçalho
  ctx.strokeStyle = "rgba(255, 215, 0, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(contentLeft, headerY + 32);
  ctx.lineTo(stubX - 44, headerY + 32);
  ctx.stroke();

  // C. Conteúdo Central
  const bodyY = headerY + 68;

  // Nome do Evento em destaque dourado
  ctx.fillStyle = "#FFD700";
  ctx.font = "900 15px monospace, 'Courier New', Courier";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(eventName.toUpperCase(), contentLeft, bodyY);

  // Título Nobre
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 44px 'Segoe UI', Inter, -apple-system, sans-serif";
  ctx.fillText("Passe Oficial do Mentorado", contentLeft, bodyY + 28);

  // Subtítulo
  ctx.fillStyle = "#C2CEE3";
  ctx.font = "600 16px 'Segoe UI', Inter, -apple-system, sans-serif";
  ctx.fillText(
    "Acesso exclusivo ao Pool de Prêmios VIP e cupom oficial registrado para o Grande Sorteio no Telão.",
    contentLeft,
    bodyY + 88
  );

  // D. Callout Oficial: Fotopolimerizador
  const calloutY = bodyY + 128;
  const calloutW = stubX - contentLeft - 44;
  const calloutH = 50;

  const calloutGrad = ctx.createLinearGradient(contentLeft, calloutY, contentLeft + calloutW, calloutY + calloutH);
  calloutGrad.addColorStop(0, "rgba(255, 215, 0, 0.32)");
  calloutGrad.addColorStop(0.5, "rgba(255, 153, 0, 0.28)");
  calloutGrad.addColorStop(1, "rgba(255, 215, 0, 0.32)");

  roundRect(ctx, contentLeft, calloutY, calloutW, calloutH, 15);
  ctx.fillStyle = calloutGrad;
  ctx.fill();
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Texto do callout com brilho
  ctx.fillStyle = "#FFF9B8";
  ctx.font = "900 15px 'Segoe UI', Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("✦ ESCANEIE O QR CODE AO LADO E CONCORRA A UM FOTOPOLIMERIZADOR !", contentLeft + 20, calloutY + calloutH / 2);

  // E. Rodapé: Portador Credenciado & Cupom Telão
  const footerLineY = innerY + innerH - 120;
  ctx.strokeStyle = "rgba(255, 215, 0, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(contentLeft, footerLineY);
  ctx.lineTo(stubX - 44, footerLineY);
  ctx.stroke();

  const footerY = footerLineY + 18;

  // Portador
  ctx.fillStyle = "#A7B2C6";
  ctx.font = "bold 12px monospace, 'Courier New', Courier";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("PORTADOR CREDENCIADO", contentLeft, footerY);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 24px 'Segoe UI', Inter, -apple-system, sans-serif";
  ctx.fillText(ticket.participantName || "Mentorado Convidado", contentLeft, footerY + 22);

  // Cupom Telão com fonte grande em ouro
  const cupomX = stubX - 44;
  ctx.textAlign = "right";
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 12px monospace, 'Courier New', Courier";
  ctx.fillText("CUPOM TELÃO", cupomX, footerY);

  const formattedTicket = ticket.code.startsWith("#") ? ticket.code : `#${ticket.code}`;
  ctx.fillStyle = "#FFD700";
  ctx.font = "900 42px monospace, 'Courier New', Courier";
  ctx.fillText(formattedTicket, cupomX, footerY + 20);

  // ========================================================
  // LADO DIREITO: CANHOTO DE SEGURANÇA COM QR CODE
  // ========================================================
  const stubCenterX = stubX + stubWidth / 2;

  // Header do Canhoto
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#FFD700";
  ctx.font = "900 14px monospace, 'Courier New', Courier";
  ctx.fillText("ESCANEAR PARA ATIVAR", stubCenterX, innerY + 38);

  // Gerar QR Code
  const origin =
    typeof window !== "undefined" && window.location.origin && !window.location.origin.includes("localhost")
      ? window.location.origin
      : "https://grupoqmax.com.br";
  const activationUrl = `${origin}/finora-experience/${eventSlug}/cadastro?vip=${encodeURIComponent(ticket.code)}`;

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, activationUrl, {
    width: 200,
    margin: 1,
    color: {
      dark: "#080D1A",
      light: "#FFFFFF",
    },
  });

  // Box branco do QR Code com borda dourada elegante
  const qrBoxSize = 224;
  const qrBoxX = stubCenterX - qrBoxSize / 2;
  const qrBoxY = innerY + 68;

  roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 20);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Desenhar QR Code dentro do box
  ctx.drawImage(qrCanvas, qrBoxX + 12, qrBoxY + 12, 200, 200);

  // Sub-legenda do QR
  ctx.fillStyle = "#C2CEE3";
  ctx.font = "600 13px 'Segoe UI', Inter, sans-serif";
  ctx.fillText("Abre cadastro com código pronto", stubCenterX, qrBoxY + qrBoxSize + 18);

  // Bloco Inferior: Código VIP gigante estilo cupom
  const codeBlockY = qrBoxY + qrBoxSize + 48;
  ctx.fillStyle = "#A7B2C6";
  ctx.font = "900 12px monospace, 'Courier New', Courier";
  ctx.fillText("BILHETE VIP", stubCenterX, codeBlockY);

  ctx.fillStyle = "#FFD700";
  ctx.font = "900 46px monospace, 'Courier New', Courier";
  ctx.fillText(formattedTicket, stubCenterX, codeBlockY + 24);

  // Selo de Válido / Resgatado
  ctx.fillStyle = ticket.redeemedAt ? "#F59E0B" : "#10B981";
  ctx.font = "bold 15px 'Segoe UI', Inter, sans-serif";
  ctx.fillText(
    ticket.redeemedAt ? "● Resgatado" : "✔ Válido p/ 1 Giro",
    stubCenterX,
    codeBlockY + 76
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

  // Canvas reutilizável offscreen
  const canvas = document.createElement("canvas");
  const total = codes.length;

  for (let i = 0; i < total; i++) {
    const item = codes[i];
    await renderGoldenTicketCanvas(canvas, item, eventName, eventSlug);

    // Converte para Blob PNG de alta qualidade
    const dataUrl = canvas.toDataURL("image/png");
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");

    const cleanCode = item.code.replace(/\W+/g, "");
    folder?.file(`bilhete-vip-${cleanCode}.png`, base64Data, { base64: true });

    if (onProgress) {
      onProgress(i + 1, total);
    }

    // Intervalo suave para liberar o event loop do navegador
    if (i % 10 === 0) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  // Adiciona arquivo README / lista com links diretos
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
