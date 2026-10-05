function offsetAt(utcMs: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(utcMs));
  const pick = (type: "year" | "month" | "day" | "hour" | "minute" | "second") => {
    const value = Number(parts.find((part) => part.type === type)?.value);
    return Number.isFinite(value) ? value : 0;
  };
  let hour = pick("hour");
  const day = pick("day");
  if (hour === 24) hour = 0;
  return (
    Date.UTC(pick("year"), pick("month") - 1, day, hour, pick("minute"), pick("second")) - utcMs
  );
}

/** Convert a wall-clock time in `timeZone` to a UTC ISO string. */
export function zonedTimeToUtc(dateTime: string, timeZone: string) {
  const [datePart, timePart = "00:00:00"] = dateTime.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second = 0] = timePart.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const first = guess - offsetAt(guess, timeZone);
  const secondPass = guess - offsetAt(first, timeZone);
  return new Date(secondPass).toISOString();
}

export function formatInTimeZone(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function formatDateKey(iso: string, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date(iso));
}

export function formatDateHeading(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(new Date(iso));
}

export function toIcsUtc(iso: string) {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}
