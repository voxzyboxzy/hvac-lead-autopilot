// server.ts — the same pipeline behind a webhook, like n8n's Webhook node.
//   npm run server
//   curl -X POST localhost:3000/lead -H "Content-Type: application/json" -d '{"name":"Ana","message":"No AC, baby at home"}'

import { createServer } from "node:http";
import { processLead } from "./pipeline.ts";

const PORT = Number(process.env.PORT ?? 3000);

createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/lead") {
    res.writeHead(404).end("POST /lead only");
    return;
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  try {
    const result = await processLead(JSON.parse(body));
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result, null, 2));
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: (err as Error).message }));
  }
}).listen(PORT, () => console.log(`Listening on http://localhost:${PORT}/lead`));
