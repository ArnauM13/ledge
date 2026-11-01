import { Inject, Injectable } from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { SessionStage } from '../../generated/prisma/client';
import { PRISMA } from '../prisma/prisma.module';
import type { AppPrismaClient } from '../prisma/prisma-client';
import {
  PENDING_SESSION_TIMEOUT_MS,
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_TOUCH_INTERVAL_MS,
} from './auth.constants';
import type { AuthContext, RequestMeta } from './request-context';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * CSRF token bound to the session: HMAC of a fixed label keyed with the
 * session token. Only someone holding the (HttpOnly) cookie can compute it,
 * and it changes whenever the session token changes.
 */
export function csrfTokenFor(sessionToken: string): string {
  return createHmac('sha256', sessionToken)
    .update('ledge-csrf-v1')
    .digest('base64url');
}

/**
 * Server-side sessions in PostgreSQL. The cookie carries a 256-bit random
 * token; the database stores only its SHA-256.
 */
@Injectable()
export class SessionService {
  constructor(@Inject(PRISMA) private readonly prisma: AppPrismaClient) {}

  async create(
    userId: string,
    stage: SessionStage,
    meta: RequestMeta,
    now = new Date(),
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const ttl =
      stage === 'AUTHENTICATED'
        ? SESSION_ABSOLUTE_TIMEOUT_MS
        : PENDING_SESSION_TIMEOUT_MS;
    await this.prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        stage,
        createdAt: now,
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + ttl),
        ip: meta.ip?.slice(0, 64) ?? null,
        userAgent: meta.userAgent?.slice(0, 256) ?? null,
      },
    });
    return token;
  }

  /**
   * Returns the session for a cookie token, or null if it is unknown, revoked
   * or expired (idle or absolute). Expired sessions are revoked on the way.
   */
  async resolve(token: string, now = new Date()): Promise<AuthContext | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return null;
    }
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.revokedAt) {
      return null;
    }
    const idleExpired =
      session.stage === 'AUTHENTICATED' &&
      now.getTime() - session.lastSeenAt.getTime() > SESSION_IDLE_TIMEOUT_MS;
    if (session.expiresAt <= now || idleExpired) {
      await this.revoke(session.id, now);
      return null;
    }
    if (
      now.getTime() - session.lastSeenAt.getTime() >
      SESSION_TOUCH_INTERVAL_MS
    ) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      });
    }
    return {
      sessionId: session.id,
      stage: session.stage,
      csrfToken: csrfTokenFor(token),
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        totpEnabled: session.user.totpEnabledAt !== null,
      },
    };
  }

  /**
   * Password + 2FA done: the pending session is revoked and a new one (new
   * token) is issued, so a token seen before 2FA is useless afterwards.
   */
  async upgrade(
    pendingSessionId: string,
    userId: string,
    meta: RequestMeta,
  ): Promise<string> {
    await this.revoke(pendingSessionId);
    return this.create(userId, 'AUTHENTICATED', meta);
  }

  async revoke(sessionId: string, now = new Date()): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
