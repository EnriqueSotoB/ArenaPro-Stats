import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eventoParaPublico } from "../../tools/lib/publico.mjs";

describe("eventoParaPublico", () => {
  it("quita notas de resultados y clasificación sin tocar lo demás", () => {
    const evento = {
      nombre: "RODEO",
      resultados: [{ nombre: "A", notas: "Cambia a Minotauro", tiempoOficial: 15.2 }],
      clasificacion: [{ categoriaId: "c1", entradas: [{ nombre: "A", notas: "Excede tiempo", lugar: 1 }] }],
    };
    const pub = eventoParaPublico(evento);
    assert.deepEqual(pub.resultados, [{ nombre: "A", tiempoOficial: 15.2 }]);
    assert.deepEqual(pub.clasificacion[0].entradas, [{ nombre: "A", lugar: 1 }]);
    assert.equal(pub.clasificacion[0].categoriaId, "c1");
    assert.equal(evento.resultados[0].notas, "Cambia a Minotauro");
  });

  it("tolera eventos sin resultados ni clasificación", () => {
    assert.deepEqual(eventoParaPublico({ nombre: "X" }), { nombre: "X" });
  });

  it("conserva los montos por omisión", () => {
    const pub = eventoParaPublico({ clasificacion: [{ entradas: [{ nombre: "A", montoGanado: 5000 }] }] });
    assert.equal(pub.clasificacion[0].entradas[0].montoGanado, 5000);
  });

  it("sin dinero quita todos los montos, statsEdits incluido", () => {
    const evento = {
      resultados: [{ nombre: "A", montoGanado: 100 }],
      clasificacion: [
        { categoriaId: "c1", entradas: [{ nombre: "A", lugar: 1, montoGanado: 5000, montoEquipo: 10000, montoHeader: 5000, montoHeeler: 5000 }] },
      ],
      statsEdits: { filas: [{ key: "k", montoGanado: 7000, puntosCircuito: 3 }] },
    };
    const pub = eventoParaPublico(evento, { conDinero: false });
    assert.deepEqual(pub.resultados, [{ nombre: "A" }]);
    assert.deepEqual(pub.clasificacion[0].entradas, [{ nombre: "A", lugar: 1 }]);
    assert.deepEqual(pub.statsEdits.filas, [{ key: "k", puntosCircuito: 3 }]);
    assert.doesNotMatch(JSON.stringify(pub), /monto/i);
    assert.equal(evento.clasificacion[0].entradas[0].montoGanado, 5000);
  });
});
