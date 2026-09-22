/**
 * Plantilla Excel manual → mismo shape que export Time (schema 2).
 * Una hoja por disciplina; columnas según tipo (tiempo / TR / puntos).
 */
import ExcelJS from "exceljs";
import { toMontoEntero } from "./money.mjs";

/** @type {Array<{ sheet: string, tipo: string, defaultRondas: number }>} */
export const DISCIPLINA_SHEETS = [
  { sheet: "Barriles", tipo: "Barriles", defaultRondas: 2 },
  { sheet: "Barriles Masters", tipo: "BarrilesMasters", defaultRondas: 2 },
  { sheet: "Lazo de Becerro", tipo: "LazoDeBecerro", defaultRondas: 2 },
  { sheet: "Lazo en Falso", tipo: "LazoEnFalso", defaultRondas: 2 },
  { sheet: "Achatada de Novillos", tipo: "AchatadaDeNovillos", defaultRondas: 2 },
  { sheet: "Amarre de Chiva", tipo: "AmarreDeChiva", defaultRondas: 2 },
  { sheet: "Team Roping", tipo: "TeamRoping", defaultRondas: 2 },
  { sheet: "Team Roping Masters", tipo: "TeamRopingMasters", defaultRondas: 2 },
  { sheet: "Caballo con Pretal", tipo: "CaballoConPretal", defaultRondas: 1 },
  { sheet: "Caballo con Montura", tipo: "CaballoConMontura", defaultRondas: 1 },
  { sheet: "Jineteos de Toros", tipo: "JineteosDeToros", defaultRondas: 1 },
  { sheet: "Polos", tipo: "Polos", defaultRondas: 1 },
];

/** @typedef {"tiempo"|"teamRoping"|"puntos"} SheetKind */

/**
 * @param {string} tipo
 * @returns {SheetKind}
 */
export function sheetKind(tipo) {
  if (/Jineteos|Montura|Pretal/i.test(tipo)) return "puntos";
  if (/^TeamRoping/i.test(tipo)) return "teamRoping";
  return "tiempo";
}

/**
 * @param {SheetKind} kind
 * @returns {Array<{ key: string, label: string, width: number }>}
 */
export function columnsForKind(kind) {
  /** @type {Array<{ key: string, label: string, width: number }>} */
  const cols = [
    { key: "lugar", label: "Lugar (puesto final)", width: 16 },
    { key: "nombre", label: "Nombre del competidor", width: 28 },
    { key: "equipo", label: "Equipo", width: 14 },
    { key: "pts", label: "Puntos de circuito", width: 16 },
    { key: "dinero", label: "Dinero ganado (MXN)", width: 18 },
  ];
  if (kind === "puntos") {
    cols.push({ key: "calif", label: "Calificación (pts)", width: 16 });
  }
  if (kind === "teamRoping") {
    cols.push({ key: "rol", label: "Rol TR", width: 12 });
  }
  if (kind === "tiempo" || kind === "teamRoping") {
    cols.push(
      { key: "r1", label: "Ronda 1 (total)", width: 14 },
      { key: "r2", label: "Ronda 2 (total)", width: 14 },
      { key: "r3", label: "Ronda 3 (total)", width: 14 },
      { key: "total", label: "Total tiempos", width: 14 }
    );
  }
  cols.push(
    { key: "fuera", label: "¿No clasificó? (DNF/DSQ)", width: 20 },
    { key: "notas", label: "Notas", width: 28 }
  );
  return cols;
}

const FOREST = "FF3F524F";
const OCHRE = "FFDD9219";
const CREAM = "FFF8F6F2";
const SAND = "FFDDD2BC";
const WHITE = "FFFFFFFF";
const MUTED = "FF82807B";
const DATA_ROWS = 40;

export async function parseExcelEvento(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer));
  return eventoFromWorkbook(workbook);
}

export function eventoFromWorkbook(workbook) {
  const meta = readEventoMeta(workbook.getWorksheet("Evento"));
  const categorias = [];
  const clasificacion = [];
  const resultados = [];
  let catIndex = 0;

  for (const def of DISCIPLINA_SHEETS) {
    const ws = workbook.getWorksheet(def.sheet);
    if (!ws) continue;
    const parsed = parseDisciplinaSheet(ws, def, catIndex);
    if (!parsed) continue;
    catIndex += 1;
    categorias.push(parsed.categoria);
    clasificacion.push(parsed.bloque);
    for (const r of parsed.resultados) resultados.push(r);
  }

  if (!categorias.length) {
    const err = new Error(
      "El Excel no tiene filas de resultados en ninguna hoja de disciplina."
    );
    err.statusCode = 400;
    throw err;
  }

  const nombreEvento = meta.nombreEvento || "Evento manual";
  const fecha = meta.fecha || new Date().toISOString().slice(0, 10);
  const slug = slugify(`${fecha}-${nombreEvento}`).slice(0, 48);

  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    source: "manual",
    eventoId: `manual:${slug}`,
    nombreEvento,
    fecha,
    sede: meta.sede || "",
    temporada: meta.temporada || "",
    categorias,
    clasificacion,
    resultados,
  };
}

export async function buildPlantillaWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ArenaPro Stats";
  wb.created = new Date();
  addComoLlenarSheet(wb);
  addEventoSheet(wb);
  for (const def of DISCIPLINA_SHEETS) addDisciplinaSheet(wb, def);
  return wb;
}

export async function writePlantillaExcel(outPath) {
  const wb = await buildPlantillaWorkbook();
  await wb.xlsx.writeFile(outPath);
}

function readEventoMeta(ws) {
  const out = { nombreEvento: "", fecha: "", sede: "", temporada: "" };
  if (!ws) return out;
  ws.eachRow((row) => {
    const label = normalizeHeader(cellText(row.getCell(2)) || cellText(row.getCell(1)));
    const value = cellText(row.getCell(3)) || cellText(row.getCell(2));
    if (!label) return;
    if (label.includes("nombre") && label.includes("evento")) out.nombreEvento = value;
    else if (label.includes("fecha")) out.fecha = value;
    else if (label.includes("sede")) out.sede = value;
    else if (label.includes("temporada")) out.temporada = value;
  });
  return out;
}

function findHeaderRow(ws) {
  let found = null;
  ws.eachRow((row, rowNumber) => {
    if (found) return;
    const map = mapHeaderRow(row);
    if (map.nombre && (map.lugar || map.ronda1 || map.puntosCircuito || map.califPts)) {
      found = { rowNumber, map };
    }
  });
  return found;
}

function parseDisciplinaSheet(ws, def, catIndex) {
  let nombreCategoria = def.sheet;
  let numeroRondas =
    sheetKind(def.tipo) === "puntos" ? 1 : def.defaultRondas;
  const headerInfo = findHeaderRow(ws);
  if (!headerInfo) return null;
  const { rowNumber: headerRow, map: h } = headerInfo;

  for (let r = 1; r < headerRow; r++) {
    const row = ws.getRow(r);
    const label = normalizeHeader(cellText(row.getCell(2)) || cellText(row.getCell(1)));
    const value = cellText(row.getCell(3)) || cellText(row.getCell(2));
    if (!label) continue;
    if (label.includes("nombre") && label.includes("categoria")) {
      if (value) nombreCategoria = value;
    } else if (label.includes("numero") && label.includes("ronda")) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) numeroRondas = Math.min(3, Math.trunc(n));
    }
  }

  const entradas = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    if (!h.nombre) return;
    const nombre = cellText(row.getCell(h.nombre));
    if (!nombre || /^ejemplo\b/i.test(nombre) || nombre.length > 80) return;

    const lugarRaw = h.lugar ? cellText(row.getCell(h.lugar)) : "";
    const lugar = lugarRaw === "" ? null : Number(lugarRaw);
    const equipo = h.equipo ? cellText(row.getCell(h.equipo)) : "";
    const puntosCircuito = h.puntosCircuito
      ? toNumOrNull(rawCellValue(row.getCell(h.puntosCircuito)))
      : null;
    const montoGanado = h.dineroMxn
      ? toMontoEntero(rawCellValue(row.getCell(h.dineroMxn)))
      : 0;
    const puntos = h.califPts ? toNumOrNull(rawCellValue(row.getCell(h.califPts))) : null;
    const rol = h.rol ? normalizeRol(cellText(row.getCell(h.rol))) : "";
    const ntEq = ntEquivalente(def.tipo);
    const t1 = h.ronda1 ? roundCell(rawCellValue(row.getCell(h.ronda1)), ntEq) : null;
    const t2 = h.ronda2 ? roundCell(rawCellValue(row.getCell(h.ronda2)), ntEq) : null;
    const t3 = h.ronda3 ? roundCell(rawCellValue(row.getCell(h.ronda3)), ntEq) : null;
    const totalExplicit = h.total
      ? roundCell(rawCellValue(row.getCell(h.total)), ntEq)
      : null;
    const sinPosicion = h.fuera ? truthy(cellText(row.getCell(h.fuera))) : false;
    const notas = h.notas ? cellText(row.getCell(h.notas)) : "";

    const tieneSenal =
      Number.isFinite(lugar) ||
      t1 != null ||
      t2 != null ||
      t3 != null ||
      (puntosCircuito != null && puntosCircuito !== 0) ||
      montoGanado > 0 ||
      (puntos != null && puntos !== 0);
    if (!tieneSenal) return;

    const tiempoTotal =
      totalExplicit != null && isNumericRound(totalExplicit)
        ? Number(totalExplicit)
        : sumRounds(t1, t2, t3);

    const hasNt = [t1, t2, t3].some((t) => isNtLike(t));
    const recorridoCompleto =
      !sinPosicion && !hasNt && tiempoTotal != null && Number.isFinite(tiempoTotal);

    const detalleParts = [];
    if (t1 != null) detalleParts.push(`Ronda 1: ${formatRound(t1)}`);
    if (t2 != null) detalleParts.push(`Ronda 2: ${formatRound(t2)}`);
    if (t3 != null) detalleParts.push(`Ronda 3: ${formatRound(t3)}`);
    if (notas) detalleParts.push(notas);

    const id = `local:${slugify(nombre)}`;
    const entrada = {
      lugar: Number.isFinite(lugar) ? lugar : null,
      sinPosicion,
      recorridoCompleto: sheetKind(def.tipo) === "puntos" ? !sinPosicion : recorridoCompleto,
      competidorId: id,
      inscripcionId: id,
      nombre,
      equipo: equipo || "",
      tiempoTotal: sheetKind(def.tipo) === "puntos" ? null : tiempoTotal,
      puntos,
      puntosCircuito: puntosCircuito ?? 0,
      montoGanado,
      detalleVueltas: detalleParts.join(" · ") || null,
      t1: t1 != null ? String(t1) : null,
      t2: t2 != null ? String(t2) : null,
      t3: t3 != null ? String(t3) : null,
    };
    if (rol) entrada.rol = rol;
    entradas.push(entrada);
  });

  if (!entradas.length) return null;

  const categoriaId = `manual:cat-${catIndex + 1}-${def.tipo}`;
  const categoria = {
    id: categoriaId,
    nombre: nombreCategoria,
    tipo: def.tipo,
    numeroRondas,
  };
  const bloque = {
    categoriaId,
    nombre: nombreCategoria,
    tipo: def.tipo,
    numeroRondas,
    entradas,
  };

  const resultados = [];
  for (const e of entradas) {
    for (const { vuelta, val } of [
      { vuelta: "Ronda 1", val: e.t1 },
      { vuelta: "Ronda 2", val: e.t2 },
      { vuelta: "Ronda 3", val: e.t3 },
    ]) {
      if (val == null || val === "") continue;
      const nt = isNtLike(val);
      resultados.push({
        inscripcionId: e.inscripcionId,
        competidorId: e.competidorId,
        categoriaId,
        nombre: e.nombre,
        equipo: e.equipo || null,
        vuelta,
        destino: "Rodeo",
        tiempoOficial: nt ? null : Number(val),
        esNoTime: nt,
        puntosCircuito: e.puntosCircuito,
        montoGanado: e.montoGanado,
      });
    }
  }

  return { categoria, bloque, resultados };
}

function mapHeaderRow(row) {
  /** @type {Record<string, number>} */
  const map = {};
  row.eachCell((cell, col) => {
    const hdr = normalizeHeader(cellText(cell));
    if (!hdr) return;
    if (hdr.startsWith("lugar") || hdr.includes("puesto")) map.lugar = col;
    else if (hdr.startsWith("nombre")) map.nombre = col;
    else if (hdr === "equipo") map.equipo = col;
    else if (hdr.includes("puntos") && hdr.includes("circuito")) map.puntosCircuito = col;
    else if (hdr.includes("dinero") || hdr.includes("ganado") || hdr.includes("mxn")) {
      map.dineroMxn = col;
    } else if (hdr.includes("calif")) map.califPts = col;
    else if (hdr.includes("rol")) map.rol = col;
    else if (hdr.includes("ronda 1") || hdr === "t1") map.ronda1 = col;
    else if (hdr.includes("ronda 2") || hdr === "t2") map.ronda2 = col;
    else if (hdr.includes("ronda 3") || hdr === "t3") map.ronda3 = col;
    else if (hdr.includes("total")) map.total = col;
    else if (
      hdr.includes("no clasific") ||
      hdr.includes("dnf") ||
      hdr.includes("dsq") ||
      hdr.includes("sin posicion") ||
      hdr.includes("fuera")
    ) {
      map.fuera = col;
    } else if (hdr === "notas" || hdr === "nota") map.notas = col;
  });
  return map;
}

function addComoLlenarSheet(wb) {
  const ws = wb.addWorksheet("Cómo llenar", {
    properties: { tabColor: { argb: OCHRE } },
    views: [{ showGridLines: false }],
  });
  ws.getColumn(1).width = 3;
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 78;

  mergeBanner(ws, "B1:C1", "ArenaPro Stats · Plantilla manual FMR Tour", FOREST);
  ws.getRow(1).height = 30;

  ws.getCell("B3").value = "¿Para qué sirve?";
  styleSectionTitle(ws.getCell("B3"));
  ws.getCell("C3").value =
    "Capturar un rodeo que NO se corrió en ArenaPro Time. En admin se convierte al mismo JSON que un export de Time.";
  styleBody(ws.getCell("C3"));
  ws.getRow(3).height = 32;

  const steps = [
    ["1. Evento", "Llena la hoja Evento: nombre, fecha (AAAA-MM-DD), sede y temporada (ej. 2027)."],
    [
      "2. Disciplinas",
      "Cada pestaña es una disciplina. Si no se corrió, déjala vacía. No renombres las pestañas.",
    ],
    [
      "3. Lugar = puesto final",
      "1 = primero, 2 = segundo… NO es el orden de salida. Es cómo quedaron al cerrar la categoría.",
    ],
    [
      "4. Columnas según disciplina",
      "Tiempos (barriles, lazos…): Ronda 1–3 + Total. Team Roping: además Rol TR. Jineteos/Montura/Pretal: solo Calificación (pts), sin rondas.",
    ],
    [
      "5. NT / NP en tiempos",
      "En rondas escribe NT, NP, o el número 60 (= NT). En Achatada de Novillos el equivalente es 120 (= NT).",
    ],
    [
      "6. ¿No clasificó? (DNF/DSQ)",
      "Pon Sí SOLO si esa persona no entra al ranking (se cayó, descalificado, no terminó). En casi todos los casos déjalo en No o vacío.",
    ],
    [
      "7. Dinero y puntos",
      "Dinero en pesos enteros. Puntos de circuito = del tour.",
    ],
    [
      "8. Team Roping",
      'Nombre como "Header / Heeler" o usa Rol TR. El dinero del dúo se parte 50/50 al publicar.',
    ],
    [
      "9. Publicar",
      "Guarda el .xlsx → publicar.bat → admin → suelta el archivo → preview → Agregar a Stats → Publicar.",
    ],
  ];
  steps.forEach(([title, body], i) => {
    const r = 5 + i;
    ws.getCell(r, 2).value = title;
    styleSectionTitle(ws.getCell(r, 2));
    ws.getCell(r, 3).value = body;
    styleBody(ws.getCell(r, 3));
    ws.getRow(r).height = 40;
  });
}

function addEventoSheet(wb) {
  const ws = wb.addWorksheet("Evento", {
    properties: { tabColor: { argb: FOREST } },
    views: [{ showGridLines: false }],
  });
  ws.getColumn(1).width = 3;
  ws.getColumn(2).width = 26;
  ws.getColumn(3).width = 44;
  ws.getColumn(4).width = 52;

  mergeBanner(ws, "B1:D1", "Datos del evento (obligatorio)", FOREST);
  ws.getRow(1).height = 30;

  const rows = [
    ["Nombre del evento", "", "Ej. RODEO CAMARGO 2027"],
    ["Fecha (AAAA-MM-DD)", "", "Ej. 2027-03-15"],
    ["Sede", "", "Arena o ciudad"],
    ["Temporada", "2027", "Año del circuito FMR (no siempre el del calendario)"],
  ];
  rows.forEach(([label, value, tip], i) => {
    const r = 3 + i;
    ws.getCell(r, 2).value = label;
    styleMetaLabel(ws.getCell(r, 2));
    ws.getCell(r, 3).value = value;
    styleInput(ws.getCell(r, 3));
    ws.getCell(r, 4).value = tip;
    ws.getCell(r, 4).font = { italic: true, color: { argb: MUTED }, size: 10 };
    ws.getRow(r).height = 24;
  });

  ws.mergeCells("B8:D8");
  ws.getCell("B8").value =
    "Luego abre cada disciplina corrida y captura la clasificación final (puesto 1, 2, 3…).";
  ws.getCell("B8").font = { color: { argb: FOREST }, size: 11 };
}

function addDisciplinaSheet(wb, def) {
  const kind = sheetKind(def.tipo);
  const cols = columnsForKind(kind);
  const headerRow = 6;
  const firstData = headerRow + 1;
  const lastCol = 1 + cols.length;

  const ws = wb.addWorksheet(def.sheet, {
    properties: { tabColor: { argb: OCHRE } },
    views: [{ state: "frozen", ySplit: headerRow, showGridLines: false }],
  });

  ws.getColumn(1).width = 3;
  cols.forEach((c, i) => {
    ws.getColumn(i + 2).width = c.width;
  });

  const end = colLetter(lastCol);
  mergeBanner(ws, `B1:${end}1`, `Clasificación final · ${def.sheet}`, FOREST);
  ws.getRow(1).height = 28;

  ws.mergeCells(`B2:${end}2`);
  ws.getCell("B2").value = tipForKind(kind, def.tipo);
  ws.getCell("B2").font = { italic: true, size: 10, color: { argb: MUTED } };
  ws.getRow(2).height = 22;

  ws.getCell("B3").value = "Nombre categoría";
  styleMetaLabel(ws.getCell("B3"));
  ws.getCell("C3").value = def.sheet;
  styleInput(ws.getCell("C3"));
  ws.getCell("D3").value = "Cómo salió en el cartel (Abierta, Master…)";
  ws.getCell("D3").font = { italic: true, size: 9, color: { argb: MUTED } };

  if (kind === "puntos") {
    ws.getCell("B4").value = "Tipo de score";
    styleMetaLabel(ws.getCell("B4"));
    ws.getCell("C4").value = "Calificación (pts)";
    styleInput(ws.getCell("C4"));
    ws.getCell("D4").value = "Sin tiempos: llena Calificación (pts).";
    ws.getCell("D4").font = { italic: true, size: 9, color: { argb: MUTED } };
  } else {
    ws.getCell("B4").value = "Número de rondas";
    styleMetaLabel(ws.getCell("B4"));
    ws.getCell("C4").value = def.defaultRondas;
    styleInput(ws.getCell("C4"));
    ws.getCell("D4").value = "1, 2 o 3. Deja vacías las rondas que no existan.";
    ws.getCell("D4").font = { italic: true, size: 9, color: { argb: MUTED } };
  }

  /** @type {Record<string, number>} */
  const keyToCol = {};
  cols.forEach((c, i) => {
    const col = i + 2;
    keyToCol[c.key] = col;
    const cell = ws.getCell(headerRow, col);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FOREST } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder(SAND);
  });
  ws.getRow(headerRow).height = 40;

  fillDataRow(
    ws,
    firstData,
    {
      lugar: 1,
      nombre: "Ejemplo Competidor",
      equipo: "",
      pts: 100,
      dinero: 0,
      calif: kind === "puntos" ? 85 : "",
      rol: "",
      r1: kind === "puntos" ? "" : 14.32,
      r2: kind !== "puntos" && def.defaultRondas >= 2 ? 15.1 : "",
      r3: "",
      fuera: "No",
      notas: "Borra esta fila; es solo guía",
    },
    keyToCol,
    true
  );

  for (let i = 1; i < DATA_ROWS; i++) prepareEmptyRow(ws, firstData + i, keyToCol);

  const last = firstData + DATA_ROWS - 1;
  if (keyToCol.rol) {
    const L = colLetter(keyToCol.rol);
    ws.dataValidations.add(`${L}${firstData}:${L}${last}`, {
      type: "list",
      allowBlank: true,
      formulae: ['"Header,Heeler"'],
      showErrorMessage: true,
      errorTitle: "Rol TR",
      error: "Elige Header, Heeler o deja vacío.",
    });
  }
  if (keyToCol.fuera) {
    const L = colLetter(keyToCol.fuera);
    ws.dataValidations.add(`${L}${firstData}:${L}${last}`, {
      type: "list",
      allowBlank: true,
      formulae: ['"Sí,No"'],
      showErrorMessage: true,
      errorTitle: "No clasificó",
      error: "Sí = DNF/DSQ (fuera del ranking). No = clasificó normal.",
    });
  }

  if (kind === "teamRoping") {
    ws.getCell(firstData + 1, keyToCol.nombre).value = "Header / Heeler";
    ws.getCell(firstData + 1, keyToCol.nombre).font = {
      italic: true,
      color: { argb: MUTED },
      size: 10,
    };
  }

  const foot = last + 2;
  ws.mergeCells(foot, 2, foot, lastCol);
  ws.getCell(foot, 2).value = footerForKind(kind, def.tipo);
  ws.getCell(foot, 2).font = { size: 9, color: { argb: MUTED }, italic: true };
}

function tipForKind(kind, tipo) {
  const ntEq = ntEquivalente(tipo);
  if (kind === "puntos") {
    return "Lugar = puesto final (no orden de salida). Solo Calificación (pts). ¿No clasificó? = Sí únicamente si DNF/DSQ.";
  }
  if (kind === "teamRoping") {
    return `Lugar = puesto final. Rondas = total de esa ronda (NT/NP o ${ntEq} = NT). Rol TR = Header/Heeler. Total se calcula solo.`;
  }
  return `Lugar = puesto final (no orden de salida). Rondas = total de esa ronda (acepta NT, NP o ${ntEq} = NT). Total se calcula solo.`;
}

function footerForKind(kind, tipo) {
  const ntEq = ntEquivalente(tipo);
  if (kind === "puntos") {
    return "Dinero sin decimales. ¿No clasificó? = Sí solo si esa persona no entra al ranking (DNF / DSQ).";
  }
  return `En rondas: NT, NP o el número ${ntEq} (equivale a NT). Dinero sin decimales. ¿No clasificó? = Sí solo si DNF / DSQ.`;
}

function totalFormula(r, r1Col, r3Col) {
  const a = colLetter(r1Col);
  const b = colLetter(r3Col);
  return { formula: `IF(COUNTA(${a}${r}:${b}${r})=0,"",SUM(${a}${r}:${b}${r}))` };
}

function prepareEmptyRow(ws, r, keyToCol) {
  for (const [key, col] of Object.entries(keyToCol)) {
    const cell = ws.getCell(r, col);
    cell.border = thinBorder(SAND);
    if (key === "total" && keyToCol.r1 && keyToCol.r3) {
      cell.value = totalFormula(r, keyToCol.r1, keyToCol.r3);
      cell.numFmt = "0.000";
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CREAM } };
    } else if (key === "dinero" || key === "pts" || key === "calif") {
      cell.numFmt = "#,##0";
    } else if (key === "r1" || key === "r2" || key === "r3") {
      cell.numFmt = "0.000";
    }
  }
}

function fillDataRow(ws, r, data, keyToCol, isExample) {
  for (const [key, col] of Object.entries(keyToCol)) {
    if (key === "total") continue;
    const cell = ws.getCell(r, col);
    const val = data[key];
    cell.value = val === "" || val == null ? null : val;
    cell.border = thinBorder(SAND);
    if (isExample) {
      cell.font = { italic: true, color: { argb: MUTED }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEEAE0" } };
    }
  }
  if (keyToCol.total && keyToCol.r1 && keyToCol.r3) {
    const total = ws.getCell(r, keyToCol.total);
    total.value = totalFormula(r, keyToCol.r1, keyToCol.r3);
    total.numFmt = "0.000";
    total.border = thinBorder(SAND);
    if (isExample) {
      total.font = { italic: true, color: { argb: MUTED }, size: 10 };
      total.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEEAE0" } };
    }
  }
}

function colLetter(n) {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function mergeBanner(ws, range, text, color) {
  ws.mergeCells(range);
  const cell = ws.getCell(range.split(":")[0]);
  cell.value = text;
  cell.font = { bold: true, size: 14, color: { argb: WHITE } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
}

function styleSectionTitle(cell) {
  cell.font = { bold: true, size: 11, color: { argb: FOREST } };
  cell.alignment = { vertical: "top" };
}

function styleBody(cell) {
  cell.font = { size: 10, color: { argb: "FF3B3B3B" } };
  cell.alignment = { wrapText: true, vertical: "top" };
}

function styleMetaLabel(cell) {
  cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FOREST } };
  cell.alignment = { vertical: "middle", indent: 1 };
}

function styleInput(cell) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CREAM } };
  cell.border = thinBorder(OCHRE);
  cell.alignment = { vertical: "middle" };
}

function thinBorder(argb) {
  const side = { style: "thin", color: { argb } };
  return { top: side, left: side, bottom: side, right: side };
}

function rawCellValue(cell) {
  if (!cell) return null;
  const v = cell.value;
  if (v == null) return null;
  if (typeof v === "object" && v.result != null) return v.result;
  if (typeof v === "object" && v.formula && v.result == null) return null;
  return v;
}

function cellText(cell) {
  if (cell == null) return "";
  const v = typeof cell === "object" && "value" in cell ? cell.value : cell;
  if (v == null) return "";
  if (typeof v === "object" && v.richText) {
    return v.richText.map((t) => t.text).join("").trim();
  }
  if (typeof v === "object" && v.text) return String(v.text).trim();
  if (typeof v === "object" && v.result != null) return String(v.result).trim();
  if (typeof v === "object" && v.formula) return "";
  return String(v).trim();
}

function normalizeHeader(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRol(s) {
  const n = normalizeHeader(s);
  if (n === "header" || n === "cabeza") return "header";
  if (n === "heeler" || n === "pata") return "heeler";
  return "";
}

function toNumOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function roundCell(v, ntEquivalenteSecs = 60) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v === ntEquivalenteSecs) return "NT";
    return String(v);
  }
  const s = String(v).trim();
  if (!s) return null;
  if (isNtLike(s)) return s.toUpperCase().includes("NP") ? "NP" : "NT";
  const n = Number(s.replace(",", "."));
  if (Number.isFinite(n)) {
    if (n === ntEquivalenteSecs) return "NT";
    return String(n);
  }
  return s;
}

/** Segundos que equivalen a NT según disciplina. Achatada = 120; resto de tiempo = 60. */
export function ntEquivalente(tipo) {
  return tipo === "AchatadaDeNovillos" ? 120 : 60;
}

function isNtLike(v) {
  const s = String(v || "")
    .trim()
    .toUpperCase();
  return s === "NT" || s === "NP" || s === "NO TIME";
}

function isNumericRound(v) {
  if (v == null) return false;
  if (isNtLike(v)) return false;
  return Number.isFinite(Number(v));
}

function sumRounds(...vals) {
  let sum = 0;
  let any = false;
  for (const v of vals) {
    if (v == null || v === "" || isNtLike(v)) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    sum += n;
    any = true;
  }
  return any ? sum : null;
}

function formatRound(v) {
  if (isNtLike(v)) return String(v).toUpperCase().includes("NP") ? "NP" : "NT";
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(3) : String(v);
}

function truthy(s) {
  const n = normalizeHeader(s);
  return n === "si" || n === "sí" || n === "yes" || n === "1" || n === "true" || n === "x";
}

function slugify(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "evento";
}
