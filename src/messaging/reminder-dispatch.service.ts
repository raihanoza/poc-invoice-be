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
  InvoiceItem,
  ReminderChannel,
  ReminderLogStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { startOfTodayUtc } from '../common/date.util';
import { formatDate, formatIDR } from '../common/format.util';
import { PdfService } from '../pdf/pdf.service';
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
  // did the text come from Groq, or did we fall back to the local template?
  source: 'groq' | 'template';
  message: string;
  results: SendResult[];
}

// Drafts and sends a payment reminder for one invoice (Groq for the wording, with a
// template fallback) and writes a reminder_log. Two ways in:
//   - dispatchForInvoice: the automatic path on invoice create. Skips if we already
//     reminded today and returns nothing.
//   - remindNow: the manual button. Always sends and returns the result for the UI.
@Injectable()
export class ReminderDispatchService {
  private readonly logger = new Logger('ReminderDispatch');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly groq: GroqService,
    private readonly messaging: MessagingService,
    private readonly pdf: PdfService,
  ) {}

  // should a freshly created invoice get a reminder right away?
  shouldDispatchOnCreate(invoice: { status: string; dueDate: Date }): boolean {
    const today = startOfTodayUtc();
    return (
      invoice.status === 'unpaid' &&
      new Date(invoice.dueDate).getTime() <= today.getTime()
    );
  }

  // automatic reminder used on invoice create and by the n8n daily run. safe to call
  // more than once a day — returns null when there's nothing to send (paid, missing,
  // or already reminded today), otherwise the dispatch result.
  async dispatchForInvoice(invoiceId: string): Promise<DispatchResult | null> {
    const invoice = await this.load(invoiceId);
    if (!invoice || invoice.status !== 'unpaid') {
      return null;
    }
    const sentDate = startOfTodayUtc();
    const existing = await this.prisma.reminderLog.findUnique({
      where: { invoiceId_sentDate: { invoiceId, sentDate } },
    });
    if (existing) {
      return null; // already sent one today
    }
    return this.process(invoice);
  }

  // manual reminder — always sends and hands back the outcome
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
      include: { client: true, items: true },
    });
  }

  // the actual work: pick a tone, draft the text, send it, log it
  private async process(
    invoice: Invoice & { client: Client; items: InvoiceItem[] },
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

    // attach the invoice PDF when we can; if rendering fails, still send the text
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await this.pdf.generateInvoicePdf(invoice);
    } catch (err) {
      this.logger.warn(
        `PDF render failed for ${invoice.invoiceNo} (${(err as Error).message}); sending reminder without attachment`,
      );
    }

    const results = await this.messaging.sendReminder(
      invoice as InvoiceWithClient,
      fullMessage,
      pdfBuffer,
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
