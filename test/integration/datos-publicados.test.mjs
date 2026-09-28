/**
 * Revisa los datos reales de data/: lo que está en main es lo que ve el público.
 * Si falla aquí, CI bloquea el despliegue de GitHub Pages.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeManifest, circuitoDataFile, eventosDeCircuito } from "../../scripts/lib/circuitos.mjs";
import { problemasDePublicacion } from "../../scripts/lib/integridad.mjs";
import { validateEvento } from "../../scripts/lib/validate-evento.mjs";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");
const readJson = (rel) => JSON.parse(readFileSync(join(dataDir, rel), "utf8"));
const manifest = normalizeManifest(readJson("manifest.json"));

describe("datos publicados en data/", () => {
  it("sin portada vacía ni rodeos duplicados", () => {
    assert.deepEqual(problemasDePublicacion(manifest, (e) => readJson(e.file)), []);
  });

  it("cada evento del manifest existe y es válido", () => {
    for (const entry of manifest.eventos) {
      assert.ok(existsSync(join(dataDir, entry.file)), `Falta ${entry.file}`);
      const v = validateEvento(readJson(entry.file));
      assert.ok(v.ok, `${entry.file}: ${v.errors.join(" ")}`);
    }
  });

  it("los acumulados de circuito están regenerados con los eventos del manifest", () => {
    for (const c of manifest.circuitos) {
      const payload = readJson(circuitoDataFile(c.id));
      assert.equal(
        payload.eventosContados,
        eventosDeCircuito(manifest, c.id).length,
        `${c.nombre}: corre npm run rebuild`
      );
    }
  });

  it("nombres de competidores en mayúsculas", () => {
    for (const c of manifest.circuitos) {
      for (const s of readJson(circuitoDataFile(c.id)).standings) {
        assert.equal(s.nombre, s.nombre.toLocaleUpperCase("es-MX"), `${c.nombre}: ${s.nombre}`);
      }
    }
  });
});
