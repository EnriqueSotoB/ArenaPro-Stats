import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeManifest,
  upsertAsociacion,
  removeAsociacion,
  upsertCircuito,
  removeCircuito,
  validarCircuitosEvento,
  eventosDeCircuito,
  eventoMuestraDinero,
  circuitosPorAsociacion,
  defaultCircuitoId,
  setAsociacionLogo,
  logoFileName,
  normalizeHashtags,
  tipoAsociacionLabel,
} from "../../web/lib/circuitos.mjs";

const base = () =>
  normalizeManifest({
    version: 2,
    circuitoDefault: "aerch-circuito-2027",
    asociaciones: [{ id: "aerch", siglas: "AERCH", nombre: "Asociación Estatal de Rodeo de Chihuahua" }],
    circuitos: [
      { id: "aerch-circuito-2027", asociacionId: "aerch", nombre: "AERCH Circuito 2027", temporada: "2027" },
    ],
    eventos: [{ id: "e1", file: "eventos/e1.json", circuitos: ["aerch-circuito-2027"] }],
  });

describe("normalizeManifest", () => {
  it("convierte v1 en un circuito con todos los eventos", () => {
    const m = normalizeManifest({
      temporadaActiva: "2027",
      titulo: "FMR Tour 2027",
      cutLine: 15,
      cutLineVisible: true,
      eventos: [{ id: "e1", file: "eventos/e1.json" }],
    });
    assert.equal(m.version, 2);
    assert.equal(m.circuitoDefault, "fmr-tour-2027");
    assert.equal(m.circuitos[0].temporada, "2027");
    assert.equal(m.circuitos[0].cutLine, 15);
    assert.equal(m.circuitos[0].cutLineVisible, true);
    assert.deepEqual(m.eventos[0].circuitos, ["fmr-tour-2027"]);
  });

  it("en v2 un default inexistente cae al primer circuito", () => {
    const m = normalizeManifest({ ...base(), circuitoDefault: "no-existe" });
    assert.equal(m.circuitoDefault, "aerch-circuito-2027");
    assert.equal(defaultCircuitoId(m), "aerch-circuito-2027");
  });
});

describe("asociaciones", () => {
  it("crea con id desde las siglas y rechaza duplicados", () => {
    const { manifest, asociacion } = upsertAsociacion(base(), {
      siglas: "FMR",
      nombre: "Federación Mexicana de Rodeo",
      tipo: "federacion",
    });
    assert.equal(asociacion.id, "fmr");
    assert.equal(manifest.asociaciones.length, 2);
    assert.throws(() => upsertAsociacion(manifest, { siglas: "fmr", nombre: "Otra" }), /Ya existe/);
  });

  it("acepta asociación, federación y promotora; un tipo desconocido cae en asociación", () => {
    const { asociacion } = upsertAsociacion(base(), { siglas: "PRS", nombre: "Promotora Rodeo Show", tipo: "promotora" });
    assert.equal(asociacion.tipo, "promotora");
    assert.equal(tipoAsociacionLabel("promotora"), "Promotora");
    assert.equal(tipoAsociacionLabel("federacion"), "Federación");
    const { asociacion: otra } = upsertAsociacion(base(), { siglas: "X", nombre: "X", tipo: "otro" });
    assert.equal(otra.tipo, "estatal");
    assert.equal(tipoAsociacionLabel(otra.tipo), "Asociación");
  });

  it("edita sin cambiar el id", () => {
    const { manifest } = upsertAsociacion(base(), { id: "aerch", siglas: "AERCH", nombre: "AERCH A.C." });
    assert.equal(manifest.asociaciones[0].nombre, "AERCH A.C.");
    assert.equal(manifest.asociaciones[0].id, "aerch");
  });

  it("conserva el logo al editar y solo acepta rutas logos/*", () => {
    const { manifest: conLogo } = setAsociacionLogo(base(), "aerch", "logos/aerch.jpg");
    assert.equal(conLogo.asociaciones[0].logo, "logos/aerch.jpg");
    const { asociacion } = upsertAsociacion(conLogo, { id: "aerch", siglas: "AERCH", nombre: "AERCH A.C." });
    assert.equal(asociacion.logo, "logos/aerch.jpg");
    assert.equal(setAsociacionLogo(base(), "aerch", "../index.html").asociacion.logo, "");
    assert.equal(logoFileName("aerch", "image/png"), "logos/aerch.png");
    assert.throws(() => logoFileName("aerch", "image/gif"), /PNG, JPG o WEBP/);
  });

  it("normaliza hashtags editables y los conserva si no se mandan", () => {
    assert.equal(normalizeHashtags("aerch, #RodeoChihuahua  #aerch ##Rodeo!"), "#aerch #RodeoChihuahua #Rodeo");
    assert.equal(normalizeHashtags(""), "");
    const { manifest } = upsertAsociacion(base(), {
      id: "aerch",
      siglas: "AERCH",
      nombre: "AERCH",
      hashtags: "AERCH RodeoChihuahua",
    });
    assert.equal(manifest.asociaciones[0].hashtags, "#AERCH #RodeoChihuahua");
    const { asociacion } = upsertAsociacion(manifest, { id: "aerch", siglas: "AERCH", nombre: "AERCH A.C." });
    assert.equal(asociacion.hashtags, "#AERCH #RodeoChihuahua");
    const vaciado = upsertAsociacion(manifest, { id: "aerch", siglas: "AERCH", nombre: "AERCH", hashtags: "" });
    assert.equal(vaciado.asociacion.hashtags, "");
  });

  it("no elimina una asociación con circuitos", () => {
    assert.throws(() => removeAsociacion(base(), "aerch"), /circuito/);
  });

  it("por omisión muestra dinero y el Vaquero Completo va por dinero", () => {
    const a = base().asociaciones[0];
    assert.equal(a.mostrarDinero, true);
    assert.equal(a.vaqueroCompleto, "dinero");
    const { asociacion } = upsertAsociacion(base(), { siglas: "X", nombre: "X", vaqueroCompleto: "raro" });
    assert.equal(asociacion.vaqueroCompleto, "dinero");
  });

  it("elige Vaquero Completo por puntos y lo conserva si no se manda", () => {
    const { manifest } = upsertAsociacion(base(), { id: "aerch", siglas: "AERCH", nombre: "AERCH", vaqueroCompleto: "puntos" });
    assert.equal(manifest.asociaciones[0].vaqueroCompleto, "puntos");
    assert.equal(manifest.asociaciones[0].mostrarDinero, true);
    const { asociacion } = upsertAsociacion(manifest, { id: "aerch", siglas: "AERCH", nombre: "AERCH A.C." });
    assert.equal(asociacion.vaqueroCompleto, "puntos");
  });

  it("sin dinero visible el Vaquero Completo queda por puntos", () => {
    const { manifest, asociacion } = upsertAsociacion(base(), {
      id: "aerch",
      siglas: "AERCH",
      nombre: "AERCH",
      mostrarDinero: false,
      vaqueroCompleto: "dinero",
    });
    assert.equal(asociacion.mostrarDinero, false);
    assert.equal(asociacion.vaqueroCompleto, "puntos");
    assert.equal(normalizeManifest(manifest).asociaciones[0].vaqueroCompleto, "puntos");
    const nueva = upsertAsociacion(base(), { siglas: "PRS", nombre: "Promotora", mostrarDinero: false });
    assert.equal(nueva.asociacion.vaqueroCompleto, "puntos");
  });

  it("un evento muestra dinero solo si todas sus asociaciones lo permiten", () => {
    let m = upsertAsociacion(base(), { siglas: "PRS", nombre: "Promotora", mostrarDinero: false }).manifest;
    m = upsertCircuito(m, { asociacionId: "prs", nombre: "PRS 2027", temporada: "2027" }).manifest;
    const soloAerch = { circuitos: ["aerch-circuito-2027"] };
    assert.equal(eventoMuestraDinero(m, soloAerch), true);
    assert.equal(eventoMuestraDinero(m, { circuitos: ["prs-2027"] }), false);
    assert.equal(eventoMuestraDinero(m, { circuitos: ["aerch-circuito-2027", "prs-2027"] }), false);
  });
});

describe("circuitos", () => {
  it("crea, marca principal y agrupa por asociación", () => {
    const { manifest, circuito } = upsertCircuito(base(), {
      asociacionId: "aerch",
      nombre: "AERCH Circuito 2028",
      temporada: "2028",
      principal: true,
    });
    assert.equal(circuito.id, "aerch-circuito-2028");
    assert.equal(manifest.circuitoDefault, "aerch-circuito-2028");
    const [grupo] = circuitosPorAsociacion(manifest);
    assert.deepEqual(
      grupo.circuitos.map((c) => c.temporada),
      ["2028", "2027"]
    );
  });

  it("al editar conserva la línea de corte", () => {
    const m = base();
    m.circuitos[0].cutLine = 12;
    const { circuito } = upsertCircuito(m, {
      id: "aerch-circuito-2027",
      asociacionId: "aerch",
      nombre: "AERCH Circuito 2026-2027",
      temporada: "2026-2027",
    });
    assert.equal(circuito.cutLine, 12);
    assert.equal(circuito.nombre, "AERCH Circuito 2026-2027");
  });

  it("rechaza nombres reservados por el router", () => {
    assert.throws(
      () => upsertCircuito(base(), { asociacionId: "aerch", nombre: "Eventos", temporada: "2027" }),
      /reservada/
    );
  });

  it("no elimina un circuito con eventos", () => {
    assert.throws(() => removeCircuito(base(), "aerch-circuito-2027"), /evento/);
  });

  it("valida los circuitos de un evento", () => {
    const m = base();
    assert.deepEqual(
      validarCircuitosEvento(m, ["aerch-circuito-2027", "aerch-circuito-2027"]),
      ["aerch-circuito-2027"]
    );
    assert.throws(() => validarCircuitosEvento(m, []), /al menos un circuito/);
    assert.throws(() => validarCircuitosEvento(m, ["x"]), /no existe/);
    assert.equal(eventosDeCircuito(m, "aerch-circuito-2027").length, 1);
  });
});
