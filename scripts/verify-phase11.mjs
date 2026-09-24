import fs from "node:fs";

const requiredFiles = [
  "vercel.json",
  "src/Phase8App.jsx",
  "src/phase8-entry.jsx",
  "src/hooks/usePhase9Incident.js",
  "src/hooks/usePhase10Readiness.js",
  "src/components/Phase9IncidentPanel.jsx",
  "src/components/Phase10ReadinessPanel.jsx",
  "public/sw.js",
  "server/index.js",
  "server/validation.js",
  "server/test/validation.test.js",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error("Missing required Phase 11 file: " + file);
}

const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
const headers = vercel.headers?.flatMap((item) => item.headers || []) || [];
const headerKeys = new Set(headers.map((item) => item.key));
for (const key of [
  "Content-Security-Policy",
  "Permissions-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
]) {
  if (!headerKeys.has(key)) throw new Error("Missing Vercel security header: " + key);
}

const app = fs.readFileSync("src/Phase8App.jsx", "utf8");
for (const marker of ["usePhase9Incident", "Phase9IncidentPanel", "usePhase10Readiness", "Phase10ReadinessPanel"]) {
  if (!app.includes(marker)) throw new Error("Phase 11 app integration marker missing: " + marker);
}

const server = fs.readFileSync("server/index.js", "utf8");
for (const marker of [
  'phase: "11"',
  "securityRlsEnforced",
  "readiness: true",
  "deliveryResilience: true",
  "DELIVERY_MAX_ATTEMPTS",
]) {
  if (!server.includes(marker)) throw new Error("Phase 11 server marker missing: " + marker);
}

const sw = fs.readFileSync("public/sw.js", "utf8");
if (!sw.includes("voiceprint-shell-v11")) throw new Error("PWA cache namespace is not v11");

const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const serverPackage = JSON.parse(fs.readFileSync("server/package.json", "utf8"));
if (rootPackage.version !== "0.11.0") throw new Error("Frontend version is not 0.11.0");
if (serverPackage.version !== "0.11.0") throw new Error("Backend version is not 0.11.0");

const migration = fs.readFileSync("supabase/migrations/phase_11_delivery_resilience.sql", "utf8");
for (const marker of ["attempt_count", "last_attempt_at", "next_retry_at"]) {
  if (!migration.includes(marker)) throw new Error("Phase 11 migration marker missing: " + marker);
}

console.log("VoicePrint Phase 11 release verification passed.");
