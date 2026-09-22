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

const HEADER_ROW = 5;
const META_LABELS = {
  nombreCategoria: "nombre categoria",
  numeroRondas: "numero de rondas",
};

const COLS = [
  "lugar",
  "nombre",
  "equipo",
  "puntosCircuito",
  "dineroMxn",
  "califPts",
  "rol",
  "ronda1",
  "ronda2",
  "ronda3",
  "total",
  "sinPosicion",
  "notas",
];

const HEADER_LABELS = [
  "Lugar",
  "Nombre",
  "Equipo",
  "Puntos circuito",
  "Dinero MXN",
  "Calif. (pts)",
  "Rol",
  "Ronda 1",
  "Ronda 2",
  "Ronda 3",
  "Total",
  "Sin posición",
  "Notas",
];

const FOREST = "FF3F524F";
const OCHRE = "FFDD9219";
const CREAM = "FFF8F6F2";

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

/**
 * Genera el workbook de plantilla (estética ArenaPro).
 * @returns {Promise<import('exceljs').Workbook>}
 */
export async function buildPlantillaWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ArenaPro Stats";
  wb.created = new Date();

  addComoLlenarSheet(wb);
  addEventoSheet(wb);
  for (const def of DISCIPLINA_SHEETS) {
    addDisciplinaSheet(wb, def);
  }
  return wb;
}

/**
 * @param {string} outPath
 */
export async function writePlantillaExcel(outPath) {
  const wb = await buildPlantillaWorkbook();
  await wb.xlsx.writeFile(outPath);
}

function readEventoMeta(ws) {
  const out = {
    nombreEvento: "",
    fecha: "",
    sede: "",
    temporada: "",
  };
  if (!ws) return out;
  ws.eachRow((row) => {
    const label = normalizeHeader(cellText(row.getCell(1)));
    const value = cellText(row.getCell(2));
    if (!label) return;
    if (label.includes("nombre")) out.nombreEvento = value;
    else if (label.includes("fecha")) out.fecha = value;
    else if (label.includes("sede")) out.sede = value;
    else if (label.includes("temporada")) out.temporada = value;
  });
  return out;
}

function parseDisciplinaSheet(ws, def, catIndex) {
  let nombreCategoria = def.sheet;
  let numeroRondas = def.defaultRondas;

  for (let r = 1; r < HEADER_ROW; r++) {
    const row = ws.getRow(r);
    const label = normalizeHeader(cellText(row.getCell(1)));
    const value = cellText(row.getCell(2));
    if (!label) continue;
    if (label.includes("nombre") && label.includes("categoria")) {
      if (value) nombreCategoria = value;
    } else if (label.includes("numero") && label.includes("ronda")) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) numeroRondas = Math.min(3, Math.trunc(n));
    }
  }

  const headerMap = mapHeaderRow(ws.getRow(HEADER_ROW));
  if (!headerMap.nombre && !headerMap.lugar) return null;

  const entradas = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= HEADER_ROW) return;
    const nombre = cellText(row.getCell(headerMap.nombre || 2));
    if (!nombre || /^ejemplo/i.test(nombre)) return;
    const lugarRaw = cellText(row.getCell(headerMap.lugar || 1));
    const lugar = lugarRaw === "" ? null : Number(lugarRaw);
    const equipo = cellText(row.getCell(headerMap.equipo || 3));
    const puntosCircuito = toNumOrNull(row.getCell(headerMap.puntosCircuito || 4).value);
    const montoGanado = toMontoEntero(row.getCell(headerMap.dineroMxn || 5).value);
    const puntos = toNumOrNull(row.getCell(headerMap.califPts || 6).value);
    const rol = normalizeRol(cellText(row.getCell(headerMap.rol || 7)));
    const t1 = roundCell(row.getCell(headerMap.ronda1 || 8).value);
    const t2 = roundCell(row.getCell(headerMap.ronda2 || 9).value);
    const t3 = roundCell(row.getCell(headerMap.ronda3 || 10).value);
    const totalExplicit = roundCell(row.getCell(headerMap.total || 11).value);
    const sinPosicion = truthy(cellText(row.getCell(headerMap.sinPosicion || 12)));
    const notas = cellText(row.getCell(headerMap.notas || 13));

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
    const rounds = [
      { vuelta: "Ronda 1", val: e.t1 },
      { vuelta: "Ronda 2", val: e.t2 },
      { vuelta: "Ronda 3", val: e.t3 },
    ];
    for (const { vuelta, val } of rounds) {
      if (val == null || val === "") continue;
      const nt = isNtLike(val);
      const num = isNumericRound(val) ? Number(val) : null;
      resultados.push({
        inscripcionId: e.inscripcionId,
        competidorId: e.competidorId,
        categoriaId,
        nombre: e.nombre,
        equipo: e.equipo || null,
        vuelta,
        destino: "Rodeo",
        tiempoOficial: nt ? null : num,
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
    if (h === "lugar" || h === "#") map.lugar = col;
    else if (h === "nombre") map.nombre = col;
    else if (h === "equipo") map.equipo = col;
    else if (h.includes("puntos") && h.includes("circuito")) map.puntosCircuito = col;
    else if (h.includes("dinero") || h === "monto" || h.includes("mxn")) map.dineroMxn = col;
    else if (h.includes("calif")) map.califPts = col;
    else if (h === "rol") map.rol = col;
    else if (h === "ronda 1" || h === "ronda1" || h === "t1") map.ronda1 = col;
    else if (h === "ronda 2" || h === "ronda2" || h === "t2") map.ronda2 = col;
    else if (h === "ronda 3" || h === "ronda3" || h === "t3") map.ronda3 = col;
    else if (h === "total" || h.includes("tiempo total")) map.total = col;
    else if (h.includes("sin posicion") || h.includes("sin posición")) map.sinPosicion = col;
    else if (h === "notas" || h === "nota") map.notas = col;
  });
  return map;
}

function addComoLlenarSheet(wb) {
  const ws = wb.addWorksheet("Cómo llenar", {
    properties: { tabColor: { argb: OCHRE } },
  });
  ws.getColumn(1).width = 88;
  const lines = [
    "Plantilla manual ArenaPro Stats — FMR Tour",
    "",
    "1. Llena la hoja Evento (nombre, fecha, sede, temporada).",
    "2. Cada disciplina tiene su propia hoja. Si no se corrió, déjala vacía.",
    "3. En la meta de la hoja: Nombre categoría (opcional) y Número de rondas (1–3).",
    "4. Una fila = un competidor. Ronda 1/2/3 = total de esa ronda (número o NT/NP).",
    "5. Total es opcional: si vacío, se suman las rondas numéricas.",
    "6. Team Roping: pon dúo como \"Header / Heeler\" o usa la columna Rol.",
    "7. Dinero en MXN enteros (sin decimales). Puntos circuito los define el circuito.",
    "8. Guarda el .xlsx y cárgalo en admin (localhost) igual que un export de Time.",
    "",
    "No edites los nombres de las pestañas de disciplina.",
  ];
  lines.forEach((text, i) => {
    const cell = ws.getCell(i + 1, 1);
    cell.value = text;
    if (i === 0) {
      cell.font = { bold: true, size: 14, color: { argb: FOREST } };
    }
  });
}

function addEventoSheet(wb) {
  const ws = wb.addWorksheet("Evento", {
    properties: { tabColor: { argb: FOREST } },
  });
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 40;
  const rows = [
    ["Nombre del evento", ""],
    ["Fecha (AAAA-MM-DD)", ""],
    ["Sede", ""],
    ["Temporada", "2027"],
  ];
  rows.forEach(([label, value], i) => {
    const r = i + 1;
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getCell(r, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: FOREST } };
    ws.getCell(r, 2).value = value;
    ws.getCell(r, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CREAM } };
  });
}

function addDisciplinaSheet(wb, def) {
  const ws = wb.addWorksheet(def.sheet, {
    properties: { tabColor: { argb: OCHRE } },
    views: [{ state: "frozen", ySplit: HEADER_ROW }],
  });

  ws.getCell(1, 1).value = "Nombre categoría";
  ws.getCell(1, 2).value = def.sheet;
  ws.getCell(2, 1).value = "Número de rondas";
  ws.getCell(2, 2).value = def.defaultRondas;

  styleMeta(ws.getCell(1, 1));
  styleMeta(ws.getCell(2, 1));
  ws.getCell(1, 2).fill = creamFill();
  ws.getCell(2, 2).fill = creamFill();

  HEADER_LABELS.forEach((label, i) => {
    const cell = ws.getCell(HEADER_ROW, i + 1);
    cell.value = label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FOREST } };
    cell.alignment = { horizontal: "center", wrapText: true };
  });

  // Fila ejemplo (se ignora al parsear por prefijo Ejemplo)
  const example = ws.getRow(HEADER_ROW + 1);
  example.getCell(1).value = 1;
  example.getCell(2).value = "Ejemplo Competidor";
  example.getCell(3).value = "";
  example.getCell(4).value = 100;
  example.getCell(5).value = 0;
  example.getCell(8).value = 14.32;
  example.font = { italic: true, color: { argb: "FF82807B" } };

  const widths = [8, 28, 16, 14, 12, 12, 10, 10, 10, 10, 10, 12, 24];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  if (def.tipo.startsWith("TeamRoping")) {
    ws.getCell(HEADER_ROW + 2, 2).value = "Header / Heeler";
    ws.getCell(HEADER_ROW + 2, 2).font = { italic: true, color: { argb: "FF82807B" } };
  }
}

function styleMeta(cell) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FOREST } };
}

function creamFill() {
  return { type: "pattern", pattern: "solid", fgColor: { argb: CREAM } };
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

// silence unused lint for META_LABELS / COLS kept as docs
void META_LABELS;
void COLS;
