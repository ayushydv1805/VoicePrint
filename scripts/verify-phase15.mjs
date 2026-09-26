import fs from "node:fs";

const requiredFiles = [
  "vercel.json",
  "src/Phase8App.jsx",
  "src/phase8-entry.jsx",
  "src/hooks/useSafetySensors.js",
  "src/hooks/usePhase4Core.js",
  "src/components/Phase4Home.jsx",
  "src/components/Phase4Control.jsx",
  "public/sw.js",
  "server/index.js",
  "server/index-phase4.js",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error("Missing required Phase 15 file: " + file);
}

const sensor = fs.readFileSync("src/hooks/useSafetySensors.js", "utf8");
for (const marker of ["startingRef", "streamRef.current || startingRef.current", "setListening(true)"]) {
  if (!sensor.includes(marker)) throw new Error("Automatic microphone guard missing: " + marker);
}

const core = fs.readFileSync("src/hooks/usePhase4Core.js", "utf8");
if (!core.includes("if (!ready || !active || listening) return;") || !core.includes("startMic();")) {
  throw new Error("Microphone does not auto-start with active protection");
}

const home = fs.readFileSync("src/components/Phase4Home.jsx", "utf8");
if (home.includes("Start clap detection") || home.includes('onClick={onMic}')) {
  throw new Error("Home still exposes a manual clap-start control");
}

const control = fs.readFileSync("src/components/Phase4Control.jsx", "utf8");
if (control.includes("START LISTENING") || control.includes("STOP LISTENING")) {
  throw new Error("Control page still exposes manual listening controls");
}
if (!control.includes("LISTENING AUTOMATICALLY")) {
  throw new Error("Automatic listening status missing");
}

const app = fs.readFileSync("src/Phase8App.jsx", "utf8");
if (app.includes("c.listening ? c.stopMic() : c.startMic()")) {
  throw new Error("Settings still exposes a manual microphone start/stop control");
}

const server = fs.readFileSync("server/index.js", "utf8");
for (const marker of ['phase: "15"', "automaticClapListening: true", "autoStartMicrophone: true"]) {
  if (!server.includes(marker)) throw new Error("Phase 15 backend marker missing: " + marker);
}

const sw = fs.readFileSync("public/sw.js", "utf8");
if (!sw.includes("voiceprint-shell-v15")) throw new Error("PWA cache namespace is not v15");

const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const serverPackage = JSON.parse(fs.readFileSync("server/package.json", "utf8"));
if (rootPackage.version !== "0.15.0") throw new Error("Frontend version is not 0.15.0");
if (serverPackage.version !== "0.15.0") throw new Error("Backend version is not 0.15.0");

console.log("VoicePrint Phase 15 release verification passed.");
