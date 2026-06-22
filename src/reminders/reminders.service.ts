import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReminderLogStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, startOfTodayUtc, toDateOnly } from '../common/date.util';
import { CreateReminderLogDto } from './dto/create-reminder-log.dto';

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // invoices worth reminding: unpaid, due within REMINDER_DAYS_BEFORE_DUE days
  // (overdue ones are caught too, since their dueDate is already < today), and not
  // reminded yet today. the "which invoice / already sent?" logic lives here in the
  // backend — n8n just orchestrates.
  findDueForReminder() {
    const today = startOfTodayUtc();
    const days = Number(this.config.get<string>('REMINDER_DAYS_BEFORE_DUE') ?? 3);
    const threshold = addDays(today, Number.isFinite(days) ? days : 3);

    return this.prisma.invoice.findMany({
      where: {
        status: 'unpaid',
        dueDate: { lte: threshold },
        reminderLogs: { none: { sentDate: today } },
      },
      include: { client: true, items: true },
      orderBy: { dueDate: 'asc' },
    });
  }

  // record the outcome of a reminder send. the upsert on (invoiceId, sentDate)
  // keeps it idempotent — a second call for the same invoice on the same day just
  // updates that row instead of adding a duplicate.
  async logReminder(dto: CreateReminderLogDto) {
    const sentDate = dto.sentDate ? toDateOnly(dto.sentDate) : startOfTodayUtc();

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      select: { id: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);
    }

    const existing = await this.prisma.reminderLog.findUnique({
      where: { invoiceId_sentDate: { invoiceId: dto.invoiceId, sentDate } },
      select: { status: true },
    });

    // never downgrade sent -> failed for the same day. when a client wants "both"
    // channels, n8n logs each channel separately; a later "failed" (e.g. WhatsApp)
    // must not erase an earlier "sent" (e.g. email) — the reminder did go out.
    const status =
      existing?.status === ReminderLogStatus.sent &&
      dto.status === ReminderLogStatus.failed
        ? ReminderLogStatus.sent
        : dto.status;

    return this.prisma.reminderLog.upsert({
      where: {
        invoiceId_sentDate: { invoiceId: dto.invoiceId, sentDate },
      },
      create: {
        invoiceId: dto.invoiceId,
        sentDate,
        channel: dto.channel,
        messageContent: dto.messageContent,
        status,
      },
      update: {
        channel: dto.channel,
        messageContent: dto.messageContent,
        status,
      },
    });
  }
}
