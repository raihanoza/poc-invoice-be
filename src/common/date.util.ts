/**
 * Date helpers working in UTC, to match Prisma's `@db.Date` columns which store
 * a calendar date with no timezone. Keeping everything in UTC avoids off-by-one
 * day shifts when the server runs in a non-UTC timezone.
 */

/** Normalize an ISO date string ("YYYY-MM-DD" or full ISO) to a UTC calendar date. */
export function toDateOnly(input: string): Date {
  const datePart = input.slice(0, 10); // YYYY-MM-DD
  return new Date(`${datePart}T00:00:00.000Z`);
}

/** Today at 00:00:00 UTC. */
export function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** Add (or subtract) whole days to a date, in UTC. */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
