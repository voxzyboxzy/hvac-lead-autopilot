// run.ts — command line runner: node src/run.ts data/sample-leads.json
// Processes every lead in the file and prints a readable report.

import { readFileSync } from "node:fs";
import type { Lead } from "./types.ts";
import { processLead } from "./pipeline.ts";

const file = process.argv[2] ?? "data/sample-leads.json";
const leads: Lead[] = JSON.parse(readFileSync(file, "utf8"));
const mode = process.env.OPENAI_API_KEY ? "OpenAI" : "rules engine (mock AI — no API key set)";
console.log(`HVAC Lead Autopilot — processing ${leads.length} leads using ${mode}\n`);

let ok = 0, failed = 0, review = 0;
for (const lead of leads) {
  try {
    const r = await processLead(lead);
    ok++;
    if (r.needsHumanReview) review++;
    console.log(`━━ ${r.lead.id} | ${r.triage.urgency.toUpperCase()} | ${r.triage.jobType} | ${r.triage.language} | via ${r.triage.classifiedBy} | CRM: ${r.crm === "duplicate" ? "duplicate — skipped, no 2nd alert" : r.crm}`);
    console.log(`   Window : ${r.timeWindow}`);
    if (r.needsHumanReview) console.log(`   Review : ${r.reviewReasons.join("; ")}`);
    console.log(`   Reply  : ${r.replyDraft}\n`);
  } catch (err) {
    // One bad lead must never stop the others.
    failed++;
    console.log(`✖ ${lead?.id ?? "unknown"} skipped: ${(err as Error).message}\n`);
  }
}
console.log(`Done: ${ok} processed, ${review} flagged for office review, ${failed} rejected.`);
console.log(`CRM: output/leads.csv | Tech alerts: output/tech-alerts.log`);
