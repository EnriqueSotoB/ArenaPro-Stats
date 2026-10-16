/**
 * Dinero MXN (permite decimales). Split Lazo por Parejas — ver docs/producto/decisiones.md.
 * Confirmado 50/50 cabecero / pialador. Si cambia la regla, ajustar TEAM_ROPING_MONEY_SPLIT / splitMoneyMxn.
 */

/** Proporción al cabecero (pialador recibe el resto). Confirmado 50/50. */
export const TEAM_ROPING_MONEY_SPLIT = 0.5;

/** Decimales máximos que conserva el pipeline (PDF FMR usa hasta 1). */
const MONTO_DECIMALES = 1;

/**
 * @param {unknown} value
 * @returns {number} monto ≥ 0 (hasta 1 decimal)
 */
export function toMontoEntero(value) {
  if (value == null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  const factor = 10 ** MONTO_DECIMALES;
  return Math.round(n * factor) / factor;
}

/** True si el monto ya está normalizado a ≤1 decimal (o no es número). */
export function esMontoMxn(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  return Math.abs(n - toMontoEntero(Math.abs(n))) < 1e-9;
}

/**
 * Parte un monto de equipo en cabecero/pialador (suman `total`).
 * Con total impar en décimas: piso al cabecero, resto al pialador.
 * Claves `header`/`heeler` = cabecero/pialador (contrato interno / Time).
 * @param {unknown} total
 * @returns {{ header: number, heeler: number }}
 */
export function splitMoneyMxn(total) {
  const n = toMontoEntero(total);
  // Enteros: mismo criterio histórico (piso al cabecero).
  if (Number.isInteger(n)) {
    const header = Math.floor(n * TEAM_ROPING_MONEY_SPLIT);
    return { header, heeler: n - header };
  }
  const factor = 10 ** MONTO_DECIMALES;
  const units = Math.round(n * factor);
  const headerUnits = Math.floor(units * TEAM_ROPING_MONEY_SPLIT);
  return { header: headerUnits / factor, heeler: (units - headerUnits) / factor };
}

/**
 * Formato público MXN; muestra 1 decimal solo si no es entero.
 * Separador de miles fijo `,` (independiente de ICU/locale del runtime).
 * @param {unknown} n
 * @returns {string} p.ej. `$12,500` / `$12,278.9` o `—`
 */
export function fmtMxn(n) {
  if (n == null || n === "") return "—";
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  const rounded = toMontoEntero(Math.abs(x));
  const sign = x < 0 ? "-" : "";
  const isInt = Number.isInteger(rounded);
  const [wholePart, fracPart] = isInt
    ? [String(Math.trunc(rounded)), null]
    : rounded.toFixed(MONTO_DECIMALES).split(".");
  const digits = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fracPart == null ? `${sign}$${digits}` : `${sign}$${digits}.${fracPart}`;
}

/**
 * Copia sin ningún campo monto* (montoGanado, montoEquipo, montoHeader…) a cualquier profundidad,
 * statsEdits incluido. Para asociaciones que no publican el dinero ganado.
 */
export function sinMontos(valor) {
  if (Array.isArray(valor)) return valor.map(sinMontos);
  if (!valor || typeof valor !== "object") return valor;
  return Object.fromEntries(
    Object.entries(valor)
      .filter(([k]) => !/^monto/i.test(k))
      .map(([k, v]) => [k, sinMontos(v)])
  );
}
