import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default class CleanupReporter {
  constructor({ runtimeName }) {
    if (!/^\.stajio-e2e-[a-f0-9-]{36}$/.test(runtimeName ?? "")) {
      throw new Error("Invalid isolated E2E runtime name.");
    }
    const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    this.runtime = path.join(workspace, runtimeName);
    if (path.dirname(this.runtime) !== workspace) throw new Error("E2E runtime is outside the workspace.");
  }

  onExit() {
    // Playwright calls this after stopping its server, including on Windows where
    // forced process-tree termination does not run the server's exit handlers.
    rmSync(this.runtime, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
