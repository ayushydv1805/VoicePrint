import fs from "node:fs";

const requiredFiles = [
  "vercel.json",
  "src/Phase8App.jsx",
  "src/phase8-entry.jsx",
  "src/hooks/usePhase10Readiness.js",
  "src/hooks/usePhase12Drill.js",
  "src/hooks/usePhase13Recovery.js",
  "src/components/Phase10ReadinessPanel.jsx",
  "src/components/Phase12DrillPanel.jsx",
  "src/components/Phase13RecoveryPanel.jsx",
  "src/components/Phase9IncidentPanel.jsx",
  "public/sw.js",
  "server/index.js",
  "server/index-phase4.js",
  "server/validation.js",
  "server/test/validation.test.js",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error("Missing required Phase 13 file: " + file);
  }
}

const app = fs.readFileSync("src/Phase8App.jsx", "utf8");
for (const marker of ["usePhase13Recovery", "Phase13RecoveryPanel", "recoverEvent"]) {
  if (!app.includes(marker)) {
    throw new Error("Phase 13 app integration marker missing: " + marker);
  }
}

const core = fs.readFileSync("src/hooks/usePhase4Core.js", "utf8");
if (!core.includes("const recoverEvent = useCallback")) {
  throw new Error("Phase 13 recovery flow is not wired into the core hook");
}

const server = fs.readFileSync("server/index.js", "utf8");
for (const marker of [
  'phase: "13"',
  "safetyDrill: DRILL_MODE",
  "recovery: true",
  'app.get("/api/v1/sos/active"',
  "DRILL_MODE",
]) {
  if (!server.includes(marker)) {
    throw new Error("Phase 13 server marker missing: " + marker);
  }
}

const sw = fs.readFileSync("public/sw.js", "utf8");
if (!sw.includes("voiceprint-shell-v13")) {
  throw new Error("PWA cache namespace is not v13");
}

const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const serverPackage = JSON.parse(fs.readFileSync("server/package.json", "utf8"));
if (rootPackage.version !== "0.13.0") {
  throw new Error("Frontend version is not 0.13.0");
}
if (serverPackage.version !== "0.13.0") {
  throw new Error("Backend version is not 0.13.0");
}

console.log("VoicePrint Phase 13 release verification passed.");
