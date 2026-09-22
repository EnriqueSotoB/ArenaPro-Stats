import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAliasMap,
  resolveCompetitorKey,
} from "../../scripts/lib/competitor-aliases.mjs";
import { competitorKey } from "../../scripts/rebuild-temporada.mjs";

describe("buildAliasMap", () => {
  it("ignora entradas incompletas o identity", () => {
    const map = buildAliasMap({
      aliases: [
        { from: "name:a", to: "name:b" },
        { from: "", to: "name:x" },
        { from: "name:y", to: "name:y" },
      ],
    });
    assert.equal(map.size, 1);
    assert.equal(map.get("name:a"), "name:b");
  });
});

describe("resolveCompetitorKey", () => {
  it("sin aliases devuelve competitorKey tal cual", () => {
    const row = { competidorId: "local:1", nombre: "Juan Pérez" };
    const key = resolveCompetitorKey(row, new Map(), competitorKey);
    assert.equal(key, "name:juan perez");
  });

  it("aplica un alias from → to", () => {
    const map = buildAliasMap({
      aliases: [{ from: "name:juan perez", to: "name:juan perez garcia" }],
    });
    const row = { competidorId: "local:1", nombre: "Juan Pérez" };
    assert.equal(
      resolveCompetitorKey(row, map, competitorKey),
      "name:juan perez garcia"
    );
  });

  it("encadena aliases hasta 5 hops", () => {
    const map = buildAliasMap({
      aliases: [
        { from: "name:a", to: "name:b" },
        { from: "name:b", to: "name:c" },
        { from: "name:c", to: "name:d" },
      ],
    });
    const row = { competidorId: "local:1", nombre: "A" };
    assert.equal(resolveCompetitorKey(row, map, competitorKey), "name:d");
  });

  it("corta ciclos sin tirar error", () => {
    const map = buildAliasMap({
      aliases: [
        { from: "name:a", to: "name:b" },
        { from: "name:b", to: "name:a" },
      ],
    });
    const row = { competidorId: "local:1", nombre: "A" };
    const key = resolveCompetitorKey(row, map, competitorKey);
    assert.ok(key === "name:a" || key === "name:b");
  });

  it("permite alias desde id local:", () => {
    const map = buildAliasMap({
      aliases: [{ from: "local:514", to: "name:juan perez" }],
    });
    // competitorKey con local: usa nombre; para pegar por id local
    // el map se consulta también tras la key inicial. Si la key es name:,
    // el from local: no aplica — por eso resolvemos también el id crudo.
    const row = { competidorId: "local:999", nombre: "Otro" };
    assert.equal(resolveCompetitorKey(row, map, competitorKey), "name:otro");

    const rowByLocal = { competidorId: "local:514", nombre: "" };
    // sin nombre, competitorKey cae al id local:
    assert.equal(
      resolveCompetitorKey(rowByLocal, map, competitorKey),
      "name:juan perez"
    );
  });
});
