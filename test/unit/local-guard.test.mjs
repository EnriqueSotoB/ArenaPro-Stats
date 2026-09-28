import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { motivoRechazo, TOKEN_HEADER } from "../../tools/lib/local-guard.mjs";

const cfg = { port: 8787, token: "a".repeat(48) };
const ok = { host: "127.0.0.1:8787", origin: "http://127.0.0.1:8787", [TOKEN_HEADER]: cfg.token };

describe("motivoRechazo (consola local)", () => {
  it("acepta GET desde la consola", () => {
    assert.equal(motivoRechazo({ method: "GET", headers: { host: "localhost:8787" } }, cfg), null);
  });

  it("acepta POST con Host, Origin y token correctos", () => {
    assert.equal(motivoRechazo({ method: "POST", headers: ok }, cfg), null);
  });

  it("rechaza DNS rebinding (Host de otro dominio), incluso en GET", () => {
    const r = motivoRechazo({ method: "GET", headers: { host: "evil.example:8787" } }, cfg);
    assert.match(r, /Host no permitido/);
  });

  it("rechaza POST desde otra página (CSRF)", () => {
    const r = motivoRechazo({ method: "POST", headers: { ...ok, origin: "https://evil.example" } }, cfg);
    assert.match(r, /Origen no permitido/);
  });

  it("rechaza POST sin Origin", () => {
    const { origin: _o, ...sinOrigin } = ok;
    assert.match(motivoRechazo({ method: "POST", headers: sinOrigin }, cfg), /Origen no permitido/);
  });

  it("rechaza POST sin token o con token viejo", () => {
    const { [TOKEN_HEADER]: _t, ...sinToken } = ok;
    assert.match(motivoRechazo({ method: "POST", headers: sinToken }, cfg), /recarga la página/);
    assert.match(
      motivoRechazo({ method: "POST", headers: { ...ok, [TOKEN_HEADER]: "b".repeat(48) } }, cfg),
      /recarga la página/
    );
  });
});
