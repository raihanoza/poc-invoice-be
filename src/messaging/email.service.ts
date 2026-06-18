import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailAttachment {
  filename: string;
  /** base64-encoded file content */
  content: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

/**
 * Thin Resend client (https://resend.com) using the built-in fetch — no SDK
 * dependency. Throws a clear error when not configured so callers can report it.
 */
@Injectable()
export class EmailService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('RESEND_API_KEY') &&
        this.config.get<string>('EMAIL_FROM'),
    );
  }

  async send(params: SendEmailParams): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM');
    if (!apiKey || !from) {
      throw new Error(
        'Email is not configured: set RESEND_API_KEY and EMAIL_FROM',
      );
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        attachments: params.attachments,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Resend API error ${res.status}: ${detail}`);
    }
  }
}
