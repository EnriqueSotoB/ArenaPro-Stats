import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  cpSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { rebuildTemporada } from "../../scripts/rebuild-temporada.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDinero = join(here, "..", "fixtures", "evento-con-dinero.json");
const fixtureTr = join(here, "..", "fixtures", "evento-team-roping-duo.json");

function writeManifest(root, eventos) {
  writeFileSync(
    join(root, "data", "manifest.json"),
    JSON.stringify(
      {
        temporadaActiva: "2027",
        titulo: "FMR Tour 2027",
        cutLineVisible: false,
        eventos,
      },
      null,
      2
    ),
    "utf8"
  );
  writeFileSync(
    join(root, "data", "competidor-aliases.json"),
    JSON.stringify({ version: 1, aliases: [] }, null, 2),
    "utf8"
  );
}

describe("rebuildTemporada dinero", () => {
  /** @type {string} */
  let root;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "arenapro-dinero-"));
    mkdirSync(join(root, "data", "eventos"), { recursive: true });
    cpSync(fixtureDinero, join(root, "data", "eventos", "e1.json"));
    // Segundo evento: mismo rider uno + barriles otra vez
    const e2 = JSON.parse(readFileSync(fixtureDinero, "utf8"));
    e2.eventoId = "local:fixture-dinero-2";
    e2.nombreEvento = "Fixture Dinero 2";
    e2.clasificacion = [
      {
        categoriaId: "local:cat-barriles",
        entradas: [
          {
            lugar: 1,
            competidorId: "local:r1",
            nombre: "Rider Uno",
            puntosCircuito: 50,
            montoGanado: 2000,
          },
        ],
      },
    ];
    writeFileSync(
      join(root, "data", "eventos", "e2.json"),
      JSON.stringify(e2, null, 2),
      "utf8"
    );
    writeManifest(root, [
      {
        id: "local:fixture-dinero",
        nombre: "Fixture Dinero",
        fecha: "2027-02-01",
        sede: "Arena Test",
        file: "eventos/e1.json",
      },
      {
        id: "local:fixture-dinero-2",
        nombre: "Fixture Dinero 2",
        fecha: "2027-02-08",
        sede: "Arena Test",
        file: "eventos/e2.json",
      },
    ]);
  });

  after(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("suma dineroTotal y puntos por disciplina entre eventos", () => {
    rebuildTemporada(root);
    const temporada = JSON.parse(
      readFileSync(join(root, "data", "temporada.json"), "utf8")
    );
    const unoBarriles = temporada.standings.find(
      (s) => s.nombre === "Rider Uno" && s.disciplinaId === "Barriles"
    );
    assert.ok(unoBarriles);
    assert.equal(unoBarriles.puntosTotales, 150);
    assert.equal(unoBarriles.dineroTotal, 10000);
    assert.equal(unoBarriles.eventos, 2);

    const unoLazo = temporada.standings.find(
      (s) => s.nombre === "Rider Uno" && s.disciplinaId === "LazoDeBecerro"
    );
    assert.ok(unoLazo);
    assert.equal(unoLazo.dineroTotal, 5000);
    assert.equal(unoLazo.puntosTotales, 90);
  });
});

describe("rebuildTemporada team roping", () => {
  /** @type {string} */
  let root;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "arenapro-tr-"));
    mkdirSync(join(root, "data", "eventos"), { recursive: true });
    cpSync(fixtureTr, join(root, "data", "eventos", "tr.json"));
    writeManifest(root, [
      {
        id: "local:fixture-tr",
        nombre: "Fixture Team Roping Duo",
        fecha: "2027-02-15",
        sede: "Arena Test",
        file: "eventos/tr.json",
      },
    ]);
  });

  after(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("genera Cabeceros/Pialadores, no parte puntos y parte dinero", () => {
    rebuildTemporada(root);
    const temporada = JSON.parse(
      readFileSync(join(root, "data", "temporada.json"), "utf8")
    );

    const headers = temporada.standings.filter(
      (s) => s.disciplinaId === "TeamRopingHeader"
    );
    const heelers = temporada.standings.filter(
      (s) => s.disciplinaId === "TeamRopingHeeler"
    );
    assert.equal(headers.length, 2);
    assert.equal(heelers.length, 2);

    const alpha = headers.find((s) => s.nombre === "Header Alpha");
    const beta = heelers.find((s) => s.nombre === "Heeler Beta");
    assert.ok(alpha);
    assert.ok(beta);
    assert.equal(alpha.puntosTotales, 100);
    assert.equal(beta.puntosTotales, 100);
    assert.equal(alpha.dineroTotal, 5000);
    assert.equal(beta.dineroTotal, 5001);

    assert.equal(
      temporada.standings.some((s) => s.disciplinaId === "TeamRoping"),
      false
    );
  });
});
