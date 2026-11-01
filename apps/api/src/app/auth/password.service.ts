import { Injectable, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  ARGON2_OPTIONS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './auth.constants';

const OPTIONS = { type: argon2.argon2id as 2, ...ARGON2_OPTIONS };

/** Returns why a new password is not acceptable, or null if it is. */
export function passwordProblem(
  password: string,
  email?: string,
): string | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) {
    return `at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return `at most ${PASSWORD_MAX_LENGTH} characters`;
  }
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) {
    return 'must not be the email';
  }
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password.normalize('NFC'), OPTIONS);
}

@Injectable()
export class PasswordService implements OnModuleInit {
  /** Verified when the user does not exist, so timing does not reveal it. */
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.dummyHash = await hashPassword('dummy-password-for-unknown-users');
  }

  hash(password: string): Promise<string> {
    return hashPassword(password);
  }

  /**
   * Checks a password. With `hash === null` (unknown user) it still runs a
   * full argon2 verification and returns false.
   */
  async verify(hash: string | null, password: string): Promise<boolean> {
    if (password.length > PASSWORD_MAX_LENGTH * 4) {
      await argon2.verify(this.dummyHash, 'x').catch(() => false);
      return false;
    }
    try {
      const ok = await argon2.verify(
        hash ?? this.dummyHash,
        password.normalize('NFC'),
      );
      return hash !== null && ok;
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, OPTIONS);
  }
}
