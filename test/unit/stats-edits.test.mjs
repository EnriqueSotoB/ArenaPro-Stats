import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDefaultEdits,
  aplicarStatsEdits,
  filaKey,
  listEditableFilas,
  upsertFilaEdit,
} from "../../scripts/lib/stats-edits.mjs";

function sampleEvento() {
  return {
    schemaVersion: 2,
    eventoId: "local:1",
    nombreEvento: "Test",
    categorias: [
      { id: "cat-a", nombre: "Barriles", tipo: "Barriles" },
      { id: "cat-b", nombre: "Lazo", tipo: "LazoDeBecerro" },
    ],
    clasificacion: [
      {
        categoriaId: "cat-a",
        entradas: [
          {
            lugar: 1,
            competidorId: "c1",
            nombre: "Uno",
            puntosCircuito: 100,
            montoGanado: 8000,
          },
          {
            lugar: 2,
            competidorId: "c2",
            nombre: "Dos",
            puntosCircuito: 80,
            montoGanado: 4000,
          },
        ],
      },
      {
        categoriaId: "cat-b",
        entradas: [
          {
            lugar: 1,
            competidorId: "c1",
            nombre: "Uno",
            puntosCircuito: 50,
            montoGanado: 1000,
          },
        ],
      },
    ],
    resultados: [
      { categoriaId: "cat-a", competidorId: "c1", nombre: "Uno", vuelta: 1 },
      { categoriaId: "cat-b", competidorId: "c1", nombre: "Uno", vuelta: 1 },
    ],
  };
}

describe("buildDefaultEdits", () => {
  it("incluye todas las categorías", () => {
    const edits = buildDefaultEdits(sampleEvento());
    assert.deepEqual(edits.categoriasIncluidas, ["cat-a", "cat-b"]);
    assert.equal(edits.filas.length, 0);
  });
});

describe("aplicarStatsEdits", () => {
  it("con edits vacíos/null no pierde datos base", () => {
    const ev = sampleEvento();
    const a = aplicarStatsEdits(ev, null);
    assert.equal(a.categorias.length, 2);
    assert.equal(a.clasificacion[0].entradas.length, 2);
    assert.notEqual(a, ev);
  });

  it("excluye categorías no incluidas (cherry-pick)", () => {
    const edits = buildDefaultEdits(sampleEvento());
    edits.categoriasIncluidas = ["cat-a"];
    const out = aplicarStatsEdits(sampleEvento(), edits);
    assert.equal(out.categorias.length, 1);
    assert.equal(out.categorias[0].id, "cat-a");
    assert.equal(out.clasificacion.length, 1);
    assert.equal(out.resultados.every((r) => r.categoriaId === "cat-a"), true);
  });

  it("aplica override de nombre, puntos y monto", () => {
    const ev = sampleEvento();
    const key = filaKey(ev.clasificacion[0].entradas[0], "cat-a", "clasif");
    const edits = buildDefaultEdits(ev);
    upsertFilaEdit(edits, key, {
      nombre: "Uno Editado",
      puntosCircuito: 120,
      montoGanado: 9000,
    });
    const out = aplicarStatsEdits(ev, edits);
    const ent = out.clasificacion[0].entradas[0];
    assert.equal(ent.nombre, "Uno Editado");
    assert.equal(ent.puntosCircuito, 120);
    assert.equal(ent.montoGanado, 9000);
  });

  it("excluye una fila puntual", () => {
    const ev = sampleEvento();
    const key = filaKey(ev.clasificacion[0].entradas[1], "cat-a", "clasif");
    const edits = buildDefaultEdits(ev);
    upsertFilaEdit(edits, key, { excluir: true });
    const out = aplicarStatsEdits(ev, edits);
    assert.equal(out.clasificacion[0].entradas.length, 1);
    assert.equal(out.clasificacion[0].entradas[0].competidorId, "c1");
  });

  it("persiste statsEdits en el evento aplicado", () => {
    const edits = buildDefaultEdits(sampleEvento());
    const out = aplicarStatsEdits(sampleEvento(), edits);
    assert.ok(out.statsEdits);
    assert.equal(out.statsEdits.version, 1);
    assert.ok(out.statsEdits.editadoEn);
  });
});

describe("listEditableFilas", () => {
  it("lista entradas de clasificación con overrides", () => {
    const ev = sampleEvento();
    const key = filaKey(ev.clasificacion[0].entradas[0], "cat-a", "clasif");
    const edits = buildDefaultEdits(ev);
    upsertFilaEdit(edits, key, { montoGanado: 1, excluir: true });
    const rows = listEditableFilas(ev, "cat-a", edits);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].montoGanado, 1);
    assert.equal(rows[0].excluir, true);
  });
});
