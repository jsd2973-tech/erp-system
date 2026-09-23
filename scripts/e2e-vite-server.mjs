import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const testProjectRef = "nazyeklqgcygfuvzzgql";
const productionProjectRef = "jqdvxmatbmmeubtoogvl";
const url = String(process.env.E2E_SUPABASE_URL || "").trim();
const anonKey = String(process.env.E2E_SUPABASE_ANON_KEY || "").trim();
const adminEmail = String(process.env.E2E_ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.E2E_ADMIN_PASSWORD || "");

const missing = [
  ["E2E_SUPABASE_URL", url],
  ["E2E_SUPABASE_ANON_KEY", anonKey],
  ["E2E_ADMIN_EMAIL", adminEmail],
  ["E2E_ADMIN_PASSWORD", adminPassword],
].filter(([, value]) => !value).map(([name]) => name);
if (missing.length) {
  console.error(`E2E preview environment is incomplete: ${missing.join(", ")}`);
  process.exit(1);
}

const projectUrl = new URL(url);
if (projectUrl.hostname === `${productionProjectRef}.supabase.co`) {
  console.error("E2E preview refused the production Supabase project.");
  process.exit(1);
}
if (projectUrl.protocol !== "https:" || projectUrl.hostname !== `${testProjectRef}.supabase.co`) {
  console.error(`E2E preview requires the isolated Supabase project ${testProjectRef}.`);
  process.exit(1);
}
const keySegments = anonKey.split(".");
let publishableKey = anonKey.startsWith("sb_publishable_");
if (!publishableKey && keySegments.length === 3) {
  try {
    publishableKey = JSON.parse(Buffer.from(keySegments[1], "base64url").toString("utf8")).role === "anon";
  } catch {
    publishableKey = false;
  }
}
if (!publishableKey) {
  console.error("E2E preview requires a publishable/anon Supabase key; secret and service-role keys are rejected.");
  process.exit(1);
}

const buildRoot = fs.mkdtempSync(path.join(os.tmpdir(), "erp-e2e-build-"));
const ignoredRoots = new Set([".git", "node_modules", "dist", "playwright-report", "test-results", ".vercel"]);
fs.cpSync(repoRoot, buildRoot, {
  recursive: true,
  filter: (source) => {
    const relative = path.relative(repoRoot, source);
    if (!relative) return true;
    const parts = relative.split(path.sep);
    return !ignoredRoots.has(parts[0]) && !parts[0].startsWith(".env");
  },
});
fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(buildRoot, "node_modules"), process.platform === "win32" ? "junction" : "dir");

const childEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    !key.startsWith("E2E_") &&
    !key.startsWith("SUPABASE_") &&
    !key.startsWith("VITE_SUPABASE_") &&
    key !== "VITE_TEST_ADMIN_EMAIL"
  ),
);
Object.assign(childEnv, {
  VITE_SUPABASE_TEST_MODE: "1",
  VITE_SUPABASE_E2E_MODE: "1",
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_ANON_KEY: anonKey,
  VITE_TEST_ADMIN_EMAIL: adminEmail,
});

let child;
let cleaning = false;
const cleanup = () => {
  if (cleaning) return;
  cleaning = true;
  fs.rmSync(buildRoot, { recursive: true, force: true });
};

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child?.kill(signal));
}

const build = spawn("npm", ["run", "build"], { cwd: buildRoot, stdio: "inherit", env: childEnv });
child = build;
const buildExit = await new Promise((resolve, reject) => {
  build.once("error", reject);
  build.once("exit", (code, signal) => resolve({ code, signal }));
});
if (buildExit.signal || buildExit.code !== 0) {
  cleanup();
  process.exit(buildExit.code || 1);
}

const preview = spawn(process.execPath, [
  "node_modules/vite/bin/vite.js",
  "preview",
  "--host",
  "127.0.0.1",
  "--port",
  "4173",
  "--strictPort",
], { cwd: buildRoot, stdio: "inherit", env: childEnv });
child = preview;

preview.on("exit", (code, signal) => {
  cleanup();
  process.exit(signal ? 0 : (code ?? 1));
});
