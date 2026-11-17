import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, retry, timer } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

export type BroadcastAudience =
  'ALL' | 'PENDING_SPIN' | 'PENDING_CLAIM' | 'CLAIMED';

export type BroadcastOptions = {
  messageTemplate: string;
  audience?: BroadcastAudience;
  scheduledTime?: string; // ISO string ou HH:mm para agendamento
  mediaUrl?: string;
  videoUrl?: string;
};

export type BroadcastResult = {
  totalTargeted: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  details: {
    participantName: string;
    phone: string;
    status: 'SENT' | 'FAILED' | 'SKIPPED';
    reason?: string;
  }[];
};

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly instanceId = process.env.ZAPI_INSTANCE_ID;
  private readonly token = process.env.ZAPI_TOKEN;
  private readonly clientToken = process.env.ZAPI_CLIENT_TOKEN;
  private readonly baseUrl = 'https://api.z-api.io/instances';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async getQueueStats(eventId?: number) {
    const where = eventId ? { event_id: eventId } : {};
    
    const counts = await this.prisma.message_queue.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true,
      },
    });

    const stats = {
      PENDING: 0,
      PROCESSING: 0,
      SENT: 0,
      FAILED: 0,
      total: 0,
    };

    counts.forEach((item) => {
      stats[item.status as keyof typeof stats] = item._count.status;
      stats.total += item._count.status;
    });

    return stats;
  }

  async getQueueHistory(eventId?: number, limit = 200) {
    const where = eventId ? { event_id: eventId } : {};

    return this.prisma.message_queue.findMany({
      where,
      orderBy: [{ next_attempt_at: 'asc' }, { id: 'asc' }],
      take: Math.min(limit, 500),
      select: {
        id: true,
        phone: true,
        message: true,
        media_url: true,
        media_type: true,
        status: true,
        attempts: true,
        next_attempt_at: true,
        error_reason: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async retryQueueMessage(id: number, customMessage?: string) {
    const msg = await this.prisma.message_queue.findUnique({ 
      where: { id },
      include: { participants: true }
    });
    if (!msg) throw new NotFoundException('Mensagem na fila não encontrada');
    if (msg.status !== 'FAILED') {
      throw new Error('Apenas mensagens com falha podem ser re-enfileiradas manualmente.');
    }

    let finalMessage = msg.message;

    if (customMessage) {
      let personalized = customMessage;
      
      // Se houver participante, trocar {nome}
      if (msg.participants) {
        const firstName = msg.participants.full_name?.split(' ')[0] || 'Visitante';
        personalized = personalized.replace(/\{nome\}/gi, firstName);
      } else {
        personalized = personalized.replace(/\{nome\}/gi, 'Visitante');
      }

      // Processar o Spintax
      finalMessage = this.parseSpintax(personalized);
    }

    return this.prisma.message_queue.update({
      where: { id },
      data: {
        message: finalMessage,
        status: 'PENDING',
        attempts: 0,
        next_attempt_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  async retryAllFailedQueue(eventId?: number, customMessage?: string) {
    const whereClause: any = { status: 'FAILED' };
    if (eventId) {
      whereClause.event_id = eventId;
    }

    if (!customMessage) {
      const result = await this.prisma.message_queue.updateMany({
        where: whereClause,
        data: {
          status: 'PENDING',
          attempts: 0,
          next_attempt_at: new Date(),
          updated_at: new Date(),
        },
      });
      return { count: result.count };
    }

    // Se tiver mensagem customizada, precisamos parsear Spintax e {nome} para CADA um.
    const messages = await this.prisma.message_queue.findMany({
      where: whereClause,
      include: { participants: true },
    });

    let count = 0;
    for (const msg of messages) {
      let personalized = customMessage;
      if (msg.participants) {
        const firstName = msg.participants.full_name?.split(' ')[0] || 'Visitante';
        personalized = personalized.replace(/\{nome\}/gi, firstName);
      } else {
        personalized = personalized.replace(/\{nome\}/gi, 'Visitante');
      }
      
      const finalMessage = this.parseSpintax(personalized);

      await this.prisma.message_queue.update({
        where: { id: msg.id },
        data: {
          message: finalMessage,
          status: 'PENDING',
          attempts: 0,
          next_attempt_at: new Date(),
          updated_at: new Date(),
        },
      });
      count++;
    }

    return { count };
  }

  /**
   * Consulta o status da conexão da instância com o WhatsApp via Z-API
   */
  async getStatus(): Promise<{
    configured: boolean;
    connected: boolean;
    phone?: string | null;
    instanceId?: string | null;
    message?: string;
  }> {
    if (!this.instanceId || !this.token) {
      return {
        configured: false,
        connected: false,
        message:
          'Credenciais ZAPI_INSTANCE_ID ou ZAPI_TOKEN não configuradas no .env.',
      };
    }

    const url = `${this.baseUrl}/${this.instanceId}/token/${this.token}/status`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          timeout: 4000,
          headers: this.clientToken ? { 'Client-Token': this.clientToken } : {},
        }),
      );

      const data = response?.data;
      const isConnected = !!(data?.connected || data?.status === 'CONNECTED');

      return {
        configured: true,
        connected: isConnected,
        phone: data?.phone || null,
        instanceId: this.instanceId,
        message: isConnected
          ? 'Instância conectada e pronta para envio.'
          : 'Instância desconectada ou aguardando leitura do QR Code na Z-API.',
      };
    } catch (error: any) {
      this.logger.warn(
        `Falha ao consultar status da Z-API: ${error?.message || error}`,
      );
      return {
        configured: true,
        connected: false,
        instanceId: this.instanceId,
        message: 'Instância desconectada ou plano de testes expirado na Z-API.',
      };
    }
  }

  /**
   * Envia uma mensagem de texto para um número via Z-API com timeout e retries automáticos
   * @param phone Número de telefone com DDI (ex: 5511999999999)
   * @param message Conteúdo da mensagem
   */
  async sendMessage(phone: string | null, message: string): Promise<boolean> {
    if (process.env.DISABLE_WHATSAPP === 'true') {
      this.logger.debug('Envio de WhatsApp desativado (DISABLE_WHATSAPP=true).');
      return false;
    }

    if (!phone) return false;

    if (!this.instanceId || !this.token) {
      this.logger.warn(
        'Credenciais da Z-API ausentes. A mensagem não foi enviada.',
      );
      return false;
    }

    const url = `${this.baseUrl}/${this.instanceId}/token/${this.token}/send-text`;

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    try {
      this.logger.log(`Enviando WhatsApp para ${cleanPhone}...`);

      const { data } = await firstValueFrom(
        this.httpService
          .post(
            url,
            {
              phone: cleanPhone,
              message: message,
            },
            {
              timeout: 6000,
              headers: this.clientToken
                ? { 'Client-Token': this.clientToken }
                : {},
            },
          )
          .pipe(
            retry({
              count: 2,
              delay: () => timer(1000),
            }),
            catchError((error) => {
              this.logger.error(
                `Erro ao enviar mensagem via Z-API após retries: ${error.message}`,
              );
              throw error;
            }),
          ),
      );

      this.logger.log(
        `Mensagem enviada com sucesso para ${cleanPhone} (ID: ${data?.messageId})`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        'Falha definitiva no envio da mensagem via Z-API',
        error,
      );
      return false;
    }
  }

  /**
   * Processa formatação Spintax {opcao1|opcao2|opcao3}
   */
  public parseSpintax(text: string): string {
    if (!text) return text;
    const spintaxRegex = /\{([^{}]+)\}/g;
    let match;
    let parsedText = text;
    while ((match = spintaxRegex.exec(parsedText)) !== null) {
      if (match[1].includes('|')) {
        const options = match[1].split('|');
        const randomOption = options[Math.floor(Math.random() * options.length)];
        parsedText = parsedText.substring(0, match.index) + randomOption + parsedText.substring(match.index + match[0].length);
        spintaxRegex.lastIndex = 0; // reset regex
      }
    }
    return parsedText;
  }

  /**
   * Enfileira uma mensagem para envio no background, garantindo que não será perdida
   */
  async enqueueMessage(
    phone: string | null,
    message: string,
    options?: {
      eventId?: number;
      participantId?: number;
      mediaUrl?: string;
      mediaType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'VOICE' | 'DOCUMENT';
    },
  ): Promise<boolean> {
    if (process.env.DISABLE_WHATSAPP === 'true') {
      return false;
    }
    if (!phone) return false;
    const finalMessage = this.parseSpintax(message);

    try {
      await this.prisma.message_queue.create({
        data: {
          phone: phone,
          message: finalMessage,
          event_id: options?.eventId,
          participant_id: options?.participantId,
          media_url: options?.mediaUrl,
          media_type: options?.mediaType || 'TEXT',
          status: 'PENDING',
        },
      });
      return true;
    } catch (err) {
      this.logger.error(`Erro ao enfileirar mensagem para ${phone}`, err);
      return false;
    }
  }

  /**
   * Envia texto ou mídia. Usado pelo Worker em Background.
   */
  async sendMediaOrText(
    phone: string,
    message: string,
    mediaUrl?: string | null,
    mediaType?: string | null,
  ): Promise<boolean> {
    if (process.env.DISABLE_WHATSAPP === 'true') {
      return false;
    }

    if (!this.instanceId || !this.token) {
      throw new Error('Credenciais da Z-API ausentes.');
    }

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    const request = (endpoint: string, payload: any) =>
      firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/${this.instanceId}/token/${this.token}/${endpoint}`,
          payload,
          { timeout: 8000, headers: this.clientToken ? { 'Client-Token': this.clientToken } : {} }
        ).pipe(
          retry({ count: 1, delay: () => timer(2000) })
        )
      );

    try {
      if (!mediaUrl) {
        // Apenas Texto
        await request('send-text', { phone: cleanPhone, message: message });
      } else {
        // Tem mídia
        switch (mediaType) {
          case 'IMAGE':
            await request('send-image', { phone: cleanPhone, image: mediaUrl, caption: message });
            break;
          case 'VIDEO':
            await request('send-video', { phone: cleanPhone, video: mediaUrl, caption: message });
            break;
          case 'AUDIO':
            await request('send-audio', { phone: cleanPhone, audio: mediaUrl });
            // Z-API não suporta caption em audio. O texto deve ser enviado separado.
            if (message && message.trim()) {
               await request('send-text', { phone: cleanPhone, message: message });
            }
            break;
          case 'VOICE': // Audio gravado na hora
            await request('send-audio', { phone: cleanPhone, audio: mediaUrl, record: true });
            if (message && message.trim()) {
               await request('send-text', { phone: cleanPhone, message: message });
            }
            break;
          case 'DOCUMENT':
            await request('send-document', { phone: cleanPhone, document: mediaUrl, fileName: 'documento', caption: message });
            break;
          default:
             await request('send-text', { phone: cleanPhone, message: message });
        }
      }
      return true;
    } catch (error: any) {
      this.logger.error(`Falha no Z-API endpoint para ${cleanPhone}: ${error.message}`);
      throw error;
    }
  }

  async sendBulkCustomMessage(options: {
    phones: string[];
    message: string;
    mediaUrl?: string;
    videoUrl?: string;
    includeNameFallback?: boolean;
  }): Promise<{
    success: boolean;
    sentCount: number;
    phoneCount: number;
    failedCount: number;
    details: Array<{
      phone: string;
      status: 'SENT' | 'FAILED';
      reason?: string;
    }>;
  }> {
    const uniquePhones = [
      ...new Set(
        (options.phones || [])
          .map((phone) => String(phone).trim())
          .filter(Boolean),
      ),
    ];
    const payload = {
      phones: uniquePhones,
      message: options.message || '',
      mediaUrl: options.mediaUrl,
      videoUrl: options.videoUrl,
    };

    if (!uniquePhones.length || !payload.message.trim()) {
      return {
        success: false,
        sentCount: 0,
        phoneCount: uniquePhones.length,
        failedCount: uniquePhones.length,
        details: uniquePhones.map((phone) => ({
          phone,
          status: 'FAILED',
          reason: 'Mensagem ou lista de números vazia.',
        })),
      };
    }

    if (!this.instanceId || !this.token) {
      return {
        success: false,
        sentCount: 0,
        phoneCount: uniquePhones.length,
        failedCount: uniquePhones.length,
        details: uniquePhones.map((phone) => ({
          phone,
          status: 'FAILED',
          reason: 'Z-API não configurada.',
        })),
      };
    }

    const details: Array<{
      phone: string;
      status: 'SENT' | 'FAILED';
      reason?: string;
    }> = [];
    let sentCount = 0;
    const queueData: any[] = [];

    for (const phone of uniquePhones) {
      const normalizedPhone = phone.replace(/\D/g, '');
      const hasValidLength =
        normalizedPhone.length >= 10 && normalizedPhone.length <= 15;
      if (!hasValidLength) {
        details.push({ phone, status: 'FAILED', reason: 'Número inválido.' });
        continue;
      }

      const finalPhone =
        normalizedPhone.length === 10 || normalizedPhone.length === 11
          ? `55${normalizedPhone}`
          : normalizedPhone;
      
      const baseMessage =
        payload.message.includes('{nome}') && options.includeNameFallback
          ? payload.message.replace(/\{nome\}/gi, 'Visitante')
          : payload.message;
      
      const textMessage = this.parseSpintax(baseMessage);

      // Determina media type
      let mediaType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'VOICE' | 'DOCUMENT' = 'TEXT';
      let mediaUrl: string | undefined = undefined;
      const isValidUrl = (url?: string) => {
        if (!url || typeof url !== 'string') return false;
        const trimmed = url.trim();
        if (trimmed.includes('...')) return false;
        if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:application/')) return true;
        try {
          const parsed = new URL(trimmed);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      };

      if (isValidUrl(payload.mediaUrl)) {
        // Simple guess based on extension, otherwise fallback to IMAGE
        const isAudio = payload.mediaUrl?.toLowerCase().match(/\.(mp3|ogg|wav)$/);
        const isVideo = payload.mediaUrl?.toLowerCase().match(/\.(mp4|avi|mov)$/);
        const isDoc = payload.mediaUrl?.toLowerCase().match(/\.(pdf|doc|docx)$/);
        if (isAudio) mediaType = 'AUDIO';
        else if (isVideo) mediaType = 'VIDEO';
        else if (isDoc) mediaType = 'DOCUMENT';
        else mediaType = 'IMAGE';
        
        mediaUrl = payload.mediaUrl;
      }
      
      if (isValidUrl(payload.videoUrl)) {
         mediaType = 'VIDEO';
         mediaUrl = payload.videoUrl;
      }

      queueData.push({
        phone,
        message: textMessage,
        media_url: mediaUrl,
        media_type: mediaType !== 'TEXT' ? mediaType : 'TEXT',
        status: 'PENDING',
      });
      
      details.push({ phone, status: 'SENT' });
      sentCount += 1;
    }

    if (queueData.length > 0) {
      try {
        await this.prisma.message_queue.createMany({
          data: queueData,
          skipDuplicates: true,
        });
      } catch (error: any) {
        this.logger.error('Falha ao inserir mensagens em batch', error);
        throw error;
      }
    }

    return {
      success: sentCount > 0,
      sentCount,
      phoneCount: uniquePhones.length,
      failedCount: details.filter((item) => item.status === 'FAILED').length,
      details,
    };
  }

  /**
   * Reenvia a mensagem de premiação para um participante do estande
   */
  async resendPrizeNotification(
    participationId: number,
  ): Promise<{ success: boolean; message: string }> {
    const participation = await this.prisma.participations.findUnique({
      where: { id: participationId },
      include: {
        participants: true,
        events: true,
        draws: {
          include: {
            prizes: true,
          },
        },
      },
    });

    if (!participation) {
      throw new NotFoundException('Participação não encontrada.');
    }

    if (!participation.draws) {
      throw new NotFoundException(
        'Esta participação ainda não realizou o sorteio.',
      );
    }

    const participant = participation.participants;
    const prize = participation.draws.prizes;
    const channelLinkMsg = participation.events.whatsapp_channel_link
      ? `\n\n👉 *Entre no nosso Canal VIP:*\n${participation.events.whatsapp_channel_link}`
      : '';

    const resendTemplate = participation.events.whatsapp_resend_message?.trim() ||
      `🎈 *PARABÉNS PELO SEU PRÊMIO, {nome}!* 🥳🎉\n\n` +
      `Foi um prazer ter você conosco no estande da *Finora* no evento *{evento}*! 💫✨\n\n` +
      `🎁 *SEU PRÊMIO:*\n` +
      `🏆 *{premio}*\n\n` +
      `Aproveite muito o seu presente! Obrigado por participar dessa experiência incrível com a gente! 🎁🔥` +
      `\n\n✨ _Finora Experience • Transformando Eventos em Experiências_`;

    const message = resendTemplate
      .replace(/\{nome\}|\[NOME\]/g, participant.full_name || 'Visitante')
      .replace(/\{evento\}|\[EVENTO\]/g, participation.events.name)
      .replace(/\{premio\}|\[PREMIO\]/g, prize.name) + 
      channelLinkMsg;

    const sent = await this.sendMessage(participant.phone, message);

    return {
      success: sent,
      message: sent
        ? `Mensagem enviada com sucesso para o WhatsApp (${participant.phone}).`
        : `Não foi possível entregar a mensagem via Z-API. Verifique o número informado.`,
    };
  }

  /**
   * Realiza disparo em massa (Broadcast) com tags dinâmicas e delay anti-ban para o evento
   */
  async broadcastToEvent(
    eventId: number,
    options: BroadcastOptions,
  ): Promise<BroadcastResult> {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }

    // Filtra público-alvo
    const whereClause: any = {
      event_id: eventId,
    };

    if (options.audience === 'PENDING_SPIN') {
      whereClause.status = 'APPROVED';
      whereClause.draws = null;
    } else if (options.audience === 'PENDING_CLAIM') {
      whereClause.status = { not: 'COMPLETED' };
    } else if (options.audience === 'CLAIMED') {
      whereClause.status = 'COMPLETED';
    }

    const participations = await this.prisma.participations.findMany({
      where: whereClause,
      include: {
        participants: true,
        draws: {
          include: {
            prizes: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    const result: BroadcastResult = {
      totalTargeted: participations.length,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      details: [],
    };

    // Evita duplicar envio para o mesmo número se a pessoa tiver mais de 1 registro
    const processedPhones = new Set<string>();
    const queueData: any[] = [];

    for (const part of participations) {
      const phone = part.participants.phone;
      const fullName = part.participants.full_name || 'Visitante';
      const firstName = fullName.split(' ')[0] || fullName;
      const prizeName = part.draws?.prizes?.name || 'Brinde Finora';
      const pin = `#${String(part.id).padStart(4, '0')}`;

      if (!phone) {
        result.skippedCount++;
        result.details.push({
          participantName: fullName,
          phone: 'Não cadastrado',
          status: 'SKIPPED',
          reason: 'Telefone ausente',
        });
        continue;
      }

      const cleanPhone = phone.replace(/\D/g, '');
      if (processedPhones.has(cleanPhone)) {
        result.skippedCount++;
        result.details.push({
          participantName: fullName,
          phone: phone,
          status: 'SKIPPED',
          reason: 'Número duplicado',
        });
        continue;
      }

      processedPhones.add(cleanPhone);

      // Substituição de Tags Dinâmicas
      let personalizedMessage = options.messageTemplate
        .replace(/\{nome\}/gi, firstName)
        .replace(/\{nome_completo\}/gi, fullName)
        .replace(/\{premio\}/gi, prizeName)
        .replace(/\{evento\}/gi, event.name)
        .replace(/\{pin\}/gi, pin);

      let mediaType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'VOICE' | 'DOCUMENT' = 'TEXT';
      let finalMediaUrl: string | undefined = undefined;
      
      if (options.videoUrl) {
        mediaType = 'VIDEO';
        finalMediaUrl = options.videoUrl;
      } else if (options.mediaUrl) {
        if (options.mediaUrl.endsWith('.pdf')) {
          mediaType = 'DOCUMENT';
        } else if (options.mediaUrl.endsWith('.mp3') || options.mediaUrl.endsWith('.ogg')) {
          mediaType = 'AUDIO';
        } else {
          mediaType = 'IMAGE';
        }
        finalMediaUrl = options.mediaUrl;
      }

      personalizedMessage = this.parseSpintax(personalizedMessage);

      queueData.push({
        phone: phone,
        message: personalizedMessage,
        event_id: event.id,
        participant_id: part.participants.id,
        media_url: finalMediaUrl,
        media_type: mediaType !== 'TEXT' ? mediaType : 'TEXT',
        status: 'PENDING',
      });

      result.sentCount++;
      result.details.push({
        participantName: fullName,
        phone: phone,
        status: 'SENT',
      });
    }

    if (queueData.length > 0) {
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < queueData.length; i += CHUNK_SIZE) {
        const chunk = queueData.slice(i, i + CHUNK_SIZE);
        try {
          await this.prisma.message_queue.createMany({
            data: chunk,
            skipDuplicates: true,
          });
        } catch (error: any) {
          this.logger.error('Erro ao salvar lote na fila', error);
          throw error;
        }
      }
    }

    return result;
  }

  // ==== EXCEL BATCH LOGIC ====

  async analyzeExcelContacts(eventId: number, contacts: { name: string; phone: string }[]) {
    const existingQueue = await this.prisma.message_queue.findMany({
      where: { event_id: eventId },
      select: { phone: true },
    });
    const alreadySentPhones = new Set(existingQueue.map(q => q.phone));

    const existingParticipants = await this.prisma.participants.findMany({
      select: { phone: true, phone_normalized: true },
    });
    
    const registeredPhones = new Set<string>();
    for (const p of existingParticipants) {
      if (p.phone) registeredPhones.add(p.phone.replace(/\D/g, ''));
      if (p.phone_normalized) registeredPhones.add(p.phone_normalized.replace(/\D/g, ''));
    }

    let duplicateQueue = 0;
    let duplicateRegistered = 0;
    const readyToSend: { name: string; phone: string; cleanPhone: string }[] = [];

    for (const c of contacts) {
      if (!c.phone) continue;
      let cleanPhone = String(c.phone).replace(/\D/g, '');
      if (cleanPhone.length < 10) continue;
      if (cleanPhone.length <= 11) {
        cleanPhone = '55' + cleanPhone;
      }

      if (alreadySentPhones.has(cleanPhone) || alreadySentPhones.has(cleanPhone.replace(/^55/, ''))) {
        duplicateQueue++;
        continue;
      }

      if (registeredPhones.has(cleanPhone) || registeredPhones.has(cleanPhone.replace(/^55/, ''))) {
        duplicateRegistered++;
        continue;
      }

      alreadySentPhones.add(cleanPhone); // Prevents duplicates within the Excel file itself
      readyToSend.push({ name: c.name, phone: c.phone, cleanPhone });
    }

    return {
      total: contacts.length,
      ready: readyToSend,
      duplicateQueue,
      duplicateRegistered,
    };
  }

  async enqueueExcelBatch(eventId: number, messageTemplate: string, validContacts: { name: string; cleanPhone: string }[]) {
    let queuedCount = 0;
    let delayMinutes = 0;
    const queueData: any[] = [];

    for (const contact of validContacts) {
      const firstName = (contact.name || 'Visitante').trim().split(' ')[0];
      
      let msg = messageTemplate.replace(/\{nome\}/gi, firstName);
      msg = this.parseSpintax(msg);

      const randomMinutes = Math.floor(Math.random() * 8) + 5; // 5 to 12 minutes
      delayMinutes += randomMinutes;
      const sendDate = new Date();
      sendDate.setMinutes(sendDate.getMinutes() + delayMinutes);

      if (sendDate.getHours() >= 21) {
        sendDate.setDate(sendDate.getDate() + 1);
        sendDate.setHours(8, Math.floor(Math.random() * 15), 0, 0);
        delayMinutes = Math.floor((sendDate.getTime() - new Date().getTime()) / 60000);
      } else if (sendDate.getHours() < 8) {
        sendDate.setHours(8, Math.floor(Math.random() * 15), 0, 0);
        delayMinutes = Math.floor((sendDate.getTime() - new Date().getTime()) / 60000);
      }

      queueData.push({
        event_id: eventId,
        phone: contact.cleanPhone,
        message: msg,
        status: 'PENDING',
        next_attempt_at: sendDate,
      });

      queuedCount++;
    }

    if (queueData.length > 0) {
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < queueData.length; i += CHUNK_SIZE) {
        const chunk = queueData.slice(i, i + CHUNK_SIZE);
        try {
          await this.prisma.message_queue.createMany({
            data: chunk,
            skipDuplicates: true,
          });
        } catch (error: any) {
          this.logger.error('Erro no lote do excel', error);
        }
      }
    }

    return { queuedCount };
  }
}
