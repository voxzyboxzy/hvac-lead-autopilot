# Verification log (Nov 7, 2026, America/New_York)

Node.js 22. `npm test` is `node --test test/*.test.ts` (19 passing, including CLI/n8n schedule parity). `npm start` processes `data/sample-leads.json` with the rules engine.

## npm test

```
✔ n8n: AI node deactivated -> rules engine, Spanish emergency (10.239498ms)
✔ n8n: valid AI answer is used (0.325681ms)
✔ n8n: AI error output -> rules fallback + flagged for review (0.401119ms)
✔ n8n: AI says routine for a gas leak -> guardrail forces emergency (0.375076ms)
✔ n8n: empty message is marked invalid (0.541233ms)
[classify] AI failed for lead t7: network down — using rules fallback
✔ Spanish no-AC call with a baby is an emergency, answered in Spanish (11.428859ms)
✔ gas smell always gets safety instructions (0.556736ms)
✔ tune-up is routine and scheduled on business days (0.725269ms)
✔ vague message with no contact info is flagged for a human (0.504978ms)
✔ blank message is rejected (0.392267ms)
✔ phone numbers are cleaned up, including ones typed inside the message (0.28646ms)
✔ if the AI call fails, the rules fallback takes over and flags review (0.705966ms)
✔ AI cannot downgrade a gas report (safety guardrail) (13.747588ms)
✔ off-spec AI output is rejected (0.351504ms)
✔ language detection (0.308774ms)
✔ duplicate form submissions are not logged twice (1.127788ms)
✔ sample leads: CLI pipeline and n8n code nodes schedule the same window (14.136647ms)
✔ injected shop clocks match, including Nov 11-16 vs Nov 10-13 (1.412022ms)
✔ workflow JSON reply node is the generated scheduler, not a second copy (0.551308ms)
ℹ tests 19
ℹ suites 0
ℹ pass 19
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 264.416241
```

## npm start

```

HVAC Lead Autopilot — processing 8 leads using rules engine (mock AI — no API key set)

━━ L-1001 | EMERGENCY | no_cooling | es | via rules | CRM: added
   Window : Today — on-call tech dispatched, arrival within 2-4 hours
   Reply  : Hola Maria, le habla Homestead Comfort HVAC. Recibimos su mensaje y lo tratamos como emergencia. Nuestro técnico va en camino y llegará en 2-4 horas. Le avisaremos por texto cuando esté cerca. Preguntas: (305) 555-0142.

━━ L-1002 | EMERGENCY | gas_or_co_safety | en | via rules | CRM: added
   Window : Today — on-call tech dispatched, arrival within 2-4 hours
   Reply  : Hi James, this is Homestead Comfort HVAC. If you smell gas or your CO alarm is going off, please leave the house now and call 911 or your gas company from outside. Don't flip switches or use flames. Our on-call tech is on the way, arriving within 2-4 hours. Call us at (305) 555-0142 anytime.

━━ L-1003 | ROUTINE | maintenance | en | via rules | CRM: added
   Window : Wed, Nov 11 - Mon, Nov 16 — office will offer a 2-hour arrival window
   Reply  : Hi Linda, thanks for contacting Homestead Comfort HVAC! We'd be glad to help with your tune-up. Our next openings are Wed, Nov 11 - Mon, Nov 16 — office will offer a 2-hour arrival window. Reply with a day that works and we'll book it.

━━ L-1004 | URGENT | water_leak | es | via rules | CRM: added
   Window : Today — afternoon slot (12pm-6pm)
   Review : no address for a dispatch
   Reply  : Hola Roberto, gracias por contactar a Homestead Comfort HVAC. Podemos enviarle un técnico: hoy en la tarde (12pm-6pm). Responda SÍ para confirmar o díganos otra hora.

━━ L-1005 | ROUTINE | install_quote | en | via rules | CRM: added
   Window : Wed, Nov 11 - Mon, Nov 16 — office will offer a 2-hour arrival window
   Review : sales lead — owner sets the quote
   Reply  : Hi Kevin, thanks for contacting Homestead Comfort HVAC! We'd be glad to help with your new system estimate. Our next openings are Wed, Nov 11 - Mon, Nov 16 — office will offer a 2-hour arrival window. Reply with a day that works and we'll book it.

━━ L-1006 | ROUTINE | other | en | via rules | CRM: added
   Window : Wed, Nov 11 - Mon, Nov 16 — office will offer a 2-hour arrival window
   Review : low AI confidence; no way to contact customer
   Reply  : Hi Sam, thanks for contacting Homestead Comfort HVAC! We'd be glad to help with your request. Our next openings are Wed, Nov 11 - Mon, Nov 16 — office will offer a 2-hour arrival window. Reply with a day that works and we'll book it.

━━ L-1001 | EMERGENCY | no_cooling | es | via rules | CRM: duplicate — skipped, no 2nd alert
   Window : Today — on-call tech dispatched, arrival within 2-4 hours
   Reply  : Hola Maria, le habla Homestead Comfort HVAC. Recibimos su mensaje y lo tratamos como emergencia. Nuestro técnico va en camino y llegará en 2-4 horas. Le avisaremos por texto cuando esté cerca. Preguntas: (305) 555-0142.

✖ L-1007 skipped: Lead is missing a message

Done: 7 processed, 3 flagged for office review, 1 rejected.
CRM: output/leads.csv | Tech alerts: output/tech-alerts.log
```

Routine sample leads (L-1003, L-1005, L-1006) arrive Monday, Nov 9, 2026 Eastern. Both the CLI and the n8n code nodes schedule them **Wed, Nov 11 – Mon, Nov 16**.

## Why the Nov 7 demo showed Tue, Nov 10 – Fri, Nov 13

[`docs/demo-results.png`](demo-results.png) is that local demo (Nov 7, 2026, 9:58 AM ET). The four webhook bodies did not include `receivedAt`, so the old n8n node scheduled from that Saturday morning: **Tue, Nov 10 – Fri, Nov 13**. The same instant now produces that window on both the CLI and the n8n code node. The sample file's Monday arrival time still produces Wed, Nov 11 – Mon, Nov 16 on both.
