#!/usr/bin/env node
/**
 * Regenera data/temporada.json sumando puntosCircuito por competidor y categoría.
 * Uso: node scripts/rebuild-temporada.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
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

  /** un valor de puntosCircuito por competidor+categoría (máx entre filas) */
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
console.log(`OK → ${outPath} (${payload.standings.length} filas, ${payload.eventosContados} eventos)`);

// sanity: list orphan json in eventos/
const dir = join(root, "data", "eventos");
const registered = new Set(eventos.map((e) => e.file.replace(/^eventos\//, "")));
for (const name of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  if (!registered.has(name)) {
    console.warn(`Aviso: ${name} no está en manifest.json`);
  }
}
