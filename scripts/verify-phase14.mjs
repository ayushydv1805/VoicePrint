import fs from "node:fs";

const requiredFiles = [
  "vercel.json",
  "src/Phase8App.jsx",
  "src/phase8-entry.jsx",
  "src/hooks/usePhase10Readiness.js",
  "src/hooks/usePhase12Drill.js",
  "src/hooks/usePhase13Recovery.js",
  "src/hooks/usePhase14RecoveryWatch.js",
  "src/components/Phase10ReadinessPanel.jsx",
  "src/components/Phase12DrillPanel.jsx",
  "src/components/Phase13RecoveryPanel.jsx",
  "src/components/Phase14RecoveryWatchPanel.jsx",
  "src/components/Phase14RecoveryBanner.jsx",
  "src/components/Phase9IncidentPanel.jsx",
  "public/sw.js",
  "server/index.js",
  "server/index-phase4.js",
  "server/validation.js",
  "server/test/validation.test.js",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error("Missing required Phase 14 file: " + file);
  }
}

const app = fs.readFileSync("src/Phase8App.jsx", "utf8");
for (const marker of [
  "usePhase14RecoveryWatch",
  "Phase14RecoveryWatchPanel",
  "Phase14RecoveryBanner",
]) {
  if (!app.includes(marker)) {
    throw new Error("Phase 14 app integration marker missing: " + marker);
  }
}

const recovery = fs.readFileSync("src/hooks/usePhase14RecoveryWatch.js", "utf8");
for (const marker of [
  '"/api/v1/sos/active"',
  "15000",
  "autoMonitoring",
  "confirmationWindowSeconds",
]) {
  if (!recovery.includes(marker)) {
    throw new Error("Phase 14 recovery monitor marker missing: " + marker);
  }
}

const server = fs.readFileSync("server/index.js", "utf8");
for (const marker of [
  'phase: "14"',
  "proactiveRecovery: true",
  "recoveryPollSeconds: 15",
  'app.get("/api/v1/sos/active"',
]) {
  if (!server.includes(marker)) {
    throw new Error("Phase 14 server marker missing: " + marker);
  }
}

const sw = fs.readFileSync("public/sw.js", "utf8");
if (!sw.includes("voiceprint-shell-v14")) {
  throw new Error("PWA cache namespace is not v14");
}

const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const serverPackage = JSON.parse(fs.readFileSync("server/package.json", "utf8"));
if (rootPackage.version !== "0.14.0") {
  throw new Error("Frontend version is not 0.14.0");
}
if (serverPackage.version !== "0.14.0") {
  throw new Error("Backend version is not 0.14.0");
}

console.log("VoicePrint Phase 14 release verification passed.");
