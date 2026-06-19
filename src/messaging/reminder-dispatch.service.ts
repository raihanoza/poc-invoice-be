import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReminderLogStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { startOfTodayUtc } from '../common/date.util';
import { formatDate, formatIDR } from '../common/format.util';
import { GroqService } from './groq.service';
import { InvoiceWithClient, MessagingService } from './messaging.service';

const MS_PER_DAY = 86_400_000;

/**
 * Processes a reminder for a single invoice immediately (used when an invoice is
 * created already due today / overdue, so it doesn't have to wait for the daily
 * n8n run). Mirrors the n8n flow: tone -> draft (Groq, template fallback) ->
 * send per channel -> log. Idempotent per day via reminder_logs (invoiceId, sentDate).
 */
@Injectable()
export class ReminderDispatchService {
  private readonly logger = new Logger('ReminderDispatch');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly groq: GroqService,
    private readonly messaging: MessagingService,
  ) {}

  /** Returns true if the invoice qualifies for an immediate reminder. */
  shouldDispatchOnCreate(invoice: { status: string; dueDate: Date }): boolean {
    const today = startOfTodayUtc();
    return (
      invoice.status === 'unpaid' &&
      new Date(invoice.dueDate).getTime() <= today.getTime()
    );
  }

  async dispatchForInvoice(invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true },
    });
    if (!invoice || invoice.status !== 'unpaid') {
      return;
    }

    const sentDate = startOfTodayUtc();

    // Idempotency: if a reminder was already logged today, do nothing.
    const existing = await this.prisma.reminderLog.findUnique({
      where: { invoiceId_sentDate: { invoiceId, sentDate } },
    });
    if (existing) {
      return;
    }

    const dueTime = new Date(invoice.dueDate).getTime();
    const overdue = dueTime < sentDate.getTime();
    const tone: 'friendly' | 'firm' = overdue ? 'firm' : 'friendly';
    const daysOverdue = overdue
      ? Math.round((sentDate.getTime() - dueTime) / MS_PER_DAY)
      : 0;

    const draftInput = {
      clientName: invoice.client.name,
      invoiceNo: invoice.invoiceNo,
      grandTotal: invoice.grandTotal.toString(),
      dueDate: formatDate(invoice.dueDate),
      tone,
      daysOverdue,
    };

    let message: string;
    try {
      message = await this.groq.draftReminder(draftInput);
    } catch (err) {
      // No Groq key or call failed — use a simple template so the reminder still goes out.
      this.logger.warn(
        `Groq draft unavailable (${(err as Error).message}); using template`,
      );
      message = this.templateMessage(draftInput);
    }

    const base =
      this.config.get<string>('WEB_PUBLIC_URL') ||
      this.config.get<string>('NEXT_PUBLIC_API_BASE_URL') ||
      '';
    const shareUrl = base
      ? `${base.replace(/\/$/, '')}/invoice/${invoice.shareToken}`
      : '';
    const fullMessage = shareUrl
      ? `${message}\n\nLihat invoice: ${shareUrl}`
      : message;

    const results = await this.messaging.sendReminder(
      invoice as InvoiceWithClient,
      fullMessage,
    );
    const anySent = results.some((r) => r.status === 'sent');
    const status = anySent ? ReminderLogStatus.sent : ReminderLogStatus.failed;

    await this.prisma.reminderLog.upsert({
      where: { invoiceId_sentDate: { invoiceId, sentDate } },
      create: {
        invoiceId,
        sentDate,
        channel: invoice.client.reminderChannel,
        messageContent: fullMessage,
        status,
      },
      update: {
        channel: invoice.client.reminderChannel,
        messageContent: fullMessage,
        status,
      },
    });

    this.logger.log(
      `Immediate reminder ${invoice.invoiceNo} (${tone}) -> ${results
        .map((r) => `${r.channel}:${r.status}`)
        .join(', ')}`,
    );
  }

  private templateMessage(input: {
    clientName: string;
    invoiceNo: string;
    grandTotal: string;
    dueDate: string;
    tone: 'friendly' | 'firm';
  }): string {
    const total = formatIDR(input.grandTotal);
    if (input.tone === 'firm') {
      return `Halo ${input.clientName}, invoice ${input.invoiceNo} sebesar ${total} telah melewati jatuh tempo (${input.dueDate}). Mohon segera lakukan pembayaran. Terima kasih.`;
    }
    return `Halo ${input.clientName}, mengingatkan invoice ${input.invoiceNo} sebesar ${total} jatuh tempo ${input.dueDate}. Mohon pembayarannya ya. Terima kasih.`;
  }
}
