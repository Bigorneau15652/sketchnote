// Bundles every file of tests/ ending in .test.ts, then runs them all with the Node test runner.
import esbuild from "esbuild";
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const files = readdirSync(`tests`).filter((f) => f.endsWith(`.test.ts`));
const outdir = `.test-build`;
await esbuild.build({
  entryPoints: files.map((f) => `tests/${f}`),
  bundle: true,
  platform: `node`,
  format: `cjs`,
  outdir,
  logLevel: `warning`,
  external: [`obsidian`],
});
const run = spawnSync(process.execPath, [`--test`, ...files.map((f) => `${outdir}/${f.replace(/\.ts$/, `.js`)}`)], { stdio: `inherit` });
process.exit(run.status ?? 1);
