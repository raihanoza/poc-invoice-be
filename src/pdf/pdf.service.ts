import { Injectable, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import { buildInvoiceHtml, InvoiceForPdf } from './templates/invoice-template';

/**
 * Pure rendering service: invoice data -> PDF buffer. It does NOT touch the DB
 * (the caller passes already-loaded invoice data), so there is no dependency on
 * InvoicesModule and thus no circular import.
 *
 * A single Chromium instance is launched lazily and reused across requests.
 */
@Injectable()
export class PdfService implements OnModuleDestroy {
  private browserPromise: Promise<Browser> | null = null;

  private launch(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browserPromise;
  }

  async generateInvoicePdf(invoice: InvoiceForPdf): Promise<Buffer> {
    const html = buildInvoiceHtml(invoice);
    const browser = await this.launch();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', right: '14mm', bottom: '16mm', left: '14mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      await browser.close();
      this.browserPromise = null;
    }
  }
}
