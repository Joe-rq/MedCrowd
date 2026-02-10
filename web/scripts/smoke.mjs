// Smoke test: start dev server, check core routes, then exit
// Usage: node scripts/smoke.mjs

import { spawn } from "node:child_process";

const BASE = "http://localhost:3000";
const TIMEOUT_MS = 30_000;

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok || res.status < 500) return true;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function checkRoute(path, method = "GET", body = null) {
  const opts = { method, signal: AbortSignal.timeout(5000) };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  return { path, status: res.status, ok: res.status < 500 };
}

async function main() {
  console.log("[smoke] Starting dev server...");
  const server = spawn("npm", ["run", "dev"], {
    stdio: "pipe",
    shell: true,
    env: { ...process.env, PORT: "3000" },
  });

  let serverOutput = "";
  server.stdout?.on("data", (d) => { serverOutput += d.toString(); });
  server.stderr?.on("data", (d) => { serverOutput += d.toString(); });

  try {
    const ready = await waitForServer(BASE, TIMEOUT_MS);
    if (!ready) {
      console.error("[smoke] Server failed to start within timeout");
      console.error(serverOutput.slice(-500));
      process.exit(1);
    }
    console.log("[smoke] Server is ready");

    const results = await Promise.all([
      checkRoute("/api/auth/session"),
      checkRoute("/api/act/triage", "POST", { message: "头疼怎么办" }),
    ]);

    let allPassed = true;
    for (const r of results) {
      const icon = r.ok ? "PASS" : "FAIL";
      console.log(`[smoke] ${icon} ${r.method || "GET"} ${r.path} -> ${r.status}`);
      if (!r.ok) allPassed = false;
    }

    if (allPassed) {
      console.log("[smoke] All checks passed");
    } else {
      console.error("[smoke] Some checks failed");
      process.exit(1);
    }
  } finally {
    server.kill("SIGTERM");
    // Give it a moment to clean up
    await new Promise((r) => setTimeout(r, 500));
  }
}

main().catch((err) => {
  console.error("[smoke] Fatal:", err);
  process.exit(1);
});
