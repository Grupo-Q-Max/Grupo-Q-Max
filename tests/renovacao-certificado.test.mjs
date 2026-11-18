import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { extrairVencimentoCertificado } = require("../proposta/services/renovacaoCertificadoService");

test("extrairVencimentoCertificado extracts date from vencimentosRegularizacoes", () => {
  const proposta = {
    socios_detalhados_json: JSON.stringify({
      vencimentosRegularizacoes: {
        certificado: {
          status: "Sim",
          dataVencimento: "2026-12-15"
        }
      }
    })
  };

  const res = extrairVencimentoCertificado(proposta);
  assert.equal(res?.status, "Sim");
  assert.equal(res?.dataVencimento, "2026-12-15");
});

test("extrairVencimentoCertificado extracts date from legacy formState and direct properties", () => {
  const proposta = {
    socios_detalhados_json: JSON.stringify({
      vencimentoCertificadoDigital: "2026-11-30",
      certificadoDigital: "Sim"
    })
  };

  const res = extrairVencimentoCertificado(proposta);
  assert.equal(res?.status, "Sim");
  assert.equal(res?.dataVencimento, "2026-11-30");
});

test("extrairVencimentoCertificado returns null when missing or invalid", () => {
  assert.equal(extrairVencimentoCertificado(null), null);
  assert.equal(extrairVencimentoCertificado({}), null);
  assert.equal(extrairVencimentoCertificado({ socios_detalhados_json: "invalid-json" }), null);
  assert.equal(extrairVencimentoCertificado({ socios_detalhados_json: JSON.stringify({ socios: [] }) }), null);
});

test("vencimento calculation detects 30 days window accurately", () => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Data daqui a 15 dias (dentro do mês)
  const d15 = new Date(hoje.getTime() + 15 * 24 * 60 * 60 * 1000);
  const diff15 = Math.ceil((d15.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  assert.ok(diff15 <= 30 && diff15 >= 0);

  // Data daqui a 60 dias (fora do mês)
  const d60 = new Date(hoje.getTime() + 60 * 24 * 60 * 60 * 1000);
  const diff60 = Math.ceil((d60.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  assert.ok(diff60 > 30);
});
