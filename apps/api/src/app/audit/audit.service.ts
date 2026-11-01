import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditOutcome } from '../../generated/prisma/client';
import { PRISMA } from '../prisma/prisma.module';
import type { AppPrismaClient } from '../prisma/prisma-client';

export interface AuditEvent {
  /** Dotted event name, e.g. `auth.login.password`. */
  action: string;
  outcome: AuditOutcome;
  /** Short machine-readable reason, e.g. `invalid_credentials`. */
  reason?: string;
  userId?: string | null;
  householdId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Writes audit_logs (append-only: this service only inserts).
 * Never pass secrets here: no passwords, codes, tokens, or the identifier a
 * user typed when it does not match an account (it may be a mistyped password).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(@Inject(PRISMA) private readonly prisma: AppPrismaClient) {}

  async record(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: event.action,
          outcome: event.outcome,
          reason: event.reason ?? null,
          userId: event.userId ?? null,
          householdId: event.householdId ?? null,
          ip: event.ip?.slice(0, 64) ?? null,
          userAgent: event.userAgent?.slice(0, 256) ?? null,
        },
      });
    } catch (err) {
      // Fail closed: an unaudited login must not succeed. Log only the error
      // type (the message could contain query details).
      this.logger.error(
        `Could not write audit event ${event.action}: ${(err as Error).name}`,
      );
      throw new Error('Audit log unavailable');
    }
  }
}
