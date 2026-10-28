import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/server/db";
import { signAuthToken } from "../../src/server/auth";
import { chatJson, listOllamaModels, streamChatWithOllama } from "../../src/server/ai/ollama";
import { POST as aiPost } from "../../app/api/ai/route";
import { POST as aiStreamPost } from "../../app/api/ai/stream/route";
import { GET as modelsGet } from "../../app/api/ai/models/route";

const session = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (session.token ? { value: session.token } : undefined) }),
}));
vi.mock("../../src/server/ai/ollama", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/server/ai/ollama")>()),
  chatJson: vi.fn(),
  streamChatWithOllama: vi.fn(),
  listOllamaModels: vi.fn(),
}));

const uid = "ai-api-test-user";
const email = "ai-api-test@stajio.dev";
const request = (body: unknown) =>
  new Request("http://localhost:3001/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.resetAllMocks();
  db.prepare("INSERT OR IGNORE INTO users (uid, email, password) VALUES (?, ?, ?)").run(uid, email, "hash");
  session.token = signAuthToken({ uid, email });
});

describe("API AI authentication", () => {
  it.each(["complete", "stream", "models"])(
    "rejects anonymous %s requests before any model call or validation",
    async (route) => {
      session.token = undefined;
      const invalidRequest = new Request("http://localhost:3001/api/ai", { method: "POST", body: "not json" });
      const response =
        route === "models"
          ? await modelsGet()
          : route === "stream"
            ? await aiStreamPost(invalidRequest)
            : await aiPost(invalidRequest);
      expect(response.status).toBe(401);
      expect(chatJson).not.toHaveBeenCalled();
      expect(streamChatWithOllama).not.toHaveBeenCalled();
      expect(listOllamaModels).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid session", async () => {
    session.token = "invalid.token";
    expect((await aiPost(request({ task: "structureLog", payload: { rawContent: "Bonjour" } }))).status).toBe(403);
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("allows an authenticated complete response", async () => {
    const result = { summary: "Résumé", missions: [], technologies: [], skills: [] };
    vi.mocked(chatJson).mockResolvedValue(result);
    const response = await aiPost(request({ task: "structureLog", payload: { rawContent: "Bonjour" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result });
    expect(chatJson).toHaveBeenCalledOnce();
  });

  it("allows an authenticated streaming response", async () => {
    vi.mocked(streamChatWithOllama).mockImplementation(async function* () {
      yield "Points";
    });
    const response = await aiStreamPost(request({ task: "generateCVPoints", payload: { logIds: [] } }));
    expect(response.status).toBe(400);
    db.prepare(
      "INSERT OR IGNORE INTO logs (id, uid, date, rawContent) VALUES ('ai-note', ?, '2026-10-27', 'Note')",
    ).run(uid);
    const streamed = await aiStreamPost(request({ task: "generateCVPoints", payload: { logIds: ["ai-note"] } }));
    expect(streamed.status).toBe(200);
    const events = (await streamed.text())
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line));
    expect(events.map((event) => event.type)).toEqual(["meta", "delta", "done"]);
    expect(streamChatWithOllama).toHaveBeenCalledOnce();
  });

  it("allows authenticated model discovery", async () => {
    vi.mocked(listOllamaModels).mockResolvedValue(["phi4-mini"]);
    const response = await modelsGet();
    expect(response.status).toBe(200);
    expect((await response.json()).models).toEqual(["phi4-mini"]);
    expect(listOllamaModels).toHaveBeenCalledOnce();
  });
});
