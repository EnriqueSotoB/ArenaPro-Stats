/**
 * ArenaPro Stats — temporada / ranking / eventos / ficha competidor.
 * Tokens: docs/design/DESIGN_TOKENS.md (TimeManagement).
 */

import {
  normalizeEvento,
  categoriesWithResults,
  buildEventoRanking,
  renderPodiumHtml,
  rankingToPodiumItems,
  renderEventoRankingTableHtml,
  athleteNameHtml,
  groupBy,
  escapeHtml,
  escapeAttr,
  fmtNum,
} from "./event-model.js";
import { getCutLine } from "../scripts/lib/cut-line.mjs";
import { fmtMxn } from "../scripts/lib/money.mjs";
import {
  normalizeSearch,
  searchCompetidores,
} from "../scripts/lib/competidores.mjs";

const MANIFEST_URL = "data/manifest.json";
const TEMPORADA_URL = "data/temporada.json";
const TOP_CARD = 5;
const ALL_AROUND_ID = "__all-around";
const DEFAULT_TITLE = "FMR Tour 2027 — ArenaPro Estadísticas";

const els = {
  status: document.getElementById("status"),
  navTemporada: document.getElementById("navTemporada"),
  navEventos: document.getElementById("navEventos"),
  viewTemporadaHub: document.getElementById("viewTemporadaHub"),
  viewTemporadaRanking: document.getElementById("viewTemporadaRanking"),
  viewCompetidor: document.getElementById("viewCompetidor"),
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
  btnBackCompetidor: document.getElementById("btnBackCompetidor"),
  compTitle: document.getElementById("compTitle"),
  compMeta: document.getElementById("compMeta"),
  compStats: document.getElementById("compStats"),
  compBody: document.getElementById("compBody"),
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
  searchInput: document.getElementById("searchInput"),
  searchResults: document.getElementById("searchResults"),
  searchRoot: document.getElementById("searchRoot"),
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
/** @type {string} */
let lastNonCompetidorHash = "#temporada";

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
  els.btnBackCompetidor?.addEventListener("click", () => {
    location.hash = lastNonCompetidorHash || "#temporada";
  });
  wireMetricToggle(els.hubMetricPuntos, els.hubMetricDinero);
  wireMetricToggle(els.rankMetricPuntos, els.rankMetricDinero);
  wireSearch();
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
  } else if (section === "competidor" && id) {
    location.hash = `#competidor/${encodeURIComponent(id)}`;
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
  if (section === "eventos") return { section: "eventos", id };
  if (section === "competidor") return { section: "competidor", id };
  if (section === "temporada") return { section: "temporada", id };
  return { section: "temporada", id: null };
}

async function applyRoute() {
  const route = parseRoute();
  hideAllViews();
  expandedRows.clear();
  syncMetricButtons();
  closeSearch();

  if (route.section !== "competidor") {
    lastNonCompetidorHash = location.hash || "#temporada";
  }

  els.navTemporada.classList.toggle("is-active", route.section === "temporada");
  els.navEventos.classList.toggle("is-active", route.section === "eventos");

  if (route.section === "competidor") {
    els.viewCompetidor.hidden = false;
    renderCompetidor(route.id);
    return;
  }

  document.title = DEFAULT_TITLE;

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
  els.viewCompetidor.hidden = true;
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

function findCompetidor(key) {
  const k = String(key || "").trim();
  if (!k) return null;
  return (temporada?.competidores || []).find((c) => c.competidorKey === k) || null;
}

function resolveProfileKey(nombre, fallbackKey) {
  const direct = String(fallbackKey || "").trim();
  if (direct && findCompetidor(direct)) return direct;
  const needle = normalizeSearch(nombre);
  if (!needle) return direct || null;
  const hit = (temporada?.competidores || []).find(
    (c) => normalizeSearch(c.nombre) === needle
  );
  return hit?.competidorKey || direct || null;
}

function placeInDiscipline(disciplinaId, competidorKey) {
  const rows = sortByMetric(
    (temporada?.standings || []).filter((s) => s.disciplinaId === disciplinaId)
  );
  const idx = rows.findIndex((r) => r.competidorKey === competidorKey);
  return idx >= 0 ? idx + 1 : null;
}

/* —— Search —— */

function wireSearch() {
  if (!els.searchInput || !els.searchResults) return;
  els.searchInput.addEventListener("input", () => renderSearchResults());
  els.searchInput.addEventListener("focus", () => renderSearchResults());
  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSearch();
      els.searchInput.blur();
    } else if (e.key === "Enter") {
      const first = els.searchResults.querySelector("[data-key]");
      if (first) {
        e.preventDefault();
        navigate("competidor", first.getAttribute("data-key"));
      }
    }
  });
  document.addEventListener("click", (e) => {
    if (!els.searchRoot?.contains(e.target)) closeSearch();
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      els.searchInput?.focus();
      els.searchInput?.select();
    }
  });
}

function closeSearch() {
  if (!els.searchResults) return;
  els.searchResults.hidden = true;
  els.searchResults.innerHTML = "";
}

function renderSearchResults() {
  const q = els.searchInput?.value || "";
  const hits = searchCompetidores(q, temporada?.competidores || [], 8);
  if (!normalizeSearch(q)) {
    closeSearch();
    return;
  }
  if (!hits.length) {
    els.searchResults.hidden = false;
    els.searchResults.innerHTML = `<p class="search-empty">Sin resultados para “${escapeHtml(q)}”</p>`;
    return;
  }
  els.searchResults.hidden = false;
  els.searchResults.innerHTML = hits
    .map((c) => {
      const discs = (c.disciplinas || [])
        .slice(0, 2)
        .map((d) => d.disciplinaNombre)
        .join(" · ");
      return `<button type="button" class="search-hit" role="option" data-key="${escapeAttr(c.competidorKey)}">
        <span class="search-hit-name">${escapeHtml(c.nombre)}</span>
        <span class="search-hit-meta">${escapeHtml(discs || `${c.eventos || 0} eventos`)} · ${fmtNum(c.puntosTotales)} pts</span>
      </button>`;
    })
    .join("");
  els.searchResults.querySelectorAll("[data-key]").forEach((btn) => {
    btn.addEventListener("click", () => navigate("competidor", btn.getAttribute("data-key")));
  });
}

/* —— Temporada hub —— */

function renderTemporadaHub() {
  const data = temporada;
  els.tempTitle.textContent = data?.titulo || `Temporada ${data?.temporada || ""}`;
  els.tempMeta.textContent = [
    data?.temporada ? `Temporada ${data.temporada}` : "",
    data?.actualizadoEn ? `Actualizado ${String(data.actualizadoEn).slice(0, 10)}` : "",
    data?.eventosContados != null ? `${data.eventosContados} eventos` : "",
    data?.competidores?.length ? `${data.competidores.length} competidores` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  renderAllAroundHub();

  if (!data?.standings?.length) {
    els.tempCards.innerHTML = `<p class="empty-state">Sin acumulado aún. Publica un evento desde la consola local.</p>`;
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
    .map(([catId, rows], cardIdx) => {
      const sorted = sortByMetric(rows);
      const nombre = sorted[0]?.disciplinaNombre || sorted[0]?.categoriaNombre || catId;
      const top = sorted.slice(0, TOP_CARD);
      const list = top
        .map(
          (r, i) => `<li>
        <span class="place">${i + 1}</span>
        <span class="name">${athleteNameHtml(r.nombre || r.competidorId || "—", r.competidorKey)}</span>
        <span class="pts">${escapeHtml(formatMetric(r))}</span>
      </li>`
        )
        .join("");

      return `<article class="cat-card" style="--card-i:${cardIdx}">
      <div class="cat-card-head">
        <h2 class="cat-card-title">${escapeHtml(nombre)}</h2>
        <span class="cat-card-count">${sorted.length} ranked</span>
      </div>
      <ol class="cat-card-list">${list}</ol>
      <button type="button" class="cat-card-cta" data-cat="${escapeAttr(catId)}">Ver ranking completo →</button>
    </article>`;
    });

  els.tempCards.innerHTML = cards.join("");
  els.tempCards.querySelectorAll(".cat-card-cta").forEach((btn) => {
    btn.addEventListener("click", () => navigate("temporada", btn.getAttribute("data-cat")));
  });
}

function renderAllAroundHub() {
  const rows = temporada?.allAround || [];
  if (!els.allAroundPanel || !els.allAroundList) return;

  // Vacío: mensaje suave (no ocultar del todo en hub)
  if (!rows.length) {
    els.allAroundPanel.hidden = false;
    els.allAroundPanel.classList.add("is-empty");
    els.allAroundList.innerHTML = `<p class="empty-state">Aún nadie califica: hace falta dinero en 2+ disciplinas. Cuando los eventos traigan montos, el All-Around aparece aquí.</p>`;
    return;
  }

  els.allAroundPanel.hidden = false;
  els.allAroundPanel.classList.remove("is-empty");
  const top = rows.slice(0, TOP_CARD);
  const list = top
    .map(
      (r, i) => `<li>
      <span class="place">${i + 1}</span>
      <span class="name">${athleteNameHtml(r.nombre || "—", r.competidorKey)}</span>
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
    els.rankTable.innerHTML = `<p class="empty-state">Nadie califica aún al All-Around (se requiere dinero en 2+ disciplinas). Completa montos en Time o Excel y vuelve a publicar.</p>`;
    return;
  }

  els.rankPodium.innerHTML = renderPodiumHtml(
    rows.slice(0, 3).map((r, i) => ({
      place: i + 1,
      name: r.nombre || "—",
      competidorKey: r.competidorKey,
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
        <td>${athleteNameHtml(r.nombre || "—", r.competidorKey)}<div class="row-sub">${escapeHtml(discs)}</div></td>
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
    els.rankTable.innerHTML = `<p class="empty-state">No hay datos para esta disciplina.</p>`;
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
      competidorKey: r.competidorKey,
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
        <td>${athleteNameHtml(r.nombre || r.competidorId || "—", r.competidorKey)} ${badge}</td>
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

/* —— Ficha competidor —— */

function renderCompetidor(key) {
  const comp = findCompetidor(key);
  if (!comp) {
    document.title = DEFAULT_TITLE;
    els.compTitle.textContent = "Competidor no encontrado";
    els.compMeta.textContent = "";
    els.compStats.innerHTML = "";
    els.compBody.innerHTML = `<p class="empty-state">No hay ficha para esta clave. Prueba la búsqueda en la barra superior.</p>`;
    return;
  }

  document.title = `${comp.nombre} — FMR Tour 2027`;
  els.compTitle.textContent = comp.nombre;
  els.compMeta.textContent = [
    temporada?.temporada ? `Temporada ${temporada.temporada}` : "",
    `${comp.eventos || 0} eventos`,
    `${(comp.disciplinas || []).length} disciplinas`,
  ]
    .filter(Boolean)
    .join(" · ");

  els.compStats.innerHTML = `
    <div class="stat-pill"><span class="stat-label">Puntos</span><span class="stat-value">${fmtNum(comp.puntosTotales)}</span></div>
    <div class="stat-pill"><span class="stat-label">Dinero</span><span class="stat-value">${escapeHtml(fmtMxn(comp.dineroTotal || 0))}</span></div>
    <div class="stat-pill"><span class="stat-label">Eventos</span><span class="stat-value">${comp.eventos || 0}</span></div>
  `;

  const discRows = (comp.disciplinas || [])
    .map((d) => {
      const place = placeInDiscipline(d.disciplinaId, comp.competidorKey);
      return `<tr>
        <td><a class="athlete-link" href="#temporada/${encodeURIComponent(d.disciplinaId)}">${escapeHtml(d.disciplinaNombre)}</a></td>
        <td class="num">${place != null ? `#${place}` : "—"}</td>
        <td class="num">${fmtNum(d.puntosTotales)}</td>
        <td class="num">${escapeHtml(fmtMxn(d.dineroTotal || 0))}</td>
        <td class="num">${d.eventos ?? "—"}</td>
      </tr>`;
    })
    .join("");

  const hist = (comp.historial || [])
    .map(
      (h) => `<tr>
      <td><a class="athlete-link" href="#eventos/${encodeURIComponent(h.eventoId)}">${escapeHtml(h.eventoNombre || h.eventoId)}</a>
        <div class="row-sub">${escapeHtml([h.fecha, h.sede].filter(Boolean).join(" · "))}</div></td>
      <td>${escapeHtml(h.disciplinaNombre || h.disciplinaId)}</td>
      <td class="num">${fmtNum(h.puntos)}</td>
      <td class="num">${Number(h.dinero) > 0 ? escapeHtml(fmtMxn(h.dinero)) : `<span class="muted">—</span>`}</td>
    </tr>`
    )
    .join("");

  const moneyNote =
    !(comp.dineroTotal > 0)
      ? `<p class="cut-note">Sin montos registrados aún en los eventos publicados. Los puntos sí cuentan para el ranking de temporada.</p>`
      : "";

  els.compBody.innerHTML = `
    <section class="panel profile-block">
      <h2 class="profile-block-title">Por disciplina</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Disciplina</th><th class="num">Lugar</th><th class="num">Puntos</th><th class="num">Dinero</th><th class="num">Eventos</th></tr></thead>
          <tbody>${discRows || `<tr><td colspan="5">Sin disciplinas</td></tr>`}</tbody>
        </table>
      </div>
    </section>
    <section class="panel profile-block">
      <h2 class="profile-block-title">Historial de temporada</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Evento</th><th>Disciplina</th><th class="num">Puntos</th><th class="num">Dinero</th></tr></thead>
          <tbody>${hist || `<tr><td colspan="4">Sin historial</td></tr>`}</tbody>
        </table>
      </div>
      ${moneyNote}
    </section>`;
}

/* —— Eventos list —— */

function renderEventosList() {
  const eventos = [...(manifest?.eventos || [])].sort((a, b) =>
    String(b.fecha || "").localeCompare(String(a.fecha || ""))
  );

  if (!eventos.length) {
    els.eventosList.innerHTML = `<p class="empty-state">No hay eventos en data/manifest.json.</p>`;
    return;
  }

  els.eventosList.innerHTML = eventos
    .map(
      (ev, i) => `<button type="button" class="event-row" style="--row-i:${i}" data-id="${escapeAttr(ev.id)}">
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
    els.eventoTable.innerHTML = `<p class="empty-state">No se pudo cargar el evento.</p>`;
  }
}

function attachProfileKeys(ranking) {
  return ranking.map((r) => ({
    ...r,
    profileKey: resolveProfileKey(r.nombre, null),
  }));
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
    els.eventoTable.innerHTML = `<p class="empty-state">Sin resultados en este archivo.</p>`;
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
  const ranking = attachProfileKeys(buildEventoRanking(evento, cat));

  els.eventoPodium.innerHTML = renderPodiumHtml(rankingToPodiumItems(ranking));

  els.eventoTable.innerHTML = renderEventoRankingTableHtml(ranking, expandedRows);
  wireExpandableRows();
}

function wireExpandableRows() {
  els.eventoTable.querySelectorAll("tr.is-expandable").forEach((tr) => {
    tr.addEventListener("click", (e) => {
      if (e.target.closest("a.athlete-link")) return;
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
