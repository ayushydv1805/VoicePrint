import fs from "node:fs";

const requiredFiles = [
  "vercel.json",
  "src/Phase8App.jsx",
  "src/hooks/useSafetySensors.js",
  "src/hooks/usePhase4Core.js",
  "src/components/Phase4Home.jsx",
  "src/components/Phase4Control.jsx",
  "src/components/Phase4Modal.jsx",
  "src/lib/apiAuth.js",
  "public/sw.js",
  "server/index.js",
  "server/index-phase4.js",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error("Missing required Phase 17 file: " + file);
}

const sensor = fs.readFileSync("src/hooks/useSafetySensors.js", "utf8");
for (const marker of [
  "scheduleRestart",
  "handleStreamEnded",
  "visibilitychange",
  "pageshow",
  "setMicRecovering",
  "startingRef",
]) {
  if (!sensor.includes(marker)) throw new Error("Microphone recovery marker missing: " + marker);
}

const core = fs.readFileSync("src/hooks/usePhase4Core.js", "utf8");
if (!core.includes("if (!ready || !active || open || listening) return;") || !core.includes("startMic();")) {
  throw new Error("Microphone automatic startup is missing");
}
if (!core.includes("micRecovering")) throw new Error("Microphone recovery state is not exposed by the core hook");

const modal = fs.readFileSync("src/components/Phase4Modal.jsx", "utf8");
if (!modal.includes("confirmationRemainingSeconds")) {
  throw new Error("SOS modal is not using server-timed confirmation data");
}

const api = fs.readFileSync("src/lib/apiAuth.js", "utf8");
if (!api.includes("https://voiceprint-api.onrender.com")) {
  throw new Error("Primary Render API is not the frontend default");
}
if (api.includes("https://voiceprint-api-v4.onrender.com")) {
  throw new Error("Legacy Render API must not be the frontend default");
}

const app = fs.readFileSync("src/Phase8App.jsx", "utf8");
if (!app.includes("VoicePrint v0.17 · Phase 17")) {
  throw new Error("App shell release marker is not Phase 17");
}

for (const file of ["server/index.js", "server/index-phase4.js"]) {
  const server = fs.readFileSync(file, "utf8");
  if (!server.includes('phase: "17"')) throw new Error("Phase 17 API marker missing in " + file);
  for (const marker of [
    "microphoneAutoRecovery: true",
    "serverTimedConfirmation: true",
    "deploymentSafeDefaults: true",
  ]) {
    if (!server.includes(marker)) throw new Error("Phase 17 backend feature marker missing in " + file + ": " + marker);
  }
}

const sw = fs.readFileSync("public/sw.js", "utf8");
if (!sw.includes("voiceprint-shell-v17")) throw new Error("PWA cache namespace is not v17");

const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const serverPackage = JSON.parse(fs.readFileSync("server/package.json", "utf8"));
if (rootPackage.version !== "0.17.0") throw new Error("Frontend version is not 0.17.0");
if (serverPackage.version !== "0.17.0") throw new Error("Backend version is not 0.17.0");

console.log("VoicePrint Phase 17 release verification passed.");
