/**
 * Nombres de competidores siempre en MAYÚSCULAS y con espacios limpios, venga de Time,
 * de la plantilla Excel o de una edición manual. Sin imports de Node: lo usan el sitio,
 * el portal, el admin, el parser de Excel y el rebuild.
 */

/** "  josé   de la  torre / Miguel " → "JOSÉ DE LA TORRE / MIGUEL" (conserva acentos y Ñ). */
export function nombreMayusculas(v) {
  if (v == null) return v;
  return String(v)
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .trim()
    .toLocaleUpperCase("es-MX");
}

const CAMPOS_NOMBRE = ["nombre", "headerNombre", "heelerNombre"];

function normalizarFila(fila) {
  if (!fila || typeof fila !== "object") return fila;
  const out = { ...fila };
  for (const campo of CAMPOS_NOMBRE) {
    if (typeof out[campo] === "string") out[campo] = nombreMayusculas(out[campo]);
  }
  return out;
}

/** Copia del evento con los nombres de resultados y clasificación en mayúsculas. */
export function eventoConNombresMayusculas(evento) {
  if (!evento || typeof evento !== "object") return evento;
  return {
    ...evento,
    resultados: Array.isArray(evento.resultados) ? evento.resultados.map(normalizarFila) : evento.resultados,
    clasificacion: Array.isArray(evento.clasificacion)
      ? evento.clasificacion.map((b) =>
          b && Array.isArray(b.entradas) ? { ...b, entradas: b.entradas.map(normalizarFila) } : b
        )
      : evento.clasificacion,
  };
}
