// schedule.ts — turns urgency into a time window the office can promise.
// Real shops would pull this from their dispatch board; here it's simple, clear rules.

import type { Urgency } from "./types.ts";

export function estimateTimeWindow(urgency: Urgency, now: Date = new Date()): string {
  const hour = now.getHours();

  if (urgency === "emergency") {
    return "Today — on-call tech dispatched, arrival within 2-4 hours";
  }
  if (urgency === "urgent") {
    // Before 2pm we can usually still fit it in today; after that it's first thing tomorrow.
    return hour < 14 ? "Today — afternoon slot (12pm-6pm)" : "Tomorrow — first morning slot (8am-11am)";
  }
  // Routine work goes 2-5 business days out, skipping the weekend.
  const start = addBusinessDays(now, 2);
  const end = addBusinessDays(now, 5);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `${fmt(start)} - ${fmt(end)} — office will offer a 2-hour arrival window`;
}

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d;
}
