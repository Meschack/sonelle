import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readexDir = join(repoRoot, ".readex");
const venvDir = join(readexDir, "piper-venv");
const voiceDir = join(readexDir, "voices", "piper");
const smokePath = join(readexDir, "piper-smoke.wav");
const voice = process.env.READEX_PIPER_VOICE ?? "en_US-lessac-medium";
const python = process.env.PYTHON ?? "python3";
const venvPython =
  process.platform === "win32"
    ? join(venvDir, "Scripts", "python.exe")
    : join(venvDir, "bin", "python");

mkdirSync(readexDir, { recursive: true });
mkdirSync(voiceDir, { recursive: true });

if (!existsSync(venvPython)) {
  run(python, ["-m", "venv", venvDir], "creating Piper Python environment");
}

run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"], "updating pip");
run(venvPython, ["-m", "pip", "install", "piper-tts"], "installing Piper");
run(
  venvPython,
  ["-m", "piper.download_voices", "--data-dir", voiceDir, voice],
  `downloading ${voice}`
);
run(
  venvPython,
  [
    "-m",
    "piper",
    "--data-dir",
    voiceDir,
    "-m",
    voice,
    "-f",
    smokePath,
    "--",
    "Readex is ready to listen."
  ],
  "testing Piper voice"
);

console.log(`Piper voice ready: ${voice}`);
console.log(`Voice data: ${voiceDir}`);
console.log(`Smoke audio: ${smokePath}`);

function run(command, args, label) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit"
  });

  if (result.error != null) {
    console.error(`Failed while ${label}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`Failed while ${label}.`);
    process.exit(result.status ?? 1);
  }
}
