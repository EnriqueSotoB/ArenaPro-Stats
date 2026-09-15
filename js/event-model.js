/** Lógica compartida de evento (sitio público + preview en admin). */

export function normalizeEvento(raw, fallbackName = "") {
  const meta = raw.meta || {};
  return {
    schemaVersion: raw.schemaVersion ?? 1,
    exportedAt: raw.exportedAt,
    source: raw.source || "time",
    eventoId: raw.eventoId || meta.eventoId || fallbackName,
    nombreEvento: raw.nombreEvento || meta.nombre || meta.nombreEvento || raw.eventoId || "Evento",
    fecha: raw.fecha || meta.fecha || (raw.exportedAt ? String(raw.exportedAt).slice(0, 10) : ""),
    temporada: raw.temporada || meta.temporada || "",
    sede: raw.sede || meta.sede || "",
    categorias: Array.isArray(raw.categorias) ? raw.categorias : [],
    resultados: Array.isArray(raw.resultados) ? raw.resultados : [],
  };
}

export function categoriesWithResults(evento) {
  const catMap = Object.fromEntries((evento.categorias || []).map((c) => [c.id || "_", c]));
  const ids = [...new Set((evento.resultados || []).map((r) => r.categoriaId || "_"))];
  return ids.map((id) => {
    const c = catMap[id];
    return {
      id,
      nombre: c?.nombre || (id === "_" ? "Sin categoría" : id),
      tipo: c?.tipo || "",
      numeroRondas: c?.numeroRondas,
    };
  });
}

export function buildEventoRanking(rows, cat) {
  const byCompetidor = groupBy(rows, (r) => r.competidorId || r.inscripcionId || r.nombre || "anon");
  const entries = [];
  const rondasEsperadas = Math.max(1, Number(cat.numeroRondas) || 1);

  for (const [key, comps] of Object.entries(byCompetidor)) {
    const sample = comps[0];
    const esPuntos = cat.tipo && /Jineteos|Montura|Pretal/i.test(cat.tipo);
    const tiempos = comps
      .filter((r) => r.tiempoOficial != null && !r.esNoTime)
      .map((r) => Number(r.tiempoOficial));
    const tieneNt = comps.some((r) => r.esNoTime);
    const noTime = !esPuntos && tiempos.length === 0;
    // Total de tiempo solo si no hay NT y hay tiempos (recorrido usable para sumar).
    const tiempoCompleto = !esPuntos && !tieneNt && tiempos.length > 0;
    const puntosDisc = comps.map((r) => r.puntos).filter((p) => p != null).map(Number);
    const puntosCircuito = comps.map((r) => r.puntosCircuito).filter((p) => p != null).map(Number);

    entries.push({
      competidorKey: key,
      nombre: sample.nombre || sample.competidorId || "—",
      equipo: sample.equipo || "",
      noTime,
      tieneNtParcial: tieneNt && tiempos.length > 0,
      tiempoCompleto,
      mejorTiempo: tiempos.length ? Math.min(...tiempos) : null,
      sumaTiempos: tiempoCompleto ? tiempos.reduce((a, b) => a + b, 0) : null,
      // Tiempos sueltos solo para detalle; no se usan para ordenar.
      tiemposParciales: !tiempoCompleto && tiempos.length ? tiempos : null,
      puntosCalif: puntosDisc.length ? Math.max(...puntosDisc) : null,
      puntosCircuito: puntosCircuito.length ? Math.max(...puntosCircuito) : null,
      esPuntos,
      rondasEsperadas,
      detalleVueltas: comps
        .map((r) => {
          if (r.esNoTime) return `${r.vuelta}: NT`;
          if (r.tiempoOficial != null) return `${r.vuelta}: ${fmtTime(r.tiempoOficial)}`;
          if (r.puntos != null) return `${r.vuelta}: ${fmtNum(r.puntos)} pts`;
          return r.vuelta;
        })
        .join(" · "),
    });
  }

  // Orden = lo que Time ya calculó (puntos de circuito FMR). No reinventar por suma de tiempos.
  entries.sort((a, b) => {
    const pa = a.puntosCircuito;
    const pb = b.puntosCircuito;
    if (pa != null || pb != null) {
      if (pa == null) return 1;
      if (pb == null) return -1;
      if (pb !== pa) return pb - pa;
    }
    if (a.esPuntos) return (b.puntosCalif ?? -1) - (a.puntosCalif ?? -1);
    // Empate sin circuito: solo entonces tiempo completo; incompletos abajo.
    if (a.tiempoCompleto !== b.tiempoCompleto) return a.tiempoCompleto ? -1 : 1;
    if (a.tiempoCompleto && b.tiempoCompleto) {
      return (a.sumaTiempos ?? 0) - (b.sumaTiempos ?? 0);
    }
    if (a.noTime !== b.noTime) return a.noTime ? 1 : -1;
    return String(a.nombre).localeCompare(String(b.nombre), "es");
  });

  return entries.map((e, i) => ({ ...e, lugar: i + 1 }));
}

export function renderPodiumHtml(items) {
  if (!items?.length) return "";
  return items
    .map(
      (item, idx) => `<article class="podium-card${idx === 0 ? " is-first" : ""}">
      <p class="podium-place">#${item.place}</p>
      <p class="podium-name">${escapeHtml(item.name)}</p>
      <p class="podium-sub">${escapeHtml(item.sub || "—")}</p>
      <p class="podium-value">${escapeHtml(item.value)}</p>
    </article>`
    )
    .join("");
}

export function rankingToPodiumItems(ranking) {
  return ranking.slice(0, 3).map((r) => ({
    place: r.lugar,
    name: r.nombre,
    sub: r.equipo || "",
    value: formatResultadoValor(r),
  }));
}

/** Tiempo / puntos para pódium; orden ya viene por puntosCircuito de Time. */
export function formatResultadoValor(r) {
  if (r.esPuntos) {
    if (r.puntosCalif == null) return "—";
    return `${fmtNum(r.puntosCalif)} pts`;
  }
  if (r.puntosCircuito != null) return `${fmtNum(r.puntosCircuito)} pts`;
  if (r.tiempoCompleto && r.sumaTiempos != null) return fmtTime(r.sumaTiempos);
  if (r.noTime) return "No Time";
  return "—";
}

export function formatTiempoCelda(r) {
  if (r.esPuntos) return r.puntosCalif == null ? "—" : fmtNum(r.puntosCalif);
  if (r.tiempoCompleto && r.sumaTiempos != null) return fmtTime(r.sumaTiempos);
  if (r.noTime) return "—";
  // NT parcial: no inventar un total; el detalle por vuelta va bajo el nombre.
  return "—";
}

export function renderEventoRankingTableHtml(ranking, expandedRows = new Set()) {
  const esPuntos = ranking.some((r) => r.esPuntos);
  const head = esPuntos
    ? `<th class="num">#</th><th>Competidor</th><th>Equipo</th><th class="num">Calif.</th><th class="num">Circuito</th>`
    : `<th class="num">#</th><th>Competidor</th><th>Equipo</th><th class="num">Tiempo</th><th class="num">Circuito</th>`;

  const body = ranking
    .map((r) => {
      const rowId = `ev-${r.lugar}-${r.competidorKey}`;
      const open = expandedRows.has(rowId);
      let mark = "";
      if (r.noTime) mark = ` <span class="badge badge-nt">No Time</span>`;
      else if (r.tieneNtParcial) mark = ` <span class="badge badge-nt">NT en vuelta</span>`;
      const sub = r.detalleVueltas
        ? `<div class="row-sub">${escapeHtml(r.detalleVueltas)}</div>`
        : "";
      const circ = r.puntosCircuito != null ? fmtNum(r.puntosCircuito) : "—";
      const main = `<tr class="is-expandable${open ? " is-open" : ""}" data-row="${escapeAttr(rowId)}" aria-expanded="${open}">
        <td class="num">${r.lugar}</td>
        <td>${escapeHtml(r.nombre)}${mark}${sub}</td>
        <td>${escapeHtml(r.equipo || "—")}</td>
        <td class="num">${formatTiempoCelda(r)}</td>
        <td class="num">${circ}</td>
      </tr>`;
      const detail = open
        ? `<tr class="detail-row"><td colspan="5">${escapeHtml(r.detalleVueltas || "Sin detalle de vueltas")}</td></tr>`
        : "";
      return main + detail;
    })
    .join("");

  return `<div class="table-wrap">
    <table>
      <thead><tr>${head}</tr></thead>
      <tbody>${body || `<tr><td colspan="5">Sin filas</td></tr>`}</tbody>
    </table>
  </div>
  <p class="cut-note">Orden por puntos de circuito (Time). Toca una fila para más detalle.</p>`;
}

export function groupBy(arr, keyFn) {
  const out = {};
  for (const item of arr) {
    const k = keyFn(item);
    (out[k] ||= []).push(item);
  }
  return out;
}

export function fmtTime(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(3);
}

export function fmtNum(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const x = Number(n);
  return Number.isInteger(x) ? String(x) : x.toFixed(2);
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function escapeAttr(s) {
  return escapeHtml(s).replaceAll("'", "&#39;");
}
