import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendAlias,
  removeAlias,
  normalizeAliasInput,
} from "../../scripts/lib/alias-store.mjs";

describe("normalizeAliasInput", () => {
  it("convierte nombre humano a name:", () => {
    assert.equal(normalizeAliasInput("Lalito Calderón"), "name:lalito calderon");
  });

  it("normaliza name: existente", () => {
    assert.equal(normalizeAliasInput("name:Eduardo  Calderón"), "name:eduardo calderon");
  });

  it("preserva local:", () => {
    assert.equal(normalizeAliasInput("local:514"), "local:514");
  });
});

describe("appendAlias", () => {
  it("agrega un alias nuevo", () => {
    const next = appendAlias({ version: 1, aliases: [] }, {
      from: "name:a",
      to: "name:b",
    });
    assert.equal(next.aliases.length, 1);
    assert.equal(next.aliases[0].from, "name:a");
  });

  it("normaliza from/to al agregar", () => {
    const next = appendAlias({ version: 1, aliases: [] }, {
      from: "Lalito Calderon",
      to: "Eduardo Calderón",
    });
    assert.equal(next.aliases[0].from, "name:lalito calderon");
    assert.equal(next.aliases[0].to, "name:eduardo calderon");
  });

  it("actualiza alias existente con mismo from", () => {
    const next = appendAlias(
      { version: 1, aliases: [{ from: "name:a", to: "name:old" }] },
      { from: "name:a", to: "name:new" }
    );
    assert.equal(next.aliases.length, 1);
    assert.equal(next.aliases[0].to, "name:new");
  });

  it("rechaza ciclo", () => {
    assert.throws(
      () =>
        appendAlias(
          { version: 1, aliases: [{ from: "name:b", to: "name:a" }] },
          { from: "name:a", to: "name:b" }
        ),
      /ciclo/i
    );
  });
});

describe("removeAlias", () => {
  it("elimina por from", () => {
    const next = removeAlias(
      {
        version: 1,
        aliases: [
          { from: "name:lalito calderon", to: "name:eduardo calderon" },
          { from: "name:a", to: "name:b" },
        ],
      },
      "Lalito Calderon"
    );
    assert.equal(next.aliases.length, 1);
    assert.equal(next.aliases[0].from, "name:a");
    assert.equal(next.removed.from, "name:lalito calderon");
  });

  it("404 si no existe", () => {
    assert.throws(
      () => removeAlias({ version: 1, aliases: [] }, "name:x"),
      (err) => err.statusCode === 404
    );
  });
});
