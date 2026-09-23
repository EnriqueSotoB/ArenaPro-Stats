/**
 * Unifica identidad de competidores entre eventos cuando hay spelling distinto
 * o ids local:*. Ver docs/02-contratos-datos.md.
 */

/**
 * @param {{ version?: number, aliases?: Array<{ from: string, to: string }> }} aliasesDoc
 * @returns {Map<string, string>}
 */
export function buildAliasMap(aliasesDoc) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const entry of aliasesDoc?.aliases || []) {
    const from = entry?.from != null ? String(entry.from).trim() : "";
    const to = entry?.to != null ? String(entry.to).trim() : "";
    if (from && to && from !== to) map.set(from, to);
  }
  return map;
}

/**
 * Resuelve la clave canónica aplicando aliases (máx. 5 hops; corta ciclos).
 * Si `competidorId` aparece en el mapa, se usa como punto de partida
 * (útil para `local:N` → `name:canónico`).
 * @param {object} row
 * @param {Map<string, string>} aliasMap
 * @param {(row: object) => string} competitorKeyFn
 * @returns {string}
 */
export function resolveCompetitorKey(row, aliasMap, competitorKeyFn) {
  const id = row?.competidorId != null ? String(row.competidorId).trim() : "";
  let key =
    aliasMap && id && aliasMap.has(id) ? id : competitorKeyFn(row);
  if (!aliasMap || aliasMap.size === 0) return competitorKeyFn(row);

  const seen = new Set();
  for (let hop = 0; hop < 5; hop++) {
    if (seen.has(key)) break;
    seen.add(key);
    if (!aliasMap.has(key)) break;
    key = aliasMap.get(key);
  }
  return key;
}
