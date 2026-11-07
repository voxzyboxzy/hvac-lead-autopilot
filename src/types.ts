// types.ts — the shapes of data that move through the pipeline.
// Keeping these in one place makes the whole flow easy to follow.

/** A raw service request, exactly as it arrives from a web form, text, or webhook. */
export interface Lead {
  id: string;            // unique id from the form tool (used to avoid logging the same lead twice)
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  message: string;       // what the customer typed — the only field we can always count on
  source?: string;       // "website form", "google ads", "sms", ...
  receivedAt?: string;   // ISO timestamp
}

export type Urgency = "emergency" | "urgent" | "routine";

export type JobType =
  | "no_heat"
  | "no_cooling"
  | "gas_or_co_safety"
  | "water_leak"
  | "noise_or_smell"
  | "thermostat"
  | "maintenance"
  | "install_quote"
  | "other";

export type Language = "en" | "es";

/** What the AI (or the rules fallback) decides about a lead. */
export interface Triage {
  urgency: Urgency;
  jobType: JobType;
  language: Language;
  summary: string;            // one-line summary for the tech
  equipment?: string;         // e.g. "heat pump", "furnace", "mini split"
  preferredTime?: string;     // anything the customer said about timing
  confidence: number;         // 0..1 — how sure we are
  classifiedBy: "llm" | "rules" | "rules-fallback";
}

/** Final record that goes into the mini CRM and back to whoever called us. */
export interface ProcessedLead {
  lead: Lead;
  triage: Triage;
  timeWindow: string;          // e.g. "Today, within 2-4 hours"
  needsHumanReview: boolean;   // true = an office manager should look before anything goes out
  reviewReasons: string[];
  replyDraft: string;          // drafted, NOT sent — a human approves it
  techAlert: string;           // short message for the on-call tech
  processedAt: string;
}
