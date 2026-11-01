import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdGuard } from './household.guard';
import { HouseholdsController } from './households.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [HouseholdsController],
  providers: [HouseholdGuard],
})
export class HouseholdModule {}
