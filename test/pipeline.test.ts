// pipeline.test.ts — run with: npm test
// Each test is one "bad day" the workflow has to survive, not just the happy path.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { processLead, normalizePhone } from "../src/pipeline.ts";
import { classifyLead, validateTriage } from "../src/classify.ts";
import { classifyWithRules, detectLanguage } from "../src/rules.ts";

// Monday Nov 9, 2026, 9:00 AM America/New_York. An absolute instant, so the
// machine's timezone cannot move the business-day window.
const MONDAY_9AM = new Date("2026-11-09T14:00:00.000Z");
const dryRun = { now: MONDAY_9AM, apiKey: "", saveAndNotify: false };

test("Spanish no-AC call with a baby is an emergency, answered in Spanish", async () => {
  const r = await processLead({ id: "t1", name: "Maria", phone: "305-555-0198", address: "1 Main St",
    message: "Hola, el aire acondicionado no enfria y tengo un bebe en la casa" }, dryRun);
  assert.equal(r.triage.language, "es");
  assert.equal(r.triage.jobType, "no_cooling");
  assert.equal(r.triage.urgency, "emergency");
  assert.match(r.replyDraft, /^Hola Maria/);
  assert.equal(r.needsHumanReview, false);
});

test("gas smell always gets safety instructions", async () => {
  const r = await processLead({ id: "t2", name: "James", phone: "7865550111", address: "2 Main St",
    message: "I smell gas near the furnace" }, dryRun);
  assert.equal(r.triage.urgency, "emergency");
  assert.equal(r.triage.jobType, "gas_or_co_safety");
  assert.match(r.replyDraft, /leave the house now and call 911/);
});

test("tune-up is routine and scheduled on business days", async () => {
  const r = await processLead({ id: "t3", name: "Linda", email: "l@example.com",
    message: "Book a tune-up for my heat pump, tomorrow morning if possible" }, dryRun);
  assert.equal(r.triage.urgency, "routine");
  assert.equal(r.triage.jobType, "maintenance");
  assert.equal(r.triage.equipment, "heat pump");
  assert.equal(r.triage.preferredTime, "tomorrow morning");
  assert.match(r.timeWindow, /^Wed, Nov 11 - Mon, Nov 16/); // Mon + 2 business days .. + 5 (skips weekend)
});

test("vague message with no contact info is flagged for a human", async () => {
  const r = await processLead({ id: "t4", name: "Sam", message: "call me back about my unit" }, dryRun);
  assert.equal(r.needsHumanReview, true);
  assert.ok(r.reviewReasons.includes("low AI confidence"));
  assert.ok(r.reviewReasons.includes("no way to contact customer"));
});

test("blank message is rejected", async () => {
  await assert.rejects(processLead({ id: "t5", message: "   " }, dryRun), /missing a message/);
});

test("phone numbers are cleaned up, including ones typed inside the message", async () => {
  assert.equal(normalizePhone("305.555.0123"), "(305) 555-0123");
  assert.equal(normalizePhone("+1 305 555 0123"), "(305) 555-0123");
  assert.equal(normalizePhone("555-0123"), undefined);
  const r = await processLead({ id: "t6", message: "AC not cooling, call 305 555 0100" }, dryRun);
  assert.equal(r.lead.phone, "(305) 555-0100");
});

test("if the AI call fails, the rules fallback takes over and flags review", async () => {
  const brokenFetch = (async () => { throw new Error("network down"); }) as unknown as typeof fetch;
  const t = await classifyLead({ id: "t7", message: "No heat in the house" }, { apiKey: "fake", fetchFn: brokenFetch });
  assert.equal(t.classifiedBy, "rules-fallback");
  assert.equal(t.jobType, "no_heat");
});

test("AI cannot downgrade a gas report (safety guardrail)", async () => {
  // Fake AI that wrongly says "routine maintenance".
  const wrongAI = (async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(
    { urgency: "routine", jobType: "maintenance", language: "en", summary: "checkup", confidence: 0.9 }) } }] }))) as unknown as typeof fetch;
  const t = await classifyLead({ id: "t8", message: "Smells like gas, also want a checkup" }, { apiKey: "fake", fetchFn: wrongAI });
  assert.equal(t.classifiedBy, "llm");
  assert.equal(t.urgency, "emergency");
  assert.equal(t.jobType, "gas_or_co_safety");
});

test("off-spec AI output is rejected", () => {
  assert.throws(() => validateTriage({ urgency: "super urgent", jobType: "no_heat", language: "en" }), /invalid urgency/);
  assert.throws(() => validateTriage({ urgency: "urgent", jobType: "pool", language: "en" }), /invalid jobType/);
});

test("language detection", () => {
  assert.equal(detectLanguage("Mi casa no tiene calefacción, por favor"), "es");
  assert.equal(detectLanguage("My furnace is making a banging noise"), "en");
  assert.equal(classifyWithRules("My furnace is making a banging noise").jobType, "noise_or_smell");
});

test("duplicate form submissions are not logged twice", async () => {
  const dir = mkdtempSync(join(tmpdir(), "crm-"));
  const opts = { now: MONDAY_9AM, apiKey: "", crmFile: join(dir, "leads.csv"), alertLogFile: join(dir, "alerts.log") };
  const lead = { id: "dup-1", name: "Ana", phone: "3055550100", address: "3 Main St", message: "No heat" };
  assert.equal((await processLead(lead, opts)).crm, "added");
  assert.equal((await processLead(lead, opts)).crm, "duplicate");
  const rows = readFileSync(opts.crmFile, "utf8").trim().split("\n");
  assert.equal(rows.length, 2); // header + 1 row
});
