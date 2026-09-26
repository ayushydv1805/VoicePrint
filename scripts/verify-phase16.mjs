import fs from "node:fs";

const requiredFiles = [
  "vercel.json",
  "src/Phase8App.jsx",
  "src/hooks/useSafetySensors.js",
  "src/hooks/usePhase4Core.js",
  "src/components/Phase4Home.jsx",
  "src/components/Phase4Control.jsx",
  "public/sw.js",
  "server/index.js",
  "server/index-phase4.js",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error("Missing required Phase 16 file: " + file);
}

const sensor = fs.readFileSync("src/hooks/useSafetySensors.js", "utf8");
for (const marker of [
  "scheduleRestart",
  "handleStreamEnded",
  "visibilitychange",
  "pageshow",
  "setMicRecovering",
  "startingRef",
  "streamRef.current || startingRef.current",
]) {
  if (!sensor.includes(marker)) throw new Error("Microphone recovery marker missing: " + marker);
}

const core = fs.readFileSync("src/hooks/usePhase4Core.js", "utf8");
if (!core.includes("if (!ready || !active || listening) return;") || !core.includes("startMic();")) {
  throw new Error("Microphone automatic startup is missing");
}
if (!core.includes("micRecovering")) throw new Error("Microphone recovery state is not exposed by the core hook");

const home = fs.readFileSync("src/components/Phase4Home.jsx", "utf8");
if (!home.includes("micRecovering") || !home.includes("Reconnecting microphone")) {
  throw new Error("Home recovery UI is missing");
}

const control = fs.readFileSync("src/components/Phase4Control.jsx", "utf8");
if (!control.includes("micRecovering") || !control.includes("RECONNECTING AUTOMATICALLY")) {
  throw new Error("Control recovery UI is missing");
}

const app = fs.readFileSync("src/Phase8App.jsx", "utf8");
if (!app.includes("micRecovering={c.micRecovering}")) {
  throw new Error("App shell is not passing microphone recovery state");
}
if (!app.includes("VoicePrint v0.16 · Phase 16")) {
  throw new Error("App shell release marker is not Phase 16");
}

for (const file of ["server/index.js", "server/index-phase4.js"]) {
  const server = fs.readFileSync(file, "utf8");
  if (!server.includes('phase: "16"')) throw new Error("Phase 16 API marker missing in " + file);
  for (const marker of ["microphoneAutoRecovery: true", "visibilityResume: true", "streamInterruptionRecovery: true"]) {
    if (!server.includes(marker)) throw new Error("Phase 16 backend feature marker missing in " + file + ": " + marker);
  }
  if (!server.includes('process.env.VOICEPRINT_RELEASE || "phase-16"')) {
    throw new Error("Phase 16 release fallback missing in " + file);
  }
}

const sw = fs.readFileSync("public/sw.js", "utf8");
if (!sw.includes("voiceprint-shell-v16")) throw new Error("PWA cache namespace is not v16");

const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const serverPackage = JSON.parse(fs.readFileSync("server/package.json", "utf8"));
if (rootPackage.version !== "0.16.0") throw new Error("Frontend version is not 0.16.0");
if (serverPackage.version !== "0.16.0") throw new Error("Backend version is not 0.16.0");

console.log("VoicePrint Phase 16 release verification passed.");
