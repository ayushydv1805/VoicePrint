import fs from "node:fs";

const requiredFiles = [
  "vercel.json",
  "src/Phase8App.jsx",
  "src/phase8-entry.jsx",
  "src/hooks/usePhase10Readiness.js",
  "src/hooks/usePhase12Drill.js",
  "src/components/Phase10ReadinessPanel.jsx",
  "src/components/Phase12DrillPanel.jsx",
  "src/components/Phase9IncidentPanel.jsx",
  "public/sw.js",
  "server/index.js",
  "server/validation.js",
  "server/test/validation.test.js",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error("Missing required Phase 12 file: " + file);
}

const app = fs.readFileSync("src/Phase8App.jsx", "utf8");
for (const marker of ["usePhase12Drill", "Phase12DrillPanel"]) {
  if (!app.includes(marker)) throw new Error("Phase 12 app integration marker missing: " + marker);
}

const server = fs.readFileSync("server/index.js", "utf8");
for (const marker of [
  'phase: "12"',
  "safetyDrill: DRILL_MODE",
  "deliveryResilience: true",
  "DRILL_MODE",
]) {
  if (!server.includes(marker)) throw new Error("Phase 12 server marker missing: " + marker);
}

const sw = fs.readFileSync("public/sw.js", "utf8");
if (!sw.includes("voiceprint-shell-v12")) throw new Error("PWA cache namespace is not v12");

const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const serverPackage = JSON.parse(fs.readFileSync("server/package.json", "utf8"));
if (rootPackage.version !== "0.12.0") throw new Error("Frontend version is not 0.12.0");
if (serverPackage.version !== "0.12.0") throw new Error("Backend version is not 0.12.0");

console.log("VoicePrint Phase 12 release verification passed.");
