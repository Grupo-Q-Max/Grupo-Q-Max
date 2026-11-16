import { expect, request as apiRequest, test, type APIRequestContext } from "@playwright/test";
import { E2E_OPERATOR, e2eEnv } from "./env";

const API = "http://127.0.0.1:3334/api/v1";

function randomCpf() {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  for (const size of [9, 10]) {
    const sum = digits.slice(0, size).reduce((acc, d, i) => acc + d * (size + 1 - i), 0);
    digits.push(((sum * 10) % 11) % 10);
  }
  return digits.join("");
}

async function adminApi(): Promise<APIRequestContext> {
  return apiRequest.newContext({ extraHTTPHeaders: { "x-finora-admin-key": e2eEnv.FINORA_ADMIN_API_KEY } });
}

async function e2eEventId(api: APIRequestContext) {
  const events: { id: number; slug: string }[] = await (await api.get(`${API}/events`)).json();
  return events.find((e) => e.slug === "e2e-clinicorp")!.id;
}

test("quiosque sem internet: cadastro fica na fila e entra uma vez só", async ({ page, context }) => {
  const api = await adminApi();
  const eventId = await e2eEventId(api);
  const name = `Offline ${Date.now()}`;

  await page.goto("clinicorp/cadastro");
  await context.setOffline(true);

  await page.getByLabel("Nome completo").fill(name);
  await page.getByLabel("CPF").fill(randomCpf());
  await page.getByLabel("WhatsApp").fill(`119${String(Date.now()).slice(-8)}`);
  await page.getByLabel("E-mail").fill(`off+${Date.now()}@teste.com.br`);
  await page.getByRole("button", { name: /Liberar.*Giro|Receber link/i }).click();
  await expect(page.getByRole("heading", { name: "Cadastro salvo neste aparelho" })).toBeVisible();
  await expect(page.getByText("1 aguardando envio")).toBeVisible();

  // Simula o reenvio duplicado (ex.: duas abas) antes de a rede voltar.
  await page.evaluate(() => {
    const key = "finora-offline-registrations";
    const items = JSON.parse(localStorage.getItem(key) || "[]");
    localStorage.setItem(key, JSON.stringify([...items, { ...items[0], id: `${items[0].id}-dup` }]));
  });

  await context.setOffline(false);
  await expect(page.getByText(/aguardando envio/)).toBeHidden({ timeout: 15_000 });

  const pending: { fullName: string }[] = await (await api.get(`${API}/participants/pending-draws?eventId=${eventId}&search=${encodeURIComponent(name)}`)).json();
  expect(pending.filter((p) => p.fullName === name)).toHaveLength(1);
});

test("balcão sem internet: confere PIN na lista baixada e envia a entrega depois", async ({ page, context }) => {
  const api = await adminApi();
  const eventId = await e2eEventId(api);

  // Ganhador pronto: cadastro, validação, agendamento e giro pela API.
  const reg = await (
    await api.post(`${API}/participants/register`, {
      data: {
        eventId,
        fullName: "Bia Balcão",
        cpf: randomCpf(),
        phone: `119${String(Date.now()).slice(-8)}`,
        email: `balcao+${Date.now()}@teste.com.br`,
        deviceId: `E2E-${crypto.randomUUID()}`,
        marketingConsent: true,
        privacyConsent: true,
      },
    })
  ).json();
  const participationId: number = reg.participation.id;
  await api.post(`${API}/participants/validate-whatsapp`, { data: { token: reg.participation.whatsappToken } });
  if (!reg.autoBookedSlot) {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const [slot] = await (await api.get(`${API}/meetings/event/${eventId}/available-slots?date=${tomorrow}`)).json();
    await api.post(`${API}/meetings/event/${eventId}/book`, { data: { participantId: reg.participant.id, scheduledAt: slot } });
  }
  expect((await api.post(`${API}/draws/participation/${participationId}`)).ok()).toBe(true);

  // Operador entra no balcão online (baixa a lista) e depois perde a rede.
  await page.request.post("api/admin-auth/login", { data: E2E_OPERATOR });
  await page.goto("admin/balcao");
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("finora-pending-claims") || "[]").length))
    .toBeGreaterThan(0);
  await context.setOffline(true);

  const pin = String(participationId).padStart(4, "0");
  await page.getByPlaceholder("Ex: 0042").fill(pin);
  await expect(page.getByText("Bia Balcão").first()).toBeVisible();
  await expect(page.getByText(/dados da lista baixada/)).toBeVisible();
  await page.getByRole("button", { name: /CONFIRMAR ENTREGA/ }).click();
  await expect(page.getByText("1 a enviar")).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/a enviar/)).toBeHidden({ timeout: 15_000 });

  const claim = await (await api.get(`${API}/draws/participation/${participationId}/verify-claim`)).json();
  expect(claim.isDelivered).toBe(true);
});
