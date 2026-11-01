import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditService } from '../audit/audit.service';
import { CryptoModule } from '../crypto/crypto.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthGuard, CsrfGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthRateLimitGuard, IpRateLimiter } from './ip-rate-limiter';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Module({
  imports: [PrismaModule, CryptoModule],
  controllers: [AuthController],
  providers: [
    AuditService,
    AuthService,
    PasswordService,
    SessionService,
    { provide: IpRateLimiter, useValue: new IpRateLimiter() },
    AuthRateLimitGuard,
    // Order matters: AuthGuard sets req.auth, CsrfGuard reads it.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
  exports: [SessionService, AuditService],
})
export class AuthModule {}
