/**
 * ArenaPro Stats — navegación por capas (temporada hub / ranking / eventos / detalle).
 * Tokens: docs/design/DESIGN_TOKENS.md (TimeManagement).
 */

import {
  normalizeEvento,
  categoriesWithResults,
  buildEventoRanking,
  renderPodiumHtml,
  rankingToPodiumItems,
  renderEventoRankingTableHtml,
  groupBy,
  escapeHtml,
  escapeAttr,
  fmtNum,
} from "./event-model.js";
import { getCutLine } from "../scripts/lib/cut-line.mjs";
import { fmtMxn } from "../scripts/lib/money.mjs";

const MANIFEST_URL = "data/manifest.json";
const TEMPORADA_URL = "data/temporada.json";
const TOP_CARD = 5;
const ALL_AROUND_ID = "__all-around";

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
  allAroundPanel: document.getElementById("allAroundPanel"),
  allAroundList: document.getElementById("allAroundList"),
  rankTitle: document.getElementById("rankTitle"),
  rankMeta: document.getElementById("rankMeta"),
  rankPodium: document.getElementById("rankPodium"),
  rankTable: document.getElementById("rankTable"),
  btnBackTemporada: document.getElementById("btnBackTemporada"),
  btnBackEventos: document.getElementById("btnBackEventos"),
  eventosList: document.getElementById("eventosList"),
  eventoTitle: document.getElementById("eventoTitle"),
  eventoMeta: document.getElementById("eventoMeta"),
  eventoPodium: document.getElementById("eventoPodium"),
  catTabs: document.getElementById("catTabs"),
  eventoTable: document.getElementById("eventoTable"),
  hubMetricPuntos: document.getElementById("hubMetricPuntos"),
  hubMetricDinero: document.getElementById("hubMetricDinero"),
  rankMetricPuntos: document.getElementById("rankMetricPuntos"),
  rankMetricDinero: document.getElementById("rankMetricDinero"),
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
/** @type {"puntos"|"dinero"} */
let metricMode = "puntos";

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
  wireMetricToggle(els.hubMetricPuntos, els.hubMetricDinero);
  wireMetricToggle(els.rankMetricPuntos, els.rankMetricDinero);
  window.addEventListener("hashchange", () => applyRoute());

  setStatus("");
  applyRoute();
}

function wireMetricToggle(btnPts, btnDinero) {
  if (!btnPts || !btnDinero) return;
  btnPts.addEventListener("click", () => setMetricMode("puntos"));
  btnDinero.addEventListener("click", () => setMetricMode("dinero"));
}

function setMetricMode(mode) {
  metricMode = mode === "dinero" ? "dinero" : "puntos";
  syncMetricButtons();
  const route = parseRoute();
  if (route.section === "temporada") {
    if (route.id) renderTemporadaRanking(route.id);
    else renderTemporadaHub();
  }
}

function syncMetricButtons() {
  for (const btn of [
    els.hubMetricPuntos,
    els.hubMetricDinero,
    els.rankMetricPuntos,
    els.rankMetricDinero,
  ]) {
    if (!btn) continue;
    const isDinero = btn.dataset.metric === "dinero";
    btn.classList.toggle("is-active", metricMode === "dinero" ? isDinero : !isDinero);
  }
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
  const slash = raw.indexOf("/");
  const section = slash < 0 ? raw : raw.slice(0, slash);
  const idPart = slash < 0 ? "" : raw.slice(slash + 1);
  let id = null;
  if (idPart) {
    try {
      id = decodeURIComponent(idPart);
    } catch {
      id = idPart;
    }
  }
  if (section === "eventos") {
    return { section: "eventos", id };
  }
  if (section === "temporada") {
    return { section: "temporada", id };
  }
  return { section: "temporada", id: null };
}

async function applyRoute() {
  const route = parseRoute();
  hideAllViews();
  expandedRows.clear();
  syncMetricButtons();

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

function metricValue(row) {
  return metricMode === "dinero" ? Number(row.dineroTotal) || 0 : Number(row.puntosTotales) || 0;
}

function formatMetric(row) {
  if (metricMode === "dinero") return fmtMxn(row.dineroTotal ?? 0);
  return `${fmtNum(row.puntosTotales)} pts`;
}

function sortByMetric(rows) {
  return [...rows].sort((a, b) => metricValue(b) - metricValue(a));
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

  renderAllAroundHub();

  if (!data?.standings?.length) {
    els.tempCards.innerHTML = `<p class="empty">Sin acumulado. Ejecuta <code>node scripts/rebuild-temporada.mjs</code>.</p>`;
    return;
  }

  const byCat = groupBy(
    data.standings,
    (s) => s.disciplinaId || s.categoriaId || s.categoriaNombre || "_"
  );
  const cards = Object.entries(byCat)
    .sort((a, b) => {
      const na = a[1][0]?.disciplinaNombre || a[1][0]?.categoriaNombre || a[0];
      const nb = b[1][0]?.disciplinaNombre || b[1][0]?.categoriaNombre || b[0];
      return String(na).localeCompare(String(nb), "es");
    })
    .map(([catId, rows]) => {
      const sorted = sortByMetric(rows);
      const nombre = sorted[0]?.disciplinaNombre || sorted[0]?.categoriaNombre || catId;
      const top = sorted.slice(0, TOP_CARD);
      const list = top
        .map(
          (r, i) => `<li>
        <span class="place">${i + 1}</span>
        <span class="name">${escapeHtml(r.nombre || r.competidorId || "—")}</span>
        <span class="pts">${escapeHtml(formatMetric(r))}</span>
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

function renderAllAroundHub() {
  const rows = temporada?.allAround || [];
  if (!els.allAroundPanel || !els.allAroundList) return;
  if (!rows.length) {
    els.allAroundPanel.hidden = true;
    els.allAroundList.innerHTML = "";
    return;
  }
  els.allAroundPanel.hidden = false;
  const top = rows.slice(0, TOP_CARD);
  const list = top
    .map(
      (r, i) => `<li>
      <span class="place">${i + 1}</span>
      <span class="name">${escapeHtml(r.nombre || "—")}</span>
      <span class="pts">${escapeHtml(fmtMxn(r.dineroTotal))}</span>
    </li>`
    )
    .join("");
  const discNote = top[0]
    ? `<p class="meta">${escapeHtml(
        (top[0].detalle || [])
          .map((d) => d.disciplinaNombre || d.disciplinaId)
          .join(" · ")
      )}</p>`
    : "";
  els.allAroundList.innerHTML = `
    <ol class="cat-card-list">${list}</ol>
    ${discNote}
    <button type="button" class="cat-card-cta all-around-cta" id="btnAllAround">Ver ranking All-Around →</button>
  `;
  els.allAroundList.querySelector("#btnAllAround")?.addEventListener("click", () =>
    navigate("temporada", ALL_AROUND_ID)
  );
}

/* —— Temporada ranking —— */

function renderAllAroundRanking() {
  const rows = temporada?.allAround || [];
  // All-Around es siempre por dinero
  if (els.rankMetricPuntos) els.rankMetricPuntos.parentElement.hidden = true;
  els.rankTitle.textContent = "All-Around Cowboy";
  els.rankMeta.textContent = [
    temporada?.temporada ? `Temporada ${temporada.temporada}` : "",
    `${rows.length} clasificados`,
    "Cobro en ≥2 disciplinas",
  ]
    .filter(Boolean)
    .join(" · ");

  if (!rows.length) {
    els.rankPodium.innerHTML = "";
    els.rankTable.innerHTML = `<p class="empty">Nadie califica aún al All-Around (se requiere dinero en 2+ disciplinas).</p>`;
    return;
  }

  els.rankPodium.innerHTML = renderPodiumHtml(
    rows.slice(0, 3).map((r, i) => ({
      place: i + 1,
      name: r.nombre || "—",
      sub: `${(r.disciplinasConDinero || []).length} disciplinas`,
      value: fmtMxn(r.dineroTotal),
    }))
  );

  const body = rows
    .map((r, i) => {
      const discs = (r.detalle || [])
        .map((d) => `${d.disciplinaNombre || d.disciplinaId}: ${fmtMxn(d.dinero)}`)
        .join(" · ");
      return `<tr>
        <td class="num">${i + 1}</td>
        <td>${escapeHtml(r.nombre || "—")}<div class="row-sub">${escapeHtml(discs)}</div></td>
        <td class="num">${(r.disciplinasConDinero || []).length}</td>
        <td class="num">${escapeHtml(fmtMxn(r.dineroTotal))}</td>
      </tr>`;
    })
    .join("");

  els.rankTable.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Competidor</th>
            <th class="num">Disc.</th>
            <th class="num">Dinero</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <p class="cut-note">All-Around de temporada: suma del dinero ganado solo en disciplinas con cobro. Header y Heeler cuentan como disciplinas distintas.</p>`;
}

function renderTemporadaRanking(catId) {
  if (els.rankMetricPuntos?.parentElement) {
    els.rankMetricPuntos.parentElement.hidden = catId === ALL_AROUND_ID;
  }
  if (catId === ALL_AROUND_ID) {
    renderAllAroundRanking();
    return;
  }

  const rows = sortByMetric(
    (temporada?.standings || []).filter(
      (s) => (s.disciplinaId || s.categoriaId || s.categoriaNombre || "_") === catId
    )
  );

  if (!rows.length) {
    els.rankTitle.textContent = "Ranking";
    els.rankMeta.textContent = "Disciplina no encontrada";
    els.rankPodium.innerHTML = "";
    els.rankTable.innerHTML = `<p class="empty">No hay datos para esta disciplina.</p>`;
    return;
  }

  const cut = metricMode === "puntos" ? getCutLine(manifest, catId) : null;
  const leaderVal = metricValue(rows[0]);
  const nombre = rows[0].disciplinaNombre || rows[0].categoriaNombre || catId;

  els.rankTitle.textContent = nombre;
  els.rankMeta.textContent = [
    temporada?.temporada ? `Temporada ${temporada.temporada}` : "",
    `${rows.length} competidores`,
    metricMode === "dinero" ? "Por dinero ganado" : "Por puntos",
    cut ? `Cut #${cut}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  els.rankPodium.innerHTML = renderPodiumHtml(
    rows.slice(0, 3).map((r, i) => ({
      place: i + 1,
      name: r.nombre || r.competidorId || "—",
      sub: r.equipo || "",
      value: formatMetric(r),
    }))
  );

  const valueHeader = metricMode === "dinero" ? "Dinero" : "Puntos";
  const body = rows
    .map((r, i) => {
      const lugar = i + 1;
      const delta = leaderVal - metricValue(r);
      const cutClass = cut && lugar === cut ? " is-cut-line" : "";
      const badge =
        cut && lugar <= cut
          ? `<span class="badge badge-cut">Clasifica</span>`
          : cut && lugar === cut + 1
            ? `<span class="badge badge-out">Bubble</span>`
            : "";
      const deltaDisplay =
        lugar === 1
          ? "—"
          : metricMode === "dinero"
            ? `−${fmtMxn(delta)}`
            : `−${fmtNum(delta)}`;
      return `<tr class="${cutClass}">
        <td class="num">${lugar}</td>
        <td>${escapeHtml(r.nombre || r.competidorId || "—")} ${badge}</td>
        <td>${escapeHtml(r.equipo || "—")}</td>
        <td class="num">${r.eventos ?? "—"}</td>
        <td class="num">${escapeHtml(formatMetric(r))}</td>
        <td class="num delta">${deltaDisplay}</td>
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
            <th class="num">${valueHeader}</th>
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
    const entry = (manifest?.eventos || []).find((e) => e.id === eventoId);
    if (!entry) throw new Error(`Evento no encontrado: ${eventoId}`);
    if (!eventoCache.has(entry.file)) {
      const raw = await fetchJson(`data/${entry.file}`);
      eventoCache.set(entry.file, normalizeEvento(raw));
    }
    const evento = eventoCache.get(entry.file);
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
  const ranking = buildEventoRanking(evento, cat);

  els.eventoPodium.innerHTML = renderPodiumHtml(rankingToPodiumItems(ranking));

  els.eventoTable.innerHTML = renderEventoRankingTableHtml(ranking, expandedRows);
  wireExpandableRows();
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

/* —— Utils —— */

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return res.json();
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg || "";
  els.status.classList.toggle("is-error", Boolean(isError && msg));
}
