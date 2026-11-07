// schedule-parity.test.ts — the CLI and the n8n Code node must promise the same window.
// Both call the scheduler in src/schedule-core.js (the workflow copy is generated).
// Clocks are absolute instants, not `new Date(y, m, d)`, so the host timezone cannot move a day.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { processLead } from "../src/pipeline.ts";
import { estimateTimeWindow } from "../src/schedule.ts";

const load = (f: string) => readFileSync(new URL(`../n8n/code/${f}`, import.meta.url), "utf8");
const asFn = (src: string) => new Function("$json", "$", src) as (json: any, $: any) => { json: any };
const validate = asFn(load("1-validate-lead.js"));
const checkAI = asFn(load("2-check-ai.js"));
const buildReply = asFn(load("3-build-reply.js"));

function runWorkflow(body: any) {
  const v = validate({ body }, null).json;
  const $ = (name: string) => ({ item: { json: name === "Validate & Clean Lead" ? v : {} } });
  const c = checkAI(v, $).json;
  return buildReply(c, $).json;
}

/** Call the reply node with a fixed arrival time, skipping classification. */
function windowFromNode(urgency: "emergency" | "urgent" | "routine", receivedAt: string) {
  return buildReply({
    lead: {
      id: "sched", name: "Pat Example", phone: "(305) 555-0100", email: "", address: "1 Main",
      message: "tune-up", receivedAt,
    },
    triage: {
      urgency, language: "en", summary: "window check", confidence: 0.75, classifiedBy: "rules",
      jobType: urgency === "urgent" ? "water_leak" : "maintenance",
    },
  }, () => ({ item: { json: {} } })).json.time_window;
}

const leads = JSON.parse(readFileSync(new URL("../data/sample-leads.json", import.meta.url), "utf8"));

test("sample leads: CLI pipeline and n8n code nodes schedule the same window", async () => {
  let checked = 0;
  for (const lead of leads) {
    if (typeof lead.message !== "string" || lead.message.trim() === "") continue;
    const cli = await processLead(lead, { apiKey: "", saveAndNotify: false });
    const row = runWorkflow(lead);
    assert.equal(row.time_window, cli.timeWindow, lead.id);
    assert.equal(row.urgency, cli.triage.urgency, lead.id);
    checked++;
  }
  assert.equal(checked, 7);
});

test("injected shop clocks match, including Nov 11-16 vs Nov 10-13", () => {
  const monday9am = new Date("2026-11-09T14:00:00.000Z"); // Mon Nov 9, 9:00 AM ET — sample-file morning
  const saturdayDemo = new Date("2026-11-07T14:58:00.000Z"); // Sat Nov 7, 9:58 AM ET — local demo clock
  const sundayEveningEast = new Date("2026-11-09T03:30:00.000Z"); // Sun Nov 8, 10:30 PM ET (still Monday in UTC)
  const morningEast = new Date("2026-11-09T14:15:00.000Z"); // 9:15 AM ET, which is 14:15 UTC
  const afterTwo = new Date("2026-11-09T19:30:00.000Z"); // 2:30 PM ET

  const expectSame = (urgency: "routine" | "urgent", now: Date, expected: string) => {
    assert.equal(estimateTimeWindow(urgency, now), expected);
    assert.equal(windowFromNode(urgency, now.toISOString()), expected);
  };

  expectSame("routine", monday9am, "Wed, Nov 11 - Mon, Nov 16 — office will offer a 2-hour arrival window");
  expectSame("routine", saturdayDemo, "Tue, Nov 10 - Fri, Nov 13 — office will offer a 2-hour arrival window");
  // Same instant, two host timezones: Sunday evening in Homestead, Monday in UTC. Shop clock wins.
  expectSame("routine", sundayEveningEast, "Tue, Nov 10 - Fri, Nov 13 — office will offer a 2-hour arrival window");
  // 9:15 AM ET is before 2pm. A UTC host's getHours() is 14 and used to flip this to tomorrow.
  expectSame("urgent", morningEast, "Today — afternoon slot (12pm-6pm)");
  expectSame("urgent", afterTwo, "Tomorrow — first morning slot (8am-11am)");
});

test("workflow JSON reply node is the generated scheduler, not a second copy", () => {
  const wf = JSON.parse(readFileSync(new URL("../n8n/hvac-lead-autopilot.workflow.json", import.meta.url), "utf8"));
  const reply = wf.nodes.find((n: { name: string }) => n.name === "Time Window, Review & Reply Draft");
  const validateNode = wf.nodes.find((n: { name: string }) => n.name === "Validate & Clean Lead");
  assert.equal(reply.parameters.jsCode, load("3-build-reply.js"));
  assert.equal(validateNode.parameters.jsCode, load("1-validate-lead.js"));
  assert.match(reply.parameters.jsCode, /function estimateTimeWindow/);
  assert.doesNotMatch(reply.parameters.jsCode, /^export /m);
});
