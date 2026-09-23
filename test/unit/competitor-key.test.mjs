import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { competitorKey } from "../../scripts/rebuild-temporada.mjs";

describe("competitorKey", () => {
  it("prioriza id web estable (no local:)", () => {
    assert.equal(
      competitorKey({ competidorId: "web:abc-123", nombre: "Juan Pérez" }),
      "web:abc-123"
    );
  });

  it("con id local: usa nombre normalizado", () => {
    assert.equal(
      competitorKey({ competidorId: "local:514", nombre: "Juan Pérez" }),
      "name:juan perez"
    );
  });

  it("normaliza acentos, mayúsculas y espacios", () => {
    const a = competitorKey({ competidorId: "local:1", nombre: "  José  García  " });
    const b = competitorKey({ competidorId: "local:2", nombre: "jose garcia" });
    assert.equal(a, b);
    assert.equal(a, "name:jose garcia");
  });

  it("normaliza slash de dúos sin inventar identidad web", () => {
    assert.equal(
      competitorKey({ competidorId: "local:9", nombre: "Ana / Luis" }),
      "name:ana/luis"
    );
  });
});
