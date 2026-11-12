import { Prisma } from "@prisma/client";

/** Known Prisma error with this code (P2002, P2025, P2003...). */
export const hasCode = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

/** Unique constraint violated (P2002). */
export const isUniqueViolation = (error: unknown) => hasCode(error, "P2002");

/** Record to update/delete not found (P2025). */
export const isNotFound = (error: unknown) => hasCode(error, "P2025");
