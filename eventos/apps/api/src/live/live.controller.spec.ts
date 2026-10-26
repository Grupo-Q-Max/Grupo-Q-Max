import { MessageEvent } from '@nestjs/common';
import { notifyLive } from './live';
import { LiveController } from './live.controller';

describe('LiveController', () => {
  it('avisa só as telas do evento que mudou', () => {
    const controller = new LiveController();
    const event1: MessageEvent[] = [];
    const event2: MessageEvent[] = [];
    const sub1 = controller.stream(1).subscribe((m) => event1.push(m));
    const sub2 = controller.stream(2).subscribe((m) => event2.push(m));

    notifyLive(1);
    notifyLive(null);

    expect(event1).toEqual([{ data: { type: 'changed' } }]);
    expect(event2).toEqual([]);

    sub1.unsubscribe();
    sub2.unsubscribe();
  });
});
