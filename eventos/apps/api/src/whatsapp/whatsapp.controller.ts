import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { WhatsappService, type BroadcastAudience } from './whatsapp.service';

export class BroadcastDto {
  @IsOptional()
  @IsString()
  messageTemplate?: string;

  @IsOptional()
  @IsString()
  template?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  audience?: BroadcastAudience;

  @IsOptional()
  @IsString()
  scheduledTime?: string;

  @IsOptional()
  @IsString({ each: true })
  phones?: string[];

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  customMessage?: string;
}

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  async getStatus() {
    return this.whatsappService.getStatus();
  }

  @Get('queue-stats')
  async getQueueStats(@Query('eventId') eventId?: string) {
    return this.whatsappService.getQueueStats(eventId ? Number(eventId) : undefined);
  }

  @Get('queue-history')
  async getQueueHistory(
    @Query('eventId') eventId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.whatsappService.getQueueHistory(
      eventId ? Number(eventId) : undefined,
      limit ? Number(limit) : 50,
    );
  }

  @Post('queue/retry-all')
  async retryAllFailedQueue(
    @Query('eventId') eventId?: string,
    @Body('message') customMessage?: string,
  ) {
    return this.whatsappService.retryAllFailedQueue(
      eventId ? Number(eventId) : undefined,
      customMessage
    );
  }

  @Post('queue/:id/retry')
  async retryQueueMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body('message') customMessage?: string,
  ) {
    return this.whatsappService.retryQueueMessage(id, customMessage);
  }

  @Post('resend/:participationId')
  async resendNotification(
    @Param('participationId', ParseIntPipe) participationId: number,
  ) {
    return this.whatsappService.resendPrizeNotification(participationId);
  }

  @Post('event/:eventId/broadcast')
  async broadcastToEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() body: BroadcastDto,
    @Query('messageTemplate') qTemplate?: string,
    @Query('template') qTemplate2?: string,
    @Query('audience') qAudience?: BroadcastAudience,
  ) {
    const messageTemplate =
      body?.messageTemplate ||
      body?.template ||
      body?.message ||
      qTemplate ||
      qTemplate2;

    const audience = (body?.audience || qAudience) as BroadcastAudience;

    if (!messageTemplate || !messageTemplate.trim()) {
      return {
        message:
          'Endpoint de transmissão WhatsApp ativo. Envie payload com messageTemplate.',
        eventId,
      };
    }

    return this.whatsappService.broadcastToEvent(eventId, {
      messageTemplate: messageTemplate.trim(),
      audience,
      mediaUrl: body?.mediaUrl,
      videoUrl: body?.videoUrl,
    });
  }

  @Post('event/:eventId/broadcast/')
  async broadcastToEventWithSlash(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() body: BroadcastDto,
    @Query('messageTemplate') qTemplate?: string,
    @Query('template') qTemplate2?: string,
    @Query('audience') qAudience?: BroadcastAudience,
  ) {
    return this.broadcastToEvent(
      eventId,
      body,
      qTemplate,
      qTemplate2,
      qAudience,
    );
  }

  @Post('send-custom')
  async sendCustomBulk(@Body() body: BroadcastDto) {
    const message =
      body?.customMessage ||
      body?.messageTemplate ||
      body?.template ||
      body?.message ||
      '';
    const phones = Array.isArray(body?.phones) ? body.phones : [];

    if (!phones.length || !message.trim()) {
      return {
        success: false,
        sentCount: 0,
        phoneCount: phones.length,
        failedCount: phones.length,
        details: phones.map((phone) => ({
          phone,
          status: 'FAILED',
          reason: 'Mensagem ou lista de números inválida.',
        })),
      };
    }

    return this.whatsappService.sendBulkCustomMessage({
      phones,
      message,
      mediaUrl: body?.mediaUrl,
      videoUrl: body?.videoUrl,
      includeNameFallback: true,
    });
  }

  @Post('trigger-broadcast')
  async triggerBroadcast() {
    const { exec } = require('child_process');
    exec('npx ts-node scripts/broadcast-hugo.ts', { cwd: process.cwd() }, (error: any, stdout: string) => {
      if (error) console.error(`Erro no disparo do Excel:`, error);
      else console.log(`Disparo do Excel finalizado:\n`, stdout);
    });
    return { success: true, message: 'Disparo iniciado em background!' };
  }

  @Post('event/:eventId/analyze-contacts')
  async analyzeContacts(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body('contacts') contacts: { name: string; phone: string }[]
  ) {
    if (!contacts || !Array.isArray(contacts)) return { error: 'Invalid contacts array' };
    return this.whatsappService.analyzeExcelContacts(eventId, contacts);
  }

  @Post('event/:eventId/enqueue-batch')
  async enqueueBatch(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body('messageTemplate') messageTemplate: string,
    @Body('contacts') contacts: { name: string; cleanPhone: string }[]
  ) {
    if (!contacts || !Array.isArray(contacts)) return { error: 'Invalid contacts array' };
    return this.whatsappService.enqueueExcelBatch(eventId, messageTemplate, contacts);
  }
}
