import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendAlias } from "../../scripts/lib/alias-store.mjs";

describe("appendAlias", () => {
  it("agrega un alias nuevo", () => {
    const next = appendAlias({ version: 1, aliases: [] }, {
      from: "name:a",
      to: "name:b",
    });
    assert.equal(next.aliases.length, 1);
    assert.equal(next.aliases[0].from, "name:a");
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
