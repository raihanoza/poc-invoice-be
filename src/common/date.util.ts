// Everything here stays in UTC to line up with Prisma's `@db.Date` columns (a bare
// calendar date, no timezone). Otherwise a server in another timezone drifts a day.

// take an ISO string (date-only or full) and pin it to midnight UTC
export function toDateOnly(input: string): Date {
  const datePart = input.slice(0, 10);
  return new Date(`${datePart}T00:00:00.000Z`);
}

// midnight UTC today
export function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

// shift a date by N days (negative to go back), in UTC
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
