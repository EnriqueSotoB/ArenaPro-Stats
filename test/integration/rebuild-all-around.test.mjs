import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rebuildTemporada } from "../../scripts/rebuild-temporada.mjs";

function writeManifest(root, eventos) {
  writeFileSync(
    join(root, "data", "manifest.json"),
    JSON.stringify(
      {
        temporadaActiva: "2027",
        titulo: "FMR Tour 2027",
        cutLineVisible: false,
        eventos,
      },
      null,
      2
    ),
    "utf8"
  );
  writeFileSync(
    join(root, "data", "competidor-aliases.json"),
    JSON.stringify({ version: 1, aliases: [] }, null, 2),
    "utf8"
  );
}

function eventoDual(id, nombre, entradasPorCat) {
  const categorias = Object.keys(entradasPorCat).map((catId, i) => ({
    id: catId,
    nombre: catId.includes("lazo") ? "Lazo de Becerro" : "Barriles",
    tipo: catId.includes("lazo") ? "LazoDeBecerro" : "Barriles",
  }));
  return {
    schemaVersion: 2,
    eventoId: id,
    nombreEvento: nombre,
    fecha: "2027-03-01",
    temporada: "2027",
    categorias,
    clasificacion: Object.entries(entradasPorCat).map(([categoriaId, entradas]) => ({
      categoriaId,
      entradas,
    })),
    resultados: [],
  };
}

describe("rebuildTemporada allAround", () => {
  /** @type {string} */
  let root;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "arenapro-aa-"));
    mkdirSync(join(root, "data", "eventos"), { recursive: true });

    const e1 = eventoDual("local:aa-1", "AA Event 1", {
      "local:barriles": [
        {
          lugar: 1,
          competidorId: "local:duo",
          nombre: "Duo Rider",
          puntosCircuito: 100,
          montoGanado: 12500,
        },
        {
          lugar: 2,
          competidorId: "local:solo",
          nombre: "Solo Rider",
          puntosCircuito: 90,
          montoGanado: 8000,
        },
      ],
      "local:lazo": [
        {
          lugar: 1,
          competidorId: "local:duo",
          nombre: "Duo Rider",
          puntosCircuito: 80,
          montoGanado: 15500,
        },
      ],
    });
    writeFileSync(
      join(root, "data", "eventos", "aa.json"),
      JSON.stringify(e1, null, 2),
      "utf8"
    );
    writeManifest(root, [
      {
        id: "local:aa-1",
        nombre: "AA Event 1",
        fecha: "2027-03-01",
        sede: "Arena Test",
        file: "eventos/aa.json",
      },
    ]);
  });

  after(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("genera allAround solo para quienes cobraron en ≥2 disciplinas", () => {
    rebuildTemporada(root);
    const temporada = JSON.parse(
      readFileSync(join(root, "data", "temporada.json"), "utf8")
    );
    assert.ok(Array.isArray(temporada.allAround));
    assert.equal(temporada.allAround.length, 1);
    assert.equal(temporada.allAround[0].nombre, "Duo Rider");
    assert.equal(temporada.allAround[0].dineroTotal, 28000);
    assert.equal(temporada.allAround[0].disciplinasConDinero.length, 2);
  });
});
