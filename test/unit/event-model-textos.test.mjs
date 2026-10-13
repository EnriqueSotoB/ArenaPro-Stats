import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatResultadoValor, renderEventoRankingTableHtml } from "../../web/js/event-model.js";

const sinTiempo = { nombre: "JUAN PÉREZ", competidorKey: "juan-perez", lugar: null, sinPosicion: true, noTime: true };
const conTiempo = { nombre: "ANA LÓPEZ", competidorKey: "ana-lopez", lugar: 1, tiempoTotal: 15.2 };

describe("textos públicos del evento", () => {
  it("el resultado sin tiempo se muestra en español", () => {
    assert.equal(formatResultadoValor(sinTiempo), "Sin tiempo");
  });

  it("la tabla con clasificación oficial no menciona Time ni inglés", () => {
    const html = renderEventoRankingTableHtml([{ ...conTiempo, desdeTime: true }, { ...sinTiempo, desdeTime: true }]);
    assert.match(html, /Sin tiempo/);
    assert.match(html, /Clasificación oficial del rodeo/);
    assert.doesNotMatch(html, /No Time|Time \(|Reexporta/);
  });

  it("la tabla sin clasificación oficial no le pide al público reexportar", () => {
    const html = renderEventoRankingTableHtml([conTiempo, { ...sinTiempo, tieneNtParcial: true, noTime: false }]);
    assert.match(html, /Sin tiempo en una vuelta/);
    assert.doesNotMatch(html, /No Time|NT en vuelta|Time \(|Reexporta/);
  });
});
