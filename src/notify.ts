// notify.ts — tells the on-call tech. Always writes to a local log; if TECH_WEBHOOK_URL
// is set (a Slack or Discord incoming webhook) it also posts there. A failed ping is
// logged but never stops the lead from being saved.

import { appendFileSync, mkdirSync } from "node:fs";
import type { ProcessedLead } from "./types.ts";

export function buildTechAlert(p: Omit<ProcessedLead, "techAlert">): string {
  const icon = p.triage.urgency === "emergency" ? "🚨" : p.triage.urgency === "urgent" ? "⚠️" : "🗓️";
  return [
    `${icon} ${p.triage.summary}`,
    `Customer: ${p.lead.name ?? "unknown"} | ${p.lead.phone ?? "no phone"} | ${p.lead.address ?? "no address"}`,
    `Window: ${p.timeWindow}`,
    `Speaks: ${p.triage.language === "es" ? "Spanish" : "English"}${p.needsHumanReview ? " | NEEDS OFFICE REVIEW: " + p.reviewReasons.join("; ") : ""}`,
  ].join("\n");
}

export async function notifyTech(p: ProcessedLead, opts: { webhookUrl?: string; logFile?: string } = {}): Promise<void> {
  const logFile = opts.logFile ?? "output/tech-alerts.log";
  mkdirSync("output", { recursive: true });
  appendFileSync(logFile, `--- ${p.processedAt} lead ${p.lead.id}\n${p.techAlert}\n\n`);

  const url = opts.webhookUrl ?? process.env.TECH_WEBHOOK_URL;
  // Only page the tech in real time for emergencies/urgent jobs; routine ones wait for the morning list.
  if (!url || p.triage.urgency === "routine") return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // "text" works for Slack, "content" for Discord — sending both covers either one.
      body: JSON.stringify({ text: p.techAlert, content: p.techAlert }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.warn(`[notify] webhook returned HTTP ${res.status}`);
  } catch (err) {
    console.warn(`[notify] webhook failed: ${(err as Error).message}`);
  }
}
