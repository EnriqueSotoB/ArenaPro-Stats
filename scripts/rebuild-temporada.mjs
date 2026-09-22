#!/usr/bin/env node
/**
 * Regenera data/temporada.json sumando puntosCircuito por competidor y disciplina de circuito.
 *
 * Unificación (el nombre de categoría en Time puede variar):
 *   "Barriles" / "Abierta" / "Barriles Abierto" / "Abierta Barriles" → Barriles
 *   "Master" / "Masters" / "Master Barriles" (tipo Barriles)         → Barriles Masters
 *   "TeamRoping" / "Abierta" (tipo TeamRoping)                      → Team Roping
 *   "Masters" / "Team Roping Masters"                               → Team Roping Masters
 *
 * No usar categoriaId local:{n}: cambia en cada competencia.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAliasMap,
  resolveCompetitorKey,
} from "./lib/competitor-aliases.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(scriptDir, "..");

/** Etiquetas de circuito (alineadas a Time / FMR). */
const DISCIPLINA_LABEL = {
  Barriles: "Barriles",
  BarrilesMasters: "Barriles Masters",
  LazoDeBecerro: "Lazo de Becerro",
  LazoEnFalso: "Lazo en Falso",
  AchatadaDeNovillos: "Achatada de Novillos",
  TeamRoping: "Team Roping",
  TeamRopingMasters: "Team Roping Masters",
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
  if (/team\s*roping|teamroping/.test(nom)) return "TeamRoping";
  if (/lazo de becerro|becerro/.test(nom)) return "LazoDeBecerro";
  if (/lazo en falso/.test(nom)) return "LazoEnFalso";
  if (/achatada/.test(nom)) return "AchatadaDeNovillos";
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
 * @param {string} [root]
 * @returns {{ standings: number, eventosContados: number, temporada: string, outPath: string, disciplinas: string[] }}
 */
export function rebuildTemporada(root = defaultRoot) {
  const manifestPath = join(root, "data", "manifest.json");
  const outPath = join(root, "data", "temporada.json");
  const aliasesPath = join(root, "data", "competidor-aliases.json");

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const eventos = manifest.eventos || [];

  let aliasMap = new Map();
  if (existsSync(aliasesPath)) {
    try {
      aliasMap = buildAliasMap(JSON.parse(readFileSync(aliasesPath, "utf8")));
    } catch {
      aliasMap = new Map();
    }
  }

  /** @type {Map<string, object>} */
  const standings = new Map();

  for (const entry of eventos) {
    const file = join(root, "data", entry.file);
    const ev = JSON.parse(readFileSync(file, "utf8"));
    const catMap = Object.fromEntries((ev.categorias || []).map((c) => [c.id, c]));

    /** Por evento: un renglón por competidor+disciplina (máx puntosCircuito del inscrito). */
    const seen = new Map();

    for (const row of ev.resultados || []) {
      const cat = catMap[row.categoriaId] || {
        id: row.categoriaId,
        nombre: row.categoriaId,
        tipo: "",
      };
      const discId = disciplinaKey(cat);
      const compKey = resolveCompetitorKey(row, aliasMap, competitorKey);
      if (!compKey || compKey === "anon") continue;

      const pts = row.puntosCircuito != null ? Number(row.puntosCircuito) : 0;
      const eventKey = `${compKey}::${discId}`;
      const prev = seen.get(eventKey);
      if (!prev || pts > prev.puntos) {
        seen.set(eventKey, {
          competidorKey: compKey,
          competidorId: row.competidorId || null,
          nombre: row.nombre || row.competidorId || "—",
          equipo: row.equipo || "",
          disciplinaId: discId,
          disciplinaNombre: disciplinaLabel(discId),
          puntos: pts,
        });
      }
    }

    for (const item of seen.values()) {
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
        eventos: 0,
      };
      cur.puntosTotales += item.puntos;
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

  const payload = {
    temporada: manifest.temporadaActiva || "2026",
    titulo: manifest.titulo || "Temporada",
    actualizadoEn: new Date().toISOString(),
    eventosContados: eventos.length,
    standings: [...standings.values()].sort(
      (a, b) =>
        String(a.disciplinaNombre).localeCompare(String(b.disciplinaNombre), "es") ||
        b.puntosTotales - a.puntosTotales
    ),
  };

  if (payload.standings.some((s) => {
    const id = String(s.disciplinaId || "");
    return !id || id.startsWith("local:") || id.startsWith("cat_");
  })) {
    throw new Error(
      "Rebuild produjo disciplinaId inválido (local:/cat_). Revisar disciplinaKey()."
    );
  }

  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

  const dir = join(root, "data", "eventos");
  const registered = new Set(eventos.map((e) => e.file.replace(/^eventos\//, "")));
  const orphans = [];
  try {
    for (const name of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      if (!registered.has(name)) orphans.push(name);
    }
  } catch {
    /* sin carpeta */
  }

  return {
    standings: payload.standings.length,
    eventosContados: payload.eventosContados,
    temporada: payload.temporada,
    outPath,
    orphans,
    disciplinas: [...new Set(payload.standings.map((s) => s.disciplinaId))],
  };
}

import { pathToFileURL } from "node:url";

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) {
  const result = rebuildTemporada();
  console.log(
    `OK → ${result.outPath} (${result.standings} filas, ${result.eventosContados} eventos, ${result.disciplinas.length} disciplinas)`
  );
  console.log(`Disciplinas: ${result.disciplinas.map(disciplinaLabel).join(", ")}`);
  for (const name of result.orphans) {
    console.warn(`Aviso: ${name} no está en manifest.json`);
  }
}
