import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  surnameFromKey,
  displayFromKey,
  nameSimilarity,
  peersWithSameSurname,
  spellingNearMatches,
} from "../../scripts/lib/alias-suggest.mjs";

describe("surnameFromKey / displayFromKey", () => {
  it("extrae apellido", () => {
    assert.equal(surnameFromKey("name:lalito calderon"), "calderon");
    assert.equal(surnameFromKey("name:solo"), "");
  });

  it("formatea etiqueta", () => {
    assert.equal(displayFromKey("name:eduardo calderon"), "Eduardo Calderon");
  });
});

describe("nameSimilarity", () => {
  it("detecta typos cercanos", () => {
    assert.ok(nameSimilarity("name:juan perez", "name:juan peres") >= 0.82);
    assert.ok(nameSimilarity("name:lalito calderon", "name:eduardo calderon") < 0.82);
  });
});

describe("peersWithSameSurname", () => {
  const people = [
    { key: "name:lalito calderon", label: "Lalito Calderon" },
    { key: "name:eduardo calderon", label: "Eduardo Calderon" },
    { key: "name:juan perez", label: "Juan Perez" },
  ];

  it("lista peers si el apellido es poco común", () => {
    const res = peersWithSameSurname("name:lalito calderon", people, null, {
      maxGroup: 5,
    });
    assert.equal(res.suppressed, false);
    assert.equal(res.peers.length, 1);
    assert.equal(res.peers[0].key, "name:eduardo calderon");
  });

  it("suprime si hay demasiados con el mismo apellido", () => {
    const many = [
      { key: "name:a garcia", label: "A" },
      { key: "name:b garcia", label: "B" },
      { key: "name:c garcia", label: "C" },
      { key: "name:d garcia", label: "D" },
      { key: "name:e garcia", label: "E" },
      { key: "name:f garcia", label: "F" },
    ];
    const res = peersWithSameSurname("name:a garcia", many, null, { maxGroup: 5 });
    assert.equal(res.suppressed, true);
    assert.equal(res.peers.length, 0);
  });
});

describe("spellingNearMatches", () => {
  it("sugiere spelling cercano", () => {
    const people = [
      { key: "name:juan perez", label: "Juan Perez" },
      { key: "name:juan peres", label: "Juan Peres" },
      { key: "name:otro", label: "Otro" },
    ];
    const hits = spellingNearMatches("name:juan perez", people);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].key, "name:juan peres");
  });
});
