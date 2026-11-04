// Ollama stand-in for the demo video. It replays the phi4-mini outputs of recordings.json, recorded
// during the reference run, so that the real Stajio server runs unchanged without minutes of CPU inference.
// Usage: node docs/demo/fake-ollama.mjs [port]
import http from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";

const port = Number(process.argv[2] || 11500);
const recordings = JSON.parse(readFileSync(path.join(import.meta.dirname, "recordings.json"), "utf8"));
const MODEL = "phi4-mini:latest";

// Each Stajio task has its own instructions (src/server/ai/prompts.ts).
function pick(prompt) {
  if (prompt.includes("Structure cette note")) return { content: recordings.structureLog, delayMs: 2600 };
  if (prompt.includes("Rédige uniquement la section « Missions réalisées »"))
    return { content: recordings.reportSection };
  if (prompt.includes("Transforme ces expériences")) return { content: recordings.cvPoints };
  return null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function chat(req, res) {
  let body = "";
  for await (const chunk of req) body += chunk;
  const request = JSON.parse(body);
  const match = pick(request.messages.map((message) => message.content).join("\n"));
  if (!match) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "aucune réponse enregistrée pour cette demande" }));
    return;
  }
  if (!request.stream) {
    await sleep(match.delayMs ?? 2000);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ model: MODEL, message: { role: "assistant", content: match.content }, done: true }));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/x-ndjson" });
  await sleep(1200);
  // Word-sized pieces, as a model emits tokens.
  for (const piece of match.content.match(/\S+\s*|\s+/g) ?? []) {
    if (res.destroyed) return;
    res.write(JSON.stringify({ model: MODEL, message: { role: "assistant", content: piece }, done: false }) + "\n");
    await sleep(22);
  }
  res.end(JSON.stringify({ model: MODEL, message: { role: "assistant", content: "" }, done: true }) + "\n");
}

http
  .createServer((req, res) => {
    if (req.method === "GET" && req.url === "/api/tags") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ models: [{ name: MODEL, model: MODEL }] }));
    } else if (req.method === "POST" && req.url === "/api/chat") {
      void chat(req, res);
    } else {
      res.writeHead(404).end();
    }
  })
  .listen(port, "127.0.0.1", () => console.log(`Ollama de démonstration sur http://127.0.0.1:${port}`));
