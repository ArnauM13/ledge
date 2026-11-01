import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CryptoModule } from './crypto/crypto.module';
import { HealthController } from './health/health.controller';
import { HouseholdModule } from './household/household.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [CryptoModule, PrismaModule, AuthModule, HouseholdModule],
  controllers: [HealthController],
})
export class AppModule {}
