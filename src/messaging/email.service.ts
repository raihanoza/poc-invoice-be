import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface EmailAttachment {
  filename: string;
  // file content, base64-encoded
  content: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

// Sends mail over plain SMTP via Nodemailer — point EMAIL_HOST at your provider
// (e.g. smtp.gmail.com) and give it EMAIL_USER / EMAIL_PASS. For Gmail you'll want
// an App Password, not your normal login. Throws something readable if it's not set up.
@Injectable()
export class EmailService {
  private readonly logger = new Logger('EmailService');
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('EMAIL_HOST') &&
        this.config.get<string>('EMAIL_USER') &&
        this.config.get<string>('EMAIL_PASS'),
    );
  }

  async send(params: SendEmailParams): Promise<void> {
    const transporter = this.getTransporter();
    const from =
      this.config.get<string>('EMAIL_FROM') ??
      this.config.get<string>('EMAIL_USER');

    await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        encoding: 'base64',
      })),
    });
  }

  // build the transporter once and hang onto it so we reuse the SMTP connection
  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.config.get<string>('EMAIL_HOST');
    const user = this.config.get<string>('EMAIL_USER');
    const pass = this.config.get<string>('EMAIL_PASS');
    if (!host || !user || !pass) {
      throw new Error(
        'Email is not configured: set EMAIL_HOST, EMAIL_USER and EMAIL_PASS',
      );
    }

    // default to 587 (STARTTLS); 465 flips on implicit TLS
    const port = Number(this.config.get<string>('EMAIL_PORT') ?? 587);
    this.transporter = createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    this.logger.log(`SMTP transport ready (${host}:${port})`);
    return this.transporter;
  }
}
