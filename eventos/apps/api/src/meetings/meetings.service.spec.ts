import { Test, TestingModule } from '@nestjs/testing';
import { MeetingsService } from './meetings.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { createPrismaMock } from '../../test/prisma-mock';
import * as msHelper from './microsoft-calendar.helper';
import * as mailHelper from './meeting-mail.helper';

describe('MeetingsService - Agendamento e Integração Teams / Hugo e Edvaldo', () => {
  let service: MeetingsService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let whatsappServiceMock: { enqueueMessage: jest.Mock };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    whatsappServiceMock = {
      enqueueMessage: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WhatsappService, useValue: whatsappServiceMock },
      ],
    }).compile();

    service = module.get<MeetingsService>(MeetingsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deve agendar reunião com sucesso e disparar convites para Hugo, Rodrigo e Edvaldo', async () => {
    const scheduledDate = new Date('2026-11-20T14:00:00.000-03:00');

    // Mocks do banco de dados
    prismaMock.meetings.findFirst.mockResolvedValue(null);
    prismaMock.meetings.findMany.mockResolvedValue([]);
    prismaMock.participants.update.mockResolvedValue({ id: 50 });

    const meetingMock = {
      id: 99,
      event_id: 3,
      participant_id: 50,
      scheduled_at: scheduledDate,
      participants: {
        id: 50,
        full_name: 'Dra. Carolina Castro',
        phone: '11999998888',
        email: 'carolina@clinica.com.br',
        clinic_name: 'Clínica Odonto Prime',
        chairs_count: 5,
        cro_number: '12345',
        cro_state: 'SP',
      },
      events: {
        id: 3,
        whatsapp_vip_message: 'Olá {nome}, sua reunião está confirmada para {data_hora}!',
      },
    };

    prismaMock.meetings.create.mockResolvedValue(meetingMock);
    prismaMock.message_queue.create.mockResolvedValue({ id: 1 });

    // Mock das chamadas de integração da Microsoft
    jest.spyOn(msHelper, 'getHugoBusyIntervals').mockResolvedValue([]);
    const msEventSpy = jest.spyOn(msHelper, 'createMicrosoftCalendarEvent').mockResolvedValue('ms-teams-event-123');
    const mailSpy = jest.spyOn(mailHelper, 'sendMeetingInvite').mockResolvedValue(true);

    const result = await service.bookMeeting(3, 50, scheduledDate, 'carolina@clinica.com.br');

    expect(result).toBeDefined();
    expect(result.id).toBe(99);
    expect(prismaMock.meetings.create).toHaveBeenCalled();

    // Verifica se createMicrosoftCalendarEvent recebeu Hugo e Edvaldo
    expect(msEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bossEmail: 'hugo@grupoqmax.com.br',
        thirdEmail: 'edvaldo.borges@grupoqmax.com.br',
        participantName: 'Dra. Carolina Castro',
        participantEmail: 'carolina@clinica.com.br',
      }),
    );

    // Verifica se sendMeetingInvite recebeu Hugo e Edvaldo
    expect(mailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bossEmail: 'hugo@grupoqmax.com.br',
        thirdEmail: 'edvaldo.borges@grupoqmax.com.br',
      }),
    );
  });
});

