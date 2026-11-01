import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthenticatedResponse,
  CodeRequest,
  LoginRequest,
  LoginResponse,
  SessionInfo,
  TotpSetupResponse,
} from '@ledge/shared-types';
import type { Response } from 'express';
import { SESSION_COOKIE } from './auth.constants';
import {
  AnyStage,
  Public,
  RequireStage,
  SESSION_COOKIE_OPTIONS,
} from './auth.guard';
import { AuthService, IssuedSession } from './auth.service';
import { AuthRateLimitGuard } from './ip-rate-limiter';
import { AuthedRequest, AuthContext, requestMeta } from './request-context';

function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
}

function issue<T>(res: Response, issued: IssuedSession<T>): T {
  setSessionCookie(res, issued.token);
  return issued.body;
}

/** No public sign-up: users are created with the CLI (src/cli/create-user.ts). */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('session')
  async session(@Req() req: AuthedRequest): Promise<SessionInfo> {
    const auth = req.auth;
    if (!auth) {
      return { authenticated: false };
    }
    if (auth.stage === 'PASSWORD_VERIFIED') {
      return {
        authenticated: false,
        stage: 'PASSWORD_VERIFIED',
        next: auth.user.totpEnabled ? 'totp' : 'totp-setup',
        csrfToken: auth.csrfToken,
      };
    }
    return {
      authenticated: true,
      stage: 'AUTHENTICATED',
      csrfToken: auth.csrfToken,
      user: {
        id: auth.user.id,
        email: auth.user.email,
        displayName: auth.user.displayName,
      },
      households: await this.auth.households(auth.user.id),
    };
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: Partial<LoginRequest> | undefined,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    return issue(
      res,
      await this.auth.login(body?.email, body?.password, requestMeta(req)),
    );
  }

  @RequireStage('PASSWORD_VERIFIED')
  @UseGuards(AuthRateLimitGuard)
  @Post('totp/verify')
  @HttpCode(200)
  async verifyTotp(
    @Body() body: Partial<CodeRequest> | undefined,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthenticatedResponse> {
    return issue(
      res,
      await this.auth.verifyTotp(
        req.auth as AuthContext,
        body?.code,
        requestMeta(req),
      ),
    );
  }

  @RequireStage('PASSWORD_VERIFIED')
  @UseGuards(AuthRateLimitGuard)
  @Post('recovery')
  @HttpCode(200)
  async recovery(
    @Body() body: Partial<CodeRequest> | undefined,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthenticatedResponse> {
    return issue(
      res,
      await this.auth.recover(
        req.auth as AuthContext,
        body?.code,
        requestMeta(req),
      ),
    );
  }

  @RequireStage('PASSWORD_VERIFIED')
  @UseGuards(AuthRateLimitGuard)
  @Post('totp/setup')
  @HttpCode(200)
  startTotpSetup(@Req() req: AuthedRequest): Promise<TotpSetupResponse> {
    return this.auth.startTotpSetup(req.auth as AuthContext, requestMeta(req));
  }

  @RequireStage('PASSWORD_VERIFIED')
  @UseGuards(AuthRateLimitGuard)
  @Post('totp/setup/confirm')
  @HttpCode(200)
  async confirmTotpSetup(
    @Body() body: Partial<CodeRequest> | undefined,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthenticatedResponse> {
    return issue(
      res,
      await this.auth.confirmTotpSetup(
        req.auth as AuthContext,
        body?.code,
        requestMeta(req),
      ),
    );
  }

  @AnyStage()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(req.auth as AuthContext, requestMeta(req));
    res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS);
  }
}
