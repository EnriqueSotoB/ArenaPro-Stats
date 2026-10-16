#!/usr/bin/env node
/**
 * Genera eventos solo-dinero del FMR Tour 2026 desde data/fuentes/fmr-tour-2026-dinero.json
 * y registra el circuito en data/manifest.json. No toca fmr-tour-2027.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toMontoEntero } from "../web/lib/money.mjs";
import { normalizeManifest } from "../web/lib/circuitos.mjs";
import { rebuildTemporada } from "./rebuild-temporada.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIRCUITO_ID = "fmr-tour-2026";
const FUENTE = join(root, "data", "fuentes", "fmr-tour-2026-dinero.json");
const EVENTOS_DIR = join(root, "data", "eventos");
const MANIFEST_PATH = join(root, "data", "manifest.json");

const CAT_DEFS = {
  CaballoConPretal: { id: "cat-pretal", nombre: "Caballo con Pretal", tipo: "CaballoConPretal" },
  LazoDeBecerro: { id: "cat-becerro", nombre: "Lazo de Becerro", tipo: "LazoDeBecerro" },
  CaballoConMontura: { id: "cat-montura", nombre: "Caballo con Montura", tipo: "CaballoConMontura" },
  TeamRoping: { id: "cat-tr", nombre: "Lazo por Parejas", tipo: "TeamRoping" },
  Barriles: { id: "cat-barriles", nombre: "Barriles", tipo: "Barriles" },
  JineteosDeToros: { id: "cat-toros", nombre: "Jineteos de Toros", tipo: "JineteosDeToros" },
  AchatadaDeNovillos: { id: "cat-achatada", nombre: "Achatada de Novillos", tipo: "AchatadaDeNovillos" },
  LazoEnFalso: { id: "cat-falso", nombre: "Lazo en Falso", tipo: "LazoEnFalso" },
};

function slugEvento(id) {
  return `fmr-tour-2026-${id}`;
}

function buildEvento(evMeta, disciplinas, exportedAt) {
  const eventoId = `fmr2026:${evMeta.id}`;
  const cats = Object.values(CAT_DEFS).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    numeroRondas: 1,
  }));

  /** @type {Map<string, object[]>} */
  const byCat = new Map(cats.map((c) => [c.id, []]));

  for (const disc of disciplinas) {
    const def = CAT_DEFS[disc.id];
    if (!def) continue;
    const entradas = byCat.get(def.id);
    for (const comp of disc.competidores || []) {
      const monto = toMontoEntero(comp.porEvento?.[evMeta.id]);
      if (!(monto > 0)) continue;
      const entrada = {
        lugar: null,
        competidorId: null,
        nombre: comp.nombre,
        puntosCircuito: 0,
        montoGanado: monto,
      };
      if (disc.rol === "header" || disc.rol === "heeler") {
        entrada.rol = disc.rol;
      }
      entradas.push(entrada);
    }
  }

  // Lugar por dinero dentro de cada categoría (mismo monto → mismo lugar)
  for (const entradas of byCat.values()) {
    entradas.sort((a, b) => b.montoGanado - a.montoGanado || String(a.nombre).localeCompare(String(b.nombre), "es"));
    let lastMonto = null;
    let lastLugar = 0;
    entradas.forEach((e, i) => {
      if (e.montoGanado !== lastMonto) {
        lastLugar = i + 1;
        lastMonto = e.montoGanado;
      }
      e.lugar = lastLugar;
    });
  }

  return {
    schemaVersion: 2,
    exportedAt,
    source: "fmr-pdf",
    eventoId,
    nombreEvento: evMeta.nombre.toUpperCase(),
    fecha: evMeta.fecha,
    sede: "",
    temporada: "2026",
    categorias: cats,
    resultados: [],
    clasificacion: cats.map((c) => ({
      categoriaId: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      entradas: byCat.get(c.id) || [],
    })),
  };
}

function cleanPreviousEventos() {
  if (!existsSync(EVENTOS_DIR)) return;
  for (const name of readdirSync(EVENTOS_DIR)) {
    if (name.startsWith("fmr-tour-2026-") && name.endsWith(".json")) {
      unlinkSync(join(EVENTOS_DIR, name));
    }
  }
}

function main() {
  const fuente = JSON.parse(readFileSync(FUENTE, "utf8"));
  const exportedAt = new Date().toISOString();
  mkdirSync(EVENTOS_DIR, { recursive: true });
  cleanPreviousEventos();

  const eventoEntries = [];
  for (const ev of fuente.eventos || []) {
    const evento = buildEvento(ev, fuente.disciplinas || [], exportedAt);
    const file = `eventos/${slugEvento(ev.id)}.json`;
    writeFileSync(join(root, "data", file), JSON.stringify(evento, null, 2), "utf8");
    eventoEntries.push({
      id: evento.eventoId,
      nombre: evento.nombreEvento,
      fecha: evento.fecha,
      sede: "",
      file,
      circuitos: [CIRCUITO_ID],
    });
  }

  const manifest = normalizeManifest(JSON.parse(readFileSync(MANIFEST_PATH, "utf8")));
  if (!manifest.circuitos.some((c) => c.id === CIRCUITO_ID)) {
    manifest.circuitos.push({
      id: CIRCUITO_ID,
      asociacionId: "fmr",
      nombre: "FMR Tour 2026",
      temporada: "2026",
      cutLine: null,
      cutLineVisible: false,
      cutLinePorDisciplina: {},
    });
  }

  // Quitar eventos previos del tour 2026 del manifest; dejar el resto intacto
  manifest.eventos = [
    ...manifest.eventos.filter((e) => !(e.circuitos || []).includes(CIRCUITO_ID) && !String(e.id || "").startsWith("fmr2026:")),
    ...eventoEntries,
  ];

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  const { outPath } = rebuildTemporada(root);
  console.log(`OK: ${eventoEntries.length} eventos → ${CIRCUITO_ID}`);
  console.log(`Circuito: ${outPath}`);
}

main();
