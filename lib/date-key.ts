const DATE_KEY_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getDateKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = DATE_KEY_FORMATTER_CACHE.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    DATE_KEY_FORMATTER_CACHE.set(timeZone, formatter);
  }
  return formatter;
}

/** Returns the user's local calendar date as YYYY-MM-DD. */
export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Returns a calendar date in an IANA timezone as YYYY-MM-DD. */
export function getDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = getDateKeyFormatter(timeZone).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Shifts a YYYY-MM-DD calendar date without applying a server timezone. */
export function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    getDateKeyFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}
