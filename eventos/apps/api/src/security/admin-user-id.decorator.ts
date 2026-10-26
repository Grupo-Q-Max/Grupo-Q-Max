import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AdminUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number | null => {
    const request = context.switchToHttp().getRequest();

    const header = request.headers['x-finora-admin-user-id'];

    const raw = Array.isArray(header) ? header[0] : header;

    if (!raw) {
      return null;
    }

    const id = Number(raw);

    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }

    return id;
  },
);
