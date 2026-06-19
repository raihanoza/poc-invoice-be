import { Client, Invoice, InvoiceItem } from '@prisma/client';
import { formatDate, formatIDR, formatQty } from '../../common/format.util';

export type InvoiceForPdf = Invoice & {
  items: InvoiceItem[];
  client: Client;
};

const BUSINESS_NAME = process.env.BUSINESS_NAME ?? 'Your Business Name';

function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// one self-contained HTML string (CSS inlined) for Puppeteer to turn into a PDF
export function buildInvoiceHtml(invoice: InvoiceForPdf): string {
  const { client, items } = invoice;
  const statusLabel = invoice.status === 'paid' ? 'LUNAS' : 'BELUM DIBAYAR';

  const rows = items
    .map(
      (it, idx) => `
        <tr>
          <td class="num">${idx + 1}</td>
          <td>${escapeHtml(it.description)}</td>
          <td class="num">${formatQty(it.qty)}</td>
          <td class="num">${formatIDR(it.unitPrice)}</td>
          <td class="num">${formatIDR(it.lineTotal)}</td>
        </tr>`,
    )
    .join('');

  const clientContact = [
    client.businessName ? escapeHtml(client.businessName) : '',
    client.email ? escapeHtml(client.email) : '',
    client.whatsappNumber ? escapeHtml(client.whatsappNumber) : '',
  ]
    .filter(Boolean)
    .map((line) => `<div>${line}</div>`)
    .join('');

  const notesBlock = invoice.notes
    ? `<div class="notes"><div class="notes-label">Catatan</div><div>${escapeHtml(
        invoice.notes,
      )}</div></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #1f2937;
    font-size: 12px;
    margin: 0;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #2563eb;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .brand { font-size: 20px; font-weight: 700; color: #111827; }
  .doc-title { font-size: 26px; font-weight: 700; color: #2563eb; letter-spacing: 2px; }
  .meta { text-align: right; font-size: 12px; color: #4b5563; }
  .meta .invoice-no { font-size: 14px; font-weight: 700; color: #111827; }
  .status {
    display: inline-block;
    margin-top: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
  }
  .status.paid { background: #dcfce7; color: #166534; }
  .status.unpaid { background: #fee2e2; color: #991b1b; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 24px; }
  .party-label { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; letter-spacing: 1px; }
  .party-name { font-weight: 700; font-size: 13px; }
  .dates { text-align: right; font-size: 12px; }
  .dates .row { margin-bottom: 4px; }
  .dates .label { color: #6b7280; margin-right: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead th {
    background: #f3f4f6;
    text-align: left;
    padding: 8px 10px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #374151;
    border-bottom: 2px solid #e5e7eb;
  }
  tbody td { padding: 8px 10px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
  th.num, td.num { text-align: right; }
  th:nth-child(1), td:nth-child(1) { width: 32px; text-align: center; }
  tfoot td { padding: 8px 10px; }
  .grand-label { text-align: right; font-weight: 700; font-size: 14px; }
  .grand-value { text-align: right; font-weight: 700; font-size: 16px; color: #2563eb; border-top: 2px solid #2563eb; }
  .notes { margin-top: 20px; padding: 12px 14px; background: #f9fafb; border-radius: 6px; }
  .notes-label { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; letter-spacing: 1px; }
  .footer { margin-top: 36px; text-align: center; color: #9ca3af; font-size: 10px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${escapeHtml(BUSINESS_NAME)}</div>
    </div>
    <div class="meta">
      <div class="doc-title">INVOICE</div>
      <div class="invoice-no">${escapeHtml(invoice.invoiceNo)}</div>
      <div><span class="status ${invoice.status}">${statusLabel}</span></div>
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="party-label">Ditagihkan kepada</div>
      <div class="party-name">${escapeHtml(client.name)}</div>
      ${clientContact}
    </div>
    <div class="dates">
      <div class="row"><span class="label">Tanggal dibuat</span>${formatDate(invoice.createdDate)}</div>
      <div class="row"><span class="label">Jatuh tempo</span>${formatDate(invoice.dueDate)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Deskripsi</th>
        <th class="num">Qty</th>
        <th class="num">Harga Satuan</th>
        <th class="num">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3"></td>
        <td class="grand-label">Grand Total</td>
        <td class="grand-value">${formatIDR(invoice.grandTotal)}</td>
      </tr>
    </tfoot>
  </table>

  ${notesBlock}

  <div class="footer">Invoice ini dibuat secara otomatis — POC Invoice &amp; Payment Reminder.</div>
</body>
</html>`;
}
