#!/usr/bin/env node
/**
 * Revisa el sitio en vivo. Sale con código 1 si hay problemas (el workflow "Monitor" avisa).
 * Uso: node scripts/monitor-sitio.mjs [url]
 */
import { execFileSync } from "node:child_process";
import { revisarSitio } from "./lib/monitor.mjs";

const baseUrl = process.argv[2] || "https://estadisticas.arenapro.mx/";

function commitDeMain() {
  try {
    const [sha, fecha] = execFileSync("git", ["log", "-1", "--format=%H %cI", "origin/main"], { encoding: "utf8" })
      .trim()
      .split(" ");
    return { commitMain: sha, fechaCommitMain: new Date(fecha) };
  } catch {
    return {};
  }
}

const problemas = await revisarSitio({ baseUrl, ...commitDeMain() });
if (problemas.length) {
  console.error(`Problemas en ${baseUrl}:`);
  for (const p of problemas) console.error(`- ${p}`);
  process.exit(1);
}
console.log(`${baseUrl} OK`);
