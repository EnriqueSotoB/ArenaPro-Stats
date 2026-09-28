#!/usr/bin/env node
/**
 * Arma _site/ = web/ + data/ (sin datos internos ni notas de jueces)
 * y versiona CSS/JS en los HTML para que un visitante no mezcle código viejo con datos nuevos.
 * Uso: node tools/build-site.mjs [version]   (en CI la versión es el commit)
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { DATA_SOLO_INTERNA, eventoParaPublico } from "./lib/publico.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "_site");

function version() {
  if (process.argv[2]) return process.argv[2].slice(0, 12);
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return String(Date.now());
  }
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, "web"), out, { recursive: true });
cpSync(join(root, "data"), join(out, "data"), { recursive: true });
writeFileSync(join(out, ".nojekyll"), "");

for (const rel of DATA_SOLO_INTERNA) rmSync(join(out, "data", rel), { force: true });
const eventosDir = join(out, "data", "eventos");
for (const f of readdirSync(eventosDir).filter((n) => n.endsWith(".json"))) {
  const file = join(eventosDir, f);
  const evento = JSON.parse(readFileSync(file, "utf8"));
  writeFileSync(file, `${JSON.stringify(eventoParaPublico(evento), null, 2)}\n`);
}

const v = version();
for (const rel of readdirSync(out).filter((n) => n.endsWith(".html"))) {
  const file = join(out, rel);
  const html = readFileSync(file, "utf8").replace(
    /((?:href|src)="(?:\.?\/)?(?:css|js)\/[^"?]+\.(?:css|js))"/g,
    `$1?v=${v}"`
  );
  writeFileSync(file, html);
}

console.log(`Sitio público listo en _site/ (versión ${v}).`);
