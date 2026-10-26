import { hourBucket, perHour, reportSummary } from './event-report';

describe('relatório pós-evento', () => {
  it('agrupa por hora no horário de Brasília', () => {
    expect(hourBucket(new Date('2026-10-14T16:30:00Z'))).toBe('2026-10-14 13h');
    const series = perHour(
      [new Date('2026-10-14T16:05:00Z'), new Date('2026-10-14T16:50:00Z')],
      [new Date('2026-10-14T17:10:00Z')],
    );
    expect(series).toEqual([
      { hour: '2026-10-14 13h', registrations: 2, draws: 0 },
      { hour: '2026-10-14 14h', registrations: 0, draws: 1 },
    ]);
  });

  it('resumo traz funil com conversão e link', () => {
    const text = reportSummary(
      {
        event: { id: 1, name: 'Expo', status: 'CLOSED' },
        funnel: { registered: 10, validated: 8, spun: 5, claimed: 4, blocked: 1 },
        perHour: [{ hour: '2026-10-14 13h', registrations: 10, draws: 5 }],
        topPrizes: [{ name: 'Caneca', total: 3 }],
      },
      'https://x/r',
    );
    expect(text).toContain('Giros: 5 (50%)');
    expect(text).toContain('Prêmios retirados: 4 (80%)');
    expect(text).toContain('1. Caneca (3)');
    expect(text).toContain('https://x/r');
  });
});
