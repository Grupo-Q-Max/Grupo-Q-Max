import { expect, request as apiRequest, test } from "@playwright/test";
import { E2E_OPERATOR, e2eEnv } from "./env";

const API = "http://127.0.0.1:3334/api/v1";

test("ajuste de estoque abaixo do limite gera alerta (uma vez)", async () => {
  const api = await apiRequest.newContext({ extraHTTPHeaders: { "x-finora-admin-key": e2eEnv.FINORA_ADMIN_API_KEY } });
  const events: { id: number; slug: string }[] = await (await api.get(`${API}/events`)).json();
  const eventId = events.find((e) => e.slug === "e2e-clinicorp")!.id;

  const prize = await (
    await api.post(`${API}/prizes`, { data: { eventId, name: `Alerta ${Date.now()}`, initialStock: 10, probability: 0 } })
  ).json();
  expect(prize.id, JSON.stringify(prize)).toBeTruthy();

  const alerts = async () =>
    ((await (await api.get(`${API}/audit?eventId=${eventId}`)).json()) as { action: string; entity_id: string }[]).filter(
      (a) => a.action === "STOCK_ALERT" && a.entity_id === String(prize.id),
    ).length;

  // 10 → 2: cruza o limite de 20% (2 unidades).
  await api.post(`${API}/prizes/${prize.id}/stock`, { data: { operation: "SET", quantity: 2 } });
  await expect.poll(alerts).toBe(1);

  // 2 → 1: já estava abaixo, não repete.
  await api.post(`${API}/prizes/${prize.id}/stock`, { data: { operation: "SET", quantity: 1 } });
  await new Promise((r) => setTimeout(r, 500));
  expect(await alerts()).toBe(1);
});

test("webhook do CRM recebe o lead com consentimento", async () => {
  const { createServer } = await import("node:http");
  const received: { type: string; lead: { email: string } }[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received.push(JSON.parse(body));
      res.end("ok");
    });
  });
  await new Promise<void>((r) => server.listen(4999, "127.0.0.1", r));

  try {
    const api = await apiRequest.newContext();
    const events: { id: number; slug: string }[] = await (await api.get(`${API}/events`)).json();
    const eventId = events.find((e) => e.slug === "e2e-clinicorp")!.id;
    const email = `crm+${Date.now()}@teste.com.br`;
    const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    for (const size of [9, 10]) digits.push(((digits.slice(0, size).reduce((a, d, i) => a + d * (size + 1 - i), 0) * 10) % 11) % 10);

    await api.post(`${API}/participants/register`, {
      data: {
        eventId,
        fullName: "Caio CRM",
        cpf: digits.join(""),
        phone: `119${String(Date.now()).slice(-8)}`,
        email,
        deviceId: `E2E-${crypto.randomUUID()}`,
        marketingConsent: true,
        privacyConsent: true,
      },
    });

    await expect.poll(() => received.find((r) => r.lead.email === email)?.type).toBe("lead");
  } finally {
    server.close();
  }
});

test("relatório mostra funil e giros por hora", async ({ page }) => {
  const api = await apiRequest.newContext();
  const events: { id: number; slug: string }[] = await (await api.get(`${API}/events`)).json();
  const eventId = events.find((e) => e.slug === "e2e-clinicorp")!.id;

  await page.request.post("api/admin-auth/login", { data: E2E_OPERATOR });
  await page.goto(`admin/relatorios?event=${eventId}`);
  await expect(page.getByRole("heading", { name: "Funil do evento" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Giros por hora" })).toBeVisible();
  await expect(page.getByText("Retiraram o prêmio")).toBeVisible();
});
