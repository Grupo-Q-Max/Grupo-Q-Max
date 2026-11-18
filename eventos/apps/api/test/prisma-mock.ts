import { PrismaService } from '../src/prisma/prisma.service';

export const createPrismaMock = () => ({
  events: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
  },
  prizes: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  participations: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  participants: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
  },
  draws: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  prize_queue: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  message_queue: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  prize_stock_movements: {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  fraud_rules: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
  },
  fraud_checks: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  meetings: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  audit_logs: {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  $transaction: jest.fn((callback) =>
    typeof callback === 'function'
      ? callback(createPrismaMock())
      : Promise.resolve(),
  ),
});
