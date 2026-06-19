import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Invoice, ReminderChannel } from '@prisma/client';
import { formatDate, formatIDR } from '../common/format.util';
import { EmailService } from './email.service';
import { WhatsappService } from './whatsapp.service';

export type InvoiceWithClient = Invoice & { client: Client };

export interface SendResult {
  channel: 'email' | 'whatsapp';
  status: 'sent' | 'failed';
  detail?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// sends an invoice to a client over whichever channel(s) their reminderChannel
// asks for (or an override). every attempt comes back as a SendResult, and one
// channel failing doesn't stop the other from going out.
@Injectable()
export class MessagingService {
  constructor(
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly whatsapp: WhatsappService,
  ) {}

  async sendInvoice(
    invoice: InvoiceWithClient,
    pdfBuffer?: Buffer,
    channelOverride?: ReminderChannel,
  ): Promise<SendResult[]> {
    const channel = channelOverride ?? invoice.client.reminderChannel;
    const link = this.buildShareUrl(invoice.shareToken);
    const businessName =
      this.config.get<string>('BUSINESS_NAME') ?? 'Your Business Name';

    const results: SendResult[] = [];
    if (channel === ReminderChannel.email || channel === ReminderChannel.both) {
      results.push(await this.trySendEmail(invoice, pdfBuffer, link, businessName));
    }
    if (channel === ReminderChannel.whatsapp || channel === ReminderChannel.both) {
      results.push(await this.trySendWhatsapp(invoice, link, businessName));
    }
    return results;
  }

  // push an already-drafted reminder message to the client over their preferred
  // channel(s). this is what the immediate on-create reminder calls.
  async sendReminder(
    invoice: InvoiceWithClient,
    message: string,
  ): Promise<SendResult[]> {
    const channel = invoice.client.reminderChannel;
    const results: SendResult[] = [];

    if (channel === ReminderChannel.email || channel === ReminderChannel.both) {
      if (!invoice.client.email) {
        results.push({ channel: 'email', status: 'failed', detail: 'client has no email address' });
      } else {
        try {
          await this.email.send({
            to: invoice.client.email,
            subject: `Pengingat pembayaran invoice ${invoice.invoiceNo}`,
            html: `<div style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-line">${escapeHtml(message)}</div>`,
          });
          results.push({ channel: 'email', status: 'sent' });
        } catch (err) {
          results.push({ channel: 'email', status: 'failed', detail: (err as Error).message });
        }
      }
    }

    if (channel === ReminderChannel.whatsapp || channel === ReminderChannel.both) {
      if (!invoice.client.whatsappNumber) {
        results.push({ channel: 'whatsapp', status: 'failed', detail: 'client has no WhatsApp number' });
      } else {
        try {
          await this.whatsapp.send({ to: invoice.client.whatsappNumber, message });
          results.push({ channel: 'whatsapp', status: 'sent' });
        } catch (err) {
          results.push({ channel: 'whatsapp', status: 'failed', detail: (err as Error).message });
        }
      }
    }

    return results;
  }

  private async trySendEmail(
    invoice: InvoiceWithClient,
    pdfBuffer: Buffer | undefined,
    link: string,
    businessName: string,
  ): Promise<SendResult> {
    if (!invoice.client.email) {
      return { channel: 'email', status: 'failed', detail: 'client has no email address' };
    }
    try {
      await this.email.send({
        to: invoice.client.email,
        subject: `Invoice ${invoice.invoiceNo} dari ${businessName}`,
        html: this.buildEmailHtml(invoice, link, businessName),
        attachments: pdfBuffer
          ? [{ filename: `${invoice.invoiceNo}.pdf`, content: pdfBuffer.toString('base64') }]
          : undefined,
      });
      return { channel: 'email', status: 'sent' };
    } catch (err) {
      return { channel: 'email', status: 'failed', detail: (err as Error).message };
    }
  }

  private async trySendWhatsapp(
    invoice: InvoiceWithClient,
    link: string,
    businessName: string,
  ): Promise<SendResult> {
    if (!invoice.client.whatsappNumber) {
      return { channel: 'whatsapp', status: 'failed', detail: 'client has no WhatsApp number' };
    }
    try {
      await this.whatsapp.send({
        to: invoice.client.whatsappNumber,
        message: this.buildWhatsappText(invoice, link, businessName),
      });
      return { channel: 'whatsapp', status: 'sent' };
    } catch (err) {
      return { channel: 'whatsapp', status: 'failed', detail: (err as Error).message };
    }
  }

  private buildShareUrl(token: string): string {
    const base =
      this.config.get<string>('WEB_PUBLIC_URL') ||
      this.config.get<string>('NEXT_PUBLIC_API_BASE_URL') ||
      '';
    return base ? `${base.replace(/\/$/, '')}/invoice/${token}` : `/invoice/${token}`;
  }

  private buildEmailHtml(
    invoice: InvoiceWithClient,
    link: string,
    businessName: string,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; color: #1f2937; font-size: 14px;">
        <p>Halo ${invoice.client.name},</p>
        <p>Berikut invoice <strong>${invoice.invoiceNo}</strong> dari ${businessName}.</p>
        <ul>
          <li>Total: <strong>${formatIDR(invoice.grandTotal)}</strong></li>
          <li>Jatuh tempo: ${formatDate(invoice.dueDate)}</li>
        </ul>
        <p>Lihat invoice: <a href="${link}">${link}</a></p>
        <p>PDF invoice terlampir pada email ini.</p>
        <p>Terima kasih.</p>
      </div>`;
  }

  private buildWhatsappText(
    invoice: InvoiceWithClient,
    link: string,
    businessName: string,
  ): string {
    return [
      `Halo ${invoice.client.name},`,
      `Berikut invoice ${invoice.invoiceNo} dari ${businessName}.`,
      `Total: ${formatIDR(invoice.grandTotal)}`,
      `Jatuh tempo: ${formatDate(invoice.dueDate)}`,
      `Lihat invoice: ${link}`,
    ].join('\n');
  }
}
