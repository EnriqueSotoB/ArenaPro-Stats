/**
 * All-Around Cowboy (temporada) — docs/00-decisiones-producto.md §6.
 * Califica quien cobró (dineroTotal > 0) en ≥2 disciplinas.
 */

/**
 * @param {Array<{
 *   competidorKey?: string,
 *   competidorId?: string|null,
 *   nombre?: string,
 *   disciplinaId?: string,
 *   disciplinaNombre?: string,
 *   dineroTotal?: number
 * }>} standings
 * @returns {Array<{
 *   competidorKey: string,
 *   competidorId: string|null,
 *   nombre: string,
 *   dineroTotal: number,
 *   disciplinasConDinero: string[],
 *   detalle: Array<{ disciplinaId: string, disciplinaNombre: string, dinero: number }>
 * }>}
 */
export function buildAllAround(standings = []) {
  /** @type {Map<string, object>} */
  const byKey = new Map();

  for (const s of standings) {
    const key = String(s.competidorKey || "").trim();
    if (!key) continue;
    const dinero = Number(s.dineroTotal) || 0;
    if (dinero <= 0) continue;

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
    const nextDinero = prev ? Math.max(prev.dinero, dinero) : dinero;
    cur.detalleMap.set(discId, {
      disciplinaId: discId,
      disciplinaNombre: s.disciplinaNombre || discId,
      dinero: nextDinero,
    });
  }

  const out = [];
  for (const cur of byKey.values()) {
    const detalle = [...cur.detalleMap.values()].sort((a, b) =>
      String(a.disciplinaNombre).localeCompare(String(b.disciplinaNombre), "es")
    );
    if (detalle.length < 2) continue;
    const dineroTotal = detalle.reduce((sum, d) => sum + d.dinero, 0);
    out.push({
      competidorKey: cur.competidorKey,
      competidorId: cur.competidorId,
      nombre: cur.nombre,
      dineroTotal,
      disciplinasConDinero: detalle.map((d) => d.disciplinaId),
      detalle,
    });
  }

  out.sort((a, b) => {
    if (b.dineroTotal !== a.dineroTotal) return b.dineroTotal - a.dineroTotal;
    if (b.disciplinasConDinero.length !== a.disciplinasConDinero.length) {
      return b.disciplinasConDinero.length - a.disciplinasConDinero.length;
    }
    const maxA = Math.max(...a.detalle.map((d) => d.dinero));
    const maxB = Math.max(...b.detalle.map((d) => d.dinero));
    if (maxB !== maxA) return maxB - maxA;
    return String(a.nombre).localeCompare(String(b.nombre), "es");
  });

  return out;
}
