// classify.ts — asks an LLM to triage the lead, checks its answer, and falls back
// to the rules engine if anything goes wrong. The workflow should never crash
// just because the AI had a bad day.

import type { JobType, Lead, Triage, Urgency } from "./types.ts";
import { classifyWithRules, isSafetyHazard } from "./rules.ts";

const URGENCIES: Urgency[] = ["emergency", "urgent", "routine"];
const JOB_TYPES: JobType[] = ["no_heat", "no_cooling", "gas_or_co_safety", "water_leak", "noise_or_smell", "thermostat", "maintenance", "install_quote", "other"];

export const SYSTEM_PROMPT = `You triage inbound service requests for a small residential HVAC company in South Florida.
Return ONLY a JSON object with these keys:
- urgency: "emergency" (gas/CO smell, no heat or no AC with a baby/elderly/medical need, active flooding), "urgent" (no heat, no cooling, water leak), or "routine" (tune-ups, quotes, noises, thermostat questions)
- jobType: one of ${JOB_TYPES.join(", ")}
- language: "en" or "es" — the language the customer wrote in
- summary: one short line a technician can read in 3 seconds
- equipment: the equipment mentioned (e.g. "heat pump"), or null
- preferredTime: any timing the customer asked for, or null
- confidence: a number from 0 to 1`;

export async function classifyLead(lead: Lead, opts: { apiKey?: string; model?: string; fetchFn?: typeof fetch } = {}): Promise<Triage> {
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;

  // No key? Use the free rules engine (this is the "mock LLM").
  let triage: Triage;
  if (!apiKey) {
    triage = classifyWithRules(lead.message);
  } else {
    try {
      triage = await classifyWithLLM(lead, apiKey, opts.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini", opts.fetchFn ?? fetch);
    } catch (err) {
      // Network error, bad JSON, rate limit, timeout... log it and keep going with rules.
      console.warn(`[classify] AI failed for lead ${lead.id}: ${(err as Error).message} — using rules fallback`);
      triage = { ...classifyWithRules(lead.message), classifiedBy: "rules-fallback" };
    }
  }

  // GUARDRAIL: never let anything downgrade a gas / CO report.
  if (isSafetyHazard(lead.message)) {
    triage = { ...triage, urgency: "emergency", jobType: "gas_or_co_safety" };
  }
  return triage;
}

async function classifyWithLLM(lead: Lead, apiKey: string, model: string, fetchFn: typeof fetch): Promise<Triage> {
  const res = await fetchFn("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Customer message:\n"""${lead.message}"""` },
      ],
    }),
    signal: AbortSignal.timeout(15_000), // don't hang forever
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);

  const data = (await res.json()) as any;
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  return validateTriage(parsed);
}

/** Never trust AI output blindly: check every field and reject anything off-spec. */
export function validateTriage(raw: any): Triage {
  if (!URGENCIES.includes(raw.urgency)) throw new Error(`invalid urgency "${raw.urgency}"`);
  if (!JOB_TYPES.includes(raw.jobType)) throw new Error(`invalid jobType "${raw.jobType}"`);
  if (raw.language !== "en" && raw.language !== "es") throw new Error(`invalid language "${raw.language}"`);
  const confidence = Number(raw.confidence);
  return {
    urgency: raw.urgency,
    jobType: raw.jobType,
    language: raw.language,
    summary: String(raw.summary ?? "").slice(0, 200) || raw.jobType,
    equipment: raw.equipment || undefined,
    preferredTime: raw.preferredTime || undefined,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
    classifiedBy: "llm",
  };
}
