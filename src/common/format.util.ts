import { Prisma } from '@prisma/client';

type Numeric = Prisma.Decimal | number | string;

function toNumber(value: Numeric): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

// rupiah, e.g. "Rp 1.150.000"
export function formatIDR(value: Numeric): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

export function formatQty(value: Numeric): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

// date in UTC, e.g. "25 Juni 2026"
export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}
