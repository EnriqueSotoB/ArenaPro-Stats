import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eventoParaPublico } from "../../scripts/lib/publico.mjs";

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
});
