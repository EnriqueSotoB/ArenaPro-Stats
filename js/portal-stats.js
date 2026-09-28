/**
 * Números del tablero del portal a partir del acumulado de un circuito
 * (data/circuitos/{id}.json). Sin DOM.
 */

/**
 * @param {any} temporada acumulado del circuito
 * @param {Array<{ id: string, nombre?: string, fecha?: string, sede?: string }>} eventos del manifest para el circuito
 */
export function calcularTablero(temporada, eventos = []) {
  const competidores = temporada?.competidores || [];
  const standings = temporada?.standings || [];

  const porEventoMap = new Map(
    eventos.map((e) => [
      e.id,
      { id: e.id, nombre: e.nombre || e.id, fecha: e.fecha || "", sede: e.sede || "", participaciones: 0, competidores: new Set(), dinero: 0 },
    ])
  );
  let participaciones = 0;
  for (const c of competidores) {
    for (const h of c.historial || []) {
      participaciones += 1;
      let ev = porEventoMap.get(h.eventoId);
      if (!ev) {
        ev = { id: h.eventoId, nombre: h.eventoNombre || h.eventoId, fecha: h.fecha || "", sede: h.sede || "", participaciones: 0, competidores: new Set(), dinero: 0 };
        porEventoMap.set(h.eventoId, ev);
      }
      ev.participaciones += 1;
      ev.competidores.add(c.competidorKey);
      ev.dinero += Number(h.dinero) || 0;
    }
  }
  const porEvento = [...porEventoMap.values()]
    .map((e) => ({ ...e, competidores: e.competidores.size }))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

  const discMap = new Map();
  for (const s of standings) {
    const id = s.disciplinaId || s.categoriaId || "_";
    const d = discMap.get(id) || { id, nombre: s.disciplinaNombre || s.categoriaNombre || id, rows: [], dinero: 0 };
    d.rows.push(s);
    d.dinero += Number(s.dineroTotal) || 0;
    discMap.set(id, d);
  }
  const porDisciplina = [...discMap.values()]
    .map((d) => {
      const rows = [...d.rows].sort((a, b) => (Number(b.puntosTotales) || 0) - (Number(a.puntosTotales) || 0));
      const lider = rows[0];
      const segundo = rows[1];
      return {
        id: d.id,
        nombre: d.nombre,
        competidores: rows.length,
        dinero: d.dinero,
        lider: lider ? { nombre: lider.nombre || "—", puntos: Number(lider.puntosTotales) || 0 } : null,
        ventaja: lider && segundo ? (Number(lider.puntosTotales) || 0) - (Number(segundo.puntosTotales) || 0) : null,
      };
    })
    .sort((a, b) => b.competidores - a.competidores || a.nombre.localeCompare(b.nombre, "es"));

  const recurrentes = competidores.filter((c) => (Number(c.eventos) || 0) >= 2).length;
  const masActivos = [...competidores]
    .sort(
      (a, b) =>
        (Number(b.eventos) || 0) - (Number(a.eventos) || 0) ||
        (b.disciplinas?.length || 0) - (a.disciplinas?.length || 0) ||
        (Number(b.puntosTotales) || 0) - (Number(a.puntosTotales) || 0)
    )
    .slice(0, 10)
    .map((c) => ({
      nombre: c.nombre || "—",
      eventos: Number(c.eventos) || 0,
      disciplinas: c.disciplinas?.length || 0,
      puntos: Number(c.puntosTotales) || 0,
      dinero: Number(c.dineroTotal) || 0,
    }));

  return {
    kpis: {
      eventos: Number(temporada?.eventosContados) || porEvento.length,
      competidores: competidores.length,
      participaciones,
      dinero: competidores.reduce((s, c) => s + (Number(c.dineroTotal) || 0), 0),
      disciplinas: porDisciplina.length,
      recurrentes,
      pctRecurrentes: competidores.length ? Math.round((recurrentes / competidores.length) * 100) : 0,
    },
    porEvento,
    porDisciplina,
    masActivos,
  };
}
