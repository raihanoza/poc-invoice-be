import { Module } from '@nestjs/common';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  controllers: [RemindersController],
  providers: [RemindersService, InternalKeyGuard],
})
export class RemindersModule {}
