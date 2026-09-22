import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { disciplinaKey, disciplinaLabel } from "../../scripts/rebuild-temporada.mjs";

describe("disciplinaKey", () => {
  it("unifica Barriles / Abierta / Barriles Abierto en Barriles", () => {
    assert.equal(disciplinaKey({ tipo: "Barriles", nombre: "Barriles" }), "Barriles");
    assert.equal(disciplinaKey({ tipo: "Barriles", nombre: "Abierta" }), "Barriles");
    assert.equal(disciplinaKey({ tipo: "Barriles", nombre: "Barriles Abierto" }), "Barriles");
    assert.equal(disciplinaKey({ tipo: "", nombre: "Abierta Barriles" }), "Barriles");
  });

  it("mapea Master de Barriles a BarrilesMasters", () => {
    assert.equal(disciplinaKey({ tipo: "Barriles", nombre: "Master" }), "BarrilesMasters");
    assert.equal(disciplinaKey({ tipo: "Barriles", nombre: "Masters" }), "BarrilesMasters");
    assert.equal(disciplinaKey({ tipo: "BarrilesMasters", nombre: "Master Barriles" }), "BarrilesMasters");
  });

  it("mapea Team Roping abierta y masters", () => {
    assert.equal(disciplinaKey({ tipo: "TeamRoping", nombre: "Abierta" }), "TeamRoping");
    assert.equal(disciplinaKey({ tipo: "TeamRoping", nombre: "Team Roping" }), "TeamRoping");
    assert.equal(disciplinaKey({ tipo: "TeamRoping", nombre: "Masters" }), "TeamRopingMasters");
    assert.equal(disciplinaKey({ tipo: "TeamRopingMasters", nombre: "Team Roping Masters" }), "TeamRopingMasters");
  });

  it("infiere tipo desde el nombre cuando falta tipo", () => {
    assert.equal(disciplinaKey({ nombre: "Lazo de Becerro" }), "LazoDeBecerro");
    assert.equal(disciplinaKey({ nombre: "Jineteos de Toros" }), "JineteosDeToros");
  });
});

describe("disciplinaLabel", () => {
  it("devuelve etiquetas conocidas en español", () => {
    assert.equal(disciplinaLabel("Barriles"), "Barriles");
    assert.equal(disciplinaLabel("TeamRopingMasters"), "Team Roping Masters");
    assert.equal(disciplinaLabel("LazoDeBecerro"), "Lazo de Becerro");
    assert.equal(disciplinaLabel("TeamRopingHeader"), "Team Roping — Headers");
    assert.equal(disciplinaLabel("TeamRopingHeeler"), "Team Roping — Heelers");
    assert.equal(
      disciplinaLabel("TeamRopingMastersHeader"),
      "Team Roping Masters — Headers"
    );
  });
});
