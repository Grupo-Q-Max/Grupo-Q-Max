import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';

import { VipCodesService } from './vip-codes.service';

class GenerateVipCodesDto {
  @IsInt()
  @Min(1)
  @Max(5000)
  quantity: number;
}

@Controller('vip-codes')
export class VipCodesController {
  constructor(private readonly vipCodesService: VipCodesService) {}

  @Post('event/:eventId/generate')
  generate(
    @Param('eventId', ParseIntPipe)
    eventId: number,

    @Body()
    dto: GenerateVipCodesDto,
  ) {
    return this.vipCodesService.generate(eventId, dto.quantity);
  }

  @Get('event/:eventId')
  findByEvent(
    @Param('eventId', ParseIntPipe)
    eventId: number,
  ) {
    return this.vipCodesService.findByEvent(eventId);
  }

  @Get('event/:eventId/validate/:code')
  validate(
    @Param('eventId', ParseIntPipe)
    eventId: number,

    @Param('code')
    code: string,
  ) {
    return this.vipCodesService.validateCode(eventId, code);
  }
}
