// n8n-code.test.ts — runs the JavaScript from the n8n Code nodes outside n8n,
// chaining them like the workflow does, so the n8n version is tested too.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const load = (f: string) => readFileSync(new URL(`../n8n/code/${f}`, import.meta.url), "utf8");
// Turn a Code node's script into a function of ($json, $) — the two n8n helpers it uses.
const asFn = (src: string) => new Function("$json", "$", src) as (json: any, $: any) => { json: any };
const validate = asFn(load("1-validate-lead.js"));
const checkAI = asFn(load("2-check-ai.js"));
const buildReply = asFn(load("3-build-reply.js"));

/** Run the 3 Code nodes in order. `aiOutput` is what the OpenAI node returned (or null = node deactivated). */
function runWorkflow(body: any, aiOutput: any | null) {
  const v = validate({ body }, null).json;
  const $ = (name: string) => ({ item: { json: name === "Validate & Clean Lead" ? v : {} } });
  const c = checkAI(aiOutput ?? v, $).json;
  return { valid: v.valid, row: buildReply(c, $).json };
}
const aiSays = (obj: any) => ({ choices: [{ message: { content: JSON.stringify(obj) } }] });

const maria = { id: "L-1", name: "Maria Gonzalez", phone: "1-305-555-0198", address: "1 Main", receivedAt: "2026-11-09T09:00:00-05:00",
  message: "Hola, el aire acondicionado no enfria y tengo un bebe en la casa, por favor" };

test("n8n: AI node deactivated -> rules engine, Spanish emergency", () => {
  const { row } = runWorkflow(maria, null);
  assert.equal(row.classified_by, "rules");
  assert.equal(row.urgency, "emergency");
  assert.equal(row.language, "es");
  assert.equal(row.phone, "(305) 555-0198");
  assert.match(row.reply_draft, /^Hola Maria/);
});

test("n8n: valid AI answer is used", () => {
  const { row } = runWorkflow(maria, aiSays({ urgency: "emergency", jobType: "no_cooling", language: "es", summary: "No AC, infant in home", confidence: 0.95 }));
  assert.equal(row.classified_by, "llm");
  assert.equal(row.summary, "No AC, infant in home");
  assert.equal(row.needs_review, "no");
});

test("n8n: AI error output -> rules fallback + flagged for review", () => {
  const { row } = runWorkflow(maria, { error: { message: "401 Unauthorized" } });
  assert.equal(row.classified_by, "rules-fallback");
  assert.match(row.review_reasons, /AI was down/);
});

test("n8n: AI says routine for a gas leak -> guardrail forces emergency", () => {
  const { row } = runWorkflow({ id: "L-2", name: "James", phone: "7865550111", address: "2 Main", message: "I smell gas by the furnace" },
    aiSays({ urgency: "routine", jobType: "maintenance", language: "en", summary: "checkup", confidence: 0.9 }));
  assert.equal(row.urgency, "emergency");
  assert.equal(row.job_type, "gas_or_co_safety");
  assert.match(row.reply_draft, /leave the house now/);
});

test("n8n: empty message is marked invalid", () => {
  assert.equal(runWorkflow({ id: "L-3", message: "  " }, null).valid, false);
});
