# SETUP: get it running in n8n and record a 2-minute demo

Plain steps, about 30-45 minutes total. You don't need to pay for anything.

---

## Part 1: Try the code version (5 min)

1. Install **Node.js 22 LTS or newer** from https://nodejs.org (the green "LTS" button).
2. Open a terminal in this folder and run:
   ```bash
   npm start
   npm test
   ```
   You should see 8 leads processed and `pass 19`. The results are in `output/leads.csv` (opens in Excel).

---

## Part 2: Get n8n running (pick ONE option)

**Option A: n8n Cloud free trial (easiest, nothing to install)**
1. Go to https://n8n.io and click **Get started**. Sign up with your email. The trial is free; don't enter a card if it doesn't ask.
2. You land in the n8n editor.

**Option B: on your own computer, free forever**
- With Node installed, run `npx n8n` and open http://localhost:5678
- Or with Docker: `docker run -it --rm -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n`
- Create the local owner account it asks for (it stays on your computer).

---

## Part 3: Import the workflow (5 min)

1. In n8n, click **Create Workflow** (or **+** → Workflow).
2. Click the **⋯** menu at the top right → **Import from File…** → pick `n8n/hvac-lead-autopilot.workflow.json`.
   (Or open the file in Notepad, copy everything, and paste it straight onto the n8n canvas with Ctrl+V.)
3. You'll see 11 nodes from left to right, plus a yellow note. Click **Save**.

---

## Part 4: Connect the 3 outside services (each one is optional)

The workflow runs even if you skip all three:

| Node | To make it work | If you skip it |
|---|---|---|
| **AI Triage (OpenAI)** | Get an API key at https://platform.openai.com/api-keys (needs a few dollars of credit). In the node: **Credential → Create new → Header Auth**, Name = `Authorization`, Value = `Bearer sk-...your key...` | Right-click the node → **Deactivate**. It then runs on the free rules engine |
| **Log to CRM (Google Sheet)** | Make a Google Sheet, name the tab `Leads`, and put these headers in row 1: `lead_id, received_at, name, phone, email, address, message, language, urgency, job_type, summary, time_window, needs_review, review_reasons, classified_by, confidence, reply_draft, status, tech_alert`. In the node: sign in with Google, then paste the sheet's URL | Deactivate it |
| **Ping On-Call Tech** | In Discord: Server Settings → Integrations → Webhooks → New Webhook → Copy URL, then paste it into the node's URL field (a Slack incoming webhook works too) | Leave it. A failed ping doesn't break anything |

> Don't want to pay for OpenAI? Deactivate the AI node. The demo still shows everything: the Spanish detection, the gas guardrail and the dedupe. Just say "it's on the rules fallback right now".

---

## Part 5: Test it (5 min)

1. Click **Test workflow** (or **Execute workflow**). The Webhook node starts listening.
2. Open the **Webhook** node and copy the **Test URL**.
3. Send a fake lead. On Windows PowerShell:
   ```powershell
   $url = "PASTE_TEST_URL_HERE"
   Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body '{"id":"DEMO-1","name":"Maria Gonzalez","phone":"305-555-0198","address":"1420 SE 12th Ave, Homestead","message":"Hola, el aire acondicionado no enfria y tengo un bebe en la casa, por favor"}'
   ```
   On Mac/Linux use curl:
   ```bash
   curl -X POST "PASTE_TEST_URL_HERE" -H "Content-Type: application/json" -d '{"id":"DEMO-1","name":"Maria Gonzalez","phone":"305-555-0198","address":"1420 SE 12th Ave, Homestead","message":"Hola, el aire acondicionado no enfria y tengo un bebe en la casa, por favor"}'
   ```
4. Every node turns green, and you get back JSON with `"urgency":"emergency"` and a Spanish `reply_draft`. Click any node to see its data.
5. More leads to try (change the `id` each time):
   - Gas: `"message":"I smell gas near the furnace"` → emergency + "leave the house" reply
   - Routine: `"message":"Book a tune-up for my heat pump"` → a date range 2-5 business days out
   - Vague: `"name":"Sam","message":"call me about my unit"` (no phone) → `needs_review: YES`
   - Send DEMO-1 again → the sheet updates the same row instead of adding a duplicate

(This exact workflow was test-run on n8n 2.46.6 with the AI node on and no key. It fell back to the rules correctly, and the empty-message request got a 400.)

---

## Part 6: Record the 2-minute demo

Free tools: **Loom** (loom.com), **OBS**, or Windows **Win+Alt+R** (Xbox Game Bar). Have the n8n canvas, the Google Sheet and Discord open side by side.

| Time | Show | Say |
|---|---|---|
| 0:00-0:15 | Your face, or the canvas | "Hi, I'm Gabriel. Small HVAC shops lose jobs because nobody answers leads fast. I built an AI workflow that handles the first five minutes of every lead." |
| 0:15-0:40 | Walk the canvas left to right | "Request comes in, AI triages urgency, job type and language. Then my validation step. If the AI fails or gives junk, a rules engine takes over." |
| 0:40-1:05 | Send the Spanish no-AC lead | "Spanish message, baby at home, so it's an emergency. The reply is drafted in Spanish, the tech gets pinged, and here's the row in the CRM." |
| 1:05-1:30 | Send the gas lead | "Gas smell. Even if the AI calls it routine, my guardrail forces an emergency and the reply starts with safety instructions." |
| 1:30-1:50 | Resend DEMO-1, then the vague lead | "Double-submitted form, so no duplicate row. Vague lead with no phone, so it's flagged for the office instead of guessing." |
| 1:50-2:00 | README diagram | "Replies are drafts. A person approves them. Next I'd connect it to Housecall Pro or Jobber. Thanks!" |

Upload it to Loom or YouTube (**Unlisted**) and put the link at the top of your README.

---

## Part 7: Put it on GitHub

1. Create a free account at https://github.com if you don't have one.
2. Click **New repository**, name it `hvac-lead-autopilot`, make it **Public**, and create it.
3. Click **uploading an existing file** and drag in everything in this folder **except** `output/` and any `.env` file. Never upload your API key.
4. Add the repo link and the demo video link to your resume and your WorkHero application.
