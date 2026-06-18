import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { CreateReminderLogDto } from './dto/create-reminder-log.dto';
import { RemindersService } from './reminders.service';

/**
 * Internal endpoints consumed by the n8n reminder workflow. Protected by the
 * x-internal-key header (InternalKeyGuard).
 */
@Controller('internal')
@UseGuards(InternalKeyGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('invoices/due-for-reminder')
  dueForReminder() {
    return this.remindersService.findDueForReminder();
  }

  @Post('reminder-logs')
  logReminder(@Body() dto: CreateReminderLogDto) {
    return this.remindersService.logReminder(dto);
  }
}
