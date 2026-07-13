import { describe, expect, it } from "vitest";
import { POST as aiPost } from "../../app/api/ai/route";
import { POST as aiStreamPost } from "../../app/api/ai/stream/route";

describe("API AI", () => {
  it("should return 400 for unsupported task", async () => {
    const request = new Request("http://localhost:3000/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "unknownTask", payload: {} }),
    });

    const response = await aiPost(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation échouée");
  });

  it("should return 400 for invalid JSON body", async () => {
    const request = new Request("http://localhost:3000/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const response = await aiPost(request);
    expect(response.status).toBe(400);
  });

  it("stream route should reject non-streamable tasks", async () => {
    const request = new Request("http://localhost:3000/api/ai/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "structureLog", payload: {} }),
    });

    const response = await aiStreamPost(request);
    expect(response.status).toBe(400);
  });
});
