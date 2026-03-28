import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/server/db";
import { POST as registerPost } from "../../app/api/auth/register/route";
import { POST as loginPost } from "../../app/api/auth/login/route";

describe("API Auth", () => {
  beforeEach(() => {
    db.prepare("DELETE FROM users WHERE email LIKE 'test-%@stajio.dev'").run();
  });

  it("register then login should return user and token cookie", async () => {
    const email = `test-${Date.now()}@stajio.dev`;

    const registerRequest = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "TestPass123!",
        displayName: "Test User",
      }),
    });

    const registerResponse = await registerPost(registerRequest);
    expect(registerResponse.status).toBe(200);
    const registerBody = await registerResponse.json();
    expect(registerBody.success).toBe(true);

    const loginRequest = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "TestPass123!" }),
    });

    const loginResponse = await loginPost(loginRequest);
    expect(loginResponse.status).toBe(200);
    const loginBody = await loginResponse.json();
    expect(loginBody.user.email).toBe(email);

    const setCookie = loginResponse.headers.get("set-cookie") || "";
    expect(setCookie).toContain("token=");
  });

  it("login with invalid password should return 401", async () => {
    const email = `test-${Date.now()}@stajio.dev`;

    const registerRequest = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "TestPass123!",
        displayName: "Test User",
      }),
    });
    await registerPost(registerRequest);

    const loginRequest = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "WrongPassword!" }),
    });

    const loginResponse = await loginPost(loginRequest);
    expect(loginResponse.status).toBe(401);
    const body = await loginResponse.json();
    expect(body.error).toBe("Invalid credentials");
  });
});
