#!/usr/bin/env node
/**
 * Regenera data/temporada.json sumando puntosCircuito por competidor y disciplina.
 * Una sola tabla por disciplina (Barriles, Team Roping, …), acumulando eventos.
 * Uso: node scripts/rebuild-temporada.mjs
 * También exporta rebuildTemporada(root) para publish-server.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(scriptDir, "..");

/** Etiquetas de circuito (alineadas a Time / FMR). */
const DISCIPLINA_LABEL = {
  Barriles: "Barriles",
  LazoDeBecerro: "Lazo de Becerro",
  LazoEnFalso: "Lazo en Falso",
  AchatadaDeNovillos: "Achatada de Novillos",
  TeamRoping: "Team Roping",
  TeamRopingMasters: "Team Roping Masters",
  CaballoConPretal: "Caballo con Pretal",
  CaballoConMontura: "Caballo con Montura",
  JineteosDeToros: "Jineteos de Toros",
};

/**
 * Clave estable de disciplina para el circuito.
 * No usar categoriaId local:{n} — cambia en cada competencia de Time.
 */
export function disciplinaKey(cat = {}) {
  const tipo = String(cat.tipo || "").trim();
  const nombre = String(cat.nombre || "");
  // Masters a veces llega mal etiquetado como TeamRoping en el export.
  if (/^TeamRoping$/i.test(tipo) && /master/i.test(nombre)) {
    return "TeamRopingMasters";
  }
  if (tipo) return tipo;
  return "_";
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
  const name = normalizeNombre(row.nombre);
  if (name) return `name:${name}`;
  if (id) return id;
  const ins = row.inscripcionId != null ? String(row.inscripcionId).trim() : "";
  return ins || "anon";
}

function normalizeNombre(n) {
  return String(n || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} [root]
 * @returns {{ standings: number, eventosContados: number, temporada: string, outPath: string }}
 */
export function rebuildTemporada(root = defaultRoot) {
  const manifestPath = join(root, "data", "manifest.json");
  const outPath = join(root, "data", "temporada.json");

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const eventos = manifest.eventos || [];

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
      const compKey = competitorKey(row);
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
        competidorId: item.competidorId,
        nombre: item.nombre,
        equipo: item.equipo,
        disciplinaId: item.disciplinaId,
        disciplinaNombre: item.disciplinaNombre,
        // Compat con UI anterior (agrupa por categoriaId).
        categoriaId: item.disciplinaId,
        categoriaNombre: item.disciplinaNombre,
        puntosTotales: 0,
        eventos: 0,
      };
      cur.puntosTotales += item.puntos;
      cur.eventos += 1;
      cur.nombre = item.nombre || cur.nombre;
      cur.equipo = item.equipo || cur.equipo;
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
