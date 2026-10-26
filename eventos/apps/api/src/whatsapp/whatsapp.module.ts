import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MessageQueueService } from './message-queue.service';

@Module({
  imports: [HttpModule, PrismaModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, MessageQueueService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
