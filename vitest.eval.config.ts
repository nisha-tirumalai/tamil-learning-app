// Config for evals that call the REAL model (they cost money): `npm run eval:smoke`.
// Kept separate so `npm test` never runs them.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["evaluation/**/*.eval.ts"], testTimeout: 600_000 },
});
