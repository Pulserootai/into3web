import { mkdir, cp, copyFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
const target = resolve("build/payment-api");
await mkdir(target, { recursive: true });
await cp("backend", target + "/backend", {
  recursive: true,
  filter: (p) => !p.includes("test") && !p.endsWith("env.example"),
});
for (const f of ["package.json", "package-lock.json"])
  await copyFile(f, target + "/" + f);
const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["ci", "--omit=dev", "--ignore-scripts"],
  { cwd: target, stdio: "inherit", shell: process.platform === "win32" },
);
if (result.status !== 0) process.exit(1);
console.log(
  "AWS package prepared at " + target + " (no .env or private data copied).",
);
