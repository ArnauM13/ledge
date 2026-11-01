import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AuthenticatedResponse,
  HouseholdSummary,
  LoginResponse,
  TotpSetupResponse,
} from '@ledge/shared-types';
import type { User } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  EncryptionContext,
  EncryptionService,
} from '../crypto/encryption.service';
import { PRISMA } from '../prisma/prisma.module';
import type { AppPrismaClient } from '../prisma/prisma-client';
import {
  GENERIC_AUTH_ERROR,
  LOCKOUT_MS,
  MAX_FAILED_ATTEMPTS,
} from './auth.constants';
import { EMAIL_RE, normaliseEmail } from './email';
import { PasswordService } from './password.service';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  looksLikeRecoveryCode,
} from './recovery-codes';
import type { AuthContext, RequestMeta } from './request-context';
import { csrfTokenFor, SessionService } from './session.service';
import { generateTotpSecret, totpEnrolment, verifyTotp } from './totp';

const totpSecretCtx = (userId: string): EncryptionContext => ({
  table: 'users',
  column: 'totp_secret',
  recordId: userId,
});
const totpPendingCtx = (userId: string): EncryptionContext => ({
  table: 'users',
  column: 'totp_pending_secret',
  recordId: userId,
});

export interface IssuedSession<T> {
  token: string;
  body: T;
}

/**
 * Login flow: password (argon2id) -> TOTP (or TOTP enrolment, mandatory on
 * the first login) -> full session. Every failure throws the same generic
 * 401 and every attempt, failed or not, is written to audit_logs.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly crypto: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- password

  async login(
    emailInput: unknown,
    passwordInput: unknown,
    meta: RequestMeta,
  ): Promise<IssuedSession<LoginResponse>> {
    const action = 'auth.login.password';
    const email =
      typeof emailInput === 'string' ? normaliseEmail(emailInput) : '';
    const password = typeof passwordInput === 'string' ? passwordInput : '';
    const wellFormed =
      EMAIL_RE.test(email) && email.length <= 254 && password.length > 0;

    const user = wellFormed
      ? await this.prisma.user.findUnique({ where: { email } })
      : null;
    // Always run argon2, even for unknown users, so timing reveals nothing.
    const passwordOk = await this.passwords.verify(
      user?.passwordHash ?? null,
      password,
    );

    if (!user) {
      // No email in the log: it may be a mistyped password.
      await this.audit.record({
        action,
        outcome: 'FAILURE',
        reason: 'unknown_user',
        ...meta,
      });
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }
    const householdId = await this.singleHouseholdId(user.id);
    const base = { action, userId: user.id, householdId, ...meta };
    if (this.isLocked(user)) {
      await this.audit.record({
        ...base,
        outcome: 'FAILURE',
        reason: 'locked',
      });
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }
    if (!passwordOk) {
      const locked = await this.registerFailure(user.id);
      await this.audit.record({
        ...base,
        outcome: 'FAILURE',
        reason: locked ? 'invalid_password_locked' : 'invalid_password',
      });
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    if (this.passwords.needsRehash(user.passwordHash)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await this.passwords.hash(password) },
      });
    }
    await this.audit.record({ ...base, outcome: 'SUCCESS' });
    const token = await this.sessions.create(
      user.id,
      'PASSWORD_VERIFIED',
      meta,
    );
    return {
      token,
      body: {
        next: user.totpEnabledAt ? 'totp' : 'totp-setup',
        csrfToken: csrfTokenFor(token),
      },
    };
  }

  // -------------------------------------------------------------------- TOTP

  async verifyTotp(
    auth: AuthContext,
    codeInput: unknown,
    meta: RequestMeta,
  ): Promise<IssuedSession<AuthenticatedResponse>> {
    const action = 'auth.login.totp';
    const { user, base } = await this.pendingUser(auth, action, meta);
    if (!user.totpSecretEnc || !user.totpEnabledAt) {
      await this.audit.record({
        ...base,
        outcome: 'FAILURE',
        reason: 'totp_not_enrolled',
      });
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }
    const code =
      typeof codeInput === 'string' ? codeInput.replace(/\s/g, '') : '';
    const secret = this.crypto.decryptString(
      user.totpSecretEnc,
      totpSecretCtx(user.id),
    );
    const step = verifyTotp(secret, code);
    const accepted =
      step !== null && (await this.consumeTotpStep(user.id, step));
    if (!accepted) {
      const locked = await this.registerFailure(user.id);
      const reason = step === null ? 'invalid_code' : 'replayed_code';
      await this.audit.record({
        ...base,
        outcome: 'FAILURE',
        reason: locked ? `${reason}_locked` : reason,
      });
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }
    await this.audit.record({ ...base, outcome: 'SUCCESS' });
    return this.completeLogin(auth, meta);
  }

  async recover(
    auth: AuthContext,
    codeInput: unknown,
    meta: RequestMeta,
  ): Promise<IssuedSession<AuthenticatedResponse>> {
    const action = 'auth.login.recovery_code';
    const { user, base } = await this.pendingUser(auth, action, meta);
    const code = typeof codeInput === 'string' ? codeInput : '';
    let used = 0;
    if (user.totpEnabledAt && looksLikeRecoveryCode(code)) {
      const result = await this.prisma.recoveryCode.updateMany({
        where: {
          userId: user.id,
          codeHash: hashRecoveryCode(code),
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });
      used = result.count;
    }
    if (used !== 1) {
      const locked = await this.registerFailure(user.id);
      await this.audit.record({
        ...base,
        outcome: 'FAILURE',
        reason: locked ? 'invalid_code_locked' : 'invalid_code',
      });
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }
    await this.audit.record({ ...base, outcome: 'SUCCESS' });
    return this.completeLogin(auth, meta);
  }

  /** First login: a new TOTP secret (encrypted) and its QR. Allowed only before 2FA is enabled. */
  async startTotpSetup(
    auth: AuthContext,
    meta: RequestMeta,
  ): Promise<TotpSetupResponse> {
    const action = 'auth.totp.setup_start';
    const { user, base } = await this.pendingUser(auth, action, meta);
    if (user.totpEnabledAt) {
      await this.audit.record({
        ...base,
        outcome: 'FAILURE',
        reason: 'already_enrolled',
      });
      throw new ConflictException();
    }
    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        totpPendingSecretEnc: this.crypto.encrypt(
          secret,
          totpPendingCtx(user.id),
        ),
      },
    });
    await this.audit.record({ ...base, outcome: 'SUCCESS' });
    return totpEnrolment(secret, user.email);
  }

  /** Confirms enrolment with a first code; returns the recovery codes once. */
  async confirmTotpSetup(
    auth: AuthContext,
    codeInput: unknown,
    meta: RequestMeta,
  ): Promise<IssuedSession<AuthenticatedResponse>> {
    const action = 'auth.totp.setup_confirm';
    const { user, base } = await this.pendingUser(auth, action, meta);
    if (user.totpEnabledAt || !user.totpPendingSecretEnc) {
      await this.audit.record({
        ...base,
        outcome: 'FAILURE',
        reason: user.totpEnabledAt ? 'already_enrolled' : 'no_pending_secret',
      });
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }
    const code =
      typeof codeInput === 'string' ? codeInput.replace(/\s/g, '') : '';
    const secret = this.crypto.decryptString(
      user.totpPendingSecretEnc,
      totpPendingCtx(user.id),
    );
    const step = verifyTotp(secret, code);
    if (step === null) {
      const locked = await this.registerFailure(user.id);
      await this.audit.record({
        ...base,
        outcome: 'FAILURE',
        reason: locked ? 'invalid_code_locked' : 'invalid_code',
      });
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    const recoveryCodes = generateRecoveryCodes();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          totpSecretEnc: this.crypto.encrypt(secret, totpSecretCtx(user.id)),
          totpPendingSecretEnc: null,
          totpEnabledAt: new Date(),
          totpLastUsedStep: BigInt(step),
        },
      }),
      this.prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
      this.prisma.recoveryCode.createMany({
        data: recoveryCodes.map((c) => ({
          userId: user.id,
          codeHash: hashRecoveryCode(c),
        })),
      }),
    ]);
    await this.audit.record({ ...base, outcome: 'SUCCESS' });
    const issued = await this.completeLogin(auth, meta);
    return { token: issued.token, body: { ...issued.body, recoveryCodes } };
  }

  // ------------------------------------------------------------ session info

  async logout(auth: AuthContext, meta: RequestMeta): Promise<void> {
    await this.sessions.revoke(auth.sessionId);
    await this.audit.record({
      action: 'auth.logout',
      outcome: 'SUCCESS',
      userId: auth.user.id,
      householdId: await this.singleHouseholdId(auth.user.id),
      ...meta,
    });
  }

  async households(userId: string): Promise<HouseholdSummary[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { household: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({
      id: m.household.id,
      name: m.household.name,
      role: m.role,
    }));
  }

  // ----------------------------------------------------------------- helpers

  private async completeLogin(
    auth: AuthContext,
    meta: RequestMeta,
  ): Promise<IssuedSession<AuthenticatedResponse>> {
    await this.prisma.user.update({
      where: { id: auth.user.id },
      data: { failedAuthCount: 0, lockedUntil: null },
    });
    const token = await this.sessions.upgrade(
      auth.sessionId,
      auth.user.id,
      meta,
    );
    return {
      token,
      body: {
        csrfToken: csrfTokenFor(token),
        user: {
          id: auth.user.id,
          email: auth.user.email,
          displayName: auth.user.displayName,
        },
      },
    };
  }

  /** Loads the user of a password-verified session and refuses locked accounts. */
  private async pendingUser(
    auth: AuthContext,
    action: string,
    meta: RequestMeta,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.user.id },
    });
    const base = {
      action,
      userId: user.id,
      householdId: await this.singleHouseholdId(user.id),
      ...meta,
    };
    if (this.isLocked(user)) {
      await this.audit.record({
        ...base,
        outcome: 'FAILURE',
        reason: 'locked',
      });
      await this.sessions.revoke(auth.sessionId);
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }
    return { user, base };
  }

  private isLocked(user: Pick<User, 'lockedUntil'>, now = new Date()): boolean {
    return user.lockedUntil !== null && user.lockedUntil > now;
  }

  /**
   * One more consecutive failure. At MAX_FAILED_ATTEMPTS the account is
   * locked for LOCKOUT_MS and the counter restarts. Atomic (single UPDATE).
   * Returns true if this failure locked the account.
   */
  private async registerFailure(userId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ locked: boolean }[]>`
      UPDATE users SET
        failed_auth_count = CASE WHEN failed_auth_count + 1 >= ${MAX_FAILED_ATTEMPTS} THEN 0 ELSE failed_auth_count + 1 END,
        locked_until = CASE WHEN failed_auth_count + 1 >= ${MAX_FAILED_ATTEMPTS}
          THEN now() + make_interval(secs => ${LOCKOUT_MS / 1000}) ELSE locked_until END,
        updated_at = now()
      WHERE id = ${userId}::uuid
      RETURNING (failed_auth_count = 0 AND locked_until > now()) AS locked`;
    return rows[0]?.locked ?? false;
  }

  /** Accepts a TOTP step only if it is newer than the last one used (no replay). */
  private async consumeTotpStep(
    userId: string,
    step: number,
  ): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: {
        id: userId,
        OR: [
          { totpLastUsedStep: null },
          { totpLastUsedStep: { lt: BigInt(step) } },
        ],
      },
      data: { totpLastUsedStep: BigInt(step) },
    });
    return result.count === 1;
  }

  /** For audit_logs.household_id: set when the user belongs to exactly one household. */
  private async singleHouseholdId(userId: string): Promise<string | null> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: { householdId: true },
      take: 2,
    });
    return memberships.length === 1 ? memberships[0].householdId : null;
  }
}
