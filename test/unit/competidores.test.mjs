import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  finalizeCompetidores,
  pushCompetidorEvento,
  searchCompetidores,
} from "../../scripts/lib/competidores.mjs";

describe("competidores index", () => {
  it("arma historial y totales por persona", () => {
    const accum = new Map();
    pushCompetidorEvento(
      accum,
      {
        competidorKey: "name:rider uno",
        competidorId: "local:r1",
        nombre: "Rider Uno",
        disciplinaId: "Barriles",
        disciplinaNombre: "Barriles",
        puntos: 100,
        dinero: 5000,
      },
      { id: "ev1", nombre: "Rodeo A", fecha: "2027-01-01", sede: "Arena" }
    );
    pushCompetidorEvento(
      accum,
      {
        competidorKey: "name:rider uno",
        nombre: "Rider Uno",
        disciplinaId: "Barriles",
        disciplinaNombre: "Barriles",
        puntos: 50,
        dinero: 0,
      },
      { id: "ev2", nombre: "Rodeo B", fecha: "2027-02-01", sede: "Arena" }
    );

    const standings = [
      {
        competidorKey: "name:rider uno",
        competidorId: "local:r1",
        nombre: "Rider Uno",
        disciplinaId: "Barriles",
        disciplinaNombre: "Barriles",
        puntosTotales: 150,
        dineroTotal: 5000,
        eventos: 2,
      },
    ];

    const list = finalizeCompetidores(accum, standings);
    assert.equal(list.length, 1);
    const c = list[0];
    assert.equal(c.nombre, "Rider Uno");
    assert.equal(c.puntosTotales, 150);
    assert.equal(c.dineroTotal, 5000);
    assert.equal(c.eventos, 2);
    assert.equal(c.disciplinas.length, 1);
    assert.equal(c.historial.length, 2);
    assert.equal(c.historial[0].eventoId, "ev2");
  });

  it("busca por prefijo e inclusión", () => {
    const comps = [
      { competidorKey: "name:chale ochoa", nombre: "CHALE OCHOA" },
      { competidorKey: "name:sergio urrutia", nombre: "Sergio Urrutia" },
      { competidorKey: "name:gael saenz", nombre: "Gael Saenz" },
    ];
    const hits = searchCompetidores("ocho", comps);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].nombre, "CHALE OCHOA");
    assert.equal(searchCompetidores("xyz", comps).length, 0);
  });
});
