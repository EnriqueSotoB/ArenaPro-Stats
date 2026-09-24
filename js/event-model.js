/** Lógica compartida de evento (sitio público + preview en admin). */

import { fmtMxn } from "../scripts/lib/money.mjs";
import { toPuntosEntero } from "../scripts/lib/points.mjs";

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
    clasificacion: Array.isArray(raw.clasificacion) ? raw.clasificacion : [],
  };
}

export function categoriesWithResults(evento) {
  const catMap = Object.fromEntries((evento.categorias || []).map((c) => [c.id || "_", c]));
  const fromClasif = (evento.clasificacion || [])
    .filter((c) => (c.entradas || []).length > 0)
    .map((c) => c.categoriaId || "_");
  const fromRows = (evento.resultados || []).map((r) => r.categoriaId || "_");
  const ids = [...new Set([...fromClasif, ...fromRows])];
  return ids.map((id) => {
    const c = catMap[id];
    const block = (evento.clasificacion || []).find((x) => (x.categoriaId || "_") === id);
    return {
      id,
      nombre: c?.nombre || block?.nombre || (id === "_" ? "Sin categoría" : id),
      tipo: c?.tipo || block?.tipo || "",
      numeroRondas: c?.numeroRondas ?? block?.numeroRondas,
    };
  });
}

/**
 * Ranking del evento: preferir `clasificacion[]` de Time (Final).
 * Solo si falta (JSON viejo) se arma un fallback desde filas de resultados.
 */
export function buildEventoRanking(evento, cat) {
  const fromClasif = rankingFromClasificacion(evento, cat);
  if (fromClasif) return fromClasif;

  const rows = (evento.resultados || []).filter((r) => (r.categoriaId || "_") === cat.id);
  return rankingFromResultadosLegacy(rows, cat);
}

function rankingFromClasificacion(evento, cat) {
  const block = (evento.clasificacion || []).find((c) => (c.categoriaId || "_") === cat.id);
  if (!block?.entradas?.length) return null;

  const esPuntos = isPuntosTipo(cat.tipo || block.tipo);
  return block.entradas.map((e, i) => {
    const detalle =
      e.detalleVueltas ||
      [e.t1 && `T1: ${e.t1}`, e.t2 && `T2: ${e.t2}`, e.t3 && `T3: ${e.t3}`].filter(Boolean).join(" · ");
    const tieneNt = /\bNT\b/.test(detalle || "");
    const tieneNp = /\bNP\b/.test(detalle || "");
    const tiempoTotal = e.tiempoTotal != null ? Number(e.tiempoTotal) : null;
    return {
      competidorKey: e.competidorId || e.inscripcionId || e.nombre || `row-${i}`,
      nombre: e.nombre || "—",
      equipo: e.equipo || "",
      lugar: e.lugar ?? null,
      sinPosicion: !!e.sinPosicion,
      noTime: !esPuntos && tieneNt && tiempoTotal == null,
      tieneNtParcial: !esPuntos && tieneNt && tiempoTotal != null,
      tieneNp,
      tiempoCompleto: !!e.recorridoCompleto && tiempoTotal != null,
      sumaTiempos: tiempoTotal,
      tiempoTotal,
      puntosCalif: e.puntos != null ? Number(e.puntos) : null,
      puntosCircuito: e.puntosCircuito != null ? toPuntosEntero(e.puntosCircuito) : null,
      montoGanado: e.montoGanado != null ? Number(e.montoGanado) : null,
      esPuntos,
      detalleVueltas: detalle,
      desdeTime: true,
    };
  });
}

/** Fallback solo para paquetes antiguos sin `clasificacion[]`. */
function rankingFromResultadosLegacy(rows, cat) {
  const byCompetidor = groupBy(rows, (r) => r.competidorId || r.inscripcionId || r.nombre || "anon");
  const entries = [];
  const rondasEsperadas = Math.max(1, Number(cat.numeroRondas) || 1);

  for (const [key, comps] of Object.entries(byCompetidor)) {
    const sample = comps[0];
    const esPuntos = isPuntosTipo(cat.tipo);
    const tiempos = comps
      .filter((r) => r.tiempoOficial != null && !r.esNoTime)
      .map((r) => Number(r.tiempoOficial));
    const tieneNt = comps.some((r) => r.esNoTime);
    const noTime = !esPuntos && tiempos.length === 0;
    const tiempoCompleto = !esPuntos && !tieneNt && tiempos.length > 0;
    const puntosDisc = comps.map((r) => r.puntos).filter((p) => p != null).map(Number);
    const puntosCircuito = comps.map((r) => r.puntosCircuito).filter((p) => p != null).map(Number);

    entries.push({
      competidorKey: key,
      nombre: sample.nombre || sample.competidorId || "—",
      equipo: sample.equipo || "",
      sinPosicion: false,
      noTime,
      tieneNtParcial: tieneNt && tiempos.length > 0,
      tiempoCompleto,
      mejorTiempo: tiempos.length ? Math.min(...tiempos) : null,
      sumaTiempos: tiempoCompleto ? tiempos.reduce((a, b) => a + b, 0) : null,
      tiemposParciales: !tiempoCompleto && tiempos.length ? tiempos : null,
      puntosCalif: puntosDisc.length ? Math.max(...puntosDisc) : null,
      puntosCircuito: puntosCircuito.length
        ? toPuntosEntero(Math.max(...puntosCircuito))
        : null,
      montoGanado: null,
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
      desdeTime: false,
    });
  }

  entries.sort((a, b) => {
    if (a.esPuntos) return (b.puntosCalif ?? -1) - (a.puntosCalif ?? -1);
    if (a.tiempoCompleto !== b.tiempoCompleto) return a.tiempoCompleto ? -1 : 1;
    if (a.tiempoCompleto && b.tiempoCompleto) {
      return (a.sumaTiempos ?? 0) - (b.sumaTiempos ?? 0);
    }
    if (a.noTime !== b.noTime) return a.noTime ? 1 : -1;
    return String(a.nombre).localeCompare(String(b.nombre), "es");
  });

  return entries.map((e, i) => ({ ...e, lugar: i + 1 }));
}

function isPuntosTipo(tipo) {
  return !!(tipo && /Jineteos|Montura|Pretal/i.test(tipo));
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
  return ranking
    .filter((r) => !r.sinPosicion && r.lugar != null)
    .slice(0, 3)
    .map((r) => ({
      place: r.lugar,
      name: r.nombre,
      sub: r.equipo || "",
      value: formatResultadoValor(r),
    }));
}

/** Valor de pódium = resultado del evento (tiempo/puntos), no puntos de circuito. */
export function formatResultadoValor(r) {
  if (r.esPuntos) {
    if (r.puntosCalif == null) return "—";
    return `${fmtNum(r.puntosCalif)} pts`;
  }
  if (r.sumaTiempos != null || r.tiempoTotal != null) return fmtTime(r.sumaTiempos ?? r.tiempoTotal);
  if (r.noTime) return "No Time";
  return "—";
}

export function formatTiempoCelda(r) {
  if (r.esPuntos) return r.puntosCalif == null ? "—" : fmtNum(r.puntosCalif);
  if (r.sumaTiempos != null || r.tiempoTotal != null) return fmtTime(r.sumaTiempos ?? r.tiempoTotal);
  if (r.noTime) return "—";
  return "—";
}

export function renderEventoRankingTableHtml(ranking, expandedRows = new Set()) {
  const esPuntos = ranking.some((r) => r.esPuntos);
  const desdeTime = ranking.some((r) => r.desdeTime);
  const tieneDinero = ranking.some((r) => r.montoGanado != null && Number(r.montoGanado) > 0);
  const head = esPuntos
    ? `<th class="num">#</th><th>Competidor</th><th>Equipo</th><th class="num">Calif.</th><th class="num">Circuito</th>${tieneDinero ? `<th class="num">$</th>` : ""}`
    : `<th class="num">#</th><th>Competidor</th><th>Equipo</th><th class="num">Tiempo</th><th class="num">Circuito</th>${tieneDinero ? `<th class="num">$</th>` : ""}`;
  const cols = tieneDinero ? 6 : 5;

  const body = ranking
    .map((r, i) => {
      const lugarLabel = r.sinPosicion || r.lugar == null ? "—" : String(r.lugar);
      const rowId = `ev-${lugarLabel}-${r.competidorKey}-${i}`;
      const open = expandedRows.has(rowId);
      let mark = "";
      if (r.tieneNp || (r.sinPosicion && /\bNP\b/.test(r.detalleVueltas || "")))
        mark = ` <span class="badge badge-nt">NP</span>`;
      else if (r.noTime) mark = ` <span class="badge badge-nt">No Time</span>`;
      else if (r.tieneNtParcial) mark = ` <span class="badge badge-nt">NT en vuelta</span>`;
      const sub = r.detalleVueltas
        ? `<div class="row-sub">${escapeHtml(r.detalleVueltas)}</div>`
        : "";
      const circ = r.puntosCircuito != null ? fmtNum(r.puntosCircuito) : "—";
      const dinero =
        tieneDinero
          ? `<td class="num">${r.montoGanado != null ? fmtMxn(r.montoGanado) : "—"}</td>`
          : "";
      const main = `<tr class="is-expandable${open ? " is-open" : ""}" data-row="${escapeAttr(rowId)}" aria-expanded="${open}">
        <td class="num">${lugarLabel}</td>
        <td>${escapeHtml(r.nombre)}${mark}${sub}</td>
        <td>${escapeHtml(r.equipo || "—")}</td>
        <td class="num">${formatTiempoCelda(r)}</td>
        <td class="num">${circ}</td>
        ${dinero}
      </tr>`;
      const detail = open
        ? `<tr class="detail-row"><td colspan="${cols}">${escapeHtml(r.detalleVueltas || "Sin detalle de vueltas")}</td></tr>`
        : "";
      return main + detail;
    })
    .join("");

  const note = desdeTime
    ? "Clasificación final de Time (mismo orden que Resultados → Final). Toca una fila para más detalle."
    : "Paquete sin clasificación de Time: orden aproximado. Reexporta desde Time para el orden oficial.";

  return `<div class="table-wrap">
    <table>
      <thead><tr>${head}</tr></thead>
      <tbody>${body || `<tr><td colspan="${cols}">Sin filas</td></tr>`}</tbody>
    </table>
  </div>
  <p class="cut-note">${note}</p>`;
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
  if (!Number.isFinite(x)) return "—";
  return String(Math.round(x));
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
