import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/server/db";
import { signAuthToken } from "../../src/server/auth";
import { AiError, chatJson, CONTEXT_TOKENS, streamChatWithOllama } from "../../src/server/ai/ollama";
import { evaluationOutput, structureLogOutput } from "../../src/server/ai/schemas";
import { structureLogPrompt } from "../../src/server/ai/prompts";
import { POST as aiPost } from "../../app/api/ai/route";
import { POST as aiStreamPost } from "../../app/api/ai/stream/route";
import { POST as estimatePost } from "../../app/api/ai/estimate/route";
import { GET as statusGet } from "../../app/api/ai/status/route";
import { GET as healthGet } from "../../app/api/health/route";

const session = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (session.token ? { value: session.token } : undefined) }),
}));

const uid = "ai-foundation-user";
const fetchMock = vi.fn();
const encoder = new TextEncoder();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** An Ollama-like streaming body made of the given raw chunks. */
function streamResponse(chunks: string[], { error }: { error?: boolean } = {}) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        if (error) controller.error(new Error("socket hang up"));
        else controller.close();
      },
    }),
  );
}

const line = (value: unknown) => `${JSON.stringify(value)}\n`;

async function collect(generator: AsyncGenerator<string>) {
  let text = "";
  for await (const part of generator) text += part;
  return text;
}

function request(url: string, body: unknown) {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const events = async (response: Response) =>
  (await response.text())
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((value) => JSON.parse(value));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  db.exec(
    "DELETE FROM reports; DELETE FROM skill_evidence; DELETE FROM logs; DELETE FROM users WHERE uid = 'ai-foundation-user'",
  );
  db.prepare(
    "INSERT INTO users (uid, email, password, displayName, internshipStart, internshipEnd) VALUES (?, ?, 'hash', 'Étudiant', '2026-09-01', '2027-06-30')",
  ).run(uid, "ai-foundation@example.test");
  session.token = signAuthToken({ uid, email: "ai-foundation@example.test" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Ollama client", () => {
  it("requests the configured context window instead of Ollama's small default", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: { content: '{"summary":"ok"}' } }));
    await chatJson({ userPrompt: "x" }, structureLogOutput);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.options.num_ctx).toBe(CONTEXT_TOKENS);
    expect(body.format).toBe("json");
  });

  it("normalizes a structured result and fills missing lists", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: { content: '```json\n{"summary":" Résumé ","skills":["API"," API ",""]}\n```' } }),
    );
    expect(await chatJson({ userPrompt: "x" }, structureLogOutput)).toEqual({
      summary: "Résumé",
      missions: [],
      technologies: [],
      skills: ["API"],
    });
  });

  it.each([
    ["malformed JSON", "pas du json"],
    ["a missing required field", '{"missions":[]}'],
  ])("rejects %s as an invalid output", async (_label, content) => {
    fetchMock.mockResolvedValue(jsonResponse({ message: { content } }));
    await expect(chatJson({ userPrompt: "x" }, structureLogOutput)).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("keeps defense scores between 0 and 10 and accepts a decimal comma", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: { content: '{"score":"7,5","feedback":"Bien"}' } }));
    expect(await chatJson({ userPrompt: "x" }, evaluationOutput)).toMatchObject({ score: 7.5, improvedAnswer: "" });
    fetchMock.mockResolvedValue(jsonResponse({ message: { content: '{"score":14,"feedback":"Bien"}' } }));
    await expect(chatJson({ userPrompt: "x" }, evaluationOutput)).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("explains how to install a missing model", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "model 'phi4-mini' not found, try pulling it first" }, 404));
    const error = await chatJson({ userPrompt: "x", model: "phi4-mini" }, structureLogOutput).catch((cause) => cause);
    expect(error).toBeInstanceOf(AiError);
    expect(error).toMatchObject({ code: "model_missing", status: 424 });
    expect(error.message).toContain("ollama pull phi4-mini");
  });

  it("reports an unreachable server", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(chatJson({ userPrompt: "x" }, structureLogOutput)).rejects.toMatchObject({
      code: "unreachable",
      status: 503,
    });
  });

  it("propagates a cancellation to the request sent to Ollama", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    const pending = chatJson({ userPrompt: "x" }, structureLogOutput, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "cancelled" });
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it("stops at the server timeout with an explicit message", async () => {
    vi.resetModules();
    vi.stubEnv("OLLAMA_TIMEOUT_MS", "20");
    const ollama = await import("../../src/server/ai/ollama");
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    await expect(ollama.chatWithOllama({ userPrompt: "x" })).rejects.toMatchObject({ code: "timeout", status: 504 });
    vi.unstubAllEnvs();
  });
});

describe("Ollama streaming", () => {
  it("yields every fragment, including a final line without a newline", async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        line({ message: { content: "Bon" } }) + '{"message":{"content":"jo',
        'ur"}}\n',
        JSON.stringify({ message: { content: " !" }, done: true }),
      ]),
    );
    expect(await collect(streamChatWithOllama({ userPrompt: "x" }))).toBe("Bonjour !");
  });

  it("turns an error line from the model into an explicit error", async () => {
    fetchMock.mockResolvedValue(
      streamResponse([line({ message: { content: "Début" } }), line({ error: "out of memory" })]),
    );
    await expect(collect(streamChatWithOllama({ userPrompt: "x" }))).rejects.toMatchObject({ code: "model_error" });
  });

  it("flags a stream that ends before Ollama's final line as incomplete", async () => {
    fetchMock.mockResolvedValue(streamResponse([line({ message: { content: "Début" } })]));
    await expect(collect(streamChatWithOllama({ userPrompt: "x" }))).rejects.toMatchObject({ code: "incomplete" });
    fetchMock.mockResolvedValue(streamResponse([line({ message: { content: "Début" } })], { error: true }));
    await expect(collect(streamChatWithOllama({ userPrompt: "x" }))).rejects.toMatchObject({ code: "incomplete" });
  });
});

describe("AI routes", () => {
  it("validates task inputs before calling the model", async () => {
    expect((await aiPost(request("/api/ai", { task: "structureLog", payload: { rawContent: "" } }))).status).toBe(400);
    expect((await aiPost(request("/api/ai", { task: "chat", payload: {} }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a clear 502 when the model answers outside the schema", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: { content: '{"plan":"pas une liste"}' } }));
    db.prepare("INSERT INTO logs (id, uid, date, rawContent) VALUES ('n', ?, '2026-10-01', 'Note')").run(uid);
    const response = await aiPost(request("/api/ai", { task: "prepareDefense", payload: {} }));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "invalid_output" });
  });

  it("loads the sources from the account and returns their snapshot", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: { content: '{"plan":["Intro"],"questions":[{"question":"Q ?","answerHint":"H"}]}' } }),
    );
    db.prepare(
      "INSERT INTO logs (id, uid, date, rawContent) VALUES ('n', ?, '2026-10-01', 'J''ai déployé l''API')",
    ).run(uid);
    const response = await aiPost(request("/api/ai", { task: "prepareDefense", payload: { logIds: ["n"] } }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sources).toEqual([
      { id: "n", date: "2026-10-01", text: expect.stringContaining("J'ai déployé l'API") },
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content).toContain("[À compléter");
  });

  it("refuses a selection that does not fit the context instead of truncating it", async () => {
    const insert = db.prepare("INSERT INTO logs (id, uid, date, rawContent) VALUES (?, ?, '2026-10-01', ?)");
    for (let index = 0; index < 20; index++) insert.run(`big-${index}`, uid, "Activité détaillée. ".repeat(300));
    const response = await aiStreamPost(
      request("/api/ai/stream", {
        task: "generateCVPoints",
        payload: { logIds: Array.from({ length: 20 }, (_, index) => `big-${index}`) },
      }),
    );
    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body).toMatchObject({ code: "context_too_large", details: { noteCount: 20, fits: false } });
    expect(body.error).toContain("section par section");
    expect(fetchMock).not.toHaveBeenCalled();
    const estimate = await (await estimatePost(request("/api/ai/estimate", { task: "cv", logIds: ["big-0"] }))).json();
    expect(estimate).toMatchObject({ fits: true, noteCount: 1 });
  });

  it("refuses notes that no longer exist or belong to another account", async () => {
    const response = await aiPost(request("/api/ai", { task: "prepareDefense", payload: { logIds: ["missing"] } }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("n'existent plus");
  });

  it("streams events and reports a model failure as a final error event", async () => {
    db.prepare("INSERT INTO logs (id, uid, date, rawContent) VALUES ('n', ?, '2026-10-01', 'Note')").run(uid);
    fetchMock.mockResolvedValue(
      streamResponse([line({ message: { content: "- Point" } }), line({ message: { content: "" }, done: true })]),
    );
    const ok = await events(
      await aiStreamPost(request("/api/ai/stream", { task: "generateCVPoints", payload: { logIds: ["n"] } })),
    );
    // The empty final fragment is not forwarded.
    expect(ok.map((event) => event.type)).toEqual(["meta", "delta", "done"]);
    expect(ok[0]).toMatchObject({ model: expect.any(String), sources: [{ id: "n" }] });

    fetchMock.mockResolvedValue(streamResponse([line({ message: { content: "- Début" } })]));
    const failed = await events(
      await aiStreamPost(request("/api/ai/stream", { task: "generateCVPoints", payload: { logIds: ["n"] } })),
    );
    expect(failed.at(-1)).toMatchObject({ type: "error", code: "incomplete" });
    expect(failed.some((event) => event.type === "done")).toBe(false);
  });

  it("reports the diagnostic and health without exposing account data", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ models: [{ name: "phi4-mini:latest" }] }));
    expect(await (await statusGet()).json()).toMatchObject({ reachable: true, models: ["phi4-mini:latest"] });
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await (await statusGet()).json()).toMatchObject({ reachable: false, models: [] });
    const health = await healthGet();
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "degraded", app: "ok", database: "ok", ollama: "unreachable" });
  });

  it("keeps the grounding rules in every prompt", () => {
    expect(structureLogPrompt("note")).toMatch(/N'invente aucun chiffre/);
  });
});
