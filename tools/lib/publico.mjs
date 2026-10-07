/**
 * Qué se quita de los datos al armar el sitio público.
 * Los archivos en data/ del repo (y el admin local) conservan todo.
 */
import { sinMontos } from "../../web/lib/money.mjs";

/** Archivos de data/ que solo usa la consola local. */
export const DATA_SOLO_INTERNA = ["competidor-aliases.json"];

function sinNotas(fila) {
  if (!fila || typeof fila !== "object" || !("notas" in fila)) return fila;
  const { notas: _notas, ...resto } = fila;
  return resto;
}

/**
 * Quita las notas de jueces de resultados[] y clasificacion[].entradas[]; con `conDinero: false`
 * también los montos (la asociación no publica el dinero ganado).
 */
export function eventoParaPublico(evento, { conDinero = true } = {}) {
  if (!evento || typeof evento !== "object") return evento;
  const out = { ...evento };
  if (Array.isArray(evento.resultados)) out.resultados = evento.resultados.map(sinNotas);
  if (Array.isArray(evento.clasificacion)) {
    out.clasificacion = evento.clasificacion.map((bloque) =>
      Array.isArray(bloque?.entradas) ? { ...bloque, entradas: bloque.entradas.map(sinNotas) } : bloque
    );
  }
  return conDinero ? out : sinMontos(out);
}
