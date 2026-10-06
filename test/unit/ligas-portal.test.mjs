import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  asociacionesConLiga,
  asociacionDeRuta,
  destinoPortal,
  paginaLigaPortal,
  rutasOcupadas,
} from "../../tools/lib/ligas-portal.mjs";

const portal = { sal: "a".repeat(32), hash: "b".repeat(64), iteraciones: 210000, version: 2 };
const manifest = {
  asociaciones: [
    { id: "aerch", siglas: "AERCH", nombre: "Asociación Estatal", portal },
    { id: "fmr", siglas: "FMR", nombre: "Federación", portal: null },
    { id: "css", siglas: "CSS", nombre: "Choca con una carpeta", portal },
  ],
};
const ocupadas = rutasOcupadas(["css", "js", "portal.html", "index.html"]);

describe("ligas cortas del portal", () => {
  it("solo asociaciones con acceso y cuyo id no choca con el sitio", () => {
    assert.deepEqual(asociacionesConLiga(manifest, ocupadas).map((a) => a.id), ["aerch"]);
    assert.deepEqual(asociacionesConLiga(manifest, ocupadas, { todas: true }).map((a) => a.id), ["aerch", "fmr"]);
    assert.ok(ocupadas.has("portal"), "portal.html también ocupa /portal");
  });

  it("reconoce la ruta con o sin diagonal y en mayúsculas", () => {
    for (const ruta of ["/aerch", "/aerch/", "/AERCH"]) {
      assert.equal(asociacionDeRuta(manifest, ruta, ocupadas)?.id, "aerch", ruta);
    }
    assert.equal(asociacionDeRuta(manifest, "/fmr", ocupadas), null);
    assert.equal(asociacionDeRuta(manifest, "/aerch/otra", ocupadas), null);
    assert.equal(asociacionDeRuta(manifest, "/", ocupadas), null);
  });

  it("la página redirige al portal con la asociación elegida", () => {
    assert.equal(destinoPortal("aerch"), "/portal.html#aerch");
    const html = paginaLigaPortal({ id: "aerch", siglas: "A&B" });
    assert.match(html, /content="0; url=\/portal\.html#aerch"/);
    assert.match(html, /Portal A&amp;B/);
  });
});
