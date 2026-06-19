import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { ReminderDispatchService } from '../messaging/reminder-dispatch.service';
import { CreateReminderLogDto } from './dto/create-reminder-log.dto';
import { RemindersService } from './reminders.service';

// internal endpoints the n8n reminder workflow calls. locked behind the
// x-internal-key header via InternalKeyGuard.
@Controller('internal')
@UseGuards(InternalKeyGuard)
export class RemindersController {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly reminderDispatch: ReminderDispatchService,
  ) {}

  @Get('invoices/due-for-reminder')
  dueForReminder() {
    return this.remindersService.findDueForReminder();
  }

  // n8n calls this per due invoice; the backend drafts, sends and logs it all.
  // skipped (already sent today / paid) comes back as { skipped: true }.
  @Post('invoices/:id/dispatch-reminder')
  async dispatchReminder(@Param('id', new ParseUUIDPipe()) id: string) {
    const result = await this.reminderDispatch.dispatchForInvoice(id);
    return result ?? { skipped: true };
  }

  @Post('reminder-logs')
  logReminder(@Body() dto: CreateReminderLogDto) {
    return this.remindersService.logReminder(dto);
  }
}
