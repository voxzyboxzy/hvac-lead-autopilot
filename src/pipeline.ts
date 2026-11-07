// pipeline.ts — the whole workflow in one function. Read this file top to bottom
// and you've read the process map in the README:
//   1. validate input  2. AI triage  3. time window  4. review checks
//   5. draft reply     6. log to CRM 7. alert the tech

import type { Lead, ProcessedLead } from "./types.ts";
import { classifyLead } from "./classify.ts";
import { estimateTimeWindow, scheduleInstant } from "./schedule.ts";
import { draftReply } from "./reply.ts";
import { logToCrm } from "./crm.ts";
import { buildTechAlert, notifyTech } from "./notify.ts";

export interface PipelineOptions {
  now?: Date;            // pass a fixed time in tests so results are repeatable
  crmFile?: string;
  alertLogFile?: string;
  apiKey?: string;       // "" forces the rules engine
  saveAndNotify?: boolean; // false = dry run (no files written)
}

export async function processLead(input: Lead, opts: PipelineOptions = {}): Promise<ProcessedLead & { crm?: string }> {
  // Tests pass opts.now. Otherwise use when the lead arrived, then the current time.
  const now = scheduleInstant(input, opts.now);

  // 1. Validate + clean the input. A blank message is the one thing we can't work with.
  if (!input || typeof input.message !== "string" || input.message.trim() === "") {
    throw new Error("Lead is missing a message");
  }
  const lead: Lead = {
    ...input,
    id: input.id || `lead-${now.getTime()}`,
    name: input.name?.trim(),
    phone: normalizePhone(input.phone ?? findPhone(input.message)),
    message: input.message.trim(),
  };

  // 2. AI triage (falls back to rules automatically).
  const triage = await classifyLead(lead, { apiKey: opts.apiKey });

  // 3. Time window.
  const timeWindow = estimateTimeWindow(triage.urgency, now);

  // 4. Human-in-the-loop checks: when should a person look before we reply?
  const reviewReasons: string[] = [];
  if (triage.confidence < 0.6) reviewReasons.push("low AI confidence");
  if (!lead.phone && !lead.email) reviewReasons.push("no way to contact customer");
  if (!lead.address && triage.urgency !== "routine") reviewReasons.push("no address for a dispatch");
  if (triage.classifiedBy === "rules-fallback") reviewReasons.push("AI was down, rules were used");
  if (triage.jobType === "install_quote") reviewReasons.push("sales lead — owner sets the quote");

  // 5-7. Draft reply, then save + notify.
  const base = {
    lead, triage, timeWindow,
    needsHumanReview: reviewReasons.length > 0,
    reviewReasons,
    replyDraft: draftReply(lead, triage, timeWindow),
    processedAt: now.toISOString(),
  };
  const result: ProcessedLead & { crm?: string } = { ...base, techAlert: buildTechAlert(base) };

  if (opts.saveAndNotify !== false) {
    result.crm = logToCrm(result, opts.crmFile);
    if (result.crm === "added") await notifyTech(result, { logFile: opts.alertLogFile });
  }
  return result;
}

/** Find a US phone number written inside the message, e.g. "call me at 305 555 1234". */
function findPhone(text: string): string | undefined {
  return text.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0];
}

/** Turn any US phone format into (305) 555-1234. Returns undefined if it isn't 10 digits. */
export function normalizePhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return undefined;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
