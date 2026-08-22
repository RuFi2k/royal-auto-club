import type { AuditAction } from "@prisma/client";
import { prisma } from "../db";

export interface AuditEntry {
  userId: string;
  userEmail?: string | null;
  action: AuditAction;
  carId?: number | null;
  // Free-form detail: { field: { from, to } } for updates, a snapshot otherwise.
  changedFields?: Record<string, unknown> | null;
}

// Callers that already hold the actor's email pass it; the rest get a lookup.
async function resolveEmail(entry: AuditEntry): Promise<string | null> {
  if (entry.userEmail !== undefined) return entry.userEmail;
  const user = await prisma.user.findUnique({
    where: { id: entry.userId },
    select: { email: true },
  });
  return user?.email ?? null;
}

// Writes one event-log row. Auditing must never break the request that triggered
// it, so failures are logged and swallowed — callers can safely `void` this.
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        userEmail: await resolveEmail(entry),
        action: entry.action,
        carId: entry.carId ?? null,
        changedFields: (entry.changedFields ?? undefined) as object | undefined,
      },
    });
  } catch (err) {
    console.error(`[audit] failed to record ${entry.action}:`, err);
  }
}
