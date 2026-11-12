/** Calendar days for the daily game, as YYYY-MM-DD keys. */

const DAY_MS = 86_400_000;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** The date on the visitor's own calendar: a new cricketer arrives at their midnight. */
export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function utcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Days since 1 January 1970 for a date key, whatever the time zone. */
export function dayNumber(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return Math.round(Date.UTC(year!, month! - 1, day!) / DAY_MS);
}

export function addDays(key: string, days: number) {
  return utcDateKey(new Date((dayNumber(key) + days) * DAY_MS));
}

/** Age in whole years on a date. */
export function ageOn(born: string, on: string) {
  const [by, bm, bd] = born.split("-").map(Number);
  const [y, m, d] = on.split("-").map(Number);
  const hadBirthday = m! > bm! || (m === bm && d! >= bd!);
  return y! - by! - (hadBirthday ? 0 : 1);
}

/** Milliseconds until the visitor's next midnight. */
export function untilMidnight(now: Date) {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight.getTime() - now.getTime();
}

/** "Thursday 12 November", for a date key. */
export function longDay(key: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(dayNumber(key) * DAY_MS));
}
