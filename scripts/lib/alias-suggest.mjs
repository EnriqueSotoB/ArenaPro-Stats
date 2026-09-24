/**
 * Ayudas para el panel de aliases (admin).
 * Sin lista global por apellido: genera demasiado ruido con homónimos.
 */
import { buildAliasMap } from "./competitor-aliases.mjs";

/**
 * @param {string} key
 * @returns {string} apellido (último token) o ""
 */
export function surnameFromKey(key) {
  const k = String(key || "").trim();
  if (!k.startsWith("name:")) return "";
  const parts = k
    .slice(5)
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) return "";
  return parts[parts.length - 1];
}

/**
 * @param {string} key
 * @returns {string}
 */
export function displayFromKey(key) {
  const k = String(key || "").trim();
  if (k.startsWith("name:")) {
    return k
      .slice(5)
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return k;
}

/**
 * @param {string} key
 * @param {Map<string, string>} aliasMap
 * @returns {string}
 */
function resolveKey(key, aliasMap) {
  if (!aliasMap || aliasMap.size === 0) return key;
  let cur = key;
  const seen = new Set();
  for (let hop = 0; hop < 5; hop++) {
    if (seen.has(cur)) break;
    seen.add(cur);
    if (!aliasMap.has(cur)) break;
    cur = aliasMap.get(cur);
  }
  return cur;
}

/**
 * Distancia de Levenshtein simple.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function editDistance(a, b) {
  const s = String(a || "");
  const t = String(b || "");
  const m = s.length;
  const n = t.length;
  if (!m) return n;
  if (!n) return m;
  /** @type {number[]} */
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    /** @type {number[]} */
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * Parecido 0–1 entre dos claves name: (typos / spelling).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function nameSimilarity(a, b) {
  const na = String(a || "").startsWith("name:") ? String(a).slice(5) : String(a || "");
  const nb = String(b || "").startsWith("name:") ? String(b).slice(5) : String(b || "");
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = editDistance(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

/**
 * @typedef {{ key: string, label: string }} NamedKey
 */

/**
 * Otros competidores con el mismo apellido, solo si el apellido es poco común
 * en la temporada (grupo pequeño). Evita listas tipo "todos los García".
 *
 * @param {string} fromKey
 * @param {NamedKey[]} people
 * @param {{ aliases?: Array<{ from: string, to: string }> }|null} [aliasesDoc]
 * @param {{ maxGroup?: number, limit?: number }} [opts]
 * @returns {{ surname: string, peers: NamedKey[], suppressed: boolean }}
 */
export function peersWithSameSurname(fromKey, people, aliasesDoc = null, opts = {}) {
  const maxGroup = Math.max(2, Number(opts.maxGroup) || 5);
  const limit = Math.max(1, Number(opts.limit) || 5);
  const key = String(fromKey || "").trim();
  const surname = surnameFromKey(key);
  if (!surname || !key.startsWith("name:")) {
    return { surname: "", peers: [], suppressed: false };
  }

  const aliases = aliasesDoc?.aliases || [];
  const aliasMap = buildAliasMap({ aliases });
  const fromCanon = resolveKey(key, aliasMap);

  const same = [];
  for (const p of people || []) {
    const pk = String(p.key || "").trim();
    if (!pk.startsWith("name:") || pk === key) continue;
    if (surnameFromKey(pk) !== surname) continue;
    if (resolveKey(pk, aliasMap) === fromCanon) continue;
    same.push({
      key: pk,
      label: p.label || displayFromKey(pk),
    });
  }

  const groupSize = same.length + 1;
  if (same.length === 0) {
    return { surname, peers: [], suppressed: false };
  }
  if (groupSize > maxGroup) {
    return { surname, peers: [], suppressed: true };
  }

  same.sort((a, b) => a.label.localeCompare(b.label, "es"));
  return { surname, peers: same.slice(0, limit), suppressed: false };
}

/**
 * Posibles typos: nombres muy parecidos pero no iguales.
 *
 * @param {string} fromKey
 * @param {NamedKey[]} people
 * @param {{ aliases?: Array<{ from: string, to: string }> }|null} [aliasesDoc]
 * @param {{ minSimilarity?: number, limit?: number }} [opts]
 * @returns {NamedKey[]}
 */
export function spellingNearMatches(fromKey, people, aliasesDoc = null, opts = {}) {
  const minSim = Number(opts.minSimilarity) || 0.82;
  const limit = Math.max(1, Number(opts.limit) || 5);
  const key = String(fromKey || "").trim();
  if (!key.startsWith("name:")) return [];

  const aliases = aliasesDoc?.aliases || [];
  const aliasMap = buildAliasMap({ aliases });
  const fromCanon = resolveKey(key, aliasMap);
  const fromName = key.slice(5);

  /** @type {Array<NamedKey & { sim: number }>} */
  const hits = [];
  for (const p of people || []) {
    const pk = String(p.key || "").trim();
    if (!pk.startsWith("name:") || pk === key) continue;
    if (resolveKey(pk, aliasMap) === fromCanon) continue;
    const sim = nameSimilarity(key, pk);
    if (sim < minSim || sim >= 1) continue;
    // Evitar comparar nombres cortos con umbral flojo
    if (Math.min(fromName.length, pk.slice(5).length) < 6 && sim < 0.9) continue;
    hits.push({
      key: pk,
      label: p.label || displayFromKey(pk),
      sim,
    });
  }

  hits.sort((a, b) => b.sim - a.sim || a.label.localeCompare(b.label, "es"));
  return hits.slice(0, limit).map(({ key: k, label }) => ({ key: k, label }));
}
