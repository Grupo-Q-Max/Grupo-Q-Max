import { expect, test } from "@playwright/test";
import { E2E_OPERATOR } from "./env";
import { pinFromQr } from "../src/lib/pin";

// CPF válido aleatório (dígitos verificadores calculados).
function randomCpf() {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  for (const size of [9, 10]) {
    const sum = digits.slice(0, size).reduce((acc, d, i) => acc + d * (size + 1 - i), 0);
    digits.push(((sum * 10) % 11) % 10);
  }
  return digits.join("");
}

test("cadastro → validação → agendamento → roleta → prêmio", async ({ page }) => {
  // 1. Cadastro
  await page.goto("clinicorp/cadastro");
  await page.getByLabel("Nome completo").fill("Ana Teste E2E");
  await page.getByLabel("CPF").fill(randomCpf());
  await page.getByLabel("WhatsApp").fill(`119${String(Date.now()).slice(-8)}`);
  await page.getByLabel("E-mail").fill(`e2e+${Date.now()}@teste.com.br`);
  await page.getByRole("checkbox", { name: /Aceito o regulamento/ }).check();

  const registerResponse = page.waitForResponse((r) => r.url().includes("/participants/register") && r.request().method() === "POST");
  await page.getByRole("button", { name: /Liberar.*Giro|Receber link/i }).click();
  const registered = await (await registerResponse).json();
  expect(registered.success, JSON.stringify(registered)).toBe(true);

  const { id: participationId, eventId, whatsappToken } = registered.participation;
  const participantId = registered.participant.id;

  // 2. Link de validação que chega no WhatsApp
  await page.goto(`v/${whatsappToken}`);
  await expect(page.getByText(/confirmad|validad/i).first()).toBeVisible();
  // QR de retirada com o PIN (id da participação).
  const pin = String(participationId).padStart(4, "0");
  await expect(page.locator("svg title", { hasText: `PIN ${pin}` })).toBeAttached();

  // 3. Agendamento (fora do horário comercial o auto-agendamento não acontece)
  if (!registered.autoBookedSlot) {
    await page.goto(`clinicorp/agendamento/${participantId}?event=${eventId}`);
    // Amanhã sempre tem horário livre.
    await page.locator("button[aria-pressed]").nth(1).click();
    await page.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first().click();
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();
    await expect(page.getByRole("button", { name: "Confirmar agendamento" })).toBeHidden();
  }

  // 4. Roleta: operador entra e o participante gira
  await page.goto(`clinicorp/roleta?eventId=${eventId}&participation=${participationId}`);
  await page.getByLabel("Usuário").fill(E2E_OPERATOR.username);
  await page.getByLabel("Senha").fill(E2E_OPERATOR.password);
  await page.getByRole("button", { name: "Entrar" }).click();

  // Fila do operador recarrega após o login (antes vinha do polling).
  await expect(page.getByText(/AGUARDANDO GIRO · [1-9]/i)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Passar o tablet|Liberar roleta/i }).click();
  const drawResponse = page.waitForResponse((r) => r.url().includes(`/draws/participation/${participationId}`) && r.request().method() === "POST");
  await page.getByRole("button", { name: /Girar.*roleta/i }).click();
  const draw = await drawResponse;
  expect(draw.ok(), await draw.text()).toBe(true);
  // Tela de resultado (depois da animação do giro).
  await expect(page.getByRole("heading", { name: /Você ganhou\s*Brinde E2E/ })).toBeVisible({ timeout: 20_000 });
});

test("rota pelo slug do banco aplica a cor do evento", async ({ page }) => {
  await page.goto("e2e-clinicorp");
  await expect(page.getByRole("link", { name: /cadastro|participar|começar/i }).first()).toHaveAttribute("href", /\/e2e-clinicorp\/cadastro$/);
  const accent = await page.locator("[data-event='e2e-clinicorp']").first().evaluate((el) => getComputedStyle(el).getPropertyValue("--event-accent").trim());
  expect(accent.toLowerCase()).toBe("#7c3aed");

  // Endereço antigo continua resolvendo o mesmo evento.
  await page.goto("clinicorp/cadastro");
  await expect(page.getByText("E2E Clinicorp").first()).toBeVisible();

  await page.goto("evento-que-nao-existe");
  await expect(page.getByText(/não existe|não encontrad/i).first()).toBeVisible();
});

test("PIN lido do QR do balcão", async () => {
  expect(pinFromQr("0042")).toBe("0042");
  expect(pinFromQr(" #0042 ")).toBe("0042");
  expect(pinFromQr("PIN_0042")).toBe("0042");
  expect(pinFromQr("https://site.com/v/123")).toBe("123");
  expect(pinFromQr("https://site.com/validar?pin=42")).toBe("42");
  expect(pinFromQr("https://site.com/outro/abc")).toBeNull();
  expect(pinFromQr("abc")).toBeNull();
});
