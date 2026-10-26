"use client";

import { useEffect, useState } from "react";
import {
  Database,
  Radio,
  Shield,
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Cpu,
  Clock,
  Server,
  Zap,
} from "lucide-react";
import { fetchAdminProxy } from "@/lib/api-client";

type HealthResponse = {
  status?: string;
  timestamp?: string;
  uptimeSeconds?: number;
  database?: {
    status?: string;
    latencyMs?: number;
  };
  memory?: {
    rssMb?: number;
    heapUsedMb?: number;
    heapTotalMb?: number;
  };
  version?: string;
};

type WhatsappStatusResponse = {
  configured?: boolean;
  connected?: boolean;
  phone?: string | null;
  instanceId?: string | null;
  message?: string;
};

export default function SystemConfigDiagnostics() {
  const [loading, setLoading] = useState(true);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);

  // Status de Saúde da API e Banco
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Status Real do Z-API
  const [zapiStatus, setZapiStatus] = useState<WhatsappStatusResponse | null>(null);
  const [zapiError, setZapiError] = useState<string | null>(null);

  async function runFullDiagnostics() {
    setLoading(true);
    setHealthError(null);
    setZapiError(null);

    // 1. Checa Health da API / Banco
    try {
      const res = await fetchAdminProxy("/health");
      if (!res.ok) {
        throw new Error(`Servidor respondeu com status HTTP ${res.status}`);
      }
      const data = await res.json();
      setHealth(data);
    } catch (err: any) {
      setHealthError(err.message || "Erro ao consultar a saúde do servidor.");
    }

    // 2. Checa Status Real do WhatsApp Z-API
    try {
      const res = await fetchAdminProxy("/whatsapp/status");
      if (!res.ok) {
        throw new Error(`Falha na API Z-API (Status ${res.status})`);
      }
      const data = await res.json();
      setZapiStatus(data);
    } catch (err: any) {
      setZapiError(err.message || "Não foi possível verificar a instância da Z-API.");
      setZapiStatus({
        configured: true,
        connected: false,
        message: "Assinatura expirada, token inválido ou serviço fora do ar.",
      });
    } finally {
      setLoading(false);
      setLastCheckTime(new Date().toLocaleTimeString("pt-BR"));
    }
  }

  useEffect(() => {
    runFullDiagnostics();
  }, []);

  const isDbConnected = health?.database?.status === "ok";
  const isZapiConnected = zapiStatus?.connected === true;

  // Sistema 100% operacional apenas se DB e Z-API estiverem ativos sem erro
  const isFullyOperational = isDbConnected && isZapiConnected && !healthError;

  return (
    <div className="space-y-6">
      {/* Banner Principal com Tema Escuro e Botão de Teste */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border-2 border-line p-6 rounded-3xl backdrop-blur">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-finora-600 uppercase tracking-wider">
              SISTEMA & INFRAESTRUTURA
            </span>
            {lastCheckTime && (
              <span className="text-[11px] text-text-2 font-medium">
                • Verificado às {lastCheckTime}
              </span>
            )}
          </div>
          <h1 className="font-display text-[30px] font-bold tracking-[-0.02em] mt-1">
            Configurações & Diagnóstico
          </h1>
          <p className="text-xs text-text-2 mt-1">
            Verificação em tempo real dos serviços de banco de dados, gateway Z-API WhatsApp e parâmetros do servidor.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Badge Global de Operacionalidade */}
          <div
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
              isFullyOperational
                ? "bg-[#E3F6EA] border-[#B7E4C7] text-[#0F7A3D]"
                : "bg-[#FDE8EC] border-[#F5C2CD] text-[#A3112F]"
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isFullyOperational ? "bg-finora-600" : "bg-danger"
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isFullyOperational ? "bg-finora-600" : "bg-danger"
                }`}
              ></span>
            </span>
            <span>
              {isFullyOperational
                ? "Sistema 100% Operacional"
                : "Atenção: Serviço com Instabilidade"}
            </span>
          </div>

          {/* Botão de Testar Conexão */}
          <button
            onClick={runFullDiagnostics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-finora-600 hover:bg-finora-700 disabled:opacity-50 text-white font-bold text-xs rounded-full transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>{loading ? "Testando..." : "Testar Conexão"}</span>
          </button>
        </div>
      </div>

      {/* Grid Principal de Status dos Serviços */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Banco de Dados MariaDB / MySQL */}
        <div className="bg-surface border-2 border-line p-5 rounded-2xl backdrop-blur flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#E3F6EA] border border-[#B7E4C7] flex items-center justify-center text-[#0F7A3D]">
                <Database size={20} />
              </div>
              <span
                className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${
                  isDbConnected
                    ? "bg-[#E3F6EA] text-[#0F7A3D] border-[#B7E4C7]"
                    : "bg-[#FDE8EC] text-[#A3112F] border-[#F5C2CD]"
                }`}
              >
                {isDbConnected ? "CONECTADO" : "FALHA DE CONEXÃO"}
              </span>
            </div>
            <strong className="text-base font-bold text-text block">
              MariaDB / MySQL
            </strong>
            <p className="text-xs text-text-2 mt-1 leading-relaxed">
              Driver Prisma ORM nativo com pool de conexões ativo.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs">
            <span className="text-text-2">Latência do Banco:</span>
            <span className="font-mono font-bold text-[#0F7A3D]">
              {health?.database?.latencyMs !== undefined
                ? `${health.database.latencyMs} ms`
                : "N/A"}
            </span>
          </div>
        </div>

        {/* 2. Z-API (WhatsApp) */}
        <div
          className={`bg-surface border-2 ${
            !isZapiConnected ? "border-[#F5C2CD] bg-[#FDE8EC]" : "border-line"
          } p-5 rounded-2xl backdrop-blur flex flex-col justify-between relative overflow-hidden`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  isZapiConnected
                    ? "bg-[#E3F6EA] border-[#B7E4C7] text-[#0F7A3D]"
                    : "bg-[#FDE8EC] border-[#F5C2CD] text-[#A3112F]"
                }`}
              >
                <Radio size={20} />
              </div>
              <span
                className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                  isZapiConnected
                    ? "bg-[#E3F6EA] text-[#0F7A3D] border-[#B7E4C7]"
                    : "bg-[#FDE8EC] text-[#A3112F] border-[#F5C2CD]"
                }`}
              >
                {isZapiConnected ? (
                  <>
                    <CheckCircle2 size={12} />
                    CONECTADO
                  </>
                ) : (
                  <>
                    <XCircle size={12} />
                    EXPIRADO / DESCONECTADO
                  </>
                )}
              </span>
            </div>
            <strong className="text-base font-bold text-text block">
              Z-API (WhatsApp)
            </strong>
            <p className="text-xs text-text mt-1 leading-relaxed">
              {zapiStatus?.message ||
                "Verificando status de envio e conexão da instância Z-API..."}
            </p>
          </div>

          {/* Alerta Destacado se Expirado / Desconectado */}
          {!isZapiConnected && (
            <div className="mt-3 p-3 bg-[#FDE8EC] border border-[#F5C2CD] rounded-xl text-xs text-[#A3112F]">
              <div className="flex items-center gap-1.5 font-bold text-[#A3112F] mb-1">
                <AlertTriangle size={14} />
                <span>Assinatura ou QR Code Necessário</span>
              </div>
              <p className="text-[11px] leading-tight text-[#A3112F]">
                A assinatura da Z-API expirou ou a instância foi desconectada do WhatsApp. Revalide a assinatura ou leia o QR Code no painel da Z-API.
              </p>
            </div>
          )}

          {zapiStatus?.phone && (
            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs">
              <span className="text-text-2">Telefone Conectado:</span>
              <span className="font-mono font-bold text-finora-600">
                {zapiStatus.phone}
              </span>
            </div>
          )}
        </div>

        {/* 3. Mecanismo Antifraude */}
        <div className="bg-surface border-2 border-line p-5 rounded-2xl backdrop-blur flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#E6F0FF] border border-[#B9D4F7] flex items-center justify-center text-finora-600">
                <Shield size={20} />
              </div>
              <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-[#E6F0FF] text-finora-600 border border-[#B9D4F7]">
                BLINDADO & ATIVO
              </span>
            </div>
            <strong className="text-base font-bold text-text block">
              Mecanismo Antifraude
            </strong>
            <p className="text-xs text-text-2 mt-1 leading-relaxed">
              Validação algorítmica de CPF, travamento por IP, gerador CSPRNG e controle de giros ilimitados para testes.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs">
            <span className="text-text-2">Isenções de Teste:</span>
            <span className="font-mono font-bold text-finora-600">Permitidas no Painel</span>
          </div>
        </div>
      </div>

      {/* Detalhes do Servidor & API NestJS */}
      <section className="bg-surface border-2 border-line p-6 rounded-3xl backdrop-blur">
        <h3 className="font-bold text-text text-base mb-4 flex items-center gap-2">
          <Activity size={18} className="text-finora-600" />
          Parâmetros do Servidor & API NestJS
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-paper p-4 rounded-xl border border-line">
            <div className="flex items-center gap-2 text-text-2 text-xs mb-1">
              <Server size={14} className="text-finora-600" />
              <span>Status da API NestJS</span>
            </div>
            <strong
              className={`font-bold text-sm block mt-1 ${
                healthError ? "text-[#A3112F]" : "text-[#0F7A3D]"
              }`}
            >
              {healthError ? "ERRO DE CONEXÃO" : health?.status?.toUpperCase() || "HEALTHY"}
            </strong>
          </div>

          <div className="bg-paper p-4 rounded-xl border border-line">
            <div className="flex items-center gap-2 text-text-2 text-xs mb-1">
              <Clock size={14} className="text-finora-600" />
              <span>Tempo de Atividade (Uptime)</span>
            </div>
            <strong className="text-text font-mono text-sm block mt-1">
              {health?.uptimeSeconds
                ? `${Math.floor(health.uptimeSeconds / 3600)}h ${Math.floor(
                    (health.uptimeSeconds % 3600) / 60
                  )}m ${health.uptimeSeconds % 60}s`
                : "Ativo"}
            </strong>
          </div>

          <div className="bg-paper p-4 rounded-xl border border-line">
            <div className="flex items-center gap-2 text-text-2 text-xs mb-1">
              <Cpu size={14} className="text-finora-600" />
              <span>Memória Node.js (Heap)</span>
            </div>
            <strong className="text-finora-600 font-mono text-sm block mt-1">
              {health?.memory?.heapUsedMb !== undefined
                ? `${health.memory.heapUsedMb} MB / ${health.memory.heapTotalMb} MB`
                : "Normal"}
            </strong>
          </div>

          <div className="bg-paper p-4 rounded-xl border border-line">
            <div className="flex items-center gap-2 text-text-2 text-xs mb-1">
              <Zap size={14} className="text-[#8A4B00]" />
              <span>Ambiente de Execução</span>
            </div>
            <strong className="text-[#8A4B00] font-bold text-sm block mt-1">
              {process.env.NODE_ENV || "production"}
            </strong>
          </div>
        </div>
      </section>
    </div>
  );
}
