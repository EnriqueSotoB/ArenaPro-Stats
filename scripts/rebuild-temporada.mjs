#!/usr/bin/env node
/**
 * Regenera data/temporada.json sumando puntosCircuito por competidor y categoría.
 * Uso: node scripts/rebuild-temporada.mjs
 * También exporta rebuildTemporada(root) para publish-server.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(scriptDir, "..");

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

    const seen = new Map();

    for (const row of ev.resultados || []) {
      const compId = row.competidorId || row.inscripcionId || row.nombre;
      if (!compId) continue;
      const catId = row.categoriaId || "_";
      const key = `${compId}::${catId}`;
      const pts = row.puntosCircuito != null ? Number(row.puntosCircuito) : 0;
      const prev = seen.get(key);
      if (!prev || pts > prev.puntos) {
        seen.set(key, {
          competidorId: row.competidorId || null,
          nombre: row.nombre || row.competidorId || "—",
          equipo: row.equipo || "",
          categoriaId: catId,
          categoriaNombre: catMap[catId]?.nombre || catId,
          puntos: pts,
        });
      }
    }

    for (const item of seen.values()) {
      const sk = `${item.competidorId || item.nombre}::${item.categoriaId}`;
      const cur = standings.get(sk) || {
        competidorId: item.competidorId,
        nombre: item.nombre,
        equipo: item.equipo,
        categoriaId: item.categoriaId,
        categoriaNombre: item.categoriaNombre,
        puntosTotales: 0,
        eventos: 0,
      };
      cur.puntosTotales += item.puntos;
      cur.eventos += 1;
      cur.nombre = item.nombre || cur.nombre;
      cur.equipo = item.equipo || cur.equipo;
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
        String(a.categoriaNombre).localeCompare(String(b.categoriaNombre)) ||
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
  };
}

import { pathToFileURL } from "node:url";

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) {
  const result = rebuildTemporada();
  console.log(
    `OK → ${result.outPath} (${result.standings} filas, ${result.eventosContados} eventos)`
  );
  for (const name of result.orphans) {
    console.warn(`Aviso: ${name} no está en manifest.json`);
  }
}
