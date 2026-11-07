# Interview talking points: HVAC Lead Autopilot

**30-second pitch**
"I built an AI workflow for small HVAC shops. A service request comes in from a form or text. AI figures out how urgent it is, what kind of job it is, and whether the customer wrote in English or Spanish. It logs the lead in a mini CRM, drafts a reply in the customer's language, and pings the on-call tech if it's urgent. I built it twice, once in n8n and once as a TypeScript script, and I tested it on the bad days, not just the clean demo."

**Why HVAC?** I grew up working on diesel engines with my dad and took HVAC coursework. Tradespeople are great at the work and buried in the admin. I've seen it firsthand.

**Process thinking.** I mapped the before (inbox → owner guesses urgency → maybe calls back) and the after. Then I found the structure hiding in the mess: every lead needs the same 7 steps. That's in the README diagram.

**Reliability, not just a demo.** These are the edge cases I handle:
- AI down, slow or returning junk → validate every field, fall back to keyword rules, flag for a human.
- AI says a gas leak is "routine" → a safety guardrail overrides it. I wrote a test where the AI is wrong on purpose.
- Double-submitted forms → the CRM dedupes by lead id, so there's no duplicate row and no second 2am text to the tech.
- No phone, no address, vague message → flagged for the office instead of guessing.
- A failed Slack/Discord ping never loses the lead.

**Human in the loop.** Replies are drafted, never auto-sent. Sales quotes always go to the owner. That matches how WorkHero pairs AI with office managers.

**A bug the tests caught.** "Tune-up for my heat pump" got classified as a new-system sales quote because "heat pump" was a quote keyword. I reordered the rules and added a test. That's why I test real messages.

**Bilingual.** I'm fluent in Spanish. In South Florida a lot of customers text in Spanish, so the replies come back in their language. Safety instructions too.

**Generalizing.** Next step: move business hours, service area and job types into a per-company config, so one workflow serves many shops instead of a custom build for each one.

**What I'd ask an engineer for.** An API to read real open slots from the dispatch board, and a webhook when the office approves a draft.

**Questions to ask them**
- How do you measure whether an automation is "right" in production? Do you track office-manager overrides?
- Which workflows repeat most across accounts right now: invoicing, permits or rebates?
- What does the first 30 days look like for a new automation engineer?
