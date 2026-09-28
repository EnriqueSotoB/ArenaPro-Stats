#!/usr/bin/env node
/**
 * Regenera data/circuitos/{circuitoId}.json sumando puntosCircuito por competidor y
 * disciplina, con los eventos asignados a cada circuito en data/manifest.json.
 *
 * Unificación (el nombre de categoría en Time puede variar):
 *   "Barriles" / "Abierta" / "Barriles Abierto" / "Abierta Barriles" → Barriles
 *   "Master" / "Masters" / "Master Barriles" (tipo Barriles)         → Barriles Master
 *   "TeamRoping" / "Abierta" / "Lazo por Parejas"                   → Lazo por Parejas
 *   "Masters" / "Lazo por Parejas Master" / "Team Roping Masters"   → Lazo por Parejas Master
 *
 * No usar categoriaId local:{n}: cambia en cada competencia.
 */
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAliasMap,
  resolveCompetitorKey,
} from "./lib/competitor-aliases.mjs";
import { toMontoEntero } from "./lib/money.mjs";
import { toPuntosCircuito } from "./lib/points.mjs";
import { buildAllAround } from "./lib/all-around.mjs";
import {
  finalizeCompetidores,
  pushCompetidorEvento,
} from "./lib/competidores.mjs";
import {
  expandTeamRopingRow,
  isTeamRopingBase,
} from "./lib/team-roping.mjs";
import {
  normalizeManifest,
  eventosDeCircuito,
  findAsociacion,
  circuitoDataFile,
} from "./lib/circuitos.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(scriptDir, "..");

/** Etiquetas de circuito (alineadas a Time / FMR). */
const DISCIPLINA_LABEL = {
  Barriles: "Barriles",
  BarrilesMasters: "Barriles Master",
  LazoDeBecerro: "Lazo de Becerro",
  LazoEnFalso: "Lazo en Falso",
  AchatadaDeNovillos: "Achatada de Novillos",
  AmarreDeChiva: "Amarre de Chiva",
  TeamRoping: "Lazo por Parejas",
  TeamRopingMasters: "Lazo por Parejas Master",
  TeamRopingHeader: "Lazo por Parejas — Cabeceros",
  TeamRopingHeeler: "Lazo por Parejas — Pialadores",
  TeamRopingMastersHeader: "Lazo por Parejas Master — Cabeceros",
  TeamRopingMastersHeeler: "Lazo por Parejas Master — Pialadores",
  CaballoConPretal: "Caballo con Pretal",
  CaballoConMontura: "Caballo con Montura",
  JineteosDeToros: "Jineteos de Toros",
  Polos: "Polos",
};

function normalizeText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function inferTipoFromNombre(nom) {
  if (/barril/.test(nom)) return "Barriles";
  if (/lazo por pareja|team\s*roping|teamroping/.test(nom)) return "TeamRoping";
  if (/lazo de becerro|becerro/.test(nom)) return "LazoDeBecerro";
  if (/lazo en falso/.test(nom)) return "LazoEnFalso";
  if (/achatada/.test(nom)) return "AchatadaDeNovillos";
  if (/amarre|chiva/.test(nom)) return "AmarreDeChiva";
  if (/pretal/.test(nom)) return "CaballoConPretal";
  if (/montura/.test(nom)) return "CaballoConMontura";
  if (/jineteo/.test(nom)) return "JineteosDeToros";
  return "";
}

/**
 * Clave estable de disciplina de circuito.
 * Abierta / Barriles / Barriles Abierto → misma cubeta.
 * Master* → cubeta Masters de esa disciplina.
 */
export function disciplinaKey(cat = {}) {
  let tipo = String(cat.tipo || "").trim();
  const nom = normalizeText(cat.nombre);
  const isMaster = /\bmasters?\b/.test(nom);

  if (!tipo) tipo = inferTipoFromNombre(nom);

  // Enum ya viene como Masters
  if (tipo === "TeamRopingMasters") return "TeamRopingMasters";
  if (tipo === "BarrilesMasters") return "BarrilesMasters";

  if (tipo === "TeamRoping") {
    return isMaster ? "TeamRopingMasters" : "TeamRoping";
  }
  if (tipo === "Barriles") {
    return isMaster ? "BarrilesMasters" : "Barriles";
  }

  if (tipo && isMaster && !/Masters$/i.test(tipo)) {
    return `${tipo}Masters`;
  }

  return tipo || "_";
}

export function disciplinaLabel(key) {
  if (DISCIPLINA_LABEL[key]) return DISCIPLINA_LABEL[key];
  if (!key || key === "_") return "Sin disciplina";
  return String(key).replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** Misma persona entre eventos: ID web estable, o nombre normalizado si es local:*. */
export function competitorKey(row) {
  const id = row.competidorId != null ? String(row.competidorId).trim() : "";
  if (id && !id.startsWith("local:")) return id;
  const name = normalizeText(row.nombre).replace(/\s*\/\s*/g, "/");
  if (name) return `name:${name}`;
  if (id) return id;
  const ins = row.inscripcionId != null ? String(row.inscripcionId).trim() : "";
  return ins || "anon";
}

/**
 * Filas a agregar: preferir clasificacion[]; si no hay entradas, usar resultados[].
 * @param {object} ev
 * @returns {object[]}
 */
export function collectEventRows(ev) {
  const fromClasif = [];
  for (const bloque of ev.clasificacion || []) {
    for (const ent of bloque.entradas || []) {
      fromClasif.push({
        ...ent,
        categoriaId: ent.categoriaId || bloque.categoriaId,
      });
    }
  }
  if (fromClasif.length) return fromClasif;
  return Array.isArray(ev.resultados) ? ev.resultados : [];
}

/**
 * @param {object} row
 * @param {object} cat
 * @returns {object[]}
 */
export function rowsForStanding(row, cat) {
  const baseDisc = disciplinaKey(cat);
  if (isTeamRopingBase(baseDisc)) {
    return expandTeamRopingRow(row, baseDisc);
  }
  return [
    {
      ...row,
      disciplinaId: baseDisc,
      montoGanado: toMontoEntero(row.montoGanado),
      puntosCircuito: toPuntosCircuito(row.puntosCircuito),
    },
  ];
}

/**
 * Acumulado de temporada de un circuito a partir de sus eventos.
 * @param {object[]} eventos entradas del manifest
 * @param {(entry: object) => object} loadEvento
 * @param {Map<string, string>} aliasMap
 */
export function buildCircuitoStandings(eventos, loadEvento, aliasMap) {
  /** @type {Map<string, object>} */
  const standings = new Map();
  /** @type {Map<string, object>} */
  const competidorAccum = new Map();

  for (const entry of eventos) {
    const ev = loadEvento(entry);
    const catMap = Object.fromEntries((ev.categorias || []).map((c) => [c.id, c]));
    const eventMeta = {
      id: entry.id || ev.eventoId || "",
      nombre: entry.nombre || ev.nombreEvento || "",
      fecha: entry.fecha || ev.fecha || "",
      sede: entry.sede || ev.sede || "",
    };

    /** Por evento: un renglón por competidor+disciplina (máx puntos / máx dinero). */
    const seen = new Map();

    for (const raw of collectEventRows(ev)) {
      const cat = catMap[raw.categoriaId] || {
        id: raw.categoriaId,
        nombre: raw.categoriaId,
        tipo: "",
      };

      for (const row of rowsForStanding(raw, cat)) {
        const discId = row.disciplinaId || disciplinaKey(cat);
        const compKey = resolveCompetitorKey(row, aliasMap, competitorKey);
        if (!compKey || compKey === "anon") continue;

        const pts = toPuntosCircuito(row.puntosCircuito);
        const dinero = toMontoEntero(row.montoGanado);
        const eventKey = `${compKey}::${discId}`;
        const prev = seen.get(eventKey);
        if (!prev) {
          seen.set(eventKey, {
            competidorKey: compKey,
            competidorId: row.competidorId || null,
            nombre: row.nombre || row.competidorId || "—",
            equipo: row.equipo || "",
            disciplinaId: discId,
            disciplinaNombre: disciplinaLabel(discId),
            puntos: pts,
            dinero,
          });
        } else {
          prev.puntos = Math.max(prev.puntos, pts);
          prev.dinero = Math.max(prev.dinero, dinero);
          prev.nombre = row.nombre || prev.nombre;
          prev.equipo = row.equipo || prev.equipo;
          if (row.competidorId && !String(row.competidorId).startsWith("local:")) {
            prev.competidorId = row.competidorId;
          }
        }
      }
    }

    for (const item of seen.values()) {
      pushCompetidorEvento(competidorAccum, item, eventMeta);

      const sk = `${item.competidorKey}::${item.disciplinaId}`;
      const cur = standings.get(sk) || {
        competidorKey: item.competidorKey,
        competidorId: item.competidorId,
        nombre: item.nombre,
        equipo: item.equipo,
        disciplinaId: item.disciplinaId,
        disciplinaNombre: item.disciplinaNombre,
        categoriaId: item.disciplinaId,
        categoriaNombre: item.disciplinaNombre,
        puntosTotales: 0,
        dineroTotal: 0,
        eventos: 0,
      };
      cur.puntosTotales += item.puntos;
      cur.dineroTotal += item.dinero;
      cur.eventos += 1;
      cur.nombre = item.nombre || cur.nombre;
      cur.equipo = item.equipo || cur.equipo;
      cur.competidorKey = item.competidorKey;
      if (item.competidorId && !String(item.competidorId).startsWith("local:")) {
        cur.competidorId = item.competidorId;
      }
      standings.set(sk, cur);
    }
  }

  const standingsList = [...standings.values()].sort(
    (a, b) =>
      String(a.disciplinaNombre).localeCompare(String(b.disciplinaNombre), "es") ||
      b.puntosTotales - a.puntosTotales ||
      b.dineroTotal - a.dineroTotal
  );

  if (standingsList.some((s) => {
    const id = String(s.disciplinaId || "");
    return !id || id.startsWith("local:") || id.startsWith("cat_");
  })) {
    throw new Error(
      "Rebuild produjo disciplinaId inválido (local:/cat_). Revisar disciplinaKey()."
    );
  }

  return {
    standings: standingsList,
    allAround: buildAllAround(standingsList),
    competidores: finalizeCompetidores(competidorAccum, standingsList),
  };
}

/**
 * Regenera data/circuitos/{circuitoId}.json para cada circuito del manifest.
 * Cada circuito suma solo los eventos que lo tienen en `circuitos[]`.
 * @param {string} [root]
 */
export function rebuildTemporada(root = defaultRoot) {
  const dataDir = join(root, "data");
  const manifest = normalizeManifest(
    JSON.parse(readFileSync(join(dataDir, "manifest.json"), "utf8"))
  );
  const aliasesPath = join(dataDir, "competidor-aliases.json");

  let aliasMap = new Map();
  if (existsSync(aliasesPath)) {
    try {
      aliasMap = buildAliasMap(JSON.parse(readFileSync(aliasesPath, "utf8")));
    } catch {
      aliasMap = new Map();
    }
  }

  /** Un evento puede contar para varios circuitos: leerlo una sola vez. */
  const eventoCache = new Map();
  const loadEvento = (entry) => {
    if (!eventoCache.has(entry.file)) {
      eventoCache.set(entry.file, JSON.parse(readFileSync(join(dataDir, entry.file), "utf8")));
    }
    return eventoCache.get(entry.file);
  };

  const outDir = join(dataDir, "circuitos");
  mkdirSync(outDir, { recursive: true });
  const actualizadoEn = new Date().toISOString();

  const circuitos = manifest.circuitos.map((circuito) => {
    const eventos = eventosDeCircuito(manifest, circuito.id);
    const asociacion = findAsociacion(manifest, circuito.asociacionId);
    const acumulado = buildCircuitoStandings(eventos, loadEvento, aliasMap);
    const payload = {
      circuitoId: circuito.id,
      asociacionId: circuito.asociacionId,
      asociacionSiglas: asociacion?.siglas || "",
      asociacionNombre: asociacion?.nombre || "",
      temporada: circuito.temporada,
      titulo: circuito.nombre,
      actualizadoEn,
      eventosContados: eventos.length,
      ...acumulado,
    };
    const outPath = join(dataDir, circuitoDataFile(circuito.id));
    writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
    return {
      circuitoId: circuito.id,
      titulo: circuito.nombre,
      temporada: circuito.temporada,
      standings: payload.standings.length,
      eventosContados: payload.eventosContados,
      outPath,
      disciplinas: [...new Set(payload.standings.map((s) => s.disciplinaId))],
    };
  });

  const vigentes = new Set(manifest.circuitos.map((c) => `${c.id}.json`));
  for (const name of readdirSync(outDir).filter((f) => f.endsWith(".json"))) {
    if (!vigentes.has(name)) unlinkSync(join(outDir, name));
  }
  const legacy = join(dataDir, "temporada.json");
  if (existsSync(legacy)) unlinkSync(legacy);

  const registered = new Set(manifest.eventos.map((e) => e.file.replace(/^eventos\//, "")));
  const orphans = [];
  try {
    for (const name of readdirSync(join(dataDir, "eventos")).filter((f) => f.endsWith(".json"))) {
      if (!registered.has(name)) orphans.push(name);
    }
  } catch {
    /* sin carpeta */
  }
  const sinCircuito = manifest.eventos.filter((e) => !e.circuitos.length).map((e) => e.nombre || e.id);

  const principal =
    circuitos.find((c) => c.circuitoId === manifest.circuitoDefault) || circuitos[0] || null;
  return {
    circuitoDefault: manifest.circuitoDefault,
    circuitos,
    standings: principal?.standings ?? 0,
    eventosContados: principal?.eventosContados ?? 0,
    temporada: principal?.temporada ?? "",
    outPath: principal?.outPath ?? "",
    disciplinas: principal?.disciplinas ?? [],
    orphans,
    sinCircuito,
  };
}

import { pathToFileURL } from "node:url";

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) {
  const result = rebuildTemporada();
  for (const c of result.circuitos) {
    console.log(
      `OK → ${c.outPath} · ${c.titulo} (${c.standings} filas, ${c.eventosContados} eventos, ${c.disciplinas.length} disciplinas)`
    );
  }
  if (!result.circuitos.length) console.warn("Aviso: el manifest no tiene circuitos.");
  for (const name of result.orphans) {
    console.warn(`Aviso: ${name} no está en manifest.json`);
  }
  for (const name of result.sinCircuito) {
    console.warn(`Aviso: "${name}" no cuenta para ningún circuito`);
  }
}
