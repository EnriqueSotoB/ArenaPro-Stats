import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nombreMayusculas, eventoConNombresMayusculas } from "../../web/lib/nombres.mjs";
import { normalizeEvento } from "../../web/js/event-model.js";

describe("nombreMayusculas", () => {
  it("unifica minúsculas, mezcla y espacios", () => {
    assert.equal(nombreMayusculas("juan pérez"), "JUAN PÉREZ");
    assert.equal(nombreMayusculas("Juan   PÉrez "), "JUAN PÉREZ");
    assert.equal(nombreMayusculas("JUAN PÉREZ"), "JUAN PÉREZ");
  });

  it("conserva Ñ y acentos", () => {
    assert.equal(nombreMayusculas("iñaki núñez"), "IÑAKI NÚÑEZ");
  });

  it("normaliza la diagonal de las parejas", () => {
    assert.equal(nombreMayusculas("alvaro de la torre/miguel"), "ALVARO DE LA TORRE / MIGUEL");
  });

  it("deja null y undefined tal cual", () => {
    assert.equal(nombreMayusculas(null), null);
    assert.equal(nombreMayusculas(undefined), undefined);
  });
});

describe("eventoConNombresMayusculas", () => {
  const evento = {
    resultados: [{ nombre: "sofia olivas", equipo: "Club Norte" }],
    clasificacion: [
      {
        categoriaId: "c1",
        entradas: [{ nombre: "Ana / beto", headerNombre: "Ana", heelerNombre: "beto" }],
      },
    ],
  };

  it("convierte nombres de resultados y clasificación sin tocar el equipo", () => {
    const out = eventoConNombresMayusculas(evento);
    assert.equal(out.resultados[0].nombre, "SOFIA OLIVAS");
    assert.equal(out.resultados[0].equipo, "Club Norte");
    assert.deepEqual(out.clasificacion[0].entradas[0], {
      nombre: "ANA / BETO",
      headerNombre: "ANA",
      heelerNombre: "BETO",
    });
  });

  it("no muta el evento original", () => {
    eventoConNombresMayusculas(evento);
    assert.equal(evento.resultados[0].nombre, "sofia olivas");
  });

  it("normalizeEvento del sitio ya entrega nombres en mayúsculas", () => {
    const out = normalizeEvento(evento);
    assert.equal(out.resultados[0].nombre, "SOFIA OLIVAS");
  });
});
