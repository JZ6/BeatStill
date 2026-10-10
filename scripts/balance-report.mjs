#!/usr/bin/env node
// Prints the balance report (src/balance/report.ts): weapon fire rates and DPS, enemy bullet
// density per palette tempo, time per kill and the time-dilation response, each against the
// pre-overhaul baseline. Loads the TypeScript through Vite's SSR module loader (the existing
// toolchain), so there is no build step and no extra dependency.
//
// Usage: npm run balance [-- <bpm>]   (default: the reference tempo, 105 bpm)
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = process.argv[2];
const bpm = arg === undefined ? undefined : Number(arg);
if (bpm !== undefined && !(Number.isFinite(bpm) && bpm > 0)) {
  console.error(`invalid bpm: ${arg}`);
  process.exit(1);
}

// Node ≥ 22 has an experimental global localStorage (and warns when it's touched). The report must
// not read saves (shop bonuses would skew it), so the game's storage wrapper sees none.
Object.defineProperty(globalThis, "localStorage", { value: undefined, configurable: true, writable: true });

const server = await createServer({
  root: ROOT,
  configFile: false,
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const report = await server.ssrLoadModule("/src/balance/report.ts");
  console.log(report.formatBalanceReport(bpm));
} finally {
  await server.close();
}
