import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TEAM_ROPING_MONEY_SPLIT,
  splitMoneyMxn,
  toMontoEntero,
  fmtMxn,
} from "../../web/lib/money.mjs";

describe("toMontoEntero", () => {
  it("normaliza a monto ≥ 0 conservando 1 decimal", () => {
    assert.equal(toMontoEntero(null), 0);
    assert.equal(toMontoEntero(""), 0);
    assert.equal(toMontoEntero(12.9), 12.9);
    assert.equal(toMontoEntero(12.94), 12.9);
    assert.equal(toMontoEntero(12.95), 13);
    assert.equal(toMontoEntero(-5), 0);
    assert.equal(toMontoEntero("8000"), 8000);
    assert.equal(toMontoEntero("62278.9"), 62278.9);
  });
});

describe("fmtMxn", () => {
  it("formatea montos MXN con decimal solo si aplica", () => {
    assert.equal(fmtMxn(12500), "$12,500");
    assert.equal(fmtMxn(0), "$0");
    assert.equal(fmtMxn(null), "—");
    assert.equal(fmtMxn(""), "—");
    assert.equal(fmtMxn(12.9), "$12.9");
    assert.equal(fmtMxn(62278.9), "$62,278.9");
  });
});

describe("splitMoneyMxn", () => {
  it("usa split 50/50 confirmado cabecero/pialador", () => {
    assert.equal(TEAM_ROPING_MONEY_SPLIT, 0.5);
  });

  it("parte montos pares", () => {
    assert.deepEqual(splitMoneyMxn(0), { header: 0, heeler: 0 });
    assert.deepEqual(splitMoneyMxn(10000), { header: 5000, heeler: 5000 });
  });

  it("con monto impar da resto al heeler y suma exacta", () => {
    const s = splitMoneyMxn(10001);
    assert.deepEqual(s, { header: 5000, heeler: 5001 });
    assert.equal(s.header + s.heeler, 10001);
  });

  it("parte 1 peso", () => {
    assert.deepEqual(splitMoneyMxn(1), { header: 0, heeler: 1 });
  });

  it("parte décimas", () => {
    const s = splitMoneyMxn(100.5);
    assert.deepEqual(s, { header: 50.2, heeler: 50.3 });
    assert.equal(s.header + s.heeler, 100.5);
  });
});
