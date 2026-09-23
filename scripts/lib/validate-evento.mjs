import { disciplinaKey } from "../rebuild-temporada.mjs";

/**
 * Valida un export Time antes de ingest.
 * @param {object} evento
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateEvento(evento) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!evento || typeof evento !== "object") {
    return { ok: false, errors: ["Falta el JSON del evento."], warnings };
  }

  if (evento.schemaVersion == null || evento.schemaVersion === "") {
    errors.push("Falta schemaVersion en el export.");
  }

  const cats = Array.isArray(evento.categorias) ? evento.categorias : [];
  if (!cats.length) {
    warnings.push("El evento no tiene categorías.");
  }

  for (const cat of cats) {
    const key = disciplinaKey(cat || {});
    if (!key || key === "_") {
      errors.push(
        `No se pudo inferir disciplina de circuito para categoría "${cat?.nombre || cat?.id || "?"}".`
      );
    } else if (key.startsWith("local:") || key.startsWith("cat_")) {
      errors.push(
        `disciplinaId inválido "${key}" (no usar ids local:/cat_ como disciplina).`
      );
    }
  }

  const schema = Number(evento.schemaVersion);
  const moneyCheck = analyzeMoneyFields(evento);

  if (Number.isFinite(schema) && schema >= 2) {
    if (moneyCheck.entradasConClasificacion === 0) {
      warnings.push(
        "schemaVersion ≥ 2 pero no hay entradas en clasificacion para validar montoGanado."
      );
    } else if (moneyCheck.sinMonto > 0) {
      warnings.push(
        `${moneyCheck.sinMonto} entrada(s) de clasificación sin montoGanado (schemaVersion ≥ 2).`
      );
    }
    if (moneyCheck.montoNoEntero > 0) {
      warnings.push(
        `${moneyCheck.montoNoEntero} monto(s) no son enteros MXN.`
      );
    }
  } else if (moneyCheck.entradasConClasificacion > 0 && moneyCheck.sinMonto === moneyCheck.entradasConClasificacion) {
    warnings.push(
      "Ninguna entrada de clasificación trae montoGanado (ok en schema 1; requerido en schema 2)."
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * @param {object} evento
 */
function analyzeMoneyFields(evento) {
  let entradasConClasificacion = 0;
  let sinMonto = 0;
  let montoNoEntero = 0;

  for (const bloque of evento.clasificacion || []) {
    for (const ent of bloque.entradas || []) {
      entradasConClasificacion += 1;
      if (ent.montoGanado == null || ent.montoGanado === "") {
        sinMonto += 1;
        continue;
      }
      const n = Number(ent.montoGanado);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        montoNoEntero += 1;
      }
    }
  }

  return { entradasConClasificacion, sinMonto, montoNoEntero };
}
