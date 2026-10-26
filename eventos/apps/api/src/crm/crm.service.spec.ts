import { CrmService } from './crm.service';

const participation = (consent: boolean) => ({
  id: 5,
  status: 'APPROVED',
  created_at: new Date('2026-10-14T16:00:00Z'),
  events: { id: 1, name: 'Expo', slug: 'expo', crm_webhook_url: 'https://hooks.exemplo.com/x' },
  participants: {
    full_name: 'Ana Maria Souza',
    email: 'ana@x.com',
    phone: '11999999999',
    clinic_name: null,
    cro_number: null,
    cro_state: null,
    city: null,
    state: null,
    chairs_count: 3,
    marketing_consent: consent,
  },
  draws: null,
});

describe('CrmService.send', () => {
  const fetchMock = jest.fn();
  beforeAll(() => (global.fetch = fetchMock as never));

  function service(p: unknown) {
    const prisma = { participations: { findUnique: jest.fn().mockResolvedValue(p), update: jest.fn() } };
    return { crm: new CrmService(prisma as never), prisma };
  }

  it('posta o lead no webhook e marca como enviado', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const { crm, prisma } = service(participation(true));

    expect(await crm.send(5, 'lead')).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe('https://hooks.exemplo.com/x');
    expect(body).toMatchObject({ type: 'lead', event: { slug: 'expo' }, lead: { firstName: 'Ana', lastName: 'Maria Souza' } });
    expect(body.event.crm_webhook_url).toBeUndefined();
    expect(prisma.participations.update).toHaveBeenCalled();
  });

  it('sem consentimento de marketing não envia', async () => {
    fetchMock.mockClear();
    const { crm } = service(participation(false));
    expect(await crm.send(5, 'lead')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
