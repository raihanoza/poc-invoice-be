import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendWhatsappParams {
  to: string;
  message: string;
}

/**
 * Generic WhatsApp sender: POSTs { to, message } to a configurable HTTP service
 * (e.g. an existing Baileys-based service or a WhatsApp Cloud API proxy). Adapt
 * the body shape to your service if needed. Throws when not configured.
 */
@Injectable()
export class WhatsappService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('WHATSAPP_SERVICE_URL'));
  }

  async send(params: SendWhatsappParams): Promise<void> {
    const url = this.config.get<string>('WHATSAPP_SERVICE_URL');
    const token = this.config.get<string>('WHATSAPP_SERVICE_TOKEN');
    if (!url) {
      throw new Error('WhatsApp is not configured: set WHATSAPP_SERVICE_URL');
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ to: params.to, message: params.message }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`WhatsApp service error ${res.status}: ${detail}`);
    }
  }
}
