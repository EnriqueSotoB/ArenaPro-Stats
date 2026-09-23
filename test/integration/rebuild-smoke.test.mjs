import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { rebuildTemporada } from "../../scripts/rebuild-temporada.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureEvento = join(here, "..", "fixtures", "mini-evento.json");

describe("rebuildTemporada (smoke)", () => {
  /** @type {string} */
  let root;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "arenapro-stats-"));
    mkdirSync(join(root, "data", "eventos"), { recursive: true });
    cpSync(fixtureEvento, join(root, "data", "eventos", "mini-evento.json"));
    writeFileSync(
      join(root, "data", "manifest.json"),
      JSON.stringify(
        {
          temporadaActiva: "2027",
          titulo: "FMR Tour 2027",
          cutLine: null,
          cutLineVisible: false,
          eventos: [
            {
              id: "local:test-1",
              nombre: "Evento Fixture Mini",
              fecha: "2027-01-01",
              sede: "Arena Test",
              file: "eventos/mini-evento.json",
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );
  });

  after(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("suma puntosCircuito por competidor y disciplina", () => {
    const result = rebuildTemporada(root);
    assert.equal(result.eventosContados, 1);
    assert.equal(result.temporada, "2027");
    assert.ok(result.standings >= 2);

    const temporada = JSON.parse(readFileSync(join(root, "data", "temporada.json"), "utf8"));
    assert.equal(temporada.titulo, "FMR Tour 2027");

    const barriles = temporada.standings.filter((s) => s.disciplinaId === "Barriles");
    assert.equal(barriles.length, 2);

    const uno = barriles.find((s) => s.nombre === "Rider Uno");
    const dos = barriles.find((s) => s.nombre === "Rider Dos");
    assert.ok(uno);
    assert.ok(dos);
    assert.equal(uno.puntosTotales, 100);
    assert.equal(dos.puntosTotales, 80);
    assert.equal(uno.eventos, 1);
    assert.equal(uno.dineroTotal, 0);
    assert.equal(dos.dineroTotal, 0);
  });
});
