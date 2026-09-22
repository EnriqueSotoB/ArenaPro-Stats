#!/usr/bin/env node
/**
 * Descubre archivos *.test.mjs bajo test/ sin depender del glob del shell
 * (funciona igual en Windows local y en Linux CI).
 */
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const testRoot = join(root, "test");

function collect(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) collect(p, out);
    else if (ent.name.endsWith(".test.mjs")) out.push(p);
  }
  return out;
}

const files = collect(testRoot).sort();
if (!files.length) {
  console.error("No se encontraron archivos *.test.mjs en test/");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
  cwd: root,
});
process.exit(result.status === null ? 1 : result.status);
