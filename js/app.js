/**
 * ArenaPro Stats — navegación por capas (temporada hub / ranking / eventos / detalle).
 * Tokens: docs/design/DESIGN_TOKENS.md (TimeManagement).
 */

const MANIFEST_URL = "data/manifest.json";
const TEMPORADA_URL = "data/temporada.json";
const TOP_CARD = 5;

const els = {
  status: document.getElementById("status"),
  navTemporada: document.getElementById("navTemporada"),
  navEventos: document.getElementById("navEventos"),
  viewTemporadaHub: document.getElementById("viewTemporadaHub"),
  viewTemporadaRanking: document.getElementById("viewTemporadaRanking"),
  viewEventosList: document.getElementById("viewEventosList"),
  viewEventoDetail: document.getElementById("viewEventoDetail"),
  tempTitle: document.getElementById("tempTitle"),
  tempMeta: document.getElementById("tempMeta"),
  tempCards: document.getElementById("tempCards"),
  rankTitle: document.getElementById("rankTitle"),
  rankMeta: document.getElementById("rankMeta"),
  rankPodium: document.getElementById("rankPodium"),
  rankTable: document.getElementById("rankTable"),
  btnBackTemporada: document.getElementById("btnBackTemporada"),
  btnBackEventos: document.getElementById("btnBackEventos"),
  eventosList: document.getElementById("eventosList"),
  fileInput: document.getElementById("fileInput"),
  eventoTitle: document.getElementById("eventoTitle"),
  eventoMeta: document.getElementById("eventoMeta"),
  eventoPodium: document.getElementById("eventoPodium"),
  catTabs: document.getElementById("catTabs"),
  eventoTable: document.getElementById("eventoTable"),
};

/** @type {any} */
let manifest = null;
/** @type {any} */
let temporada = null;
/** @type {Map<string, any>} */
const eventoCache = new Map();
/** @type {any} */
let currentEvento = null;
/** @type {string|null} */
let currentCatId = null;
/** @type {Set<string>} */
const expandedRows = new Set();

init().catch((err) => setStatus(err.message || String(err), true));

async function init() {
  setStatus("Cargando datos…");
  const [m, t] = await Promise.all([fetchJson(MANIFEST_URL), fetchJson(TEMPORADA_URL)]);
  manifest = m;
  temporada = t;

  els.navTemporada.addEventListener("click", () => navigate("temporada"));
  els.navEventos.addEventListener("click", () => navigate("eventos"));
  els.btnBackTemporada.addEventListener("click", () => navigate("temporada"));
  els.btnBackEventos.addEventListener("click", () => navigate("eventos"));
  window.addEventListener("hashchange", () => applyRoute());

  els.fileInput.addEventListener("change", onFilePreview);

  setStatus("");
  applyRoute();
}

function navigate(section, id) {
  if (section === "temporada" && id) {
    location.hash = `#temporada/${encodeURIComponent(id)}`;
  } else if (section === "temporada") {
    location.hash = "#temporada";
  } else if (section === "eventos" && id) {
    location.hash = `#eventos/${encodeURIComponent(id)}`;
  } else {
    location.hash = "#eventos";
  }
}

function parseRoute() {
  const raw = (location.hash || "#temporada").replace(/^#/, "");
  const [section, id] = raw.split("/");
  if (section === "eventos") {
    return { section: "eventos", id: id ? decodeURIComponent(id) : null };
  }
  if (section === "temporada") {
    return { section: "temporada", id: id ? decodeURIComponent(id) : null };
  }
  return { section: "temporada", id: null };
}

async function applyRoute() {
  const route = parseRoute();
  hideAllViews();
  expandedRows.clear();

  els.navTemporada.classList.toggle("is-active", route.section === "temporada");
  els.navEventos.classList.toggle("is-active", route.section === "eventos");

  if (route.section === "temporada") {
    if (route.id) {
      els.viewTemporadaRanking.hidden = false;
      renderTemporadaRanking(route.id);
    } else {
      els.viewTemporadaHub.hidden = false;
      renderTemporadaHub();
    }
    return;
  }

  if (route.id) {
    els.viewEventoDetail.hidden = false;
    await showEvento(route.id);
  } else {
    els.viewEventosList.hidden = false;
    renderEventosList();
  }
}

function hideAllViews() {
  els.viewTemporadaHub.hidden = true;
  els.viewTemporadaRanking.hidden = true;
  els.viewEventosList.hidden = true;
  els.viewEventoDetail.hidden = true;
}

/* —— Temporada hub —— */

function renderTemporadaHub() {
  const data = temporada;
  els.tempTitle.textContent = data?.titulo || `Temporada ${data?.temporada || ""}`;
  els.tempMeta.textContent = [
    data?.temporada ? `Temporada ${data.temporada}` : "",
    data?.actualizadoEn ? `Actualizado ${String(data.actualizadoEn).slice(0, 10)}` : "",
    data?.eventosContados != null ? `${data.eventosContados} eventos` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  if (!data?.standings?.length) {
    els.tempCards.innerHTML = `<p class="empty">Sin acumulado. Ejecuta <code>node scripts/rebuild-temporada.mjs</code>.</p>`;
    return;
  }

  const byCat = groupBy(data.standings, (s) => s.categoriaId || s.categoriaNombre || "_");
  const cards = Object.entries(byCat).map(([catId, rows]) => {
    const sorted = [...rows].sort((a, b) => (b.puntosTotales ?? 0) - (a.puntosTotales ?? 0));
    const nombre = sorted[0]?.categoriaNombre || catId;
    const top = sorted.slice(0, TOP_CARD);
    const list = top
      .map(
        (r, i) => `<li>
        <span class="place">${i + 1}</span>
        <span class="name">${escapeHtml(r.nombre || r.competidorId || "—")}</span>
        <span class="pts">${fmtNum(r.puntosTotales)}</span>
      </li>`
      )
      .join("");

    return `<button type="button" class="cat-card" data-cat="${escapeAttr(catId)}">
      <div class="cat-card-head">
        <h2 class="cat-card-title">${escapeHtml(nombre)}</h2>
        <span class="cat-card-count">${sorted.length} ranked</span>
      </div>
      <ol class="cat-card-list">${list}</ol>
      <span class="cat-card-cta">Ver ranking completo →</span>
    </button>`;
  });

  els.tempCards.innerHTML = cards.join("");
  els.tempCards.querySelectorAll(".cat-card").forEach((btn) => {
    btn.addEventListener("click", () => navigate("temporada", btn.getAttribute("data-cat")));
  });
}

/* —— Temporada ranking —— */

function renderTemporadaRanking(catId) {
  const rows = (temporada?.standings || [])
    .filter((s) => (s.categoriaId || s.categoriaNombre || "_") === catId)
    .sort((a, b) => (b.puntosTotales ?? 0) - (a.puntosTotales ?? 0));

  if (!rows.length) {
    els.rankTitle.textContent = "Ranking";
    els.rankMeta.textContent = "Categoría no encontrada";
    els.rankPodium.innerHTML = "";
    els.rankTable.innerHTML = `<p class="empty">No hay datos para esta categoría.</p>`;
    return;
  }

  const cut = Number(manifest?.cutLine) > 0 ? Number(manifest.cutLine) : null;
  const leaderPts = rows[0]?.puntosTotales ?? 0;
  const nombre = rows[0].categoriaNombre || catId;

  els.rankTitle.textContent = nombre;
  els.rankMeta.textContent = [
    temporada?.temporada ? `Temporada ${temporada.temporada}` : "",
    `${rows.length} competidores`,
    cut ? `Cut #${cut}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  els.rankPodium.innerHTML = renderPodium(
    rows.slice(0, 3).map((r, i) => ({
      place: i + 1,
      name: r.nombre || r.competidorId || "—",
      sub: r.equipo || "",
      value: `${fmtNum(r.puntosTotales)} pts`,
    }))
  );

  const body = rows
    .map((r, i) => {
      const lugar = i + 1;
      const delta = leaderPts - (r.puntosTotales ?? 0);
      const cutClass = cut && lugar === cut ? " is-cut-line" : "";
      const badge =
        cut && lugar <= cut
          ? `<span class="badge badge-cut">Clasifica</span>`
          : cut && lugar === cut + 1
            ? `<span class="badge badge-out">Bubble</span>`
            : "";
      return `<tr class="${cutClass}">
        <td class="num">${lugar}</td>
        <td>${escapeHtml(r.nombre || r.competidorId || "—")} ${badge}</td>
        <td>${escapeHtml(r.equipo || "—")}</td>
        <td class="num">${r.eventos ?? "—"}</td>
        <td class="num">${fmtNum(r.puntosTotales)}</td>
        <td class="num delta">${lugar === 1 ? "—" : `−${fmtNum(delta)}`}</td>
      </tr>`;
    })
    .join("");

  const cutNote =
    cut && rows[cut - 1]
      ? `<p class="cut-note">Línea de corte en #${cut}: ${escapeHtml(rows[cut - 1].nombre || "")} con ${fmtNum(rows[cut - 1].puntosTotales)} pts. Debajo persiguen clasificación.</p>`
      : "";

  els.rankTable.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Competidor</th>
            <th>Equipo</th>
            <th class="num">Eventos</th>
            <th class="num">Puntos</th>
            <th class="num">Δ líder</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    ${cutNote}`;
}

/* —— Eventos list —— */

function renderEventosList() {
  const eventos = [...(manifest?.eventos || [])].sort((a, b) =>
    String(b.fecha || "").localeCompare(String(a.fecha || ""))
  );

  if (!eventos.length) {
    els.eventosList.innerHTML = `<p class="empty">No hay eventos en data/manifest.json.</p>`;
    return;
  }

  els.eventosList.innerHTML = eventos
    .map(
      (ev) => `<button type="button" class="event-row" data-id="${escapeAttr(ev.id)}">
      <div>
        <p class="event-row-title">${escapeHtml(ev.nombre || ev.id)}</p>
        <p class="event-row-meta">${escapeHtml([ev.fecha, ev.sede].filter(Boolean).join(" · ") || "—")}</p>
      </div>
      <span class="event-row-cta">Ver resultados →</span>
    </button>`
    )
    .join("");

  els.eventosList.querySelectorAll(".event-row").forEach((btn) => {
    btn.addEventListener("click", () => navigate("eventos", btn.getAttribute("data-id")));
  });
}

async function showEvento(eventoId) {
  setStatus("Cargando evento…");
  try {
    let evento;
    if (eventoId === "__preview__" && currentEvento?.eventoId === "__preview__") {
      evento = currentEvento;
    } else {
      const entry = (manifest?.eventos || []).find((e) => e.id === eventoId);
      if (!entry) throw new Error(`Evento no encontrado: ${eventoId}`);
      if (!eventoCache.has(entry.file)) {
        const raw = await fetchJson(`data/${entry.file}`);
        eventoCache.set(entry.file, normalizeEvento(raw));
      }
      evento = eventoCache.get(entry.file);
    }
    currentEvento = evento;
    const cats = categoriesWithResults(evento);
    currentCatId = cats[0]?.id || null;
    renderEventoDetail(evento, currentCatId);
    setStatus("");
  } catch (err) {
    setStatus(err.message || String(err), true);
    els.eventoTitle.textContent = "Evento";
    els.eventoMeta.textContent = "";
    els.eventoPodium.innerHTML = "";
    els.catTabs.innerHTML = "";
    els.eventoTable.innerHTML = `<p class="empty">No se pudo cargar el evento.</p>`;
  }
}

function renderEventoDetail(evento, catId) {
  els.eventoTitle.textContent = evento.nombreEvento || evento.eventoId || "Evento";
  els.eventoMeta.textContent = [evento.fecha, evento.sede, evento.temporada ? `Temp. ${evento.temporada}` : ""]
    .filter(Boolean)
    .join(" · ");

  const cats = categoriesWithResults(evento);
  if (!cats.length) {
    els.eventoPodium.innerHTML = "";
    els.catTabs.innerHTML = "";
    els.eventoTable.innerHTML = `<p class="empty">Sin resultados en este archivo.</p>`;
    return;
  }

  const activeId = catId || cats[0].id;
  currentCatId = activeId;

  els.catTabs.innerHTML = cats
    .map(
      (c) =>
        `<button type="button" class="tab${c.id === activeId ? " is-active" : ""}" role="tab" data-cat="${escapeAttr(c.id)}" aria-selected="${c.id === activeId}">${escapeHtml(c.nombre)}</button>`
    )
    .join("");

  els.catTabs.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      expandedRows.clear();
      renderEventoDetail(evento, tab.getAttribute("data-cat"));
    });
  });

  const cat = cats.find((c) => c.id === activeId) || cats[0];
  const rows = (evento.resultados || []).filter((r) => (r.categoriaId || "_") === cat.id);
  const ranking = buildEventoRanking(rows, cat);

  els.eventoPodium.innerHTML = renderPodium(
    ranking.slice(0, 3).map((r) => ({
      place: r.lugar,
      name: r.nombre,
      sub: r.equipo || "",
      value: r.noTime
        ? "No Time"
        : r.esPuntos
          ? `${fmtNum(r.puntosCalif)} pts`
          : fmtTime(r.sumaTiempos ?? r.mejorTiempo),
    }))
  );

  els.eventoTable.innerHTML = renderEventoRankingTable(ranking);
  wireExpandableRows();
}

function renderEventoRankingTable(ranking) {
  const esPuntos = ranking.some((r) => r.esPuntos);
  const head = esPuntos
    ? `<th class="num">#</th><th>Competidor</th><th>Equipo</th><th class="num">Calif.</th><th class="num">Circuito</th>`
    : `<th class="num">#</th><th>Competidor</th><th>Equipo</th><th class="num">Tiempo</th><th class="num">Circuito</th>`;

  const body = ranking
    .map((r) => {
      const rowId = `ev-${r.lugar}-${r.competidorKey}`;
      const open = expandedRows.has(rowId);
      const mark = r.noTime ? ` <span class="badge badge-nt">No Time</span>` : "";
      const valor = r.noTime
        ? "—"
        : esPuntos
          ? fmtNum(r.puntosCalif)
          : fmtTime(r.sumaTiempos ?? r.mejorTiempo);
      const circ = r.puntosCircuito != null ? fmtNum(r.puntosCircuito) : "—";
      const main = `<tr class="is-expandable${open ? " is-open" : ""}" data-row="${escapeAttr(rowId)}" aria-expanded="${open}">
        <td class="num">${r.lugar}</td>
        <td>${escapeHtml(r.nombre)}${mark}</td>
        <td>${escapeHtml(r.equipo || "—")}</td>
        <td class="num">${valor}</td>
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
  <p class="cut-note">Toca una fila para ver el detalle por vuelta.</p>`;
}

function wireExpandableRows() {
  els.eventoTable.querySelectorAll("tr.is-expandable").forEach((tr) => {
    tr.addEventListener("click", () => {
      const id = tr.getAttribute("data-row");
      if (!id || !currentEvento) return;
      if (expandedRows.has(id)) expandedRows.delete(id);
      else expandedRows.add(id);
      renderEventoDetail(currentEvento, currentCatId);
    });
  });
}

async function onFilePreview() {
  const file = els.fileInput.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const evento = normalizeEvento(data, file.name);
    evento.eventoId = "__preview__";
    currentEvento = evento;
    eventoCache.set("__preview__", evento);
    const target = "#eventos/__preview__";
    if (location.hash === target) await applyRoute();
    else location.hash = target;
    setStatus(`Vista previa local: ${file.name} (no se guarda en el repo)`);
  } catch (err) {
    setStatus(`No se pudo leer el archivo: ${err.message}`, true);
  }
}

/* —— Domain helpers —— */

function normalizeEvento(raw, fallbackName = "") {
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

function categoriesWithResults(evento) {
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

function buildEventoRanking(rows, cat) {
  const byCompetidor = groupBy(rows, (r) => r.competidorId || r.inscripcionId || r.nombre || "anon");
  const entries = [];

  for (const [key, comps] of Object.entries(byCompetidor)) {
    const sample = comps[0];
    const esPuntos = cat.tipo && /Jineteos|Montura|Pretal/i.test(cat.tipo);
    const noTime = comps.some((r) => r.esNoTime);
    const tiempos = comps
      .filter((r) => r.tiempoOficial != null && !r.esNoTime)
      .map((r) => Number(r.tiempoOficial));
    const puntosDisc = comps.map((r) => r.puntos).filter((p) => p != null).map(Number);
    const puntosCircuito = comps.map((r) => r.puntosCircuito).filter((p) => p != null).map(Number);

    entries.push({
      competidorKey: key,
      nombre: sample.nombre || sample.competidorId || "—",
      equipo: sample.equipo || "",
      noTime,
      mejorTiempo: tiempos.length ? Math.min(...tiempos) : null,
      sumaTiempos: tiempos.length ? tiempos.reduce((a, b) => a + b, 0) : null,
      puntosCalif: puntosDisc.length ? Math.max(...puntosDisc) : null,
      puntosCircuito: puntosCircuito.length ? Math.max(...puntosCircuito) : null,
      esPuntos,
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

  entries.sort((a, b) => {
    if (a.noTime !== b.noTime) return a.noTime ? 1 : -1;
    if (a.esPuntos) return (b.puntosCalif ?? -1) - (a.puntosCalif ?? -1);
    const ta = a.sumaTiempos ?? a.mejorTiempo;
    const tb = b.sumaTiempos ?? b.mejorTiempo;
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return ta - tb;
  });

  return entries.map((e, i) => ({ ...e, lugar: i + 1 }));
}

function renderPodium(items) {
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

/* —— Utils —— */

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return res.json();
}

function groupBy(arr, keyFn) {
  const out = {};
  for (const item of arr) {
    const k = keyFn(item);
    (out[k] ||= []).push(item);
  }
  return out;
}

function fmtTime(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(3);
}

function fmtNum(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const x = Number(n);
  return Number.isInteger(x) ? String(x) : x.toFixed(2);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll("'", "&#39;");
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg || "";
  els.status.classList.toggle("is-error", Boolean(isError && msg));
}
