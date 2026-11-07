// crm.ts — a "mini CRM": one CSV row per lead. Opens in Excel or Google Sheets.
// It is idempotent: if the same lead id comes in twice (forms love to double-submit),
// we skip it instead of creating a duplicate row.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ProcessedLead } from "./types.ts";

const HEADERS = ["lead_id", "received_at", "name", "phone", "address", "language", "urgency", "job_type", "summary", "time_window", "needs_review", "review_reasons", "classified_by", "confidence", "status"];

export function logToCrm(p: ProcessedLead, file = "output/leads.csv"): "added" | "duplicate" {
  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file)) appendFileSync(file, HEADERS.join(",") + "\n");

  const existing = readFileSync(file, "utf8");
  if (existing.split("\n").some((line) => line.startsWith(csv(p.lead.id) + ","))) return "duplicate";

  const row = [
    p.lead.id, p.lead.receivedAt ?? p.processedAt, p.lead.name ?? "", p.lead.phone ?? "", p.lead.address ?? "",
    p.triage.language, p.triage.urgency, p.triage.jobType, p.triage.summary, p.timeWindow,
    p.needsHumanReview ? "YES" : "no", p.reviewReasons.join("; "), p.triage.classifiedBy, p.triage.confidence.toFixed(2),
    p.needsHumanReview ? "waiting for office review" : "reply ready to send",
  ];
  appendFileSync(file, row.map(csv).join(",") + "\n");
  return "added";
}

// Wrap a value in quotes and escape inner quotes so commas in messages don't break the CSV.
function csv(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}
