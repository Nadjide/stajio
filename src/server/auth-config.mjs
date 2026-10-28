import { randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import process from "node:process";

const developmentSecretKey = Symbol.for("stajio.development.jwt-secret");
const placeholderSecret =
  /change[_ -]?me|replace[_ -]?me|your[_ -]?(jwt[_ -]?)?secret|stajio-secret-key|example[_ -]?secret/i;

/** @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env */
function configuredSecret(env) {
  const value = env.JWT_SECRET?.trim();
  if (!value || Buffer.byteLength(value, "utf8") < 32 || placeholderSecret.test(value)) {
    throw new Error("JWT_SECRET doit contenir au moins 32 octets et être un secret dédié généré aléatoirement.");
  }
  return value;
}

/**
 * The fallback is random and shared by all route bundles in this process.
 * Restarting a development server without a configured secret ends its sessions.
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function getJwtSecret(env = process.env) {
  if (env.JWT_SECRET?.trim() || env.NODE_ENV === "production") return configuredSecret(env);
  if (!globalThis[developmentSecretKey]) {
    globalThis[developmentSecretKey] = randomBytes(32).toString("hex");
  }
  return globalThis[developmentSecretKey];
}

/** @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env] */
export function getSecureAuthCookie(env = process.env) {
  const value = env.STAJIO_COOKIE_SECURE;
  if (value === undefined || value === "" || value === "false") return false;
  if (value === "true") return true;
  throw new Error("STAJIO_COOKIE_SECURE doit valoir true (HTTPS) ou false (HTTP local).");
}

/**
 * Validate only when starting a production server, never while compiling it.
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function validateProductionAuthConfig(env = process.env) {
  configuredSecret(env);
  getSecureAuthCookie(env);
}
