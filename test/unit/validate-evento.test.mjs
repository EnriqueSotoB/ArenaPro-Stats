import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateEvento } from "../../scripts/lib/validate-evento.mjs";

function baseEvento(overrides = {}) {
  return {
    schemaVersion: 1,
    eventoId: "local:1",
    nombreEvento: "Test",
    categorias: [{ id: "local:c1", nombre: "Abierta", tipo: "Barriles" }],
    clasificacion: [],
    ...overrides,
  };
}

describe("validateEvento", () => {
  it("acepta evento schema 1 válido", () => {
    const r = validateEvento(baseEvento());
    assert.equal(r.ok, true);
    assert.equal(r.errors.length, 0);
  });

  it("falla sin schemaVersion", () => {
    const r = validateEvento(baseEvento({ schemaVersion: undefined }));
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => /schemaVersion/i.test(e)));
  });

  it("falla si la categoría no mapea a disciplina de circuito", () => {
    const r = validateEvento(
      baseEvento({
        categorias: [{ id: "local:x", nombre: "Categoria Rara XYZ", tipo: "" }],
      })
    );
    assert.equal(r.ok, false);
    assert.ok(r.errors.length > 0);
  });

  it("avisa en schema ≥ 2 si falta montoGanado", () => {
    const r = validateEvento(
      baseEvento({
        schemaVersion: 2,
        clasificacion: [
          {
            categoriaId: "local:c1",
            entradas: [
              { nombre: "A", montoGanado: 1000 },
              { nombre: "B" },
            ],
          },
        ],
      })
    );
    assert.equal(r.ok, true);
    assert.ok(r.warnings.some((w) => /montoGanado/i.test(w)));
  });

  it("avisa en schema 1 si ninguna entrada trae dinero", () => {
    const r = validateEvento(
      baseEvento({
        clasificacion: [
          {
            categoriaId: "local:c1",
            entradas: [{ nombre: "A", puntosCircuito: 10 }],
          },
        ],
      })
    );
    assert.equal(r.ok, true);
    assert.ok(r.warnings.some((w) => /montoGanado/i.test(w)));
  });

  it("avisa montos no enteros en schema 2", () => {
    const r = validateEvento(
      baseEvento({
        schemaVersion: 2,
        clasificacion: [
          {
            categoriaId: "local:c1",
            entradas: [{ nombre: "A", montoGanado: 10.5 }],
          },
        ],
      })
    );
    assert.equal(r.ok, true);
    assert.ok(r.warnings.some((w) => /enteros/i.test(w)));
  });
});
