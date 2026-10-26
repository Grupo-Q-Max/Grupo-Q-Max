import { Module } from '@nestjs/common';

import { ParticipantsController } from './participants.controller';
import { ParticipantsService } from './participants.service';
import { FraudRulesModule } from '../fraud-rules/fraud-rules.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { MeetingsModule } from '../meetings/meetings.module';

@Module({
  imports: [WhatsappModule, FraudRulesModule, MeetingsModule],
  controllers: [ParticipantsController],

  providers: [ParticipantsService],

  exports: [ParticipantsService],
})
export class ParticipantsModule {}
