import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  Invoice,
  ReminderChannel,
  ReminderLogStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { startOfTodayUtc } from '../common/date.util';
import { formatDate, formatIDR } from '../common/format.util';
import { GroqService } from './groq.service';
import {
  InvoiceWithClient,
  MessagingService,
  SendResult,
} from './messaging.service';

const MS_PER_DAY = 86_400_000;

export interface DispatchResult {
  tone: 'friendly' | 'firm';
  channel: ReminderChannel;
  status: ReminderLogStatus;
  /** Where the message text came from: AI (Groq) or the local template fallback. */
  source: 'groq' | 'template';
  message: string;
  results: SendResult[];
}

/**
 * Drafts + sends a payment reminder for one invoice (tone-aware, Groq with a
 * template fallback) and records a reminder_log.
 *
 * - `dispatchForInvoice` — automatic path (on invoice create): idempotent, skips
 *   if already reminded today, returns nothing.
 * - `remindNow` — on-demand path (POST /invoices/:id/remind): always sends and
 *   returns the result so the UI can show it.
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

  /** True if a newly-created invoice should be reminded immediately. */
  shouldDispatchOnCreate(invoice: { status: string; dueDate: Date }): boolean {
    const today = startOfTodayUtc();
    return (
      invoice.status === 'unpaid' &&
      new Date(invoice.dueDate).getTime() <= today.getTime()
    );
  }

  /** Automatic, idempotent reminder (used on invoice create). */
  async dispatchForInvoice(invoiceId: string): Promise<void> {
    const invoice = await this.load(invoiceId);
    if (!invoice || invoice.status !== 'unpaid') {
      return;
    }
    const sentDate = startOfTodayUtc();
    const existing = await this.prisma.reminderLog.findUnique({
      where: { invoiceId_sentDate: { invoiceId, sentDate } },
    });
    if (existing) {
      return; // already reminded today
    }
    await this.process(invoice);
  }

  /** On-demand reminder; always sends and returns the outcome. */
  async remindNow(invoiceId: string): Promise<DispatchResult> {
    const invoice = await this.load(invoiceId);
    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }
    if (invoice.status === 'paid') {
      throw new BadRequestException(
        'Invoice sudah lunas — tidak perlu reminder',
      );
    }
    return this.process(invoice);
  }

  private load(invoiceId: string) {
    return this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true },
    });
  }

  /** Core: tone -> draft -> send -> log. Returns the dispatch result. */
  private async process(
    invoice: Invoice & { client: Client },
  ): Promise<DispatchResult> {
    const sentDate = startOfTodayUtc();
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
    let source: 'groq' | 'template';
    try {
      message = await this.groq.draftReminder(draftInput);
      source = 'groq';
      this.logger.log(`Message for ${invoice.invoiceNo} drafted by Groq AI`);
    } catch (err) {
      this.logger.warn(
        `Groq draft unavailable (${(err as Error).message}); using template`,
      );
      message = this.templateMessage(draftInput);
      source = 'template';
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
      where: { invoiceId_sentDate: { invoiceId: invoice.id, sentDate } },
      create: {
        invoiceId: invoice.id,
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
      `Reminder ${invoice.invoiceNo} (tone=${tone}, source=${source}) -> ${results
        .map((r) => `${r.channel}:${r.status}`)
        .join(', ')}`,
    );

    return {
      tone,
      channel: invoice.client.reminderChannel,
      status,
      source,
      message: fullMessage,
      results,
    };
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
