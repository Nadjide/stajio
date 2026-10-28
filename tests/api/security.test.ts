import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import constants from "next/constants.js";
import nextConfig from "../../next.config.mjs";
import { db } from "../../src/server/db";
import { getAuthFromCookie, signAuthToken, verifyAuthToken } from "../../src/server/auth";
import { getJwtSecret, getSecureAuthCookie, validateProductionAuthConfig } from "../../src/server/auth-config.mjs";
import { getAuthCookieOptions } from "../../src/server/cookie";

const session = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (session.token ? { value: session.token } : undefined) }),
}));

afterEach(() => vi.unstubAllEnvs());

describe("Auth configuration", () => {
  const secret = "80531c6d4ad9d6523945cc4f34efb910d48e39fd66ea625bcf0b3ee9f584bbd7";

  it.each([undefined, "", "short", "change_me", "your-secret-change-me-at-deployment-please"])(
    "rejects missing, short or placeholder production secrets: %s",
    (value) => {
      expect(() => getJwtSecret({ NODE_ENV: "production", JWT_SECRET: value })).toThrow("JWT_SECRET");
    },
  );

  it("accepts a dedicated production secret", () => {
    expect(getJwtSecret({ NODE_ENV: "production", JWT_SECRET: secret })).toBe(secret);
    expect(() => validateProductionAuthConfig({ JWT_SECRET: secret })).not.toThrow();
  });

  it("uses a stable, non-public random secret when development has none", () => {
    const first = getJwtSecret({ NODE_ENV: "development" });
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(getJwtSecret({ NODE_ENV: "development" })).toBe(first);
    expect(first).not.toBe("stajio-secret-key-change-me");
  });

  it("validates production startup without requiring a production secret during build", () => {
    vi.stubEnv("JWT_SECRET", "");
    expect(() => nextConfig(constants.PHASE_PRODUCTION_BUILD)).not.toThrow();
    expect(() => nextConfig(constants.PHASE_PRODUCTION_SERVER)).toThrow("JWT_SECRET");
    vi.stubEnv("JWT_SECRET", secret);
    expect(() => nextConfig(constants.PHASE_PRODUCTION_SERVER)).not.toThrow();
  });

  it("keeps local HTTP usable with HTTP-only, same-site cookies", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STAJIO_COOKIE_SECURE", "false");
    expect(getAuthCookieOptions()).toEqual({ httpOnly: true, secure: false, sameSite: "lax", path: "/" });
  });

  it("enables Secure for HTTPS and refuses ambiguous cookie settings", () => {
    vi.stubEnv("STAJIO_COOKIE_SECURE", "true");
    expect(getAuthCookieOptions().secure).toBe(true);
    expect(getSecureAuthCookie({})).toBe(false);
    expect(() => getSecureAuthCookie({ STAJIO_COOKIE_SECURE: "yes" })).toThrow("STAJIO_COOKIE_SECURE");
  });
});

describe("Revocable sessions", () => {
  const uid = "session-user";
  const email = "session-user@stajio.dev";

  beforeEach(() => {
    db.prepare("DELETE FROM users WHERE uid = ?").run(uid);
    db.prepare("INSERT INTO users (uid, email, password, authVersion) VALUES (?, ?, ?, 0)").run(uid, email, "hash");
    session.token = undefined;
  });

  it("issues an expiring HS256 token tied to the current account version", () => {
    const token = signAuthToken({ uid, email });
    expect(verifyAuthToken(token)).toEqual({ uid, email, authVersion: 0 });
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    expect(decoded.exp! - decoded.iat!).toBe(7 * 24 * 60 * 60);
    expect(jwt.decode(token, { complete: true })?.header.alg).toBe("HS256");
  });

  it("revokes old sessions when the account version changes", () => {
    const oldToken = signAuthToken({ uid, email });
    db.prepare("UPDATE users SET authVersion = authVersion + 1 WHERE uid = ?").run(uid);
    expect(verifyAuthToken(oldToken)).toBeNull();
    expect(verifyAuthToken(signAuthToken({ uid, email }))?.authVersion).toBe(1);
  });

  it("rejects sessions for a deleted account", () => {
    const token = signAuthToken({ uid, email });
    db.prepare("DELETE FROM users WHERE uid = ?").run(uid);
    expect(verifyAuthToken(token)).toBeNull();
    expect(() => signAuthToken({ uid, email })).toThrow("inexistant");
  });

  it("rejects signed but malformed, non-expiring or differently signed tokens", () => {
    expect(
      verifyAuthToken(jwt.sign({ uid: 4, email, authVersion: 0 }, getJwtSecret(), { expiresIn: "7d" })),
    ).toBeNull();
    expect(verifyAuthToken(jwt.sign({ uid, email, authVersion: 0 }, getJwtSecret()))).toBeNull();
    expect(
      verifyAuthToken(
        jwt.sign({ uid, email, authVersion: 0 }, getJwtSecret(), { algorithm: "HS384", expiresIn: "7d" }),
      ),
    ).toBeNull();
  });

  it("distinguishes missing cookies from invalid and valid sessions", async () => {
    expect(await getAuthFromCookie()).toEqual({ payload: null, hasToken: false });
    session.token = "invalid-token";
    expect(await getAuthFromCookie()).toEqual({ payload: null, hasToken: true });
    session.token = signAuthToken({ uid, email });
    expect(await getAuthFromCookie()).toEqual({ payload: { uid, email, authVersion: 0 }, hasToken: true });
  });
});
