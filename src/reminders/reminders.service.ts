import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, startOfTodayUtc, toDateOnly } from '../common/date.util';
import { CreateReminderLogDto } from './dto/create-reminder-log.dto';

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Invoices that should be reminded: unpaid, due within REMINDER_DAYS_BEFORE_DUE
   * days (this also covers already-overdue invoices, since their dueDate < today),
   * and not yet reminded today. All "which invoice / already sent?" logic lives
   * here in the backend — n8n only orchestrates (Section 6.1).
   */
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

  /**
   * Record a reminder send result. Upsert on the (invoiceId, sentDate) unique
   * constraint gives idempotency: a second call for the same invoice on the same
   * day updates the existing row instead of creating a duplicate.
   */
  async logReminder(dto: CreateReminderLogDto) {
    const sentDate = dto.sentDate ? toDateOnly(dto.sentDate) : startOfTodayUtc();

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      select: { id: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);
    }

    return this.prisma.reminderLog.upsert({
      where: {
        invoiceId_sentDate: { invoiceId: dto.invoiceId, sentDate },
      },
      create: {
        invoiceId: dto.invoiceId,
        sentDate,
        channel: dto.channel,
        messageContent: dto.messageContent,
        status: dto.status,
      },
      update: {
        channel: dto.channel,
        messageContent: dto.messageContent,
        status: dto.status,
      },
    });
  }
}
