import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toCsv, filasClasificacion, filasVaqueroCompleto } from "../../web/lib/csv-tablas.mjs";

const temporada = {
  standings: [
    { competidorKey: "a", nombre: "ANA", disciplinaId: "Barriles", disciplinaNombre: "Barriles", puntosTotales: 150, dineroTotal: 5000, eventos: 2 },
    { competidorKey: "b", nombre: "BEA", disciplinaId: "Barriles", disciplinaNombre: "Barriles", puntosTotales: 160.5, dineroTotal: 0, eventos: 1 },
    { competidorKey: "a", nombre: "ANA", disciplinaId: "LazoEnFalso", disciplinaNombre: "Lazo en Falso", puntosTotales: 80, dineroTotal: 1000, eventos: 1 },
  ],
  competidores: [
    {
      competidorKey: "a",
      historial: [
        { eventoId: "e1", disciplinaId: "Barriles", puntos: 100 },
        { eventoId: "e2", disciplinaId: "Barriles", puntos: 50 },
        { eventoId: "e2", disciplinaId: "LazoEnFalso", puntos: 80 },
      ],
    },
    { competidorKey: "b", historial: [{ eventoId: "e2", disciplinaId: "Barriles", puntos: 160.5 }] },
  ],
  allAround: [
    {
      competidorKey: "a",
      nombre: "ANA",
      dineroTotal: 6000,
      disciplinas: ["Barriles", "LazoEnFalso"],
      detalle: [
        { disciplinaId: "Barriles", disciplinaNombre: "Barriles", dinero: 5000 },
        { disciplinaId: "LazoEnFalso", disciplinaNombre: "Lazo en Falso", dinero: 1000 },
      ],
    },
  ],
};
const eventos = [
  { id: "e2", nombre: "Rodeo B", fecha: "2027-02-01" },
  { id: "e1", nombre: "Rodeo A", fecha: "2027-01-01" },
];

describe("csv-tablas", () => {
  it("clasificación por puntos con columna por rodeo en orden de fecha", () => {
    const filas = filasClasificacion(temporada, eventos, "Barriles");
    assert.deepEqual(filas[0], ["Disciplina", "Lugar", "Competidor", "Eventos", "Puntos", "Dinero (MXN)", "Rodeo A (2027-01-01)", "Rodeo B (2027-02-01)"]);
    assert.deepEqual(filas[1], ["Barriles", 1, "BEA", 1, 160.5, 0, null, 160.5]);
    assert.deepEqual(filas[2], ["Barriles", 2, "ANA", 2, 150, 5000, 100, 50]);
    assert.equal(filas.length, 3);
  });

  it("todas las disciplinas, una debajo de otra", () => {
    const filas = filasClasificacion(temporada, eventos);
    assert.deepEqual(filas.slice(1).map((f) => [f[0], f[1], f[2]]), [
      ["Barriles", 1, "BEA"],
      ["Barriles", 2, "ANA"],
      ["Lazo en Falso", 1, "ANA"],
    ]);
  });

  it("sin dinero visible la clasificación no lleva columna de dinero", () => {
    const filas = filasClasificacion({ ...temporada, mostrarDinero: false }, [], "Barriles");
    assert.ok(!filas[0].includes("Dinero (MXN)"));
    assert.equal(filas[1].length, filas[0].length);
  });

  it("Vaquero Completo por puntos", () => {
    const filas = filasVaqueroCompleto({ ...temporada, vaqueroCompleto: "puntos" });
    assert.deepEqual(filas[0], ["Lugar", "Competidor", "Disciplinas con puntos", "Puntos totales", "Barriles (pts)", "Lazo en Falso (pts)"]);
  });

  it("Vaquero Completo con dinero por disciplina", () => {
    const filas = filasVaqueroCompleto(temporada);
    assert.deepEqual(filas[0], ["Lugar", "Competidor", "Disciplinas con dinero", "Dinero total (MXN)", "Barriles (MXN)", "Lazo en Falso (MXN)"]);
    assert.deepEqual(filas[1], [1, "ANA", 2, 6000, 5000, 1000]);
  });

  it("CSV con BOM, comillas cuando hace falta y sin fórmulas", () => {
    const csv = toCsv([
      ["Nombre", "Puntos"],
      ['PEREZ, "EL GÜERO"', 7.5],
      ["=HYPERLINK(1)", null],
    ]);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.equal(csv, '\uFEFFNombre,Puntos\r\n"PEREZ, ""EL GÜERO""",7.5\r\n\'=HYPERLINK(1),\r\n');
  });
});
