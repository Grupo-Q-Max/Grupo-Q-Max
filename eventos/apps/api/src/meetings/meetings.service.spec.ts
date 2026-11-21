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

  it('getAvailableSlots deve bloquear e ocultar os horários em que o Hugo já tem reunião no Microsoft 365', async () => {
    prismaMock.meetings.findMany.mockResolvedValue([]);

    jest.spyOn(msHelper, 'getHugoBusyIntervals').mockResolvedValue([
      {
        start: new Date('2026-11-25T14:00:00.000-03:00'),
        end: new Date('2026-11-25T15:00:00.000-03:00'),
      },
    ]);

    const slots = await service.getAvailableSlots(3, '2026-11-25');

    expect(slots).not.toContain(new Date('2026-11-25T14:00:00.000-03:00').toISOString());
    expect(slots).toContain(new Date('2026-11-25T15:00:00.000-03:00').toISOString());
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

  it('deve reagendar reunião existente e sincronizar a alteração na agenda da Microsoft', async () => {
    const oldDate = new Date('2026-11-24T10:00:00.000-03:00');
    const newDate = new Date('2026-11-26T15:00:00.000-03:00');

    const existingMeeting = {
      id: 77,
      event_id: 3,
      participant_id: 50,
      scheduled_at: oldDate,
      host_email: 'hugo@grupoqmax.com.br',
      participants: {
        id: 50,
        full_name: 'Dr. Marcos Silva',
        phone: '11988887777',
        email: 'marcos@clinica.com.br',
        clinic_name: 'Clínica Silva',
        chairs_count: 4,
        cro_number: '54321',
        cro_state: 'SP',
      },
      events: {
        id: 3,
        whatsapp_vip_message: null,
      },
    };

    prismaMock.meetings.findUnique.mockResolvedValue(existingMeeting);
    prismaMock.meetings.findMany.mockResolvedValue([]);
    prismaMock.meetings.update.mockResolvedValue({
      ...existingMeeting,
      scheduled_at: newDate,
      status: 'SCHEDULED',
    });
    prismaMock.message_queue.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.message_queue.create.mockResolvedValue({ id: 10 });

    jest.spyOn(msHelper, 'getHugoBusyIntervals').mockResolvedValue([]);
    const rescheduleMsSpy = jest
      .spyOn(msHelper, 'rescheduleMicrosoftCalendarEvent')
      .mockResolvedValue('ms-event-updated-77');
    jest.spyOn(mailHelper, 'sendMeetingInvite').mockResolvedValue(true);

    const updated = await service.rescheduleMeeting(77, newDate.toISOString());

    expect(updated.scheduled_at).toEqual(newDate);
    expect(prismaMock.meetings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 77 },
      }),
    );
    expect(rescheduleMsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bossEmail: 'hugo@grupoqmax.com.br',
        participantName: 'Dr. Marcos Silva',
        previousScheduledAt: oldDate,
        newScheduledAt: newDate,
      }),
    );
  });

  it('deve cancelar reunião e remover da agenda da Microsoft de forma síncrona', async () => {
    const meetingDate = new Date('2026-11-25T11:00:00.000-03:00');
    prismaMock.meetings.findUnique.mockResolvedValue({
      id: 88,
      event_id: 3,
      participant_id: 60,
      scheduled_at: meetingDate,
      host_email: 'hugo@grupoqmax.com.br',
      participants: {
        id: 60,
        full_name: 'Dra. Juliana Mendes',
      },
    });
    prismaMock.message_queue.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.meetings.delete.mockResolvedValue({ id: 88 });

    const deleteMsSpy = jest.spyOn(msHelper, 'deleteMicrosoftEventsMatching').mockResolvedValue(1);

    const res = await service.deleteMeeting(88);

    expect(res.success).toBe(true);
    expect(prismaMock.meetings.delete).toHaveBeenCalledWith({ where: { id: 88 } });
    expect(deleteMsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bossEmail: 'hugo@grupoqmax.com.br',
        searchTerm: 'Dra. Juliana Mendes',
        scheduledAt: meetingDate,
      }),
    );
  });
});

