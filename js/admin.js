/** Consola local admin — requiere publish-server.mjs */

import {
  normalizeEvento,
  categoriesWithResults,
  buildEventoRanking,
  renderPodiumHtml,
  rankingToPodiumItems,
  renderEventoRankingTableHtml,
  escapeHtml,
  escapeAttr,
} from "./event-model.js";
import {
  buildDefaultEdits,
  aplicarStatsEdits,
  listEditableFilas,
  upsertFilaEdit,
} from "../scripts/lib/stats-edits.mjs";

let pendingEvento = null;
/** @type {ReturnType<typeof buildDefaultEdits>|null} */
let pendingEdits = null;
let previewCatId = null;
const expandedRows = new Set();

const els = {
  statusMeta: document.getElementById("statusMeta"),
  banner: document.getElementById("banner"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  fileInfo: document.getElementById("fileInfo"),
  preview: document.getElementById("preview"),
  warningsBox: document.getElementById("warningsBox"),
  cherryPick: document.getElementById("cherryPick"),
  cherryPickList: document.getElementById("cherryPickList"),
  editPanel: document.getElementById("editPanel"),
  editTable: document.getElementById("editTable"),
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
    if (pendingEvento) refreshPreviewUi();
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
    const evento = normalizeEvento(data, file.name);
    const temp =
      data.temporada ||
      els.temporadaInput.value ||
      (await fetchStatusSafe())?.temporadaActiva ||
      "";
    els.temporadaInput.value = temp;
    evento.temporada = temp;

    pendingEvento = evento;
    pendingEdits = buildDefaultEdits(evento);
    previewCatId = null;
    expandedRows.clear();

    els.fileInfo.textContent = `Archivo: ${file.name}`;
    refreshPreviewUi();
    showBanner(`Listo para revisar: ${evento.nombreEvento || file.name}`, false);
  } catch (err) {
    resetPending();
    showBanner(err.message || String(err), true);
  }
}

function resetPending() {
  pendingEvento = null;
  pendingEdits = null;
  previewCatId = null;
  expandedRows.clear();
  els.btnIngest.disabled = true;
  els.fileInfo.textContent = "";
  els.fileInput.value = "";
  els.preview.classList.add("empty-preview");
  els.preview.textContent = "Sin archivo cargado.";
  els.warningsBox.hidden = true;
  els.cherryPick.hidden = true;
  els.editPanel.hidden = true;
  els.eventPreview.hidden = true;
}

function getAppliedEvento() {
  if (!pendingEvento || !pendingEdits) return null;
  const applied = aplicarStatsEdits(pendingEvento, pendingEdits);
  applied.temporada = els.temporadaInput.value.trim() || applied.temporada;
  return applied;
}

function refreshPreviewUi() {
  if (!pendingEvento || !pendingEdits) {
    resetPending();
    return;
  }

  const applied = getAppliedEvento();
  renderMetaPreview(applied);
  renderWarnings(applied);
  renderCherryPick();
  const included = pendingEdits.categoriasIncluidas || [];
  els.btnIngest.disabled = included.length === 0;

  if (!included.length) {
    els.editPanel.hidden = true;
    els.eventPreview.hidden = true;
    return;
  }

  if (!previewCatId || !included.includes(String(previewCatId))) {
    previewCatId = included[0];
  }

  renderEditPanel(previewCatId);
  renderEventPreview(applied, previewCatId);
}

function renderMetaPreview(evento) {
  els.preview.classList.remove("empty-preview");
  const lines = [
    evento.nombreEvento || evento.eventoId || "Sin nombre",
    [evento.fecha, evento.sede, evento.temporada ? `Temp. ${evento.temporada}` : ""]
      .filter(Boolean)
      .join(" · "),
    `${(evento.resultados || []).length} filas · ${(evento.categorias || []).length} categorías incluidas`,
  ];
  els.preview.innerHTML = lines.map((l) => `<div>${escapeHtml(l)}</div>`).join("");
}

function renderWarnings(evento) {
  const warnings = clientWarnings(evento);
  if (!warnings.length) {
    els.warningsBox.hidden = true;
    els.warningsBox.innerHTML = "";
    return;
  }
  els.warningsBox.hidden = false;
  els.warningsBox.innerHTML = `<strong>Avisos de validación</strong><ul>${warnings
    .map((w) => `<li>${escapeHtml(w)}</li>`)
    .join("")}</ul>`;
}

/** Avisos livianos en browser (sin importar módulos Node del rebuild). */
function clientWarnings(evento) {
  const warnings = [];
  const schema = Number(evento?.schemaVersion);
  let entradas = 0;
  let sinMonto = 0;
  let noEntero = 0;
  for (const bloque of evento?.clasificacion || []) {
    for (const ent of bloque.entradas || []) {
      entradas += 1;
      if (ent.montoGanado == null || ent.montoGanado === "") {
        sinMonto += 1;
        continue;
      }
      const n = Number(ent.montoGanado);
      if (!Number.isFinite(n) || !Number.isInteger(n)) noEntero += 1;
    }
  }
  if (Number.isFinite(schema) && schema >= 2) {
    if (entradas === 0) {
      warnings.push(
        "schemaVersion ≥ 2 pero no hay entradas en clasificacion para validar montoGanado."
      );
    } else if (sinMonto > 0) {
      warnings.push(
        `${sinMonto} entrada(s) de clasificación sin montoGanado (schemaVersion ≥ 2).`
      );
    }
    if (noEntero > 0) {
      warnings.push(`${noEntero} monto(s) no son enteros MXN.`);
    }
  } else if (entradas > 0 && sinMonto === entradas) {
    warnings.push(
      "Ninguna entrada de clasificación trae montoGanado (ok en schema 1; requerido en schema 2)."
    );
  }
  if (!(evento?.categorias || []).length) {
    warnings.push("El evento aplicado no tiene categorías incluidas.");
  }
  return warnings;
}

function renderCherryPick() {
  const cats = pendingEvento?.categorias || [];
  if (!cats.length) {
    els.cherryPick.hidden = true;
    return;
  }
  els.cherryPick.hidden = false;
  const included = new Set(pendingEdits.categoriasIncluidas || []);

  els.cherryPickList.innerHTML = cats
    .map((c) => {
      const id = String(c.id);
      const checked = included.has(id) ? "checked" : "";
      return `<label class="cherry-item">
        <input type="checkbox" data-cat-id="${escapeAttr(id)}" ${checked} />
        <span>${escapeHtml(c.nombre || id)} <span class="meta">(${escapeHtml(c.tipo || "—")})</span></span>
      </label>`;
    })
    .join("");

  els.cherryPickList.querySelectorAll("input[data-cat-id]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.getAttribute("data-cat-id");
      const set = new Set(pendingEdits.categoriasIncluidas || []);
      if (input.checked) set.add(id);
      else set.delete(id);
      pendingEdits.categoriasIncluidas = [...set];
      refreshPreviewUi();
    });
  });
}

function renderEditPanel(catId) {
  const rows = listEditableFilas(pendingEvento, catId, pendingEdits);
  els.editPanel.hidden = false;
  if (!rows.length) {
    els.editTable.innerHTML = `<p class="meta">Sin filas editables en esta categoría.</p>`;
    return;
  }

  els.editTable.innerHTML = `<table class="edit-table">
    <thead>
      <tr>
        <th>Incluir</th>
        <th>Nombre</th>
        <th>Pts circuito</th>
        <th>$ MXN</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map((r) => {
          const excl = r.excluir;
          return `<tr class="${excl ? "is-excluded" : ""}" data-key="${escapeAttr(r.key)}">
            <td><input type="checkbox" data-field="incluir" ${excl ? "" : "checked"} /></td>
            <td><input type="text" data-field="nombre" value="${escapeAttr(r.nombre)}" /></td>
            <td><input type="number" data-field="puntosCircuito" step="1" value="${r.puntosCircuito ?? ""}" /></td>
            <td><input type="number" data-field="montoGanado" step="1" value="${r.montoGanado ?? ""}" /></td>
          </tr>`;
        })
        .join("")}
    </tbody>
  </table>`;

  els.editTable.querySelectorAll("tr[data-key]").forEach((tr) => {
    const key = tr.getAttribute("data-key");
    tr.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => {
        const field = input.getAttribute("data-field");
        if (field === "incluir") {
          upsertFilaEdit(pendingEdits, key, { excluir: !input.checked });
          tr.classList.toggle("is-excluded", !input.checked);
        } else if (field === "nombre") {
          upsertFilaEdit(pendingEdits, key, { nombre: input.value });
        } else if (field === "puntosCircuito") {
          const v = input.value === "" ? null : Number(input.value);
          upsertFilaEdit(pendingEdits, key, { puntosCircuito: v });
        } else if (field === "montoGanado") {
          const v = input.value === "" ? null : Number(input.value);
          upsertFilaEdit(pendingEdits, key, { montoGanado: v });
        }
        refreshPreviewOnly();
      });
    });
  });
}

/** Actualiza meta/warnings/podium sin rearmar inputs (evita perder foco). */
function refreshPreviewOnly() {
  if (!pendingEvento || !pendingEdits) return;
  const applied = getAppliedEvento();
  renderMetaPreview(applied);
  renderWarnings(applied);
  const included = pendingEdits.categoriasIncluidas || [];
  els.btnIngest.disabled = included.length === 0;
  if (!included.length) {
    els.eventPreview.hidden = true;
    return;
  }
  renderEventPreview(applied, previewCatId);
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
      previewCatId = tab.getAttribute("data-cat");
      refreshPreviewUi();
    });
  });

  const cat = cats.find((c) => c.id === activeId) || cats[0];
  const ranking = buildEventoRanking(evento, cat);

  els.previewPodium.innerHTML = renderPodiumHtml(rankingToPodiumItems(ranking));
  els.previewTable.innerHTML = renderEventoRankingTableHtml(ranking, expandedRows);

  els.previewTable.querySelectorAll("tr.is-expandable").forEach((tr) => {
    tr.addEventListener("click", () => {
      const id = tr.getAttribute("data-row");
      if (!id) return;
      if (expandedRows.has(id)) expandedRows.delete(id);
      else expandedRows.add(id);
      refreshPreviewUi();
    });
  });
}

async function onIngest() {
  if (!pendingEvento || !pendingEdits) return;
  if (!(pendingEdits.categoriasIncluidas || []).length) {
    showBanner("Selecciona al menos una categoría.", true);
    return;
  }
  els.btnIngest.disabled = true;
  showBanner("Agregando evento…", false);
  try {
    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evento: pendingEvento,
        temporada: els.temporadaInput.value.trim(),
        statsEdits: pendingEdits,
      }),
    });
    const body = await res.json();
    if (!res.ok || body.ok === false) throw new Error(body.error || "Error al agregar");
    const warn =
      body.warnings?.length
        ? ` Avisos: ${body.warnings.join(" · ")}`
        : "";
    showBanner(
      `Agregado: ${body.entry?.nombre || body.file}. Temporada ${body.temporada}.${warn} Ya puedes publicar.`,
      false
    );
    resetPending();
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
            (e) => `<li class="ev-row">
            <div class="ev-info">
              <span class="ev-name">${escapeHtml(e.nombre || e.id)}</span>
              <span class="ev-meta">${escapeHtml([e.fecha, e.sede].filter(Boolean).join(" · "))}</span>
            </div>
            <button type="button" class="btn-danger btn-sm" data-remove="${escapeAttr(e.id)}">Eliminar</button>
          </li>`
          )
          .join("")
      : `<li class="ev-meta">Sin eventos aún.</li>`;

    els.eventosList.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const eventId = btn.getAttribute("data-remove");
        const nombre =
          btn.closest("li")?.querySelector(".ev-name")?.textContent?.trim() || eventId;
        onRemove(eventId, nombre);
      });
    });
  } catch {
    els.statusMeta.textContent =
      "No hay API. Ejecuta publicar.bat o: node scripts/publish-server.mjs";
    els.btnPublish.disabled = true;
  }
}

async function onRemove(id, nombre) {
  if (!id) return;
  const label = nombre || id;
  if (
    !confirm(
      `¿Eliminar "${label}"?\n\nSe borra el archivo y se actualiza la temporada. Luego publica para que desaparezca del sitio.`
    )
  ) {
    return;
  }

  showBanner("Eliminando evento…", false);
  try {
    const res = await fetch("/api/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const body = await res.json();
    if (!res.ok || body.ok === false) throw new Error(body.error || "Error al eliminar");
    showBanner(
      `Eliminado: ${body.removed?.nombre || id}. Publica para actualizar el sitio.`,
      false
    );
    await refreshStatus();
  } catch (err) {
    showBanner(err.message || String(err), true);
  }
}

function showBanner(msg, isError) {
  els.banner.hidden = !msg;
  els.banner.textContent = msg || "";
  els.banner.classList.toggle("is-error", Boolean(isError));
  els.banner.classList.toggle("is-ok", Boolean(msg && !isError));
}
