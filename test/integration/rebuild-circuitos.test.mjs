import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  cpSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { rebuildTemporada } from "../../scripts/rebuild-temporada.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureEvento = join(here, "..", "fixtures", "mini-evento.json");

describe("rebuildTemporada por circuito", () => {
  /** @type {string} */
  let root;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "arenapro-circuitos-"));
    mkdirSync(join(root, "data", "eventos"), { recursive: true });
    mkdirSync(join(root, "data", "circuitos"), { recursive: true });
    cpSync(fixtureEvento, join(root, "data", "eventos", "a.json"));
    cpSync(fixtureEvento, join(root, "data", "eventos", "b.json"));
    writeFileSync(join(root, "data", "temporada.json"), "{}", "utf8");
    writeFileSync(join(root, "data", "circuitos", "borrado.json"), "{}", "utf8");
    writeFileSync(
      join(root, "data", "manifest.json"),
      JSON.stringify({
        version: 2,
        circuitoDefault: "aerch-circuito-2027",
        asociaciones: [
          { id: "aerch", siglas: "AERCH", nombre: "Asociación Estatal de Rodeo de Chihuahua", tipo: "estatal" },
          { id: "fmr", siglas: "FMR", nombre: "Federación Mexicana de Rodeo", tipo: "federacion" },
        ],
        circuitos: [
          { id: "aerch-circuito-2027", asociacionId: "aerch", nombre: "AERCH Circuito 2027", temporada: "2027" },
          { id: "fmr-tour-2027", asociacionId: "fmr", nombre: "FMR Tour 2027", temporada: "2027" },
          { id: "aerch-circuito-2028", asociacionId: "aerch", nombre: "AERCH Circuito 2028", temporada: "2028" },
        ],
        eventos: [
          { id: "ev-a", nombre: "A", fecha: "2027-01-01", file: "eventos/a.json", circuitos: ["aerch-circuito-2027", "fmr-tour-2027"] },
          { id: "ev-b", nombre: "B", fecha: "2027-02-01", file: "eventos/b.json", circuitos: ["aerch-circuito-2027"] },
        ],
      }),
      "utf8"
    );
  });

  after(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("cada circuito suma solo sus eventos", () => {
    const result = rebuildTemporada(root);
    assert.equal(result.circuitos.length, 3);
    assert.equal(result.circuitoDefault, "aerch-circuito-2027");

    const leer = (id) =>
      JSON.parse(readFileSync(join(root, "data", "circuitos", `${id}.json`), "utf8"));
    const puntosUno = (payload) =>
      payload.standings.find((s) => s.nombre === "Rider Uno" && s.disciplinaId === "Barriles")
        ?.puntosTotales;

    const aerch = leer("aerch-circuito-2027");
    assert.equal(aerch.eventosContados, 2);
    assert.equal(aerch.asociacionSiglas, "AERCH");
    assert.equal(puntosUno(aerch), 200);

    const fmr = leer("fmr-tour-2027");
    assert.equal(fmr.eventosContados, 1);
    assert.equal(puntosUno(fmr), 100);

    const vacio = leer("aerch-circuito-2028");
    assert.equal(vacio.eventosContados, 0);
    assert.deepEqual(vacio.standings, []);
  });

  it("borra salidas de circuitos eliminados y el temporada.json viejo", () => {
    rebuildTemporada(root);
    assert.equal(existsSync(join(root, "data", "circuitos", "borrado.json")), false);
    assert.equal(existsSync(join(root, "data", "temporada.json")), false);
  });
});
