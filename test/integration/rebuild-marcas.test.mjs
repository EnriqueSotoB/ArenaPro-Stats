import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCircuitoStandings } from "../../tools/rebuild-temporada.mjs";

const evento = {
  eventoId: "local:1",
  nombreEvento: "Rodeo Prueba",
  fecha: "2027-03-01",
  categorias: [
    { id: "c-bar", nombre: "Barriles", tipo: "Barriles" },
    { id: "c-tr", nombre: "Abierta", tipo: "TeamRoping" },
  ],
  clasificacion: [
    {
      categoriaId: "c-bar",
      entradas: [
        { lugar: 1, sinPosicion: false, recorridoCompleto: true, nombre: "Ana", tiempoTotal: 36.84, puntosCircuito: 100, detalleVueltas: "Primera: 18.145 · Rodeo: 18.695" },
        { lugar: null, sinPosicion: true, recorridoCompleto: false, nombre: "Bea", tiempoTotal: null, puntosCircuito: 0, detalleVueltas: "Primera: NP · Rodeo: NP" },
      ],
    },
    {
      categoriaId: "c-tr",
      entradas: [
        { lugar: 1, recorridoCompleto: true, nombre: "Juan / Pedro", tiempoTotal: 14.72, puntosCircuito: 50, detalleVueltas: "Primera: 8.250 · Rodeo: 6.470" },
        { lugar: 3, recorridoCompleto: true, nombre: "Juan / Luis", tiempoTotal: 18.1, puntosCircuito: 30, detalleVueltas: "Primera: 9.000 · Rodeo: 9.100" },
      ],
    },
  ],
};

describe("rebuild: marcas en el historial", () => {
  const { competidores } = buildCircuitoStandings(
    [{ id: "local:1", nombre: "Rodeo Prueba", fecha: "2027-03-01", file: "x.json" }],
    () => evento,
    new Map()
  );
  const de = (nombre, disc) => competidores.find((c) => c.nombre === nombre).historial.find((h) => h.disciplinaId === disc);

  it("guarda lugar, total y recorridos de la clasificación", () => {
    const ana = de("ANA", "Barriles");
    assert.equal(ana.lugar, 1);
    assert.equal(ana.marca, 36.84);
    assert.deepEqual(ana.recorridos, [18.145, 18.695]);
    assert.equal(ana.limpio, true);

    const bea = de("BEA", "Barriles");
    assert.equal(bea.lugar, null);
    assert.equal(bea.limpio, false);
  });

  it("cabecero en dos parejas: mejor lugar y todos sus recorridos", () => {
    const juan = de("JUAN", "TeamRopingHeader");
    assert.equal(juan.lugar, 1);
    assert.equal(juan.marca, 14.72);
    assert.deepEqual(juan.recorridos, [8.25, 6.47, 9, 9.1]);
    assert.equal(de("LUIS", "TeamRopingHeeler").lugar, 3);
  });
});
