/** Consola local admin — requiere publish-server.mjs */

import {
  normalizeEvento,
  categoriesWithResults,
  buildEventoRanking,
  renderPodiumHtml,
  rankingToPodiumItems,
  renderEventoRankingTableHtml,
  escapeHtml,
} from "./event-model.js";

let pendingEvento = null;
let previewEvento = null;
let previewCatId = null;
const expandedRows = new Set();

const els = {
  statusMeta: document.getElementById("statusMeta"),
  banner: document.getElementById("banner"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  fileInfo: document.getElementById("fileInfo"),
  preview: document.getElementById("preview"),
  eventPreview: document.getElementById("eventPreview"),
  previewPodium: document.getElementById("previewPodium"),
  previewTabs: document.getElementById("previewTabs"),
  previewTable: document.getElementById("previewTable"),
  temporadaInput: document.getElementById("temporadaInput"),
  btnIngest: document.getElementById("btnIngest"),
  btnPublish: document.getElementById("btnPublish"),
  pagesLink: document.getElementById("pagesLink"),
  dirtyNote: document.getElementById("dirtyNote"),
  eventosList: document.getElementById("eventosList"),
};

init().catch((err) => showBanner(err.message || String(err), true));

async function init() {
  wireDropzone();
  els.btnIngest.addEventListener("click", onIngest);
  els.btnPublish.addEventListener("click", onPublish);
  els.temporadaInput.addEventListener("input", () => {
    if (previewEvento) {
      previewEvento.temporada = els.temporadaInput.value.trim();
      renderMetaPreview(previewEvento);
    }
  });
  await refreshStatus();
}

function wireDropzone() {
  const dz = els.dropzone;

  dz.addEventListener("click", (e) => {
    if (e.target.closest("label")) return;
    els.fileInput.click();
  });

  dz.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      els.fileInput.click();
    }
  });

  ["dragenter", "dragover"].forEach((ev) => {
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add("is-drag");
    });
  });

  ["dragleave", "drop"].forEach((ev) => {
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.remove("is-drag");
    });
  });

  dz.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  });

  els.fileInput.addEventListener("change", () => {
    const file = els.fileInput.files?.[0];
    if (file) loadFile(file);
  });
}

async function loadFile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    pendingEvento = data;
    const evento = normalizeEvento(data, file.name);
    const temp =
      data.temporada ||
      els.temporadaInput.value ||
      (await fetchStatusSafe())?.temporadaActiva ||
      "";
    els.temporadaInput.value = temp;
    evento.temporada = temp;
    previewEvento = evento;
    previewCatId = null;
    expandedRows.clear();

    els.fileInfo.textContent = `Archivo: ${file.name}`;
    renderMetaPreview(evento);
    renderEventPreview(evento, null);
    els.btnIngest.disabled = false;
    showBanner(`Listo para agregar: ${evento.nombreEvento || file.name}`, false);
  } catch (err) {
    pendingEvento = null;
    previewEvento = null;
    els.btnIngest.disabled = true;
    els.preview.classList.add("empty-preview");
    els.preview.textContent = "No se pudo leer el JSON.";
    els.eventPreview.hidden = true;
    showBanner(err.message || String(err), true);
  }
}

function renderMetaPreview(evento) {
  els.preview.classList.remove("empty-preview");
  const lines = [
    evento.nombreEvento || evento.eventoId || "Sin nombre",
    [evento.fecha, evento.sede, evento.temporada ? `Temp. ${evento.temporada}` : ""]
      .filter(Boolean)
      .join(" · "),
    `${(evento.resultados || []).length} filas · ${(evento.categorias || []).length} categorías`,
  ];
  els.preview.innerHTML = lines.map((l) => `<div>${escapeHtml(l)}</div>`).join("");
}

function renderEventPreview(evento, catId) {
  const cats = categoriesWithResults(evento);
  if (!cats.length) {
    els.eventPreview.hidden = true;
    return;
  }

  els.eventPreview.hidden = false;
  const activeId = catId || cats[0].id;
  previewCatId = activeId;

  els.previewTabs.innerHTML = cats
    .map(
      (c) =>
        `<button type="button" class="tab${c.id === activeId ? " is-active" : ""}" data-cat="${escapeHtml(c.id)}">${escapeHtml(c.nombre)}</button>`
    )
    .join("");

  els.previewTabs.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      expandedRows.clear();
      renderEventPreview(evento, tab.getAttribute("data-cat"));
    });
  });

  const cat = cats.find((c) => c.id === activeId) || cats[0];
  const rows = (evento.resultados || []).filter((r) => (r.categoriaId || "_") === cat.id);
  const ranking = buildEventoRanking(rows, cat);

  els.previewPodium.innerHTML = renderPodiumHtml(rankingToPodiumItems(ranking));
  els.previewTable.innerHTML = renderEventoRankingTableHtml(ranking, expandedRows);

  els.previewTable.querySelectorAll("tr.is-expandable").forEach((tr) => {
    tr.addEventListener("click", () => {
      const id = tr.getAttribute("data-row");
      if (!id || !previewEvento) return;
      if (expandedRows.has(id)) expandedRows.delete(id);
      else expandedRows.add(id);
      renderEventPreview(previewEvento, previewCatId);
    });
  });
}

async function onIngest() {
  if (!pendingEvento) return;
  els.btnIngest.disabled = true;
  showBanner("Agregando evento…", false);
  try {
    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evento: pendingEvento,
        temporada: els.temporadaInput.value.trim(),
      }),
    });
    const body = await res.json();
    if (!res.ok || body.ok === false) throw new Error(body.error || "Error al agregar");
    showBanner(
      `Agregado: ${body.entry?.nombre || body.file}. Temporada ${body.temporada}. Ya puedes publicar.`,
      false
    );
    pendingEvento = null;
    previewEvento = null;
    els.fileInfo.textContent = "";
    els.fileInput.value = "";
    els.eventPreview.hidden = true;
    els.preview.classList.add("empty-preview");
    els.preview.textContent = "Sin archivo cargado.";
    await refreshStatus();
  } catch (err) {
    showBanner(err.message || String(err), true);
    els.btnIngest.disabled = false;
  }
}

async function onPublish() {
  els.btnPublish.disabled = true;
  showBanner("Publicando…", false);
  try {
    const res = await fetch("/api/publish", { method: "POST" });
    const body = await res.json();
    if (!res.ok || body.ok === false) throw new Error(body.error || "Error al publicar");
    showBanner(body.message || "Listo.", false);
    if (body.pagesUrl) els.pagesLink.href = body.pagesUrl;
    await refreshStatus();
  } catch (err) {
    showBanner(err.message || String(err), true);
  } finally {
    await refreshStatus();
  }
}

async function fetchStatusSafe() {
  try {
    const res = await fetch("/api/status");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function refreshStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      els.statusMeta.textContent =
        data.error ||
        "No hay API. Abre esta página con node scripts/publish-server.mjs (o publicar.bat).";
      els.btnPublish.disabled = true;
      return;
    }

    els.statusMeta.textContent = [
      data.titulo,
      data.temporadaActiva ? `Temporada activa ${data.temporadaActiva}` : "",
      data.branch ? `rama ${data.branch}` : "",
      data.dirty ? "hay cambios sin publicar" : "sin cambios pendientes",
    ]
      .filter(Boolean)
      .join(" · ");

    if (!els.temporadaInput.value && data.temporadaActiva) {
      els.temporadaInput.value = data.temporadaActiva;
    }

    els.btnPublish.disabled = !data.dirty;
    els.dirtyNote.textContent = data.dirty
      ? "Hay cambios en data/ listos para publicar."
      : "Nada pendiente de publicar.";
    if (data.pagesUrl) els.pagesLink.href = data.pagesUrl;

    const eventos = [...(data.eventos || [])].sort((a, b) =>
      String(b.fecha || "").localeCompare(String(a.fecha || ""))
    );
    els.eventosList.innerHTML = eventos.length
      ? eventos
          .map(
            (e) => `<li>
            <span class="ev-name">${escapeHtml(e.nombre || e.id)}</span>
            <span class="ev-meta">${escapeHtml([e.fecha, e.sede].filter(Boolean).join(" · "))}</span>
          </li>`
          )
          .join("")
      : `<li class="ev-meta">Sin eventos aún.</li>`;
  } catch {
    els.statusMeta.textContent =
      "No hay API. Ejecuta publicar.bat o: node scripts/publish-server.mjs";
    els.btnPublish.disabled = true;
  }
}

function showBanner(msg, isError) {
  els.banner.hidden = !msg;
  els.banner.textContent = msg || "";
  els.banner.classList.toggle("is-error", Boolean(isError));
  els.banner.classList.toggle("is-ok", Boolean(msg && !isError));
}
