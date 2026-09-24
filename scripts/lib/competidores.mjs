/**
 * Índice de competidores para búsqueda + ficha (historial por evento).
 */

/**
 * @param {Map<string, {
 *   competidorKey: string,
 *   competidorId?: string|null,
 *   nombre?: string,
 *   equipo?: string,
 *   historial: object[],
 *   eventoIds: Set<string>
 * }>} accum
 * @param {object[]} standingsList
 * @returns {object[]}
 */
export function finalizeCompetidores(accum, standingsList = []) {
  /** @type {Map<string, object>} */
  const byKey = new Map();

  for (const s of standingsList) {
    const key = String(s.competidorKey || "").trim();
    if (!key) continue;
    let cur = byKey.get(key);
    if (!cur) {
      cur = {
        competidorKey: key,
        competidorId: s.competidorId ?? null,
        nombre: s.nombre || s.competidorId || "—",
        equipo: s.equipo || "",
        puntosTotales: 0,
        dineroTotal: 0,
        eventos: 0,
        disciplinas: [],
      };
      byKey.set(key, cur);
    }
    cur.nombre = s.nombre || cur.nombre;
    cur.equipo = s.equipo || cur.equipo;
    if (s.competidorId && !String(s.competidorId).startsWith("local:")) {
      cur.competidorId = s.competidorId;
    }
    cur.puntosTotales += Number(s.puntosTotales) || 0;
    cur.dineroTotal += Number(s.dineroTotal) || 0;
    cur.disciplinas.push({
      disciplinaId: s.disciplinaId,
      disciplinaNombre: s.disciplinaNombre || s.disciplinaId,
      puntosTotales: Number(s.puntosTotales) || 0,
      dineroTotal: Number(s.dineroTotal) || 0,
      eventos: Number(s.eventos) || 0,
    });
  }

  for (const [key, draft] of accum.entries()) {
    let cur = byKey.get(key);
    if (!cur) {
      cur = {
        competidorKey: key,
        competidorId: draft.competidorId ?? null,
        nombre: draft.nombre || "—",
        equipo: draft.equipo || "",
        puntosTotales: 0,
        dineroTotal: 0,
        eventos: 0,
        disciplinas: [],
      };
      byKey.set(key, cur);
    }
    cur.historial = [...(draft.historial || [])].sort(
      (a, b) =>
        String(b.fecha || "").localeCompare(String(a.fecha || "")) ||
        String(a.disciplinaNombre || "").localeCompare(String(b.disciplinaNombre || ""), "es")
    );
    cur.eventos = draft.eventoIds?.size ?? new Set(cur.historial.map((h) => h.eventoId)).size;
  }

  for (const cur of byKey.values()) {
    if (!cur.historial) cur.historial = [];
    if (!cur.eventos) {
      cur.eventos = new Set(cur.historial.map((h) => h.eventoId)).size;
    }
    cur.disciplinas.sort((a, b) =>
      String(a.disciplinaNombre).localeCompare(String(b.disciplinaNombre), "es")
    );
  }

  return [...byKey.values()].sort((a, b) =>
    String(a.nombre).localeCompare(String(b.nombre), "es")
  );
}

/**
 * Acumula una aparición en un evento (llamar una vez por competidor+disciplina+evento).
 * @param {Map<string, object>} accum
 * @param {object} item
 * @param {{ id: string, nombre?: string, fecha?: string, sede?: string }} entry
 */
export function pushCompetidorEvento(accum, item, entry) {
  const key = String(item.competidorKey || "").trim();
  if (!key) return;

  let cur = accum.get(key);
  if (!cur) {
    cur = {
      competidorKey: key,
      competidorId: item.competidorId ?? null,
      nombre: item.nombre || "—",
      equipo: item.equipo || "",
      historial: [],
      eventoIds: new Set(),
    };
    accum.set(key, cur);
  }
  cur.nombre = item.nombre || cur.nombre;
  cur.equipo = item.equipo || cur.equipo;
  if (item.competidorId && !String(item.competidorId).startsWith("local:")) {
    cur.competidorId = item.competidorId;
  }

  const eventoId = entry.id || "";
  if (eventoId) cur.eventoIds.add(eventoId);

  cur.historial.push({
    eventoId,
    eventoNombre: entry.nombre || "",
    fecha: entry.fecha || "",
    sede: entry.sede || "",
    disciplinaId: item.disciplinaId,
    disciplinaNombre: item.disciplinaNombre,
    puntos: Number(item.puntos) || 0,
    dinero: Number(item.dinero) || 0,
  });
}

/**
 * @param {string} q
 * @param {object[]} competidores
 * @param {number} [limit]
 */
export function searchCompetidores(q, competidores = [], limit = 8) {
  const needle = normalizeSearch(q);
  if (!needle) return [];
  const scored = [];
  for (const c of competidores) {
    const name = normalizeSearch(c.nombre);
    if (!name) continue;
    let score = 0;
    if (name === needle) score = 100;
    else if (name.startsWith(needle)) score = 80;
    else if (name.includes(needle)) score = 50;
    else continue;
    scored.push({ score, c });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      String(a.c.nombre).localeCompare(String(b.c.nombre), "es")
  );
  return scored.slice(0, limit).map((x) => x.c);
}

export function normalizeSearch(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
