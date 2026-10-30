import { afterAll } from "vitest";

// This runs before each suite's imports, including direct imports of server/db.
// Never inherit the user's database path from their shell or local .env.
process.env.STAJIO_DB_PATH = ":memory:";
process.env.JWT_SECRET = "stajio-vitest-isolated-secret-only-for-tests";

const { db } = await import("../src/server/db");
afterAll(() => {
  if (db.open) db.close();
});
