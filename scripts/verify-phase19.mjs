import fs from "node:fs";

const requiredFiles = [
  "vercel.json",
  "src/Phase8App.jsx",
  "src/hooks/useSafetySensors.js",
  "src/hooks/usePhase4Core.js",
  "src/components/Phase19SensorDiagnostics.jsx",
  "src/components/Phase4Home.jsx",
  "src/components/Phase4Control.jsx",
  "src/components/Phase4Modal.jsx",
  "src/lib/apiAuth.js",
  "src/hooks/usePhase8DeploymentStatus.js",
  "src/hooks/usePhase10Readiness.js",
  "public/sw.js",
  "server/index.js",
  "server/index-phase4.js",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error("Missing required Phase 19 file: " + file);
}

const sensor = fs.readFileSync("src/hooks/useSafetySensors.js", "utf8");
for (const marker of [
  "scheduleRestart",
  "handleStreamEnded",
  "visibilitychange",
  "pageshow",
  "setMicRecovering",
  "setCalibrating",
  "setSignalLevel",
  "lastSignalUiAtRef",
  "aboveSinceRef",
  "peakRmsRef",
  "startingRef",
]) {
  if (!sensor.includes(marker)) throw new Error("Sensor stability marker missing: " + marker);
}
if (!sensor.includes("now - lastSignalUiAtRef.current >= 120")) {
  throw new Error("Sensor telemetry must be UI-throttled");
}

const core = fs.readFileSync("src/hooks/usePhase4Core.js", "utf8");
if (!core.includes("if (!ready || !active || open || listening) return;") || !core.includes("startMic();")) {
  throw new Error("Microphone automatic startup is missing");
}
for (const marker of ["micRecovering", "calibrating", "signalLevel", "lastClapAt"]) {
  if (!core.includes(marker)) throw new Error("Sensor telemetry is not exposed by the core hook: " + marker);
}

const telemetry = fs.readFileSync("src/components/Phase19SensorDiagnostics.jsx", "utf8");
for (const marker of ["Microphone diagnostics", "Live input level", "does not upload or store microphone audio", "signalLevel"]) {
  if (!telemetry.includes(marker)) throw new Error("Telemetry UI marker missing: " + marker);
}

const app = fs.readFileSync("src/Phase8App.jsx", "utf8");
if (!app.includes("Phase19SensorDiagnostics")) throw new Error("Phase 19 telemetry panel is not mounted");
if (!app.includes("VoicePrint v0.19 · Phase 19")) throw new Error("App shell release marker is not Phase 19");

for (const file of ["src/hooks/usePhase8DeploymentStatus.js", "src/hooks/usePhase10Readiness.js"]) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes("https://voiceprint-api.onrender.com")) {
    throw new Error("Primary Render API default is missing in " + file);
  }
  if (source.includes("voiceprint-api-v4.onrender.com")) {
    throw new Error("Legacy Render API is still referenced by " + file);
  }
  if (!source.includes('phase-19')) {
    throw new Error("Phase 19 readiness parity is missing in " + file);
  }
}

const vercel = fs.readFileSync("vercel.json", "utf8");
if (vercel.includes("voiceprint-api-v4.onrender.com")) {
  throw new Error("Legacy Render API must be removed from frontend CSP");
}

for (const file of ["server/index.js", "server/index-phase4.js"]) {
  const server = fs.readFileSync(file, "utf8");
  if (!server.includes('phase: "19"')) throw new Error("Phase 19 API marker missing in " + file);
  for (const marker of [
    "microphoneAutoRecovery: true",
    "serverTimedConfirmation: true",
    "deploymentSafeDefaults: true",
    "clapTransientFiltering: true",
    "sensorWarmup: true",
    "locationSyncDebounce: true",
    "sensorTelemetry: true",
    "audioNotStored: true",
    "telemetryUi: true",
  ]) {
    if (!server.includes(marker)) throw new Error("Phase 19 backend feature marker missing in " + file + ": " + marker);
  }
}

const sw = fs.readFileSync("public/sw.js", "utf8");
if (!sw.includes("voiceprint-shell-v19")) throw new Error("PWA cache namespace is not v19");

const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const serverPackage = JSON.parse(fs.readFileSync("server/package.json", "utf8"));
if (rootPackage.version !== "0.19.0") throw new Error("Frontend version is not 0.19.0");
if (serverPackage.version !== "0.19.0") throw new Error("Backend version is not 0.19.0");

console.log("VoicePrint Phase 19 release verification passed.");
