/**
 * Dinero MXN entero. Split TR provisional — ver docs/00-decisiones-producto.md.
 * Si organizadores cambian la regla, ajustar TEAM_ROPING_MONEY_SPLIT / splitMoneyMxn.
 */

/** Proporción al header (heeler recibe el resto). Provisional 50/50. */
export const TEAM_ROPING_MONEY_SPLIT = 0.5;

/**
 * @param {unknown} value
 * @returns {number} entero ≥ 0
 */
export function toMontoEntero(value) {
  if (value == null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

/**
 * Parte un monto de equipo en header/heeler (enteros que suman `total`).
 * Con monto impar: piso al header, resto al heeler (ej. 10001 → 5000 / 5001).
 * @param {unknown} total
 * @returns {{ header: number, heeler: number }}
 */
export function splitMoneyMxn(total) {
  const n = toMontoEntero(total);
  const header = Math.floor(n * TEAM_ROPING_MONEY_SPLIT);
  const heeler = n - header;
  return { header, heeler };
}

/**
 * Formato público MXN sin decimales.
 * Separador de miles fijo `,` (independiente de ICU/locale del runtime).
 * @param {unknown} n
 * @returns {string} p.ej. `$12,500` o `—`
 */
export function fmtMxn(n) {
  if (n == null || n === "") return "—";
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  const entero = Math.trunc(x);
  const sign = entero < 0 ? "-" : "";
  const digits = String(Math.abs(entero)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${digits}`;
}
