import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toPuntosEntero } from "../../scripts/lib/points.mjs";

describe("toPuntosEntero", () => {
  it("normaliza a entero ≥ 0", () => {
    assert.equal(toPuntosEntero(null), 0);
    assert.equal(toPuntosEntero(""), 0);
    assert.equal(toPuntosEntero(-3), 0);
    assert.equal(toPuntosEntero("100"), 100);
  });

  it("redondea fracciones de empate de Time", () => {
    assert.equal(toPuntosEntero(22.666666666666668), 23);
    assert.equal(toPuntosEntero(1.4545454545454546), 1);
    assert.equal(toPuntosEntero(94.5), 95);
    assert.equal(toPuntosEntero(18.5), 19);
  });
});
