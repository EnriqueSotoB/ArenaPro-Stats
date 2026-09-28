#!/usr/bin/env node
/** Regenera templates/evento-manual.xlsx */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writePlantillaExcel } from "./lib/excel-evento.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "templates", "evento-manual.xlsx");
mkdirSync(dirname(out), { recursive: true });
await writePlantillaExcel(out);
console.log(`OK → ${out}`);
