import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  cpSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { rebuildTemporada } from "../../scripts/rebuild-temporada.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureEvento = join(here, "..", "fixtures", "mini-evento.json");

describe("rebuildTemporada con aliases", () => {
  /** @type {string} */
  let root;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "arenapro-aliases-"));
    mkdirSync(join(root, "data", "eventos"), { recursive: true });
    cpSync(fixtureEvento, join(root, "data", "eventos", "mini-evento.json"));
    writeFileSync(
      join(root, "data", "manifest.json"),
      JSON.stringify(
        {
          temporadaActiva: "2027",
          titulo: "FMR Tour 2027",
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
    writeFileSync(
      join(root, "data", "competidor-aliases.json"),
      JSON.stringify(
        {
          version: 1,
          aliases: [
            { from: "name:rider uno", to: "name:rider uno canon" },
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

  it("aplica aliases al competidorKey en standings", () => {
    rebuildTemporada(root);
    const temporada = JSON.parse(
      readFileSync(join(root, "data", "temporada.json"), "utf8")
    );
    const uno = temporada.standings.find((s) => s.nombre === "Rider Uno");
    assert.ok(uno);
    assert.equal(uno.competidorKey, "name:rider uno canon");
    assert.equal(uno.puntosTotales, 100);
  });
});
