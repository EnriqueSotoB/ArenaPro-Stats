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
  sheetKind,
  columnsForKind,
  ntEquivalente,
  normalizeFechaYmd,
} from "../../scripts/lib/excel-evento.mjs";
import { validateEvento } from "../../scripts/lib/validate-evento.mjs";
import { disciplinaKey, disciplinaLabel } from "../../scripts/rebuild-temporada.mjs";
import { expandTeamRopingRow } from "../../scripts/lib/team-roping.mjs";

describe("AmarreDeChiva", () => {
  it("tiene label e inferencia por nombre", () => {
    assert.equal(disciplinaLabel("AmarreDeChiva"), "Amarre de Chiva");
    assert.equal(disciplinaKey({ nombre: "Amarre de Chiva" }), "AmarreDeChiva");
    assert.ok(DISCIPLINA_SHEETS.some((d) => d.tipo === "AmarreDeChiva"));
  });
});

describe("columnas por disciplina", () => {
  it("tiempo no trae calificación ni rol", () => {
    const keys = columnsForKind("tiempo").map((c) => c.key);
    assert.ok(keys.includes("r1"));
    assert.ok(!keys.includes("calif"));
    assert.ok(!keys.includes("rol"));
  });

  it("teamRoping trae cabecero/pialador y rondas, sin rol ni calificación", () => {
    const keys = columnsForKind("teamRoping").map((c) => c.key);
    assert.ok(keys.includes("cabecero"));
    assert.ok(keys.includes("pialador"));
    assert.ok(keys.includes("r1"));
    assert.ok(!keys.includes("rol"));
    assert.ok(!keys.includes("calif"));
    assert.ok(!keys.includes("nombre"));
  });

  it("solo 2 hojas TR (abierta + masters)", () => {
    const tr = DISCIPLINA_SHEETS.filter((d) => /^TeamRoping/i.test(d.tipo));
    assert.deepEqual(
      tr.map((d) => d.tipo),
      ["TeamRoping", "TeamRopingMasters"]
    );
  });

  it("puntos solo calificación, sin rondas", () => {
    assert.equal(sheetKind("JineteosDeToros"), "puntos");
    const keys = columnsForKind("puntos").map((c) => c.key);
    assert.ok(keys.includes("calif"));
    assert.ok(!keys.includes("r1"));
    assert.ok(!keys.includes("total"));
  });

  it("NT equivalente 60 general y 120 en achatada", () => {
    assert.equal(ntEquivalente("Barriles"), 60);
    assert.equal(ntEquivalente("AchatadaDeNovillos"), 120);
  });

  it("normalizeFechaYmd limpia Date de Excel y strings basura", () => {
    assert.equal(normalizeFechaYmd("2026-09-19"), "2026-09-19");
    assert.equal(normalizeFechaYmd(new Date(2026, 8, 19)), "2026-09-19");
    const ugly =
      "Sat Sep 19 2026 18:00:00 GMT-0600 (Central Standard Time)";
    assert.equal(normalizeFechaYmd(ugly), "2026-09-19");
    assert.ok(!normalizeFechaYmd(ugly).includes(":"));
  });
});

describe("excel-evento", () => {
  /** @type {Buffer} */
  let filledBuffer;

  before(async () => {
    const root = mkdtempSync(join(tmpdir(), "arenapro-xlsx-"));
    const xlsxPath = join(root, "evento.xlsx");
    const wb = await buildPlantillaWorkbook();

    const ev = wb.getWorksheet("Evento");
    ev.getCell(3, 3).value = "Rodeo Manual Test";
    ev.getCell(4, 3).value = "2027-04-01";
    ev.getCell(5, 3).value = "Arena Test";
    ev.getCell(6, 3).value = "2027";

    // Barriles (tiempo): B lugar, C nombre, E pts, F dinero, G r1, H r2
    const barriles = wb.getWorksheet("Barriles");
    barriles.getCell(7, 2).value = 1;
    barriles.getCell(7, 3).value = "Rider Uno";
    barriles.getCell(7, 5).value = 100;
    barriles.getCell(7, 6).value = 8000;
    barriles.getCell(7, 7).value = 14.32;
    barriles.getCell(7, 8).value = 15.1;

    barriles.getCell(8, 2).value = 2;
    barriles.getCell(8, 3).value = "Rider Solo";
    barriles.getCell(8, 5).value = 80;
    barriles.getCell(8, 6).value = 4000;
    barriles.getCell(8, 7).value = "NT";
    barriles.getCell(8, 8).value = 12.5;

    barriles.getCell(9, 2).value = 3;
    barriles.getCell(9, 3).value = "Rider Sesenta";
    barriles.getCell(9, 5).value = 70;
    barriles.getCell(9, 6).value = 1000;
    barriles.getCell(9, 7).value = 60; // = NT

    // TR: B lugar, C cabecero, D pialador, F pts, G dinero, H r1
    const tr = wb.getWorksheet("Team Roping");
    tr.getCell(7, 2).value = 1;
    tr.getCell(7, 3).value = "Alpha";
    tr.getCell(7, 4).value = "Beta";
    tr.getCell(7, 6).value = 90;
    tr.getCell(7, 7).value = 10001;
    tr.getCell(7, 8).value = 7.45;

    const achatada = wb.getWorksheet("Achatada de Novillos");
    achatada.getCell(7, 2).value = 1;
    achatada.getCell(7, 3).value = "Achatada Rider";
    achatada.getCell(7, 5).value = 50;
    achatada.getCell(7, 6).value = 500;
    achatada.getCell(7, 7).value = 120; // = NT en achatada

    const chiva = wb.getWorksheet("Amarre de Chiva");
    chiva.getCell(7, 2).value = 1;
    chiva.getCell(7, 3).value = "Chiva Rider";
    chiva.getCell(7, 5).value = 50;
    chiva.getCell(7, 6).value = 2000;
    chiva.getCell(7, 7).value = 9.1;

    const jineteos = wb.getWorksheet("Jineteos de Toros");
    // puntos: B lugar, C nombre, E pts, F dinero, G calif
    jineteos.getCell(7, 2).value = 1;
    jineteos.getCell(7, 3).value = "Jinete Uno";
    jineteos.getCell(7, 5).value = 40;
    jineteos.getCell(7, 6).value = 3000;
    jineteos.getCell(7, 7).value = 88;

    await wb.xlsx.writeFile(xlsxPath);
    filledBuffer = readFileSync(xlsxPath);
  });

  it("parsea meta, tiempos, NT/60/120 y hojas de puntos", async () => {
    const evento = await parseExcelEvento(filledBuffer);
    assert.equal(evento.source, "manual");
    assert.equal(evento.nombreEvento, "Rodeo Manual Test");

    const barriles = evento.clasificacion.find((c) => c.tipo === "Barriles");
    assert.ok(barriles);
    assert.equal(barriles.entradas.length, 3);
    const uno = barriles.entradas[0];
    assert.equal(uno.nombre, "Rider Uno");
    assert.equal(uno.montoGanado, 8000);
    assert.ok(Math.abs(uno.tiempoTotal - 29.42) < 0.001);

    assert.equal(barriles.entradas[1].t1, "NT");
    assert.equal(barriles.entradas[2].t1, "NT"); // 60 → NT

    const ach = evento.clasificacion.find((c) => c.tipo === "AchatadaDeNovillos");
    assert.ok(ach);
    assert.equal(ach.entradas[0].t1, "NT"); // 120 → NT

    const tr = evento.clasificacion.find((c) => c.tipo === "TeamRoping");
    assert.ok(tr);
    assert.equal(tr.entradas[0].nombre, "Alpha / Beta");
    assert.equal(tr.entradas[0].headerNombre, "Alpha");
    assert.equal(tr.entradas[0].heelerNombre, "Beta");
    assert.ok(!tr.entradas[0].rol);

    const roles = expandTeamRopingRow(tr.entradas[0], "TeamRoping");
    assert.equal(roles.length, 2);
    assert.equal(roles[0].disciplinaId, "TeamRopingHeader");
    assert.equal(roles[0].nombre, "Alpha");
    assert.equal(roles[1].disciplinaId, "TeamRopingHeeler");
    assert.equal(roles[1].nombre, "Beta");

    const jin = evento.clasificacion.find((c) => c.tipo === "JineteosDeToros");
    assert.ok(jin);
    assert.equal(jin.entradas[0].puntos, 88);
    assert.equal(jin.entradas[0].t1, null);

    const v = validateEvento(evento);
    assert.equal(v.ok, true);
  });

  it("teamRoping acepta fila solo con Cabecero+Pialador", async () => {
    const wb = await buildPlantillaWorkbook();
    const ev = wb.getWorksheet("Evento");
    ev.getCell(3, 3).value = "Solo TR";
    ev.getCell(4, 3).value = "2027-05-01";
    const tr = wb.getWorksheet("Team Roping");
    // limpia ejemplo (fila 7) y pone dúo sin lugar/tiempos/pts
    for (let c = 2; c <= 12; c++) tr.getCell(7, c).value = null;
    tr.getCell(8, 3).value = "Juan";
    tr.getCell(8, 4).value = "Pedro";
    const dir = mkdtempSync(join(tmpdir(), "arenapro-tr-only-"));
    const out = join(dir, "solo-tr.xlsx");
    await wb.xlsx.writeFile(out);
    const evento = await parseExcelEvento(readFileSync(out));
    const block = evento.clasificacion.find((c) => c.tipo === "TeamRoping");
    assert.ok(block);
    assert.equal(block.entradas[0].nombre, "Juan / Pedro");
    assert.equal(block.entradas[0].headerNombre, "Juan");
    assert.equal(block.entradas[0].heelerNombre, "Pedro");
  });

  it("escribe plantilla reutilizable", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arenapro-tpl-"));
    const out = join(dir, "plantilla.xlsx");
    await writePlantillaExcel(out);
    assert.ok(readFileSync(out).length > 1000);
  });
});
