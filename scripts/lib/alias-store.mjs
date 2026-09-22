/**
 * Helpers para competidor-aliases.json (API local admin).
 */
import { buildAliasMap } from "./competitor-aliases.mjs";

/**
 * @param {{ version?: number, aliases?: Array<object> }} doc
 * @param {{ from: string, to: string, nota?: string }} entry
 * @returns {{ version: number, aliases: Array<object> }}
 */
export function appendAlias(doc, entry) {
  const from = entry?.from != null ? String(entry.from).trim() : "";
  const to = entry?.to != null ? String(entry.to).trim() : "";
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
