// build-workflow.mjs — writes hvac-lead-autopilot.workflow.json from the code/*.js files,
// so the JavaScript inside the n8n Code nodes stays readable and testable.
//   node n8n/build-workflow.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url);
const code = (f) => readFileSync(new URL(`code/${f}`, dir), 'utf8');

const SYSTEM_PROMPT = readFileSync(new URL('../src/classify.ts', dir), 'utf8')
  .match(/SYSTEM_PROMPT = `([\s\S]*?)`;/)[1]
  .replace('${JOB_TYPES.join(", ")}', 'no_heat, no_cooling, gas_or_co_safety, water_leak, noise_or_smell, thermostat, maintenance, install_quote, other');

const node = (id, name, type, typeVersion, position, parameters, extra = {}) => ({ id, name, type, typeVersion, position, parameters, ...extra });

const nodes = [
  node('a1', 'New Service Request (Webhook)', 'n8n-nodes-base.webhook', 2, [0, 300],
    { httpMethod: 'POST', path: 'hvac-lead', responseMode: 'responseNode', options: {} }, { webhookId: 'hvac-lead-autopilot' }),
  node('a2', 'Validate & Clean Lead', 'n8n-nodes-base.code', 2, [220, 300],
    { mode: 'runOnceForEachItem', jsCode: code('1-validate-lead.js') }),
  node('a3', 'Has a Message?', 'n8n-nodes-base.if', 2, [440, 300], {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
      conditions: [{ id: 'c1', leftValue: '={{ $json.valid }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
      combinator: 'and',
    },
    options: {},
  }),
  node('a4', 'Reject Empty Request', 'n8n-nodes-base.respondToWebhook', 1.1, [660, 500],
    { respondWith: 'json', responseBody: '={{ { "error": "Lead is missing a message" } }}', options: { responseCode: 400 } }),
  node('a5', 'AI Triage (OpenAI)', 'n8n-nodes-base.httpRequest', 4.2, [660, 200], {
    method: 'POST',
    url: 'https://api.openai.com/v1/chat/completions',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({ model: "gpt-4o-mini", temperature: 0, response_format: { type: "json_object" }, messages: [ { role: "system", content: ${JSON.stringify(SYSTEM_PROMPT)} }, { role: "user", content: "Customer message:\\n" + $json.lead.message } ] }) }}`,
    options: { timeout: 15000 },
  }, { onError: 'continueRegularOutput', retryOnFail: true, maxTries: 2, waitBetweenTries: 2000,
       notes: 'Needs a Header Auth credential: Name = Authorization, Value = Bearer sk-... . No key? Deactivate this node and the workflow runs on the rules engine.' }),
  node('a6', 'Check AI Answer (fallback + guardrail)', 'n8n-nodes-base.code', 2, [880, 200],
    { mode: 'runOnceForEachItem', jsCode: code('2-check-ai.js') }),
  node('a7', 'Time Window, Review & Reply Draft', 'n8n-nodes-base.code', 2, [1100, 200],
    { mode: 'runOnceForEachItem', jsCode: code('3-build-reply.js') }),
  node('a8', 'Log to CRM (Google Sheet)', 'n8n-nodes-base.googleSheets', 4.5, [1320, 200], {
    operation: 'appendOrUpdate',
    documentId: { __rl: true, mode: 'url', value: '' },
    sheetName: { __rl: true, mode: 'name', value: 'Leads' },
    columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['lead_id'], schema: [] },
    options: {},
  }, { onError: 'continueRegularOutput', notes: 'appendOrUpdate on lead_id = a double-submitted form updates the same row instead of making a duplicate.' }),
  node('a9', 'Emergency or Urgent?', 'n8n-nodes-base.if', 2, [1540, 200], {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
      conditions: [{ id: 'c2', leftValue: "={{ $('Time Window, Review & Reply Draft').item.json.urgency }}", rightValue: 'routine', operator: { type: 'string', operation: 'notEquals' } }],
      combinator: 'and',
    },
    options: {},
  }),
  node('a10', 'Ping On-Call Tech (Slack/Discord)', 'n8n-nodes-base.httpRequest', 4.2, [1760, 100], {
    method: 'POST',
    url: 'https://discord.com/api/webhooks/REPLACE_WITH_YOUR_WEBHOOK',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ content: $('Time Window, Review & Reply Draft').item.json.tech_alert, text: $('Time Window, Review & Reply Draft').item.json.tech_alert }) }}",
    options: { timeout: 10000 },
  }, { onError: 'continueRegularOutput', notes: 'A failed ping never blocks the lead. Paste a Discord or Slack incoming-webhook URL.' }),
  node('a11', 'Send Result Back', 'n8n-nodes-base.respondToWebhook', 1.1, [1980, 300],
    { respondWith: 'json', responseBody: "={{ $('Time Window, Review & Reply Draft').item.json }}", options: {} }),
  node('n1', 'Sticky Note', 'n8n-nodes-base.stickyNote', 1, [-20, -60], {
    width: 760, height: 200,
    content: '## HVAC Lead Autopilot — by Gabriel Nadal\nWeb form / text → AI triage (urgency, job type, language) → validation + rules fallback + gas/CO safety guardrail → time window + human-review checks → bilingual reply DRAFT → Google Sheet mini-CRM (deduped by lead_id) → ping on-call tech for urgent jobs.\nReply drafts are never auto-sent: an office manager approves them.',
  }),
];

const connections = {
  'New Service Request (Webhook)': { main: [[{ node: 'Validate & Clean Lead', type: 'main', index: 0 }]] },
  'Validate & Clean Lead': { main: [[{ node: 'Has a Message?', type: 'main', index: 0 }]] },
  'Has a Message?': { main: [[{ node: 'AI Triage (OpenAI)', type: 'main', index: 0 }], [{ node: 'Reject Empty Request', type: 'main', index: 0 }]] },
  'AI Triage (OpenAI)': { main: [[{ node: 'Check AI Answer (fallback + guardrail)', type: 'main', index: 0 }]] },
  'Check AI Answer (fallback + guardrail)': { main: [[{ node: 'Time Window, Review & Reply Draft', type: 'main', index: 0 }]] },
  'Time Window, Review & Reply Draft': { main: [[{ node: 'Log to CRM (Google Sheet)', type: 'main', index: 0 }]] },
  'Log to CRM (Google Sheet)': { main: [[{ node: 'Emergency or Urgent?', type: 'main', index: 0 }]] },
  'Emergency or Urgent?': { main: [[{ node: 'Ping On-Call Tech (Slack/Discord)', type: 'main', index: 0 }], [{ node: 'Send Result Back', type: 'main', index: 0 }]] },
  'Ping On-Call Tech (Slack/Discord)': { main: [[{ node: 'Send Result Back', type: 'main', index: 0 }]] },
};

const workflow = { name: 'HVAC Lead Autopilot', nodes, connections, settings: { executionOrder: 'v1' }, pinData: {}, active: false, tags: [] };
writeFileSync(new URL('hvac-lead-autopilot.workflow.json', dir), JSON.stringify(workflow, null, 2) + '\n');
console.log(`Wrote n8n/hvac-lead-autopilot.workflow.json (${nodes.length} nodes)`);
