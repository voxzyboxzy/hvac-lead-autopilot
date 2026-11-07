# Verification log (Nov 7, 2026 9:46 AM ET)

## npm test
```
✔ n8n: AI node deactivated -> rules engine, Spanish emergency (1.012336ms)
✔ n8n: valid AI answer is used (0.215316ms)
✔ n8n: AI error output -> rules fallback + flagged for review (0.242842ms)
✔ n8n: AI says routine for a gas leak -> guardrail forces emergency (0.412756ms)
✔ n8n: empty message is marked invalid (10.336884ms)
✔ Spanish no-AC call with a baby is an emergency, answered in Spanish (1.664134ms)
✔ gas smell always gets safety instructions (0.342561ms)
✔ tune-up is routine and scheduled on business days (9.879054ms)
✔ vague message with no contact info is flagged for a human (0.490754ms)
✔ blank message is rejected (0.372796ms)
✔ phone numbers are cleaned up, including ones typed inside the message (0.178254ms)
✔ if the AI call fails, the rules fallback takes over and flags review (0.743679ms)
✔ AI cannot downgrade a gas report (safety guardrail) (20.248003ms)
✔ off-spec AI output is rejected (0.359005ms)
✔ language detection (0.451033ms)
✔ duplicate form submissions are not logged twice (0.994768ms)
ℹ tests 16
ℹ pass 16
ℹ fail 0
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

## Real n8n run (n8n 2.46.6, self-hosted locally, Google Sheet node deactivated, OpenAI node active without a key, Discord URL left as placeholder)
- Spanish no-AC lead: emergency, es reply, classified_by "rules-fallback", needs_review YES ("AI was down, rules were used"). The failed Discord ping did not block the response.
- Gas lead (AI node off): emergency + gas_or_co_safety + "leave the house now" reply
- Tune-up lead: routine/maintenance, window "Wed, Nov 11 - Mon, Nov 16"
- Blank message: HTTP 400 {"error":"Lead is missing a message"}
