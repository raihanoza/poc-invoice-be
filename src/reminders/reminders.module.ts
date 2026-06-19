import { Module } from '@nestjs/common';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { MessagingModule } from '../messaging/messaging.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [MessagingModule],
  controllers: [RemindersController],
  providers: [RemindersService, InternalKeyGuard],
})
export class RemindersModule {}
