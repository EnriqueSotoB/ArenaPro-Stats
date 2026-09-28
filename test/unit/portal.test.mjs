import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  crearAccesoPortal,
  verificarPassword,
  generarPassword,
  normalizePortal,
} from "../../scripts/lib/portal-auth.mjs";
import { normalizeManifest, upsertAsociacion, setAsociacionPortal } from "../../scripts/lib/circuitos.mjs";
import { planPaginas } from "../../js/social-card.js";
import { specTemporada, shareCaption, withContexto, ALL_AROUND_ID } from "../../js/share-specs.js";
import { calcularTablero } from "../../js/portal-stats.js";
import { categoriaEtiqueta } from "../../js/event-model.js";

const manifestBase = () =>
  normalizeManifest({
    version: 2,
    asociaciones: [{ id: "aerch", siglas: "AERCH", nombre: "AERCH" }],
    circuitos: [{ id: "c1", asociacionId: "aerch", nombre: "AERCH Circuito 2027", temporada: "2027" }],
    eventos: [],
  });

function filas(n) {
  return Array.from({ length: n }, (_, i) => ({ lugar: i + 1, nombre: `Competidor ${i + 1}`, valor: `${100 - i}` }));
}

describe("portal-auth", () => {
  it("verifica la contraseña correcta y rechaza otras", async () => {
    const acceso = await crearAccesoPortal("mi-clave-segura");
    assert.ok(normalizePortal(acceso));
    assert.equal(await verificarPassword("mi-clave-segura", acceso), true);
    assert.equal(await verificarPassword("  mi-clave-segura ", acceso), true);
    assert.equal(await verificarPassword("otra-clave-123", acceso), false);
    assert.equal(await verificarPassword("", acceso), false);
    assert.equal(await verificarPassword("mi-clave-segura", null), false);
  });

  it("genera contraseñas legibles y distintas", () => {
    const a = generarPassword();
    assert.match(a, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.notEqual(a, generarPassword());
  });

  it("rechaza contraseñas cortas", async () => {
    await assert.rejects(() => crearAccesoPortal("corta"), /al menos 10/);
  });

  it("descarta registros mal formados", () => {
    assert.equal(normalizePortal({ sal: "x", hash: "y" }), null);
    assert.equal(normalizePortal("abc"), null);
  });
});

describe("acceso al portal en el manifest", () => {
  it("editar la asociación conserva el acceso; quitarlo lo borra", async () => {
    const acceso = await crearAccesoPortal("mi-clave-segura");
    const { manifest } = setAsociacionPortal(manifestBase(), "aerch", acceso);
    const editado = upsertAsociacion(manifest, { id: "aerch", siglas: "AERCH", nombre: "AERCH A.C.", portal: null });
    assert.deepEqual(editado.asociacion.portal, acceso);
    const quitado = setAsociacionPortal(editado.manifest, "aerch", null);
    assert.equal(quitado.asociacion.portal, null);
  });

  it("una asociación nueva no trae acceso aunque lo manden en el body", async () => {
    const acceso = await crearAccesoPortal("mi-clave-segura");
    const { asociacion } = upsertAsociacion(manifestBase(), { siglas: "FMR", nombre: "FMR", portal: acceso });
    assert.equal(asociacion.portal, null);
  });
});

describe("planPaginas", () => {
  const spec = (n) => ({ kicker: "AERCH", linea: "Circuito", titulo: "Barriles", subtitulo: "Puntos", filas: filas(n) });

  it("Top 3 y Top 10 en post caben en una columna", () => {
    assert.deepEqual(planPaginas(spec(40), "post", "top3").map((p) => [p.filas.length, p.columnas]), [[3, 1]]);
    assert.deepEqual(planPaginas(spec(40), "post", "top10").map((p) => [p.filas.length, p.columnas]), [[10, 1]]);
  });

  it("Top 10 en cuadrado usa dos columnas", () => {
    assert.deepEqual(planPaginas(spec(40), "cuadrado", "top10").map((p) => [p.filas.length, p.columnas]), [[10, 2]]);
  });

  it("Todos en post mete ~30 por imagen y reparte parejo", () => {
    const una = planPaginas(spec(28), "post", "todos");
    assert.equal(una.length, 1);
    assert.equal(una[0].columnas, 2);
    const dos = planPaginas(spec(58), "post", "todos");
    assert.deepEqual(dos.map((p) => p.filas.length), [29, 29]);
    assert.equal(dos[1].filas[0].lugar, 30);
  });

  it("con pocos resultados no rellena de más", () => {
    assert.deepEqual(planPaginas(spec(2), "post", "top10").map((p) => p.filas.length), [2]);
    assert.deepEqual(planPaginas(spec(0), "post", "todos"), [{ filas: [], columnas: 1 }]);
  });
});

describe("specTemporada y texto", () => {
  const temporada = {
    circuitoId: "c1",
    eventosContados: 3,
    actualizadoEn: "2026-09-20T10:00:00Z",
    standings: [
      { competidorKey: "a", nombre: "Ana", disciplinaId: "Barriles", disciplinaNombre: "Barriles", puntosTotales: 50, dineroTotal: 900, eventos: 2 },
      { competidorKey: "b", nombre: "Bea", disciplinaId: "Barriles", disciplinaNombre: "Barriles", puntosTotales: 80, dineroTotal: 100, eventos: 3 },
    ],
    allAround: [],
  };

  it("ordena por la métrica elegida y da valor corto para doble columna", () => {
    const pts = specTemporada(temporada, "Barriles", "puntos");
    assert.deepEqual(pts.filas.map((f) => f.nombre), ["Bea", "Ana"]);
    assert.equal(pts.filas[0].valor, "80 pts");
    assert.equal(pts.filas[0].valorCorto, "80");
    const dinero = specTemporada(temporada, "Barriles", "dinero");
    assert.deepEqual(dinero.filas.map((f) => f.nombre), ["Ana", "Bea"]);
    assert.equal(specTemporada(temporada, ALL_AROUND_ID).filas.length, 0);
  });

  it("el texto usa los hashtags de la asociación y el link público", () => {
    const spec = withContexto(specTemporada(temporada, "Barriles", "puntos"), {
      asociacion: { id: "aerch", siglas: "AERCH", nombre: "AERCH", hashtags: "#AERCH #Rodeo", logo: "logos/aerch.jpg" },
      circuito: { id: "c1", nombre: "AERCH Circuito 2027" },
      temporada,
    });
    assert.equal(spec.logo, "data/logos/aerch.jpg");
    const texto = shareCaption(spec);
    assert.match(texto, /^Barriles · AERCH Circuito 2027/);
    assert.match(texto, /1\. Bea · 80 pts/);
    assert.match(texto, /https:\/\/estadisticas\.arenapro\.mx\/#c1\/temporada\/Barriles/);
    assert.ok(texto.endsWith("#AERCH #Rodeo"));
    assert.ok(!shareCaption({ ...spec, hashtags: "" }).includes("#AERCH"));
  });
});

describe("categoriaEtiqueta", () => {
  it("rotula como Time: una vez si coincide con la disciplina, si no Disciplina — Categoría", () => {
    assert.equal(categoriaEtiqueta("Barriles", "Barriles"), "Barriles");
    assert.equal(categoriaEtiqueta("Jineteo de Toros", "JineteosDeToros"), "Jineteo de Toros");
    assert.equal(categoriaEtiqueta("Abierta", "TeamRoping"), "Lazo por Parejas — Abierta");
    assert.equal(categoriaEtiqueta("Master", "TeamRoping"), "Lazo por Parejas — Master");
    assert.equal(categoriaEtiqueta("Abierta", "Barriles"), "Barriles — Abierta");
    assert.equal(categoriaEtiqueta("Team Roping", "TeamRoping"), "Lazo por Parejas");
    assert.equal(categoriaEtiqueta("Team Roping Masters", "TeamRoping"), "Lazo por Parejas — Masters");
    assert.equal(categoriaEtiqueta("Master", "TeamRopingMasters"), "Lazo por Parejas Master");
    assert.equal(categoriaEtiqueta("Libre", ""), "Libre");
  });
});

describe("calcularTablero", () => {
  it("cuenta inscripciones, competidores distintos y recurrentes", () => {
    const temporada = {
      eventosContados: 2,
      standings: [
        { disciplinaId: "B", disciplinaNombre: "Barriles", nombre: "Ana", puntosTotales: 80, dineroTotal: 500 },
        { disciplinaId: "B", disciplinaNombre: "Barriles", nombre: "Bea", puntosTotales: 50, dineroTotal: 0 },
      ],
      competidores: [
        {
          competidorKey: "a", nombre: "Ana", eventos: 2, puntosTotales: 80, dineroTotal: 500, disciplinas: [{}],
          historial: [
            { eventoId: "e1", puntos: 40, dinero: 500 },
            { eventoId: "e2", puntos: 40, dinero: 0 },
          ],
        },
        { competidorKey: "b", nombre: "Bea", eventos: 1, puntosTotales: 50, dineroTotal: 0, disciplinas: [{}], historial: [{ eventoId: "e2", puntos: 50, dinero: 0 }] },
      ],
    };
    const t = calcularTablero(temporada, [
      { id: "e1", nombre: "Rodeo 1", fecha: "2026-08-01" },
      { id: "e2", nombre: "Rodeo 2", fecha: "2026-08-15" },
    ]);
    assert.equal(t.kpis.participaciones, 3);
    assert.equal(t.kpis.competidores, 2);
    assert.equal(t.kpis.dinero, 500);
    assert.equal(t.kpis.pctRecurrentes, 50);
    assert.deepEqual(t.porEvento.map((e) => [e.nombre, e.participaciones, e.competidores, e.dinero]), [
      ["Rodeo 1", 1, 1, 500],
      ["Rodeo 2", 2, 2, 0],
    ]);
    assert.equal(t.porDisciplina[0].lider.nombre, "Ana");
    assert.equal(t.porDisciplina[0].ventaja, 30);
    assert.equal(t.masActivos[0].nombre, "Ana");
  });
});
