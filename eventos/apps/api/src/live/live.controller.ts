import {
  Controller,
  Header,
  MessageEvent,
  Param,
  ParseIntPipe,
  Sse,
} from '@nestjs/common';
import { filter, interval, map, merge, Observable } from 'rxjs';
import { liveEvents } from './live';

@Controller('live')
export class LiveController {
  @Sse('event/:eventId')
  // no-transform/X-Accel-Buffering: compressão e nginx não seguram o stream.
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('X-Accel-Buffering', 'no')
  stream(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Observable<MessageEvent> {
    return merge(
      liveEvents.pipe(
        filter((id) => id === eventId),
        map(() => ({ data: { type: 'changed' } })),
      ),
      // Heartbeat: mantém a conexão viva atrás de proxies.
      interval(25_000).pipe(map(() => ({ data: { type: 'ping' } }))),
    );
  }
}
