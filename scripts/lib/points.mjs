/**
 * Puntos de circuito al estilo AERCH: enteros o medios (.5) por empate.
 * Time a veces exporta basura float (22.666…, 1.454…); Stats redondea al medio más cercano.
 * Evidencia: tablas AERCH Circuito 2026 (p.ej. Barriles 7.5 / 37.5).
 * Ver docs/00-decisiones-producto.md §2.
 */

/**
 * @param {unknown} value
 * @returns {number} ≥ 0, múltiplo de 0.5
 */
export function toPuntosCircuito(value) {
  if (value == null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 2) / 2;
}
