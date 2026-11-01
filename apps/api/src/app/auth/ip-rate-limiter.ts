import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { IP_RATE_LIMIT } from './auth.constants';

/**
 * Fixed-window counter per client IP, in memory. Complements the per-account
 * lockout stored in PostgreSQL (which survives restarts).
 */
@Injectable()
export class IpRateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number = IP_RATE_LIMIT.max,
    private readonly windowMs: number = IP_RATE_LIMIT.windowMs,
  ) {}

  /** Records an attempt. Returns false when the IP is over the limit. */
  hit(ip: string, now = Date.now()): boolean {
    if (this.hits.size > 10_000) {
      for (const [key, entry] of this.hits) {
        if (entry.resetAt <= now) this.hits.delete(key);
      }
    }
    const entry = this.hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(ip, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.max;
  }

  reset(): void {
    this.hits.clear();
  }
}

export const RATE_LIMITED_MESSAGE =
  'Too many attempts. Try again in a few minutes.';

/** Applied to the login and 2FA endpoints. */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: IpRateLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!this.limiter.hit(req.ip ?? 'unknown')) {
      throw new HttpException(
        RATE_LIMITED_MESSAGE,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
