// schedule-core.js — the only copy of the time-window rules.
// n8n/build-workflow.mjs pastes this file into the n8n Code node so the
// workflow cannot drift from the CLI.
//
// Dates are civil days in America/New_York (the shop is in Homestead, FL).
// Date#getDay / setDate / getHours and toLocaleDateString() follow the host
// timezone, so a UTC server and an Eastern laptop can disagree on the calendar
// day and on the 2pm cutoff. A missing receivedAt also schedules from "now":
// the Nov 7 demo (Saturday 9:58 AM ET, no receivedAt) was Tue Nov 10–Fri Nov 13,
// while the sample file's Monday Nov 9 arrival time is Wed Nov 11–Mon Nov 16.

export const SHOP_TIME_ZONE = "America/New_York";

/** Year/month/day/hour of an instant on the shop's wall clock. */
export function shopWallClock(instant) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = {};
  for (const part of fmt.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0; // some ICU builds report midnight as 24
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
  };
}

/**
 * Which clock a lead is scheduled from.
 * An explicit `now` (tests) wins, then the lead's receivedAt, then the current time.
 */
export function scheduleInstant(lead, now) {
  if (now instanceof Date && !Number.isNaN(now.getTime())) return now;
  if (lead && lead.receivedAt) {
    const received = new Date(lead.receivedAt);
    if (!Number.isNaN(received.getTime())) return received;
  }
  return new Date();
}

/** Move a shop calendar date forward by `days` weekdays (Sat/Sun skipped). */
export function addBusinessDays(from, days) {
  const start = from instanceof Date ? shopWallClock(from) : from;
  let year = start.year;
  let month = start.month;
  let day = start.day;
  let added = 0;
  while (added < days) {
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
    const weekday = next.getUTCDay();
    if (weekday !== 0 && weekday !== 6) added++;
  }
  return { year, month, day };
}

export function formatShopDate(civil) {
  const noonUtc = new Date(Date.UTC(civil.year, civil.month - 1, civil.day, 12));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(noonUtc);
}

export function estimateTimeWindow(urgency, now = new Date()) {
  const wall = shopWallClock(now);
  if (urgency === "emergency") {
    return "Today \u2014 on-call tech dispatched, arrival within 2-4 hours";
  }
  if (urgency === "urgent") {
    // Before 2pm shop time we can usually still fit it in today.
    return wall.hour < 14
      ? "Today \u2014 afternoon slot (12pm-6pm)"
      : "Tomorrow \u2014 first morning slot (8am-11am)";
  }
  // Routine work goes 2-5 business days out, skipping the weekend.
  const start = formatShopDate(addBusinessDays(wall, 2));
  const end = formatShopDate(addBusinessDays(wall, 5));
  return `${start} - ${end} \u2014 office will offer a 2-hour arrival window`;
}

/** Spanish wording for the English windows estimateTimeWindow() returns. */
export function translateWindow(when) {
  return when
    .replace("Today \u2014 on-call tech dispatched, arrival within 2-4 hours", "hoy, llegada en 2-4 horas")
    .replace("Today \u2014 afternoon slot (12pm-6pm)", "hoy en la tarde (12pm-6pm)")
    .replace("Tomorrow \u2014 first morning slot (8am-11am)", "ma\u00f1ana temprano (8am-11am)")
    .replace("\u2014 office will offer a 2-hour arrival window", "(le daremos una ventana de llegada de 2 horas)");
}
