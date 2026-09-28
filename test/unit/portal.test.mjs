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
import {
  specTemporada,
  specMovimientos,
  specRecords,
  specRecordsNuevos,
  shareCaption,
  withContexto,
  ALL_AROUND_ID,
} from "../../js/share-specs.js";
import {
  calcularTablero,
  calcularMovimientos,
  calcularRecords,
  calcularRecordsNuevos,
  recorridosDeEntrada,
} from "../../js/portal-stats.js";
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

describe("calcularMovimientos", () => {
  const h = (eventoId, fecha, puntos, disciplinaId = "B") => ({
    eventoId,
    eventoNombre: eventoId === "e2" ? "Rodeo 2" : "Rodeo 1",
    fecha,
    disciplinaId,
    disciplinaNombre: "Barriles",
    puntos,
  });
  const c = (competidorKey, historial) => ({ competidorKey, nombre: competidorKey.toUpperCase(), historial });

  it("da la clasificación después del último rodeo con lugares movidos y nuevos", () => {
    const temporada = {
      competidores: [
        c("ana", [h("e1", "2026-08-01", 100)]),
        c("bea", [h("e1", "2026-08-01", 80), h("e2", "2026-08-15", 50)]),
        c("cris", [h("e1", "2026-08-01", 60), h("e2", "2026-08-15", 10)]),
        c("dani", [h("e1", "2026-08-01", 60)]),
        c("eva", [h("e2", "2026-08-15", 200)]),
      ],
    };
    const mv = calcularMovimientos(temporada);
    assert.equal(mv.evento.id, "e2");
    // Antes: ana 1, bea 2, cris/dani 3. Después: eva 1, bea 2 (130), ana 3, cris 4, dani 5.
    assert.deepEqual(mv.cambiosLider.map((x) => [x.antes, x.ahora]), [[["ANA"], ["EVA"]]]);
    assert.equal(mv.tablas.length, 1);
    assert.equal(mv.tablas[0].corrieron, 3);
    assert.deepEqual(
      mv.tablas[0].filas.map((f) => [f.nombre, f.lugar, f.lugarAntes, f.cambio, f.nuevo, f.puntos, f.corrio]),
      [
        ["EVA", 1, null, null, true, 200, true],
        ["BEA", 2, 2, 0, false, 130, true],
        ["ANA", 3, 1, -2, false, 100, false],
        ["CRIS", 4, 3, -1, false, 70, true],
        ["DANI", 5, 3, -2, false, 60, false],
      ]
    );
  });

  it("empatados comparten lugar y las disciplinas que no se corrieron quedan sin cambios", () => {
    const temporada = {
      competidores: [
        c("a", [h("e1", "2026-08-01", 90)]),
        c("x", [h("e1", "2026-08-01", 10), h("e2", "2026-08-15", 100)]),
        c("y", [h("e1", "2026-08-01", 5), h("e2", "2026-08-15", 1)]),
        c("z", [h("e1", "2026-08-01", 5), h("e2", "2026-08-15", 1)]),
        c("p", [h("e1", "2026-08-01", 40, "P")]),
      ],
    };
    const mv = calcularMovimientos(temporada);
    const b = mv.tablas.find((t) => t.disciplinaId === "B");
    assert.deepEqual(b.filas.map((f) => [f.nombre, f.lugar, f.cambio]), [
      ["X", 1, 1],
      ["A", 2, -1],
      ["Y", 3, 0],
      ["Z", 3, 0],
    ]);
    const p = mv.tablas.find((t) => t.disciplinaId === "P");
    assert.equal(p.corrieron, 0);
    assert.deepEqual(p.filas.map((f) => [f.lugar, f.cambio]), [[1, 0]]);
  });

  it("arma la imagen para redes con flechas y el texto con resumen", () => {
    const mv = calcularMovimientos({
      circuitoId: "c",
      competidores: [
        c("ana", [h("e1", "2026-08-01", 100)]),
        c("bea", [h("e1", "2026-08-01", 80), h("e2", "2026-08-15", 50)]),
        c("eva", [h("e2", "2026-08-15", 1)]),
      ],
    });
    const spec = specMovimientos(mv, "B", "c");
    assert.equal(spec.subtitulo, "Clasificación después de Rodeo 2");
    assert.deepEqual(
      spec.filas.map((f) => [f.lugar, f.nombre, f.valor, f.movimiento, f.detalle]),
      [
        [1, "BEA", "130 pts", { tipo: "sube", n: 1 }, "50 pts en el rodeo"],
        [2, "ANA", "100 pts", { tipo: "baja", n: 1 }, "No corrió"],
        [3, "EVA", "1 pt", { tipo: "nuevo" }, "1 pt en el rodeo"],
      ]
    );
    const texto = shareCaption(spec);
    assert.match(texto, /Nuevo líder: BEA/);
    assert.match(texto, /Mayor subida: BEA \(del #2 al #1\)/);
    assert.match(texto, /1\. BEA · 130 pts \(▲1\)\n2\. ANA · 100 pts \(▼1\)\n3\. EVA · 1 pt \(nuevo\)/);
    assert.equal(specMovimientos(mv, "X", "c"), null);
  });

  it("con un solo rodeo no hay movimientos", () => {
    const mv = calcularMovimientos({ competidores: [c("a", [h("e1", "2026-08-01", 10)])] });
    assert.equal(mv.evento.id, "e1");
    assert.deepEqual([mv.tablas, mv.cambiosLider], [[], []]);
  });
});

describe("calcularRecords", () => {
  it("lee recorridos de detalleVueltas, t1..t3 o el total", () => {
    assert.deepEqual(recorridosDeEntrada({ detalleVueltas: "Primera: 13.240 · Rodeo: NT" }, false), [
      { ronda: "Primera", valor: 13.24 },
    ]);
    assert.deepEqual(
      recorridosDeEntrada({ detalleVueltas: "Cabecero: ANA · Pialador: BEA · Ronda 1: 5.870" }, false),
      [{ ronda: "Ronda 1", valor: 5.87 }]
    );
    assert.deepEqual(recorridosDeEntrada({ t1: "NT", t2: "7.5" }, false), [{ ronda: "Ronda 2", valor: 7.5 }]);
    assert.deepEqual(recorridosDeEntrada({ puntos: 70 }, true), [{ ronda: "", valor: 70 }]);
    assert.deepEqual(recorridosDeEntrada({ detalleVueltas: "Rodeo: NT" }, true), []);
  });

  it("toma el recorrido más rápido o la calificación más alta por disciplina", () => {
    const evento = (clasificacion) => ({ categorias: [], clasificacion });
    const eventos = [
      {
        id: "e1",
        nombre: "Rodeo 1",
        fecha: "2026-08-01",
        evento: evento([
          { categoriaId: "c1", tipo: "Barriles", nombre: "Abierta", entradas: [{ nombre: "Ana", detalleVueltas: "Primera: 18.300 · Rodeo: 18.100" }] },
          { categoriaId: "c2", tipo: "Barriles", nombre: "Master", entradas: [{ nombre: "Lola", detalleVueltas: "Primera: 19.000" }] },
          { categoriaId: "c3", tipo: "JineteosDeToros", nombre: "Jineteo de Toros", entradas: [{ nombre: "Toño", puntos: 71, detalleVueltas: "Rodeo: 71" }] },
        ]),
      },
      {
        id: "e2",
        nombre: "Rodeo 2",
        fecha: "2026-08-15",
        evento: evento([
          { categoriaId: "c9", tipo: "Barriles", nombre: "Barriles", entradas: [{ nombre: "Bea", detalleVueltas: "Rodeo: 18.100" }] },
          { categoriaId: "c8", tipo: "JineteosDeToros", nombre: "Jineteos", entradas: [{ nombre: "Beto", puntos: 80 }] },
        ]),
      },
    ];
    const r = Object.fromEntries(calcularRecords(eventos).map((x) => [x.disciplinaId, x]));
    assert.equal(r.Barriles.valor, 18.1);
    assert.deepEqual(r.Barriles.titulares.map((t) => [t.nombre, t.eventoNombre, t.ronda]), [
      ["Ana", "Rodeo 1", "Rodeo"],
      ["Bea", "Rodeo 2", "Rodeo"],
    ]);
    assert.equal(r.BarrilesMasters.titulares[0].nombre, "Lola");
    assert.equal(r.JineteosDeToros.valor, 80);
    assert.equal(r.JineteosDeToros.titulares[0].nombre, "Beto");
    assert.equal(r.JineteosDeToros.disciplinaNombre, "Jineteos de Toros");
    assert.equal(r.JineteosDeToros.nuevo, true, "80 del último rodeo supera el 71");
    assert.equal(r.Barriles.nuevo, false, "empatar el récord no es récord nuevo");
    assert.equal(r.BarrilesMasters.nuevo, false, "no se corrió en el último rodeo");
  });
});

describe("récords nuevos y posts de récords", () => {
  const evento = (clasificacion) => ({ categorias: [], clasificacion });
  const eventos = [
    {
      id: "e2",
      nombre: "Rodeo 2",
      fecha: "2026-08-15",
      evento: evento([
        { categoriaId: "b", tipo: "Barriles", nombre: "Barriles", entradas: [{ nombre: "Bea", detalleVueltas: "Rodeo: 17.950" }] },
        { categoriaId: "j", tipo: "JineteosDeToros", nombre: "Jineteos", entradas: [{ nombre: "Beto", puntos: 70 }] },
        { categoriaId: "p", tipo: "LazoDeBecerro", nombre: "Lazo", entradas: [{ nombre: "Paco", t1: "9.100" }] },
      ]),
    },
    {
      id: "e1",
      nombre: "Rodeo 1",
      fecha: "2026-08-01",
      evento: evento([
        { categoriaId: "b", tipo: "Barriles", nombre: "Barriles", entradas: [{ nombre: "Ana", detalleVueltas: "Rodeo: 18.100" }] },
        { categoriaId: "j", tipo: "JineteosDeToros", nombre: "Jineteos", entradas: [{ nombre: "Toño", puntos: 71 }] },
      ]),
    },
  ];

  it("compara contra lo que había antes del evento, sin importar el orden de la lista", () => {
    const nuevos = calcularRecordsNuevos(eventos, "e2");
    assert.equal(nuevos.length, 1, "Jineteos no mejoró y Lazo se corrió por primera vez");
    const [b] = nuevos;
    assert.equal(b.disciplinaId, "Barriles");
    assert.equal(b.valor, 17.95);
    assert.equal(b.titulares[0].nombre, "Bea");
    assert.equal(b.anterior.valor, 18.1);
    assert.equal(b.anterior.titulares[0].nombre, "Ana");
    assert.ok(Math.abs(b.mejora - 0.15) < 1e-9);
    assert.deepEqual(calcularRecordsNuevos(eventos, "e1"), [], "el primer rodeo no rompe récords");
    assert.deepEqual(calcularRecordsNuevos(eventos, "nope"), []);
  });

  it("post de récords de la temporada: una fila por disciplina, sin lugar y con NUEVO", () => {
    const spec = specRecords(calcularRecords(eventos), "c");
    assert.equal(spec.titulo, "Récords de la temporada");
    assert.equal(spec.lista, true);
    const barriles = spec.filas.find((f) => f.nombre === "Barriles");
    assert.equal(barriles.lugar, "");
    assert.equal(barriles.valor, "17.950 s");
    assert.equal(barriles.detalle, "Bea · Rodeo 2");
    assert.deepEqual(barriles.movimiento, { tipo: "nuevo" });
    const jineteos = spec.filas.find((f) => f.nombre === "Jineteos de Toros");
    assert.equal(jineteos.valor, "71 pts");
    assert.equal(jineteos.movimiento, undefined);
    const caption = shareCaption(spec);
    assert.match(caption, /Barriles: 17\.950 s \(nuevo\) · Bea · Rodeo 2/);
    assert.match(caption, /Lazo de Becerro: 9\.100 s · Paco/);
    assert.equal(specRecords([], "c"), null);
  });

  it("post de récords nuevos de un evento, con la marca anterior", () => {
    const ev = eventos[0];
    const spec = specRecordsNuevos(calcularRecordsNuevos(eventos, "e2"), ev, "c");
    assert.equal(spec.titulo, "¡Nuevo récord!");
    assert.match(spec.subtitulo, /^Rodeo 2 · /);
    assert.deepEqual(
      spec.filas.map((f) => [f.lugar, f.nombre, f.detalle, f.valor]),
      [["", "Bea", "Barriles · antes 18.100 s", "17.950 s"]]
    );
    assert.match(shareCaption(spec), /Barriles: Bea · 17\.950 s \(antes 18\.100 s, Ana\)/);
    assert.equal(spec.hash, "#c/eventos/e2");
    assert.equal(specRecordsNuevos([], ev, "c"), null);
  });

  it("las listas de récords van en una columna, ignoran el top y se reparten en carrusel", () => {
    const filas = Array.from({ length: 12 }, (_, i) => ({ lugar: "", nombre: `D${i}`, detalle: "x", valor: "1 s" }));
    const spec = { titulo: "Récords de la temporada", subtitulo: "s", lista: true, filas };
    const paginas = planPaginas(spec, "post", "top3");
    assert.ok(paginas.length > 1);
    assert.ok(paginas.every((p) => p.columnas === 1));
    assert.equal(paginas.reduce((n, p) => n + p.filas.length, 0), 12);
    const tam = paginas.map((p) => p.filas.length);
    assert.ok(Math.max(...tam) - Math.min(...tam) <= 1, "páginas balanceadas");
    assert.deepEqual(planPaginas({ ...spec, filas: filas.slice(0, 3) }, "post", "top3"), [
      { filas: filas.slice(0, 3), columnas: 1 },
    ]);
  });
});
