import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { marcasDeEntrada, combinarMarcas, resumenCompetidor } from "../../web/lib/marcas.mjs";

describe("marcasDeEntrada", () => {
  it("toma lugar, total y recorridos de una entrada con tiempo", () => {
    const m = marcasDeEntrada(
      { lugar: 1, sinPosicion: false, recorridoCompleto: true, tiempoTotal: 24.08, detalleVueltas: "Primera: 13.240 · Rodeo: 10.840" },
      false
    );
    assert.equal(m.lugar, 1);
    assert.equal(m.marca, 24.08);
    assert.deepEqual(m.recorridos, [13.24, 10.84]);
    assert.deepEqual(m.rondas, ["Primera", "Rodeo"]);
    assert.equal(m.limpio, true);
  });

  it("un NT no deja la suma como limpia (el total trae tiempo de castigo)", () => {
    const m = marcasDeEntrada(
      { lugar: 1, recorridoCompleto: true, tiempoTotal: 69.35, detalleVueltas: "Primera: 9.350 · Segunda: NT" },
      false
    );
    assert.equal(m.limpio, false);
    assert.deepEqual(m.recorridos, [9.35]);
  });

  it("sin posición no tiene lugar", () => {
    const m = marcasDeEntrada({ lugar: null, sinPosicion: true, recorridoCompleto: false, detalleVueltas: "Rodeo: NT" }, true);
    assert.equal(m.lugar, null);
    assert.equal(m.marca, null);
    assert.equal(m.limpio, false);
  });

  it("en disciplinas calificadas la marca es la calificación", () => {
    const m = marcasDeEntrada({ lugar: 2, recorridoCompleto: true, puntos: 67, tiempoTotal: null, detalleVueltas: "Rodeo: 67" }, true);
    assert.equal(m.marca, 67);
    assert.equal(m.limpio, true);
  });

  it("lazador en dos parejas: queda el mejor lugar y se juntan los recorridos", () => {
    const a = { lugar: 4, marca: 20, recorridos: [10, 10], rondas: ["Primera", "Rodeo"], limpio: true, detalle: "" };
    const b = { lugar: 2, marca: 18, recorridos: [9, 9], rondas: ["Primera", "Rodeo"], limpio: true, detalle: "" };
    const m = combinarMarcas(a, b);
    assert.equal(m.lugar, 2);
    assert.equal(m.marca, 18);
    assert.deepEqual(m.recorridos, [10, 10, 9, 9]);
    assert.equal(combinarMarcas(null, b), b);
  });
});

describe("resumenCompetidor", () => {
  const h = (eventoId, disciplinaId, extra) => ({
    eventoId,
    eventoNombre: `Rodeo ${eventoId}`,
    fecha: "2027-01-01",
    disciplinaId,
    disciplinaNombre: disciplinaId,
    puntos: 10,
    dinero: 0,
    ...extra,
  });

  it("cuenta victorias, podios y mejores marcas por disciplina", () => {
    const comp = {
      competidorKey: "a",
      disciplinas: [{ disciplinaId: "Barriles", disciplinaNombre: "Barriles" }],
      historial: [
        h("e1", "Barriles", { lugar: 1, marca: 36.84, recorridos: [18.145, 18.695], rondas: ["Primera", "Rodeo"], limpio: true, dinero: 5000 }),
        h("e2", "Barriles", { lugar: 3, marca: 35.5, recorridos: [17.5, 18], rondas: ["Primera", "Rodeo"], limpio: true }),
        h("e3", "Barriles", { lugar: 5, marca: 17.1, recorridos: [17.1], rondas: ["Rodeo"], limpio: true }),
        h("e4", "Barriles", { lugar: null, marca: null, recorridos: [], rondas: [], limpio: false }),
      ],
    };
    const otro = { competidorKey: "b", historial: [h("e1", "Barriles", { recorridos: [17.0] })] };
    const r = resumenCompetidor(comp, [comp, otro]);
    assert.equal(r.conMarcas, true);
    assert.equal(r.victorias, 1);
    assert.equal(r.podios, 2);
    assert.equal(r.mejorLugar, 1);
    assert.equal(r.cobros, 1);

    const d = r.porDisciplina[0];
    assert.equal(d.mejorRecorrido.valor, 17.1);
    assert.equal(d.mejorRecorrido.eventoId, "e3");
    assert.equal(d.esRecord, false, "otro competidor corrió 17.0");
    assert.equal(d.mejorSuma.valor, 35.5, "el rodeo de 1 ronda no compite con los de 2");
    assert.equal(d.mejorSuma.rondas, 2);
    assert.equal(d.recorridos, 5);
    assert.equal(d.promedio, 17.888);
  });

  it("en jineteos gana la calificación más alta y marca el récord", () => {
    const comp = {
      competidorKey: "a",
      historial: [
        h("e1", "JineteosDeToros", { lugar: 2, marca: 70, recorridos: [70], rondas: ["Rodeo"], limpio: true }),
        h("e2", "JineteosDeToros", { lugar: 1, marca: 82, recorridos: [82], rondas: ["Rodeo"], limpio: true }),
      ],
    };
    const d = resumenCompetidor(comp, [comp]).porDisciplina[0];
    assert.equal(d.esPuntos, true);
    assert.equal(d.mejorRecorrido.valor, 82);
    assert.equal(d.mejorSuma.valor, 82);
    assert.equal(d.esRecord, true);
  });

  it("acumulados viejos sin marcas: conMarcas false", () => {
    const comp = { competidorKey: "a", historial: [{ eventoId: "e1", disciplinaId: "Barriles", puntos: 10, dinero: 0 }] };
    const r = resumenCompetidor(comp, [comp]);
    assert.equal(r.conMarcas, false);
    assert.equal(r.porDisciplina[0].mejorRecorrido, null);
  });
});
