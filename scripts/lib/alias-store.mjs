/**
 * Helpers para competidor-aliases.json (API local admin).
 */
import { buildAliasMap } from "./competitor-aliases.mjs";

function normalizeText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convierte input humano o clave cruda a la forma que usa el rebuild.
 * "Lalito Calderón" → "name:lalito calderon"
 * "name:…" / "local:…" / id web se preservan (normalizando el nombre).
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeAliasInput(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (s.startsWith("local:")) return s.trim();
  if (s.startsWith("name:")) {
    const name = normalizeText(s.slice(5)).replace(/\s*\/\s*/g, "/");
    return name ? `name:${name}` : "";
  }
  // ID web estable (sin espacios)
  if (!/\s/.test(s) && !s.includes(":") && s.length >= 6) return s;
  const name = normalizeText(s).replace(/\s*\/\s*/g, "/");
  return name ? `name:${name}` : "";
}

/**
 * @param {{ version?: number, aliases?: Array<object> }} doc
 * @param {{ from: string, to: string, nota?: string }} entry
 * @returns {{ version: number, aliases: Array<object> }}
 */
export function appendAlias(doc, entry) {
  const from = normalizeAliasInput(entry?.from);
  const to = normalizeAliasInput(entry?.to);
  if (!from || !to) {
    throw Object.assign(new Error("Faltan from y to para el alias."), {
      statusCode: 400,
    });
  }
  if (from === to) {
    throw Object.assign(new Error("from y to no pueden ser iguales."), {
      statusCode: 400,
    });
  }

  const aliases = Array.isArray(doc?.aliases) ? [...doc.aliases] : [];
  const idx = aliases.findIndex((a) => String(a.from) === from);
  const row = {
    from,
    to,
    ...(entry.nota ? { nota: String(entry.nota) } : {}),
  };
  if (idx >= 0) aliases[idx] = row;
  else aliases.push(row);

  // Detectar ciclo trivial inmediato
  const map = buildAliasMap({ aliases });
  let cursor = to;
  const seen = new Set([from]);
  for (let i = 0; i < 6; i++) {
    if (!map.has(cursor)) break;
    if (seen.has(cursor)) {
      throw Object.assign(new Error("El alias crearía un ciclo."), {
        statusCode: 400,
      });
    }
    seen.add(cursor);
    cursor = map.get(cursor);
  }

  return {
    version: doc?.version || 1,
    aliases,
  };
}

/**
 * @param {{ version?: number, aliases?: Array<object> }} doc
 * @param {string} fromRaw
 * @returns {{ version: number, aliases: Array<object>, removed: object|null }}
 */
export function removeAlias(doc, fromRaw) {
  const from = normalizeAliasInput(fromRaw);
  if (!from) {
    throw Object.assign(new Error("Falta from para eliminar el alias."), {
      statusCode: 400,
    });
  }
  const aliases = Array.isArray(doc?.aliases) ? [...doc.aliases] : [];
  const idx = aliases.findIndex((a) => String(a.from) === from);
  if (idx < 0) {
    throw Object.assign(new Error(`No hay alias con from "${from}".`), {
      statusCode: 404,
    });
  }
  const [removed] = aliases.splice(idx, 1);
  return {
    version: doc?.version || 1,
    aliases,
    removed,
  };
}
