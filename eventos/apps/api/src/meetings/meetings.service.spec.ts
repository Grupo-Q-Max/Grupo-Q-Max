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
    const scheduledDate = new Date('2026-11-23T14:00:00.000-03:00');

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

    const result = await service.bookMeeting(3, 50, scheduledDate.toISOString(), 'carolina@clinica.com.br');

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

  it('deve agendar reunião com a agenda da Alessandra (alessandra@grupoqmax.com.br) puxando conflitos em tempo real', async () => {
    const scheduledDate = new Date('2026-11-24T15:00:00.000-03:00');

    prismaMock.meetings.findFirst.mockResolvedValue(null);
    prismaMock.meetings.findMany.mockResolvedValue([]);
    prismaMock.participants.update.mockResolvedValue({ id: 51 });

    const meetingMock = {
      id: 100,
      event_id: 3,
      participant_id: 51,
      scheduled_at: scheduledDate,
      host_email: 'alessandra@grupoqmax.com.br',
      participants: {
        id: 51,
        full_name: 'Dr. Bruno Silva',
        phone: '11988887777',
        email: 'bruno@odonto.com.br',
        clinic_name: 'Odonto Silva',
        chairs_count: 3,
        cro_number: '54321',
        cro_state: 'SP',
      },
      events: {
        id: 3,
        whatsapp_vip_message: null,
      },
    };

    prismaMock.meetings.create.mockResolvedValue(meetingMock);
    prismaMock.message_queue.create.mockResolvedValue({ id: 2 });

    const busySpy = jest.spyOn(msHelper, 'getHugoBusyIntervals').mockResolvedValue([]);
    const msEventSpy = jest.spyOn(msHelper, 'createMicrosoftCalendarEvent').mockResolvedValue('ms-teams-event-ale-456');
    const mailSpy = jest.spyOn(mailHelper, 'sendMeetingInvite').mockResolvedValue(true);

    const result = await service.bookMeeting(3, 51, scheduledDate.toISOString(), 'bruno@odonto.com.br', 'ale');

    expect(result).toBeDefined();
    expect(busySpy).toHaveBeenCalledWith('2026-11-24', 'alessandra@grupoqmax.com.br');
    expect(msEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bossEmail: 'alessandra@grupoqmax.com.br',
        participantName: 'Dr. Bruno Silva',
      }),
    );
    expect(mailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bossEmail: 'alessandra@grupoqmax.com.br',
      }),
    );
  });

  it('getAvailableSlots da Ale deve exibir apenas os horários em que o Hugo está ocupado e a Ale está livre', async () => {
    prismaMock.meetings.findMany.mockResolvedValue([]);

    // Simula Hugo ocupado das 14h às 15h e das 16h às 17h (fuso -03:00), e Ale ocupada apenas das 16h às 17h
    jest.spyOn(msHelper, 'getHugoBusyIntervals').mockImplementation(async (_dateStr, email) => {
      if (email === 'hugo@grupoqmax.com.br') {
        return [
          {
            start: new Date('2026-11-25T14:00:00.000-03:00'),
            end: new Date('2026-11-25T15:00:00.000-03:00'),
          },
          {
            start: new Date('2026-11-25T16:00:00.000-03:00'),
            end: new Date('2026-11-25T17:00:00.000-03:00'),
          },
        ];
      }
      if (email === 'alessandra@grupoqmax.com.br') {
        return [
          {
            start: new Date('2026-11-25T16:00:00.000-03:00'),
            end: new Date('2026-11-25T17:00:00.000-03:00'),
          },
        ];
      }
      return [];
    });

    const aleSlots = await service.getAvailableSlots(3, '2026-11-25', 'ale');

    // A Ale só deve ter disponível o horário das 14:00 (-03:00 = 17:00Z),
    // pois é o único horário em que o Hugo NÃO está livre e a Ale está livre!
    expect(aleSlots).toEqual([new Date('2026-11-25T14:00:00.000-03:00').toISOString()]);
  });

  it('deve formatar data para o fuso de Brasília (America/Sao_Paulo) sem descompasso de UTC', () => {
    // 14:00 UTC deve ser exatamente 11:00 em America/Sao_Paulo
    const utcDate = new Date('2026-11-19T14:00:00.000Z');
    const formatted = msHelper.formatToSaoPauloIsoNoZ(utcDate);
    expect(formatted).toBe('2026-11-19T11:00:00');

    // 17:00 UTC deve ser exatamente 14:00 em America/Sao_Paulo
    const utcDate2 = new Date('2026-11-19T17:00:00.000Z');
    const formatted2 = msHelper.formatToSaoPauloIsoNoZ(utcDate2);
    expect(formatted2).toBe('2026-11-19T14:00:00');
  });

  it('deve fazer parse de data do Microsoft Graph respeitando o fuso de Brasília', () => {
    const d1 = msHelper.parseGraphDateTime('2026-11-19T11:00:00');
    expect(d1.toISOString()).toBe('2026-11-19T14:00:00.000Z');

    const d2 = msHelper.parseGraphDateTime('2026-11-19T14:00:00Z');
    expect(d2.toISOString()).toBe('2026-11-19T14:00:00.000Z');
  });
});

