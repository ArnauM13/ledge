import { Module } from '@nestjs/common';
import { CryptoModule } from './crypto/crypto.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [CryptoModule, PrismaModule],
  controllers: [HealthController],
})
export class AppModule {}
