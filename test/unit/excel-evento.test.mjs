import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildPlantillaWorkbook,
  parseExcelEvento,
  writePlantillaExcel,
  DISCIPLINA_SHEETS,
} from "../../scripts/lib/excel-evento.mjs";
import { validateEvento } from "../../scripts/lib/validate-evento.mjs";
import { disciplinaKey, disciplinaLabel } from "../../scripts/rebuild-temporada.mjs";

describe("AmarreDeChiva", () => {
  it("tiene label e inferencia por nombre", () => {
    assert.equal(disciplinaLabel("AmarreDeChiva"), "Amarre de Chiva");
    assert.equal(disciplinaKey({ nombre: "Amarre de Chiva" }), "AmarreDeChiva");
    assert.ok(DISCIPLINA_SHEETS.some((d) => d.tipo === "AmarreDeChiva"));
  });
});

describe("excel-evento", () => {
  /** @type {string} */
  let xlsxPath;
  /** @type {Buffer} */
  let filledBuffer;

  before(async () => {
    const root = mkdtempSync(join(tmpdir(), "arenapro-xlsx-"));
    xlsxPath = join(root, "evento.xlsx");
    const wb = await buildPlantillaWorkbook();

    const ev = wb.getWorksheet("Evento");
    ev.getCell(1, 2).value = "Rodeo Manual Test";
    ev.getCell(2, 2).value = "2027-04-01";
    ev.getCell(3, 2).value = "Arena Test";
    ev.getCell(4, 2).value = "2027";

    const barriles = wb.getWorksheet("Barriles");
    // clear example row and write real data at row 6
    barriles.getRow(6).values = [];
    barriles.getCell(6, 1).value = 1;
    barriles.getCell(6, 2).value = "Rider Uno";
    barriles.getCell(6, 4).value = 100;
    barriles.getCell(6, 5).value = 8000;
    barriles.getCell(6, 8).value = 14.32;
    barriles.getCell(6, 9).value = 15.1;

    barriles.getCell(7, 1).value = 2;
    barriles.getCell(7, 2).value = "Rider Solo";
    barriles.getCell(7, 4).value = 80;
    barriles.getCell(7, 5).value = 4000;
    barriles.getCell(7, 8).value = "NT";
    barriles.getCell(7, 9).value = 12.5;

    const tr = wb.getWorksheet("Team Roping");
    tr.getCell(6, 1).value = 1;
    tr.getCell(6, 2).value = "Alpha / Beta";
    tr.getCell(6, 4).value = 90;
    tr.getCell(6, 5).value = 10001;
    tr.getCell(6, 8).value = 7.45;

    const chiva = wb.getWorksheet("Amarre de Chiva");
    chiva.getCell(6, 1).value = 1;
    chiva.getCell(6, 2).value = "Chiva Rider";
    chiva.getCell(6, 4).value = 50;
    chiva.getCell(6, 5).value = 2000;
    chiva.getCell(6, 8).value = 9.1;

    await wb.xlsx.writeFile(xlsxPath);
    filledBuffer = readFileSync(xlsxPath);
  });

  it("parsea meta, clasificacion, tiempos y Amarre de Chiva", async () => {
    const evento = await parseExcelEvento(filledBuffer);
    assert.equal(evento.source, "manual");
    assert.equal(evento.schemaVersion, 2);
    assert.equal(evento.nombreEvento, "Rodeo Manual Test");
    assert.equal(evento.temporada, "2027");

    const barriles = evento.clasificacion.find((c) => c.tipo === "Barriles");
    assert.ok(barriles);
    assert.equal(barriles.entradas.length, 2);
    const uno = barriles.entradas[0];
    assert.equal(uno.nombre, "Rider Uno");
    assert.equal(uno.montoGanado, 8000);
    assert.equal(uno.puntosCircuito, 100);
    assert.equal(uno.t1, "14.32");
    assert.equal(uno.t2, "15.1");
    assert.ok(Math.abs(uno.tiempoTotal - 29.42) < 0.001);

    const solo = barriles.entradas[1];
    assert.equal(solo.t1, "NT");
    assert.equal(solo.tiempoTotal, 12.5);

    const tr = evento.clasificacion.find((c) => c.tipo === "TeamRoping");
    assert.ok(tr);
    assert.equal(tr.entradas[0].nombre, "Alpha / Beta");
    assert.equal(tr.entradas[0].montoGanado, 10001);

    const chiva = evento.clasificacion.find((c) => c.tipo === "AmarreDeChiva");
    assert.ok(chiva);
    assert.equal(chiva.entradas[0].nombre, "Chiva Rider");

    const v = validateEvento(evento);
    assert.equal(v.ok, true);
  });

  it("escribe plantilla reutilizable", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arenapro-tpl-"));
    const out = join(dir, "plantilla.xlsx");
    await writePlantillaExcel(out);
    const buf = readFileSync(out);
    assert.ok(buf.length > 1000);
  });
});
