import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SYSTEM_PROMPT = `Kamu adalah asisten yang menulis pesan pengingat pembayaran invoice untuk sebuah bisnis kecil.

Tulis SATU pesan pengingat singkat (maksimal 80 kata) dalam Bahasa Indonesia, dengan ketentuan:
- Jika tone = friendly: nada ramah, sopan, tidak menekan, mengingatkan jatuh tempo yang akan datang.
- Jika tone = firm: nada lebih tegas dan profesional (bukan kasar), menekankan invoice sudah lewat jatuh tempo dan perlu segera dibayar.
- Sebutkan nomor invoice, jumlah tagihan, dan tanggal jatuh tempo.
- Jangan gunakan salam pembuka formal yang panjang, langsung ke inti pesan.
- Output HANYA teks pesan, tanpa penjelasan tambahan, tanpa markdown.`;

export interface DraftReminderInput {
  clientName: string;
  invoiceNo: string;
  grandTotal: string;
  dueDate: string;
  tone: 'friendly' | 'firm';
  daysOverdue: number;
}

// drafts the reminder text through Groq (OpenAI-compatible API). kept in line with
// the n8n "Draft message (Groq)" node so reminders read the same whether the backend
// or n8n kicked them off. throws when GROQ_API_KEY is missing, and callers fall back
// to a template at that point.
@Injectable()
export class GroqService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('GROQ_API_KEY'));
  }

  async draftReminder(input: DraftReminderInput): Promise<string> {
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not set');
    }
    const model =
      this.config.get<string>('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        temperature: 0.7,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              'Data:',
              `- Nama client: ${input.clientName}`,
              `- Nomor invoice: ${input.invoiceNo}`,
              `- Jumlah tagihan: Rp ${input.grandTotal}`,
              `- Tanggal jatuh tempo: ${input.dueDate}`,
              `- Tone: ${input.tone}`,
              `- Hari terlambat (jika ada): ${input.daysOverdue}`,
            ].join('\n'),
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Groq API error ${res.status}: ${detail}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('Groq returned an empty message');
    }
    return text;
  }
}
