import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runtimeName = process.env.STAJIO_E2E_RUNTIME_NAME;
if (!/^\.stajio-e2e-[a-f0-9-]{36}$/.test(runtimeName ?? "")) {
  throw new Error("Start the isolated server through the Playwright configuration.");
}
const runtime = path.join(workspace, runtimeName);
mkdirSync(runtime);

// Next writes generated types and tsconfig settings into its project directory.
// A source-only copy keeps the developer's server, .next and configuration intact.
for (const directory of ["app", "src", "public"]) {
  cpSync(path.join(workspace, directory), path.join(runtime, directory), { recursive: true });
}
for (const filename of ["package.json", "tsconfig.json", "next-env.d.ts", "postcss.config.mjs"]) {
  const source = path.join(workspace, filename);
  if (existsSync(source)) cpSync(source, path.join(runtime, filename));
}
writeFileSync(
  path.join(runtime, "next.config.mjs"),
  `export default { distDir: ".next", turbopack: { root: ${JSON.stringify(workspace)} } };\n`,
);
mkdirSync(path.join(runtime, "data"));

const child = spawn(
  process.execPath,
  [path.join(workspace, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3101"],
  {
    cwd: runtime,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "development",
      STAJIO_DB_PATH: path.join(runtime, "data", "e2e.sqlite"),
      JWT_SECRET: randomBytes(32).toString("hex"),
      STAJIO_COOKIE_SECURE: "false",
      NEXT_TELEMETRY_DISABLED: "1",
      // Browser tests do not depend on a model running on the user's computer.
      OLLAMA_BASE_URL: "http://127.0.0.1:9",
      OLLAMA_MODEL: "stajio-e2e-no-model",
    },
  },
);

function cleanup() {
  // Only remove the exact, newly created runtime, never a caller-provided path.
  if (path.dirname(runtime) === workspace && path.basename(runtime).startsWith(".stajio-e2e-")) {
    rmSync(runtime, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

child.once("error", (error) => {
  console.error(error.message);
  cleanup();
  process.exitCode = 1;
});
child.once("exit", (code) => {
  cleanup();
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}
