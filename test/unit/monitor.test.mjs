import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { revisarSitio } from "../../scripts/lib/monitor.mjs";

const BASE = "https://sitio.test/";
const SHA = "abcdef1234567890abcdef1234567890abcdef12";

function respuesta(status, body) {
  return {
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    json: async () => (typeof body === "string" ? JSON.parse(body) : body),
  };
}

function fakeFetch(rutas) {
  return async (url) => {
    const path = new URL(url).pathname;
    const r = rutas[path];
    if (r instanceof Error) throw r;
    return r || respuesta(404, "no");
  };
}

function sitioSano(overrides = {}) {
  return {
    "/": respuesta(200, `<html>ArenaPro<link href="css/styles.css?v=${SHA.slice(0, 12)}"></html>`),
    "/data/manifest.json": respuesta(200, { circuitoDefault: "aerch" }),
    "/data/circuitos/aerch.json": respuesta(200, { eventosContados: 5 }),
    ...overrides,
  };
}

const deMain = { commitMain: SHA, fechaCommitMain: new Date("2026-09-28T10:00:00Z"), ahora: new Date("2026-09-28T12:00:00Z") };

describe("revisarSitio", () => {
  it("sin problemas cuando todo está bien", async () => {
    assert.deepEqual(await revisarSitio({ baseUrl: BASE, fetchFn: fakeFetch(sitioSano()), ...deMain }), []);
  });

  it("detecta portada caída", async () => {
    const p = await revisarSitio({ baseUrl: BASE, fetchFn: fakeFetch(sitioSano({ "/": new Error("ECONNREFUSED") })) });
    assert.ok(p.some((x) => /no respondió/.test(x)));
  });

  it("detecta circuito principal vacío", async () => {
    const p = await revisarSitio({
      baseUrl: BASE,
      fetchFn: fakeFetch(sitioSano({ "/data/circuitos/aerch.json": respuesta(200, { eventosContados: 0 }) })),
    });
    assert.ok(p.some((x) => /no tiene eventos/.test(x)));
  });

  it("detecta admin expuesto", async () => {
    const p = await revisarSitio({
      baseUrl: BASE,
      fetchFn: fakeFetch(sitioSano({ "/admin.html": respuesta(200, "<html>") })),
    });
    assert.ok(p.some((x) => /admin\.html está expuesto/.test(x)));
  });

  it("detecta deploy atorado solo después de la gracia", async () => {
    const viejo = sitioSano({ "/": respuesta(200, `ArenaPro css/styles.css?v=000000000000`) });
    const atorado = await revisarSitio({ baseUrl: BASE, fetchFn: fakeFetch(viejo), ...deMain });
    assert.ok(atorado.some((x) => /Deploy Pages/.test(x)));

    const reciente = await revisarSitio({
      baseUrl: BASE,
      fetchFn: fakeFetch(viejo),
      ...deMain,
      ahora: new Date("2026-09-28T10:10:00Z"),
    });
    assert.deepEqual(reciente, []);
  });
});
