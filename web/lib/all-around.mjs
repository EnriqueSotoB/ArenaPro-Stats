/**
 * Vaquero Completo (temporada) — docs/producto/decisiones.md §6.
 * Califica quien sumó en ≥2 disciplinas según el criterio de su asociación:
 * - "dinero": cobró (dineroTotal > 0) en cada una; se ordena por dinero total.
 * - "puntos": sumó puntos (puntosTotales > 0) en cada una; se ordena por puntos totales.
 */

/**
 * @param {Array<{
 *   competidorKey?: string,
 *   competidorId?: string|null,
 *   nombre?: string,
 *   disciplinaId?: string,
 *   disciplinaNombre?: string,
 *   puntosTotales?: number,
 *   dineroTotal?: number
 * }>} standings
 * @param {"dinero"|"puntos"} [criterio]
 * @returns {Array<{
 *   competidorKey: string,
 *   competidorId: string|null,
 *   nombre: string,
 *   puntosTotales: number,
 *   dineroTotal: number,
 *   disciplinas: string[],
 *   detalle: Array<{ disciplinaId: string, disciplinaNombre: string, puntos: number, dinero: number }>
 * }>}
 */
export function buildAllAround(standings = [], criterio = "dinero") {
  const porPuntos = criterio === "puntos";
  const valor = (x) => (porPuntos ? x.puntos : x.dinero);
  /** @type {Map<string, object>} */
  const byKey = new Map();

  for (const s of standings) {
    const key = String(s.competidorKey || "").trim();
    if (!key) continue;
    const puntos = Number(s.puntosTotales) || 0;
    const dinero = Number(s.dineroTotal) || 0;
    if (valor({ puntos, dinero }) <= 0) continue;

    const discId = String(s.disciplinaId || "").trim();
    if (!discId) continue;

    let cur = byKey.get(key);
    if (!cur) {
      cur = {
        competidorKey: key,
        competidorId: s.competidorId ?? null,
        nombre: s.nombre || s.competidorId || "—",
        detalleMap: new Map(),
      };
      byKey.set(key, cur);
    }
    cur.nombre = s.nombre || cur.nombre;
    if (s.competidorId && !String(s.competidorId).startsWith("local:")) {
      cur.competidorId = s.competidorId;
    }

    const prev = cur.detalleMap.get(discId);
    cur.detalleMap.set(discId, {
      disciplinaId: discId,
      disciplinaNombre: s.disciplinaNombre || discId,
      puntos: prev ? Math.max(prev.puntos, puntos) : puntos,
      dinero: prev ? Math.max(prev.dinero, dinero) : dinero,
    });
  }

  const out = [];
  for (const cur of byKey.values()) {
    const detalle = [...cur.detalleMap.values()].sort((a, b) =>
      String(a.disciplinaNombre).localeCompare(String(b.disciplinaNombre), "es")
    );
    if (detalle.length < 2) continue;
    out.push({
      competidorKey: cur.competidorKey,
      competidorId: cur.competidorId,
      nombre: cur.nombre,
      puntosTotales: detalle.reduce((sum, d) => sum + d.puntos, 0),
      dineroTotal: detalle.reduce((sum, d) => sum + d.dinero, 0),
      disciplinas: detalle.map((d) => d.disciplinaId),
      detalle,
    });
  }

  const total = (r) => (porPuntos ? r.puntosTotales : r.dineroTotal);
  out.sort((a, b) => {
    if (total(b) !== total(a)) return total(b) - total(a);
    if (b.disciplinas.length !== a.disciplinas.length) {
      return b.disciplinas.length - a.disciplinas.length;
    }
    const maxA = Math.max(...a.detalle.map(valor));
    const maxB = Math.max(...b.detalle.map(valor));
    if (maxB !== maxA) return maxB - maxA;
    return String(a.nombre).localeCompare(String(b.nombre), "es");
  });

  return out;
}
