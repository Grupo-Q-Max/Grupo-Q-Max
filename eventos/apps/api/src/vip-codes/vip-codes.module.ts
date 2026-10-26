import { Module } from '@nestjs/common';

import { VipCodesController } from './vip-codes.controller';
import { VipCodesService } from './vip-codes.service';

@Module({
  controllers: [VipCodesController],
  providers: [VipCodesService],
})
export class VipCodesModule {}
