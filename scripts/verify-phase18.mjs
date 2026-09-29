import fs from "node:fs";

const requiredFiles = [
  "vercel.json",
  "src/Phase8App.jsx",
  "src/hooks/useSafetySensors.js",
  "src/hooks/usePhase4Core.js",
  "scripts/verify-phase18.mjs",
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
  if (!fs.existsSync(file)) throw new Error("Missing required Phase 18 file: " + file);
}

const sensor = fs.readFileSync("src/hooks/useSafetySensors.js", "utf8");
for (const marker of [
  "scheduleRestart",
  "handleStreamEnded",
  "visibilitychange",
  "pageshow",
  "setMicRecovering",
  "setCalibrating",
  "aboveSinceRef",
  "peakRmsRef",
  "startingRef",
]) {
  if (!sensor.includes(marker)) throw new Error("Microphone recovery marker missing: " + marker);
}

const core = fs.readFileSync("src/hooks/usePhase4Core.js", "utf8");
if (!core.includes("if (!ready || !active || open || listening) return;") || !core.includes("startMic();")) {
  throw new Error("Microphone automatic startup is missing");
}
if (!core.includes("micRecovering")) throw new Error("Microphone recovery state is not exposed by the core hook");
if (!core.includes("calibrating")) throw new Error("Sensor calibration state is not exposed by the core hook");
if (!core.includes("lastLocationSyncAt.current = Date.now()")) throw new Error("Initial location sync debounce is missing");

const modal = fs.readFileSync("src/components/Phase4Modal.jsx", "utf8");
if (!modal.includes("confirmationRemainingSeconds")) {
  throw new Error("SOS modal is not using server-timed confirmation data");
}

const contacts = fs.readFileSync("src/components/Phase4Contacts.jsx", "utf8");
if (!contacts.includes("/^\\+[1-9][0-9]{7,14}$/")) {
  throw new Error("Trusted-contact E.164 validation is malformed");
}

const api = fs.readFileSync("src/lib/apiAuth.js", "utf8");
if (!api.includes("https://voiceprint-api.onrender.com")) {
  throw new Error("Primary Render API is not the frontend default");
}
if (api.includes("https://voiceprint-api-v4.onrender.com")) {
  throw new Error("Legacy Render API must not be the frontend default");
}

for (const file of ["src/hooks/usePhase8DeploymentStatus.js", "src/hooks/usePhase10Readiness.js"]) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes("https://voiceprint-api.onrender.com")) {
    throw new Error("Primary Render API default is missing in " + file);
  }
  if (source.includes("voiceprint-api-v4.onrender.com")) {
    throw new Error("Legacy Render API is still referenced by " + file);
  }
  if (!source.includes('phase-18')) {
    throw new Error("Phase 18 readiness parity is missing in " + file);
  }
}

const app = fs.readFileSync("src/Phase8App.jsx", "utf8");
if (!app.includes("VoicePrint v0.17 · Phase 18")) {
  throw new Error("App shell release marker is not Phase 18");
}

for (const file of ["server/index.js", "server/index-phase4.js"]) {
  const server = fs.readFileSync(file, "utf8");
  if (!server.includes('phase: "17"')) throw new Error("Phase 18 API marker missing in " + file);
  for (const marker of [
    "microphoneAutoRecovery: true",
    "serverTimedConfirmation: true",
    "deploymentSafeDefaults: true",
    "clapTransientFiltering: true",
    "sensorWarmup: true",
    "locationSyncDebounce: true",
  ]) {
    if (!server.includes(marker)) throw new Error("Phase 18 backend feature marker missing in " + file + ": " + marker);
  }
}

const sensor = fs.readFileSync("src/hooks/useSafetySensors.js", "utf8");
if (!sensor.includes("pulseMs >= 30 && pulseMs <= 320")) throw new Error("Clap pulse-duration filter is missing");

const sw = fs.readFileSync("public/sw.js", "utf8");
if (!sw.includes("voiceprint-shell-v18")) throw new Error("PWA cache namespace is not v17");

const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const serverPackage = JSON.parse(fs.readFileSync("server/package.json", "utf8"));
if (rootPackage.version !== "0.18.0") throw new Error("Frontend version is not 0.18.0");
if (serverPackage.version !== "0.18.0") throw new Error("Backend version is not 0.18.0");

console.log("VoicePrint Phase 18 release verification passed.");
