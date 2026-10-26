import { ParticipantsService } from './participants.service';
import { RegisterParticipantDto } from './dto/register-participant.dto';

const stored = {
  id: 7,
  participant_id: 3,
  event_id: 1,
  status: 'APPROVED',
  whatsapp_token: 'tok',
  participants: { full_name: 'Ana' },
  vip_codes: null,
};

function serviceWith(findUnique: jest.Mock) {
  const prisma = { participations: { findUnique } };
  return new ParticipantsService(prisma as never, {} as never, {} as never, {} as never);
}

describe('ParticipantsService.register (fila offline)', () => {
  const dto = { eventId: 1, clientRequestId: '0b8f3c1e-5a2b-4d7e-9c1f-2a3b4c5d6e7f' } as RegisterParticipantDto;

  it('reenvio com o mesmo clientRequestId devolve o cadastro existente', async () => {
    const service = serviceWith(jest.fn().mockResolvedValue(stored));
    const registerNew = jest.spyOn(service as never, 'registerNew');

    const result = await service.register(dto);

    expect(registerNew).not.toHaveBeenCalled();
    expect(result).toMatchObject({ replayed: true, participation: { id: 7, whatsappToken: 'tok' } });
  });

  it('corrida (P2002) busca de novo em vez de falhar', async () => {
    const findUnique = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(stored);
    const service = serviceWith(findUnique);
    jest.spyOn(service as never, 'registerNew').mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }) as never);

    await expect(service.register(dto)).resolves.toMatchObject({ replayed: true });
  });
});
