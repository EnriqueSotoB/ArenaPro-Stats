import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { archivoParaRuta } from "../../tools/lib/rutas.mjs";

const ROOT = join("C:", "repo");

describe("archivoParaRuta", () => {
  it("sirve el sitio desde web/", () => {
    assert.equal(archivoParaRuta(ROOT, "/"), join(ROOT, "web", "index.html"));
    assert.equal(archivoParaRuta(ROOT, "/css/styles.css?v=abc"), join(ROOT, "web", "css", "styles.css"));
    assert.equal(archivoParaRuta(ROOT, "/lib/points.mjs"), join(ROOT, "web", "lib", "points.mjs"));
  });

  it("monta data/, admin/ y templates/ en sus mismas URLs", () => {
    assert.equal(archivoParaRuta(ROOT, "/data/manifest.json"), join(ROOT, "data", "manifest.json"));
    assert.equal(archivoParaRuta(ROOT, "/admin.html"), join(ROOT, "admin", "admin.html"));
    assert.equal(archivoParaRuta(ROOT, "/admin/admin.js"), join(ROOT, "admin", "admin.js"));
    assert.equal(
      archivoParaRuta(ROOT, "/templates/evento-manual.xlsx"),
      join(ROOT, "templates", "evento-manual.xlsx")
    );
  });

  it("no deja salir de la carpeta montada", () => {
    assert.equal(archivoParaRuta(ROOT, "/../package.json"), null);
    assert.equal(archivoParaRuta(ROOT, "/data/../tools/publish-server.mjs"), null);
    assert.equal(archivoParaRuta(ROOT, "/%2e%2e/.git/config"), null);
    assert.equal(archivoParaRuta(ROOT, "/%E0%A4%A"), null);
  });

  it("el código del repo fuera de web/ no es alcanzable", () => {
    assert.equal(archivoParaRuta(ROOT, "/tools/publish-server.mjs"), join(ROOT, "web", "tools", "publish-server.mjs"));
  });
});
