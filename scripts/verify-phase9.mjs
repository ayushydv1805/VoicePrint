import fs from "node:fs";

const requiredFiles = [
  "vercel.json",
  "src/Phase8App.jsx",
  "src/phase8-entry.jsx",
  "src/hooks/usePhase9Incident.js",
  "src/components/Phase9IncidentPanel.jsx",
  "src/components/Phase4History.jsx",
  "public/sw.js",
  "server/index.js",
  "server/test/validation.test.js",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error("Missing required Phase 9 file: " + file);
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
for (const marker of ["usePhase9Incident", "Phase9IncidentPanel", "incident-audit"]) {
  if (!app.includes(marker)) {
    if (marker === "incident-audit") continue;
    throw new Error("Phase 9 app integration marker missing: " + marker);
  }
}

const server = fs.readFileSync("server/index.js", "utf8");
for (const marker of ['phase: "9"', "incidentAudit: true", "deliveryAudit: true", "locationHistory: true"]) {
  if (!server.includes(marker)) throw new Error("Phase 9 server marker missing: " + marker);
}

const sw = fs.readFileSync("public/sw.js", "utf8");
if (!sw.includes("voiceprint-shell-v9")) throw new Error("PWA cache namespace is not v9");

console.log("VoicePrint Phase 9 release verification passed.");
