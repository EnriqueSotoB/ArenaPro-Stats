import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAllAround } from "../../web/lib/all-around.mjs";

describe("buildAllAround", () => {
  it("excluye quien solo cobró en una disciplina", () => {
    const allAround = buildAllAround([
      {
        competidorKey: "name:solo",
        nombre: "Solo Uno",
        disciplinaId: "Barriles",
        disciplinaNombre: "Barriles",
        dineroTotal: 10000,
      },
      {
        competidorKey: "name:solo",
        nombre: "Solo Uno",
        disciplinaId: "LazoDeBecerro",
        disciplinaNombre: "Lazo de Becerro",
        dineroTotal: 0,
      },
    ]);
    assert.equal(allAround.length, 0);
  });

  it("suma dinero de dos o más disciplinas", () => {
    const allAround = buildAllAround([
      {
        competidorKey: "name:duo",
        nombre: "Duo Rider",
        disciplinaId: "Barriles",
        disciplinaNombre: "Barriles",
        dineroTotal: 12500,
      },
      {
        competidorKey: "name:duo",
        nombre: "Duo Rider",
        disciplinaId: "LazoDeBecerro",
        disciplinaNombre: "Lazo de Becerro",
        dineroTotal: 15500,
      },
      {
        competidorKey: "name:solo",
        nombre: "Solo Uno",
        disciplinaId: "Barriles",
        disciplinaNombre: "Barriles",
        dineroTotal: 90000,
      },
    ]);
    assert.equal(allAround.length, 1);
    assert.equal(allAround[0].nombre, "Duo Rider");
    assert.equal(allAround[0].dineroTotal, 28000);
    assert.deepEqual(allAround[0].disciplinas, [
      "Barriles",
      "LazoDeBecerro",
    ]);
  });

  it("trata Cabecero y Pialador como disciplinas distintas", () => {
    const allAround = buildAllAround([
      {
        competidorKey: "name:tr",
        nombre: "TR Rider",
        disciplinaId: "TeamRopingHeader",
        disciplinaNombre: "Lazo por Parejas — Cabeceros",
        dineroTotal: 5000,
      },
      {
        competidorKey: "name:tr",
        nombre: "TR Rider",
        disciplinaId: "TeamRopingHeeler",
        disciplinaNombre: "Lazo por Parejas — Pialadores",
        dineroTotal: 4000,
      },
    ]);
    assert.equal(allAround.length, 1);
    assert.equal(allAround[0].dineroTotal, 9000);
    assert.equal(allAround[0].disciplinas.length, 2);
  });

  it("desempata por más disciplinas, luego mayor premio, luego nombre", () => {
    const allAround = buildAllAround([
      {
        competidorKey: "name:b",
        nombre: "Beta",
        disciplinaId: "Barriles",
        disciplinaNombre: "Barriles",
        dineroTotal: 5000,
      },
      {
        competidorKey: "name:b",
        nombre: "Beta",
        disciplinaId: "LazoDeBecerro",
        disciplinaNombre: "Lazo de Becerro",
        dineroTotal: 5000,
      },
      {
        competidorKey: "name:a",
        nombre: "Alpha",
        disciplinaId: "Barriles",
        disciplinaNombre: "Barriles",
        dineroTotal: 10000,
      },
      {
        competidorKey: "name:a",
        nombre: "Alpha",
        disciplinaId: "LazoDeBecerro",
        disciplinaNombre: "Lazo de Becerro",
        dineroTotal: 1,
      },
      {
        competidorKey: "name:a",
        nombre: "Alpha",
        disciplinaId: "LazoEnFalso",
        disciplinaNombre: "Lazo en Falso",
        dineroTotal: 1,
      },
    ]);
    // Alpha 10002 (3 disc) vs Beta 10000 (2 disc) → Alpha primero por dinero
    assert.equal(allAround[0].nombre, "Alpha");
    assert.equal(allAround[1].nombre, "Beta");

    const tied = buildAllAround([
      {
        competidorKey: "name:x",
        nombre: "Xena",
        disciplinaId: "Barriles",
        disciplinaNombre: "Barriles",
        dineroTotal: 8000,
      },
      {
        competidorKey: "name:x",
        nombre: "Xena",
        disciplinaId: "LazoDeBecerro",
        disciplinaNombre: "Lazo de Becerro",
        dineroTotal: 2000,
      },
      {
        competidorKey: "name:y",
        nombre: "Yuri",
        disciplinaId: "Barriles",
        disciplinaNombre: "Barriles",
        dineroTotal: 6000,
      },
      {
        competidorKey: "name:y",
        nombre: "Yuri",
        disciplinaId: "LazoDeBecerro",
        disciplinaNombre: "Lazo de Becerro",
        dineroTotal: 2000,
      },
      {
        competidorKey: "name:y",
        nombre: "Yuri",
        disciplinaId: "LazoEnFalso",
        disciplinaNombre: "Lazo en Falso",
        dineroTotal: 2000,
      },
    ]);
    // Empate 10000: Yuri tiene 3 disciplinas → primero
    assert.equal(tied[0].nombre, "Yuri");
    assert.equal(tied[1].nombre, "Xena");
  });

  describe("por puntos", () => {
    const fila = (key, disciplinaId, puntosTotales, dineroTotal = 0) => ({
      competidorKey: key,
      nombre: key.toUpperCase(),
      disciplinaId,
      disciplinaNombre: disciplinaId,
      puntosTotales,
      dineroTotal,
    });

    it("califica con puntos en 2+ disciplinas aunque no haya cobrado", () => {
      const aa = buildAllAround(
        [fila("ana", "Barriles", 40), fila("ana", "LazoDeBecerro", 25.5), fila("bea", "Barriles", 90)],
        "puntos"
      );
      assert.equal(aa.length, 1);
      assert.equal(aa[0].nombre, "ANA");
      assert.equal(aa[0].puntosTotales, 65.5);
      assert.deepEqual(aa[0].disciplinas, ["Barriles", "LazoDeBecerro"]);
      assert.deepEqual(aa[0].detalle.map((d) => d.puntos), [40, 25.5]);
    });

    it("no cuenta disciplinas sin puntos y ordena por puntos, no por dinero", () => {
      const aa = buildAllAround(
        [
          fila("ana", "Barriles", 50, 100),
          fila("ana", "LazoDeBecerro", 50, 100),
          fila("rico", "Barriles", 10, 90000),
          fila("rico", "LazoDeBecerro", 10, 90000),
          fila("cero", "Barriles", 80),
          fila("cero", "LazoDeBecerro", 0, 5000),
        ],
        "puntos"
      );
      assert.deepEqual(aa.map((r) => r.nombre), ["ANA", "RICO"]);
    });
  });
});
