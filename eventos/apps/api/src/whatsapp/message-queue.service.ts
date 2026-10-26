import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';

// ─── Configurações Anti-Ban ───────────────────────────────────────────────────
//
// Após um ban/restrição, enviar de forma humana é essencial:
//  - Delay aleatório entre mensagens (3 a 6 minutos)
//  - Somente em horário comercial (9h–20h, horário de Brasília)
//  - Máximo de 15 mensagens por hora
//  - Jitter extra nos primeiros dias após desbloqueio
//
// O cron roda a cada 30s para maior precisão, mas o controle real
// é feito internamente via lastSentAt + intervalo aleatório.
// ─────────────────────────────────────────────────────────────────────────────

const ANTI_BAN = {
  /** Intervalo mínimo entre envios (ms). Padrão: 3 minutos. */
  get MIN_DELAY_MS() {
    return process.env.WHATSAPP_MIN_DELAY_MS
      ? Math.max(1000, Number(process.env.WHATSAPP_MIN_DELAY_MS))
      : 3 * 60 * 1000;
  },
  /** Intervalo máximo entre envios (ms). Padrão: 6 minutos. */
  get MAX_DELAY_MS() {
    return process.env.WHATSAPP_MAX_DELAY_MS
      ? Math.max(1000, Number(process.env.WHATSAPP_MAX_DELAY_MS))
      : 6 * 60 * 1000;
  },
  /** Hora de início do envio (horário de Brasília, UTC-3). Padrão: 9h. */
  get BUSINESS_HOUR_START() {
    return process.env.WHATSAPP_BUSINESS_START
      ? Number(process.env.WHATSAPP_BUSINESS_START)
      : 9;
  },
  /** Hora de término do envio (horário de Brasília, UTC-3). Padrão: 20h. */
  get BUSINESS_HOUR_END() {
    return process.env.WHATSAPP_BUSINESS_END
      ? Number(process.env.WHATSAPP_BUSINESS_END)
      : 20;
  },
  /** Máximo de mensagens enviadas por hora. Padrão: 15. */
  get MAX_PER_HOUR() {
    return process.env.WHATSAPP_MAX_PER_HOUR
      ? Number(process.env.WHATSAPP_MAX_PER_HOUR)
      : 15;
  },
  /** Máximo de tentativas antes de desistir. */
  get MAX_ATTEMPTS() {
    return process.env.WHATSAPP_MAX_ATTEMPTS
      ? Number(process.env.WHATSAPP_MAX_ATTEMPTS)
      : 1;
  },
};

@Injectable()
export class MessageQueueService {
  private readonly logger = new Logger(MessageQueueService.name);

  /** Mutex: evita execuções simultâneas do cron. */
  private isProcessing = false;

  /** Timestamp do último envio bem-sucedido. */
  private lastSentAt: Date | null = null;

  /** Próximo intervalo aleatório a ser aguardado (ms). */
  private nextIntervalMs: number = this.randomDelay();

  /** Histórico de envios na última hora para controle do cap. */
  private sentTimestamps: Date[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Retorna um delay aleatório entre MIN e MAX (anti-padrão mecânico). */
  private randomDelay(): number {
    const min = ANTI_BAN.MIN_DELAY_MS;
    const max = Math.max(min, ANTI_BAN.MAX_DELAY_MS);
    return min + Math.floor(Math.random() * (max - min));
  }

  /**
   * Verifica se o horário atual está dentro do horário comercial (Brasília UTC-3).
   * Impede envios madrugada/noite que são um sinal forte de bot.
   */
  private isBusinessHour(): boolean {
    if (process.env.WHATSAPP_IGNORE_BUSINESS_HOURS === 'true') {
      return true;
    }
    const now = new Date();
    // Brasília = UTC - 3h
    const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;
    return (
      brasiliaHour >= ANTI_BAN.BUSINESS_HOUR_START &&
      brasiliaHour < ANTI_BAN.BUSINESS_HOUR_END
    );
  }

  /**
   * Remove timestamps com mais de 1 hora e verifica se o cap foi atingido.
   */
  private isHourlyCapReached(): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.sentTimestamps = this.sentTimestamps.filter((t) => t > oneHourAgo);
    return this.sentTimestamps.length >= ANTI_BAN.MAX_PER_HOUR;
  }

  /**
   * Verifica se o tempo mínimo desde o último envio já passou.
   */
  private isMinIntervalReached(): boolean {
    if (!this.lastSentAt) return true;
    return Date.now() - this.lastSentAt.getTime() >= this.nextIntervalMs;
  }

  // ─── Cron Worker ───────────────────────────────────────────────────────────

  /**
   * Tick a cada 30s para verificar se há mensagens prontas.
   * O controle real do ritmo é feito pelos guards internos (Anti-Ban).
   */
  @Cron('*/30 * * * * *') // A cada 30 segundos
  async processQueue() {
    if (process.env.DISABLE_WHATSAPP === 'true') {
      return;
    }
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // ── Guard 1: Horário comercial ──────────────────────────────────────────
      if (!this.isBusinessHour()) {
        const now = new Date();
        const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;
        this.logger.debug(
          `[Anti-Ban] Fora do horário comercial (${brasiliaHour}h BRT). Fila pausada.`,
        );
        return;
      }

      // ── Guard 2: Cap horário ────────────────────────────────────────────────
      if (this.isHourlyCapReached()) {
        this.logger.warn(
          `[Anti-Ban] Limite de ${ANTI_BAN.MAX_PER_HOUR} msgs/hora atingido. Aguardando próxima janela.`,
        );
        return;
      }

      // ── Guard 3: Intervalo mínimo aleatório ────────────────────────────────
      if (!this.isMinIntervalReached()) {
        const remaining = Math.ceil(
          (this.nextIntervalMs - (Date.now() - (this.lastSentAt?.getTime() ?? 0))) / 1000,
        );
        this.logger.debug(
          `[Anti-Ban] Aguardando ${remaining}s antes do próximo envio.`,
        );
        return;
      }

      // ── Guard 4: Conexão Z-API ─────────────────────────────────────────────
      const status = await this.whatsappService.getStatus();
      if (!status.connected) {
        this.logger.warn(
          '[Anti-Ban] Z-API desconectada. Fila pausada para evitar burst quando reconectar.',
        );
        return;
      }

      // ── Busca próxima mensagem ─────────────────────────────────────────────
      const message = await this.prisma.message_queue.findFirst({
        where: {
          status: { in: ['PENDING', 'FAILED'] },
          next_attempt_at: { lte: new Date() },
          attempts: { lt: ANTI_BAN.MAX_ATTEMPTS },
        },
        orderBy: { created_at: 'asc' }, // FIFO
      });

      if (!message) {
        this.logger.debug('[Queue] Nenhuma mensagem pendente no momento.');
        return;
      }

      // ── ATOMIC LOCK: Marca como PROCESSANDO ─────────────────────────────
      const updateResult = await this.prisma.message_queue.updateMany({
        where: { id: message.id, status: message.status },
        data: { status: 'PROCESSING', updated_at: new Date() },
      });

      if (updateResult.count === 0) {
        this.logger.debug(`[Queue] Msg ID ${message.id} já foi pega por outro processo. Ignorando.`);
        return;
      }

      this.logger.log(
        `[Queue] Processando msg ID ${message.id} → ${message.phone} (tentativa ${message.attempts + 1}/${ANTI_BAN.MAX_ATTEMPTS})`,
      );

      // ── Envia ─────────────────────────────────────────────────────────────
      let success = false;
      let errorReason: string | null = null;

      try {
        success = await this.whatsappService.sendMediaOrText(
          message.phone,
          message.message,
          message.media_url,
          message.media_type,
        );
      } catch (err: any) {
        errorReason = err.message || 'Falha desconhecida no envio';
      }

      if (success) {
        await this.prisma.message_queue.update({
          where: { id: message.id },
          data: { status: 'SENT', updated_at: new Date() },
        });

        // Registra timestamp para o cap horário e sorteia próximo intervalo
        this.lastSentAt = new Date();
        this.sentTimestamps.push(this.lastSentAt);
        this.nextIntervalMs = this.randomDelay();

        const minStr = Math.floor(this.nextIntervalMs / 60000);
        const secStr = Math.floor((this.nextIntervalMs % 60000) / 1000);
        this.logger.log(
          `[Queue] ✅ Msg ID ${message.id} enviada. ` +
          `Enviadas na última hora: ${this.sentTimestamps.length}/${ANTI_BAN.MAX_PER_HOUR}. ` +
          `Próximo envio em ~${minStr}m${secStr}s.`,
        );
      } else {
        // Exponential backoff: 4m, 8m, 16m, 32m...
        const nextAttempt = new Date();
        nextAttempt.setMinutes(
          nextAttempt.getMinutes() + Math.pow(2, message.attempts + 1) * 2,
        );

        await this.prisma.message_queue.update({
          where: { id: message.id },
          data: {
            status: 'FAILED',
            attempts: message.attempts + 1,
            next_attempt_at: nextAttempt,
            error_reason: errorReason ?? 'Z-API retornou falha.',
            updated_at: new Date(),
          },
        });
        this.logger.warn(
          `[Queue] ❌ Msg ID ${message.id} falhou (${message.attempts + 1}/${ANTI_BAN.MAX_ATTEMPTS}). ` +
          `Próxima tentativa em ${Math.round((nextAttempt.getTime() - Date.now()) / 60000)}min.`,
        );
      }
    } catch (error) {
      this.logger.error('[Queue] Erro inesperado no worker da fila:', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
