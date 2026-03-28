import { describe, expect, it } from "vitest";
import { POST as aiPost } from "../../app/api/ai/route";

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
    expect(body.error).toBe("Unsupported AI task");
  });
});
