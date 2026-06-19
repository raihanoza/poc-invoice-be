import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendWhatsappParams {
  to: string;
  message: string;
}

/**
 * WhatsApp sender for the transporindo waapi service. POSTs the following body
 * to WHATSAPP_SERVICE_URL:
 *   { "message": "...", "numbers": "<phone>", "apiKey": "<WHATSAPP_SERVICE_TOKEN>" }
 * Throws when not configured (URL / apiKey missing).
 */
@Injectable()
export class WhatsappService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('WHATSAPP_SERVICE_URL') &&
        this.config.get<string>('WHATSAPP_SERVICE_TOKEN'),
    );
  }

  async send(params: SendWhatsappParams): Promise<void> {
    const url = this.config.get<string>('WHATSAPP_SERVICE_URL');
    const apiKey = this.config.get<string>('WHATSAPP_SERVICE_TOKEN');
    if (!url) {
      throw new Error('WhatsApp is not configured: set WHATSAPP_SERVICE_URL');
    }
    if (!apiKey) {
      throw new Error(
        'WhatsApp is not configured: set WHATSAPP_SERVICE_TOKEN (apiKey)',
      );
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: params.message,
        numbers: params.to,
        apiKey,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`WhatsApp service error ${res.status}: ${detail}`);
    }
  }
}
