import { Prisma } from '../../../generated/prisma/client';

/** Detects Prisma unique constraint conflicts without coupling callers to Prisma error classes. */
export function isPrismaUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Detects transaction conflicts that can happen when competing workers create guarded tasks. */
export function isPrismaConcurrentTaskCreateConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}
