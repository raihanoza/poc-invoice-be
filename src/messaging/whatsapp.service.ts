import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface SendWhatsappFile {
  filename: string;
  content: Buffer;
  // defaults to application/pdf
  contentType?: string;
}

export interface SendWhatsappParams {
  to: string;
  message: string;
  // when set, the message goes out with the file attached via /send-message-image
  file?: SendWhatsappFile;
}

@Injectable()
export class WhatsappService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>("WHATSAPP_SERVICE_URL") &&
      this.config.get<string>("WHATSAPP_SERVICE_TOKEN"),
    );
  }

  async send(params: SendWhatsappParams): Promise<void> {
    const apiKey = this.config.get<string>("WHATSAPP_SERVICE_TOKEN");
    if (!apiKey) {
      throw new Error(
        "WhatsApp is not configured: set WHATSAPP_SERVICE_TOKEN (apiKey)",
      );
    }

    if (params.file) {
      await this.sendWithFile(params, apiKey, params.file);
    } else {
      await this.sendText(params, apiKey);
    }
  }

  // plain text -> /send-message, JSON body
  private async sendText(
    params: SendWhatsappParams,
    apiKey: string,
  ): Promise<void> {
    const url = this.config.get<string>("WHATSAPP_SERVICE_URL");
    if (!url) {
      throw new Error("WhatsApp is not configured: set WHATSAPP_SERVICE_URL");
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  // message + file -> /send-message-image, multipart/form-data
  private async sendWithFile(
    params: SendWhatsappParams,
    apiKey: string,
    file: SendWhatsappFile,
  ): Promise<void> {
    const url = this.imageUrl();
    if (!url) {
      throw new Error(
        "WhatsApp is not configured: set WHATSAPP_SERVICE_URL or WHATSAPP_SERVICE_IMAGE_URL",
      );
    }

    const form = new FormData();
    form.append("numbers", params.to);
    form.append("apiKey", apiKey);
    form.append("message", params.message);
    form.append(
      "files",
      new Blob([new Uint8Array(file.content)], {
        type: file.contentType ?? "application/pdf",
      }),
      file.filename,
    );

    const res = await fetch(url, { method: "POST", body: form });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`WhatsApp service error ${res.status}: ${detail}`);
    }
  }

  private imageUrl(): string | undefined {
    const explicit = this.config.get<string>("WHATSAPP_SERVICE_IMAGE_URL");
    if (explicit) {
      return explicit;
    }
    const base = this.config.get<string>("WHATSAPP_SERVICE_URL");
    if (!base) {
      return undefined;
    }
    return base.replace(/\/send-message$/, "/send-message-image");
  }
}
