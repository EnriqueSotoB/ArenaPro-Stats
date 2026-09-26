import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TEAM_ROPING_MONEY_SPLIT,
  splitMoneyMxn,
  toMontoEntero,
  fmtMxn,
} from "../../scripts/lib/money.mjs";

describe("toMontoEntero", () => {
  it("normaliza a entero ≥ 0", () => {
    assert.equal(toMontoEntero(null), 0);
    assert.equal(toMontoEntero(""), 0);
    assert.equal(toMontoEntero(12.9), 12);
    assert.equal(toMontoEntero(-5), 0);
    assert.equal(toMontoEntero("8000"), 8000);
  });
});

describe("fmtMxn", () => {
  it("formatea montos MXN sin decimales", () => {
    assert.equal(fmtMxn(12500), "$12,500");
    assert.equal(fmtMxn(0), "$0");
    assert.equal(fmtMxn(null), "—");
    assert.equal(fmtMxn(""), "—");
    assert.equal(fmtMxn(12.9), "$12");
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
});
