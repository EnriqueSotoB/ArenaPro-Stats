import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toPuntosCircuito } from "../../scripts/lib/points.mjs";

describe("toPuntosCircuito", () => {
  it("normaliza a ≥ 0", () => {
    assert.equal(toPuntosCircuito(null), 0);
    assert.equal(toPuntosCircuito(""), 0);
    assert.equal(toPuntosCircuito(-3), 0);
    assert.equal(toPuntosCircuito("100"), 100);
  });

  it("conserva medios puntos como AERCH (Barriles 7.5 / 37.5)", () => {
    assert.equal(toPuntosCircuito(7.5), 7.5);
    assert.equal(toPuntosCircuito(37.5), 37.5);
    assert.equal(toPuntosCircuito(94.5), 94.5);
    assert.equal(toPuntosCircuito(18.5), 18.5);
  });

  it("limpia fracciones basura de Time al medio más cercano", () => {
    assert.equal(toPuntosCircuito(22.666666666666668), 22.5);
    assert.equal(toPuntosCircuito(1.4545454545454546), 1.5);
    assert.equal(toPuntosCircuito(122.83333333333333), 123);
  });
});
