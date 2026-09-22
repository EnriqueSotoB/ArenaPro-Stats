/**
 * Plantilla Excel manual → mismo shape que export Time (schema 2).
 * Una hoja por disciplina; hojas vacías se ignoran.
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

  const HEADER_LABELS = [
  "Lugar (puesto final)",
  "Nombre del competidor",
  "Equipo",
  "Puntos de circuito",
  "Dinero ganado (MXN)",
  "Calificación (pts)",
  "Rol TR",
  "Ronda 1 (total)",
  "Ronda 2 (total)",
  "Ronda 3 (total)",
  "Total tiempos",
  "¿Sin posición?",
  "Notas",
];

/** Columnas de datos (A = margen): B…N */
const COL = {
  lugar: 2,
  nombre: 3,
  equipo: 4,
  pts: 5,
  dinero: 6,
  calif: 7,
  rol: 8,
  r1: 9,
  r2: 10,
  r3: 11,
  total: 12,
  sinPos: 13,
  notas: 14,
};

const FOREST = "FF3F524F";
const OCHRE = "FFDD9219";
const CREAM = "FFF8F6F2";
const SAND = "FFDDD2BC";
const WHITE = "FFFFFFFF";
const MUTED = "FF82807B";
const DATA_ROWS = 40;

/**
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer
 * @returns {Promise<object>}
 */
export async function parseExcelEvento(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer));
  return eventoFromWorkbook(workbook);
}

/**
 * @param {import('exceljs').Workbook} workbook
 * @returns {object}
 */
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

/** @returns {Promise<import('exceljs').Workbook>} */
export async function buildPlantillaWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ArenaPro Stats";
  wb.created = new Date();
  addComoLlenarSheet(wb);
  addEventoSheet(wb);
  for (const def of DISCIPLINA_SHEETS) addDisciplinaSheet(wb, def);
  return wb;
}

/** @param {string} outPath */
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
    if (map.nombre && (map.lugar || map.ronda1 || map.puntosCircuito)) {
      found = { rowNumber, map };
    }
  });
  return found;
}

function parseDisciplinaSheet(ws, def, catIndex) {
  let nombreCategoria = def.sheet;
  let numeroRondas = def.defaultRondas;
  const headerInfo = findHeaderRow(ws);
  if (!headerInfo) return null;
  const { rowNumber: headerRow, map: headerMap } = headerInfo;

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
    const nombre = cellText(row.getCell(headerMap.nombre || COL.nombre));
    if (!nombre) return;
    if (/^ejemplo\b/i.test(nombre)) return;

    const lugarRaw = cellText(row.getCell(headerMap.lugar || COL.lugar));
    const lugar = lugarRaw === "" ? null : Number(lugarRaw);
    const equipo = cellText(row.getCell(headerMap.equipo || COL.equipo));
    const puntosCircuito = toNumOrNull(
      rawCellValue(row.getCell(headerMap.puntosCircuito || COL.pts))
    );
    const montoGanado = toMontoEntero(
      rawCellValue(row.getCell(headerMap.dineroMxn || COL.dinero))
    );
    const puntos = toNumOrNull(rawCellValue(row.getCell(headerMap.califPts || COL.calif)));
    const rol = normalizeRol(cellText(row.getCell(headerMap.rol || COL.rol)));
    const t1 = roundCell(rawCellValue(row.getCell(headerMap.ronda1 || COL.r1)));
    const t2 = roundCell(rawCellValue(row.getCell(headerMap.ronda2 || COL.r2)));
    const t3 = roundCell(rawCellValue(row.getCell(headerMap.ronda3 || COL.r3)));
    const totalExplicit = roundCell(
      rawCellValue(row.getCell(headerMap.total || COL.total))
    );

    // Evitar pies de página / textos de ayuda (celdas combinadas).
    const tieneSenal =
      Number.isFinite(lugar) ||
      t1 != null ||
      t2 != null ||
      t3 != null ||
      (puntosCircuito != null && puntosCircuito !== 0) ||
      montoGanado > 0 ||
      (puntos != null && puntos !== 0);
    if (!tieneSenal) return;
    if (nombre.length > 80) return;
    const sinPosicion = truthy(
      cellText(row.getCell(headerMap.sinPosicion || COL.sinPos))
    );
    const notas = cellText(row.getCell(headerMap.notas || COL.notas));

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
      recorridoCompleto,
      competidorId: id,
      inscripcionId: id,
      nombre,
      equipo: equipo || "",
      tiempoTotal,
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
    const h = normalizeHeader(cellText(cell));
    if (!h) return;
    if (h.startsWith("lugar") || h.includes("puesto")) map.lugar = col;
    else if (h.startsWith("nombre")) map.nombre = col;
    else if (h === "equipo") map.equipo = col;
    else if (h.includes("puntos") && h.includes("circuito")) map.puntosCircuito = col;
    else if (h.includes("dinero") || h.includes("ganado") || h.includes("mxn")) {
      map.dineroMxn = col;
    } else if (h.includes("calif")) map.califPts = col;
    else if (h.includes("rol")) map.rol = col;
    else if (h.includes("ronda 1") || h === "t1") map.ronda1 = col;
    else if (h.includes("ronda 2") || h === "t2") map.ronda2 = col;
    else if (h.includes("ronda 3") || h === "t3") map.ronda3 = col;
    else if (h.includes("total")) map.total = col;
    else if (h.includes("sin posicion") || h.includes("sin posición")) map.sinPosicion = col;
    else if (h === "notas" || h === "nota") map.notas = col;
  });
  return map;
}

function addComoLlenarSheet(wb) {
  const ws = wb.addWorksheet("Cómo llenar", {
    properties: { tabColor: { argb: OCHRE } },
    views: [{ showGridLines: false }],
  });

  ws.getColumn(1).width = 3;
  ws.getColumn(2).width = 28;
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
      "1 = primero, 2 = segundo, etc. NO es el orden de salida a la arena. Es cómo quedaron al cerrar la categoría.",
    ],
    [
      "4. Tiempos",
      "Ronda 1/2/3 = total de ESA ronda en segundos. Si hubo NT o NP, escríbelo así. Sin splits internos.",
    ],
    [
      "5. Total tiempos",
      "Trae fórmula: suma Ronda 1+2+3. NT se ignora en la suma. Puedes sobrescribir el total a mano si hace falta.",
    ],
    [
      "6. Dinero y puntos",
      "Dinero en pesos enteros (sin centavos). Puntos de circuito = del tour. Calificación = solo jineteos / montura / pretal.",
    ],
    [
      "7. Team Roping",
      'Nombre como "Header / Heeler" o usa Rol TR. El dinero del dúo se parte 50/50 al publicar.',
    ],
    [
      "8. Publicar",
      "Guarda el .xlsx → publicar.bat → admin → suelta el archivo → preview → Agregar a Stats → Publicar.",
    ],
  ];

  steps.forEach(([title, body], i) => {
    const r = 5 + i;
    ws.getCell(r, 2).value = title;
    styleSectionTitle(ws.getCell(r, 2));
    ws.getCell(r, 3).value = body;
    styleBody(ws.getCell(r, 3));
    ws.getRow(r).height = 38;
  });

  ws.getCell("B14").value = "Tip";
  styleSectionTitle(ws.getCell("B14"));
  ws.getCell("C14").value =
    "La fila gris de Ejemplo se ignora al cargar (porque el nombre empieza con «Ejemplo»). Bórrala si prefieres.";
  styleBody(ws.getCell("C14"));
  ws.getRow(14).height = 32;
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
  const headerRow = 6;
  const firstData = headerRow + 1;
  const ws = wb.addWorksheet(def.sheet, {
    properties: { tabColor: { argb: OCHRE } },
    views: [{ state: "frozen", ySplit: headerRow, showGridLines: false }],
  });

  const widths = [3, 18, 28, 14, 16, 18, 16, 12, 14, 14, 14, 14, 14, 32];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  mergeBanner(ws, "B1:N1", `Clasificación final · ${def.sheet}`, FOREST);
  ws.getRow(1).height = 28;

  ws.mergeCells("B2:N2");
  ws.getCell("B2").value =
    "Lugar = puesto al cerrar (1° mejor). NO es orden de salida. Rondas = total de esa ronda. Total tiempos se calcula solo.";
  ws.getCell("B2").font = { italic: true, size: 10, color: { argb: MUTED } };
  ws.getRow(2).height = 22;

  ws.getCell("B3").value = "Nombre categoría";
  styleMetaLabel(ws.getCell("B3"));
  ws.getCell("C3").value = def.sheet;
  styleInput(ws.getCell("C3"));
  ws.getCell("D3").value = "Cómo salió en el cartel (Abierta, Master…)";
  ws.getCell("D3").font = { italic: true, size: 9, color: { argb: MUTED } };

  ws.getCell("B4").value = "Número de rondas";
  styleMetaLabel(ws.getCell("B4"));
  ws.getCell("C4").value = def.defaultRondas;
  styleInput(ws.getCell("C4"));
  ws.getCell("D4").value = "1, 2 o 3. Deja vacías las rondas que no existan.";
  ws.getCell("D4").font = { italic: true, size: 9, color: { argb: MUTED } };

  HEADER_LABELS.forEach((label, i) => {
    const cell = ws.getCell(headerRow, i + 2);
    cell.value = label;
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
      calif: "",
      rol: "",
      r1: 14.32,
      r2: def.defaultRondas >= 2 ? 15.1 : "",
      r3: "",
      sinPos: "No",
      notas: "Borra esta fila; es solo guía",
    },
    true
  );

  for (let i = 1; i < DATA_ROWS; i++) {
    prepareEmptyRow(ws, firstData + i);
  }

  const last = firstData + DATA_ROWS - 1;
  ws.dataValidations.add(`H${firstData}:H${last}`, {
    type: "list",
    allowBlank: true,
    formulae: ['"Header,Heeler"'],
    showErrorMessage: true,
    errorTitle: "Rol TR",
    error: "Elige Header, Heeler o deja vacío.",
  });
  ws.dataValidations.add(`M${firstData}:M${last}`, {
    type: "list",
    allowBlank: true,
    formulae: ['"Sí,No"'],
    showErrorMessage: true,
    errorTitle: "Sin posición",
    error: "Elige Sí o No.",
  });

  if (def.tipo.startsWith("TeamRoping")) {
    ws.getCell(firstData + 1, COL.nombre).value = "Header / Heeler";
    ws.getCell(firstData + 1, COL.nombre).font = {
      italic: true,
      color: { argb: MUTED },
      size: 10,
    };
  }

  const foot = last + 2;
  ws.mergeCells(foot, 2, foot, 14);
  ws.getCell(foot, 2).value =
    "NT / NP válidos en rondas. Dinero sin decimales. ¿Sin posición? = Sí si no clasificó (DNF / DSQ).";
  ws.getCell(foot, 2).font = { size: 9, color: { argb: MUTED }, italic: true };
}

function totalFormula(r) {
  return {
    formula: `IF(COUNTA(I${r}:K${r})=0,"",SUM(I${r}:K${r}))`,
  };
}

function prepareEmptyRow(ws, r) {
  for (const col of Object.values(COL)) {
    const cell = ws.getCell(r, col);
    cell.border = thinBorder(SAND);
    if (col === COL.total) {
      cell.value = totalFormula(r);
      cell.numFmt = "0.000";
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CREAM } };
    } else if (col === COL.dinero || col === COL.pts) {
      cell.numFmt = "#,##0";
    } else if (col === COL.r1 || col === COL.r2 || col === COL.r3) {
      cell.numFmt = "0.000";
    }
  }
}

function fillDataRow(ws, r, data, isExample) {
  const map = [
    [COL.lugar, data.lugar],
    [COL.nombre, data.nombre],
    [COL.equipo, data.equipo],
    [COL.pts, data.pts],
    [COL.dinero, data.dinero],
    [COL.calif, data.calif],
    [COL.rol, data.rol],
    [COL.r1, data.r1],
    [COL.r2, data.r2],
    [COL.r3, data.r3],
    [COL.sinPos, data.sinPos],
    [COL.notas, data.notas],
  ];
  for (const [col, val] of map) {
    const cell = ws.getCell(r, col);
    cell.value = val === "" ? null : val;
    cell.border = thinBorder(SAND);
    if (isExample) {
      cell.font = { italic: true, color: { argb: MUTED }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEEAE0" } };
    }
  }
  const total = ws.getCell(r, COL.total);
  total.value = totalFormula(r);
  total.numFmt = "0.000";
  total.border = thinBorder(SAND);
  if (isExample) {
    total.font = { italic: true, color: { argb: MUTED }, size: 10 };
    total.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEEAE0" } };
  }
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

function roundCell(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  const s = String(v).trim();
  if (!s) return null;
  if (isNtLike(s)) return s.toUpperCase().includes("NP") ? "NP" : "NT";
  const n = Number(s.replace(",", "."));
  if (Number.isFinite(n)) return String(n);
  return s;
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
