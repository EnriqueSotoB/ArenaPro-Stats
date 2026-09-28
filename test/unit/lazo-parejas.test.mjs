import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCircuitoStandings, puntosLazadorRepetido } from "../../tools/rebuild-temporada.mjs";
import { expandTeamRopingRow } from "../../web/lib/team-roping.mjs";
import { aplicarStatsEdits, buildDefaultEdits, filaKey, listEditableFilas, upsertFilaEdit } from "../../web/lib/stats-edits.mjs";
import { normalizeManifest, upsertAsociacion } from "../../web/lib/circuitos.mjs";

const evento = (entradas) => ({
  eventoId: "e1",
  categorias: [{ id: "c1", nombre: "Abierta", tipo: "TeamRoping" }],
  clasificacion: [{ categoriaId: "c1", entradas }],
});

function standingsDe(ev, regla) {
  const r = buildCircuitoStandings([{ id: "e1", nombre: "Rodeo", fecha: "2026-08-01", file: "x" }], () => ev, new Map(), {
    lazadorRepetido: regla,
  });
  return Object.fromEntries(
    r.standings.map((s) => [`${s.nombre}|${s.disciplinaId}`, { puntos: s.puntosTotales, dinero: s.dineroTotal, eventos: s.eventos }])
  );
}

describe("puntosLazadorRepetido", () => {
  it("FMR: mejor lugar + 1 por cada lugar extra con puntos (no por asistencia)", () => {
    assert.equal(puntosLazadorRepetido([90, 100], "fmr"), 101);
    assert.equal(puntosLazadorRepetido([100, 90, 2], "fmr"), 101);
    assert.equal(puntosLazadorRepetido([1, 2], "fmr"), 2);
  });

  it("sumar: suma completa", () => {
    assert.equal(puntosLazadorRepetido([90, 100, 2], "sumar"), 192);
  });
});

describe("lazador en dos parejas del mismo lado", () => {
  const ev = evento([
    { lugar: 1, nombre: "ANA / BETO", puntosCircuito: 100, montoGanado: 2000 },
    { lugar: 2, nombre: "CARLOS / BETO", puntosCircuito: 90, montoGanado: 1000 },
  ]);

  it("suma el dinero y aplica la regla de la asociación a los puntos", () => {
    const fmr = standingsDe(ev, "fmr");
    assert.deepEqual(fmr["BETO|TeamRopingHeeler"], { puntos: 101, dinero: 1500, eventos: 1 });
    assert.deepEqual(fmr["ANA|TeamRopingHeader"], { puntos: 100, dinero: 1000, eventos: 1 });

    const sumar = standingsDe(ev, "sumar");
    assert.deepEqual(sumar["BETO|TeamRopingHeeler"], { puntos: 190, dinero: 1500, eventos: 1 });
  });

  it("sin regla usa la de la FMR", () => {
    assert.equal(standingsDe(ev)["BETO|TeamRopingHeeler"].puntos, 101);
  });
});

describe("lazo de ayuda", () => {
  it("el compañero de ayuda no suma puntos pero sí su dinero; su pareja cuenta normal", () => {
    const rows = expandTeamRopingRow(
      { nombre: "ANA / BETO", puntosCircuito: 100, montoGanado: 2000, lazoAyuda: "heeler" },
      "TeamRoping"
    );
    assert.deepEqual(
      rows.map((r) => [r.nombre, r.puntosCircuito, r.montoGanado, r.lazoAyuda]),
      [
        ["ANA", 100, 1000, false],
        ["BETO", 0, 1000, true],
      ]
    );
  });

  it("en el acumulado: ayuda en una pareja, normal en otra", () => {
    const s = standingsDe(
      evento([
        { lugar: 1, nombre: "ANA / BETO", puntosCircuito: 100, montoGanado: 2000, lazoAyuda: "heeler" },
        { lugar: 3, nombre: "CARLOS / BETO", puntosCircuito: 80, montoGanado: 600 },
      ]),
      "sumar"
    );
    assert.deepEqual(s["BETO|TeamRopingHeeler"], { puntos: 80, dinero: 1300, eventos: 1 });
    assert.equal(s["ANA|TeamRopingHeader"].puntos, 100);
  });

  it("se marca desde las ediciones del admin y se puede quitar", () => {
    const base = evento([{ lugar: 1, nombre: "ANA / BETO", puntosCircuito: 100 }]);
    const edits = buildDefaultEdits(base);
    const key = filaKey(base.clasificacion[0].entradas[0], "c1");
    upsertFilaEdit(edits, key, { lazoAyuda: "header" });
    assert.equal(listEditableFilas(base, "c1", edits)[0].lazoAyuda, "header");
    assert.equal(aplicarStatsEdits(base, edits).clasificacion[0].entradas[0].lazoAyuda, "header");

    const marcado = aplicarStatsEdits(base, edits);
    upsertFilaEdit(edits, key, { lazoAyuda: "" });
    assert.equal("lazoAyuda" in aplicarStatsEdits(marcado, edits).clasificacion[0].entradas[0], false);
  });
});

describe("regla por asociación en el manifest", () => {
  it("por defecto FMR y se conserva al editar sin mandarla", () => {
    let m = normalizeManifest({ version: 2, asociaciones: [{ id: "aerch", siglas: "AERCH", nombre: "A", lazadorRepetido: "sumar" }] });
    assert.equal(m.asociaciones[0].lazadorRepetido, "sumar");
    m = upsertAsociacion(m, { id: "aerch", siglas: "AERCH", nombre: "A 2" }).manifest;
    assert.equal(m.asociaciones[0].lazadorRepetido, "sumar");
    m = upsertAsociacion(m, { siglas: "FMR", nombre: "F", lazadorRepetido: "raro" }).manifest;
    assert.equal(m.asociaciones[1].lazadorRepetido, "fmr");
  });
});
