/**
 * Puntos de circuito enteros (estilo AERCH / tablas públicas).
 * Time a veces exporta fracciones por empates (p.ej. 22.666…); Stats redondea.
 * Ver docs/00-decisiones-producto.md §2.
 */

/**
 * @param {unknown} value
 * @returns {number} entero ≥ 0
 */
export function toPuntosEntero(value) {
  if (value == null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}
