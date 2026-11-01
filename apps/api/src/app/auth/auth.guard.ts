import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import type { SessionStage } from '../../generated/prisma/client';
import { CSRF_HEADER, SESSION_COOKIE } from './auth.constants';
import type { AuthedRequest } from './request-context';
import { SessionService } from './session.service';

/** Route works without a session (login, session probe, health). */
export const Public = () => SetMetadata('auth:public', true);
/** Route needs a session in exactly this stage (default: AUTHENTICATED). */
export const RequireStage = (stage: SessionStage) =>
  SetMetadata('auth:stage', stage);
/** Route accepts a session in any stage (logout). */
export const AnyStage = () => SetMetadata('auth:any-stage', true);

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
} as const;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function metadata<T>(
  reflector: Reflector,
  key: string,
  context: ExecutionContext,
): T | undefined {
  return reflector.getAllAndOverride<T>(key, [
    context.getHandler(),
    context.getClass(),
  ]);
}

/**
 * Global guard #1: resolves the session cookie into `req.auth` and enforces
 * the stage the route needs. Everything is private unless marked @Public().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const res = context.switchToHttp().getResponse<Response>();

    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token.length > 0) {
      const auth = await this.sessions.resolve(token);
      if (auth) {
        req.auth = auth;
      } else {
        res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS);
      }
    }

    if (metadata<boolean>(this.reflector, 'auth:public', context)) {
      return true;
    }
    if (!req.auth) {
      throw new UnauthorizedException();
    }
    if (metadata<boolean>(this.reflector, 'auth:any-stage', context)) {
      return true;
    }
    const stage =
      metadata<SessionStage>(this.reflector, 'auth:stage', context) ??
      'AUTHENTICATED';
    if (req.auth.stage !== stage) {
      throw new UnauthorizedException();
    }
    return true;
  }
}

function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Global guard #2 (after AuthGuard): CSRF protection for state-changing requests.
 * 1. Rejects cross-site requests (Sec-Fetch-Site) and foreign Origins.
 * 2. Requires `Content-Type: application/json`: an HTML form cannot send it,
 *    and a cross-origin fetch with it needs a CORS preflight, which the API
 *    never grants.
 * 3. With a session: requires the session's synchronizer token in X-CSRF-Token.
 *    The only session-less mutation is the login itself (covered by 1 and 2).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins = new Set(
    (process.env['WEB_ORIGINS'] ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  );

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (SAFE_METHODS.has(req.method)) {
      return true;
    }
    if (req.get('sec-fetch-site') === 'cross-site') {
      throw new ForbiddenException();
    }
    const origin = req.get('origin');
    if (
      origin &&
      !this.allowedOrigins.has(origin) &&
      origin !== `${req.protocol}://${req.get('host')}`
    ) {
      throw new ForbiddenException();
    }
    if (!req.is('application/json')) {
      throw new ForbiddenException();
    }
    if (req.auth) {
      const sent = req.get(CSRF_HEADER);
      if (!sent || !sameToken(sent, req.auth.csrfToken)) {
        throw new ForbiddenException();
      }
    }
    return true;
  }
}
