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
import { normalizeAliasInput } from "../scripts/lib/alias-store.mjs";
import {
  displayFromKey,
  peersWithSameSurname,
  spellingNearMatches,
} from "../scripts/lib/alias-suggest.mjs";

let pendingEvento = null;
/** @type {ReturnType<typeof buildDefaultEdits>|null} */
let pendingEdits = null;
let previewCatId = null;
const expandedRows = new Set();

/** @type {{ aliases: Array<object>, names: Array<{key:string,label:string}> }} */
let aliasesState = { aliases: [], names: [] };

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
  editSearch: document.getElementById("editSearch"),
  editSearchMeta: document.getElementById("editSearchMeta"),
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
  btnDownloadPlantilla: document.getElementById("btnDownloadPlantilla"),
  aliasForm: document.getElementById("aliasForm"),
  aliasFrom: document.getElementById("aliasFrom"),
  aliasTo: document.getElementById("aliasTo"),
  aliasNota: document.getElementById("aliasNota"),
  aliasFromKey: document.getElementById("aliasFromKey"),
  aliasToKey: document.getElementById("aliasToKey"),
  aliasNamesList: document.getElementById("aliasNamesList"),
  aliasesList: document.getElementById("aliasesList"),
  aliasHints: document.getElementById("aliasHints"),
  btnAliasSave: document.getElementById("btnAliasSave"),
};

init().catch((err) => showBanner(err.message || String(err), true));

async function init() {
  wireDropzone();
  wireAliasesPanel();
  els.btnDownloadPlantilla?.addEventListener("click", onDownloadPlantilla);
  els.btnIngest.addEventListener("click", onIngest);
  els.btnPublish.addEventListener("click", onPublish);
  els.temporadaInput.addEventListener("input", () => {
    if (pendingEvento) refreshPreviewUi();
  });
  els.editSearch.addEventListener("input", () => applyEditSearchFilter());
  await refreshStatus();
  await refreshAliases();
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

const PLANTILLA_URL = "/templates/evento-manual.xlsx";
const PLANTILLA_NAME = "evento-manual.xlsx";

async function onDownloadPlantilla() {
  try {
    const res = await fetch(PLANTILLA_URL);
    if (!res.ok) throw new Error(`No se pudo obtener la plantilla (${res.status})`);
    const buf = await res.arrayBuffer();

    if (typeof window.showSaveFilePicker === "function") {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: PLANTILLA_NAME,
          types: [
            {
              description: "Excel",
              accept: {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
                  ".xlsx",
                ],
              },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(buf);
        await writable.close();
        showBanner(`Plantilla guardada: ${handle.name}`, false);
        return;
      } catch (err) {
        if (err?.name === "AbortError") return; // usuario canceló
        // sigue al fallback
      }
    }

    // Fallback: descarga clásica (el navegador decide carpeta / Guardar como)
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = PLANTILLA_NAME;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showBanner("Plantilla descargada. Si no pregunta carpeta, revisa Descargas.", false);
  } catch (err) {
    showBanner(err.message || String(err), true);
  }
}

async function loadFile(file) {
  try {
    const isExcel = /\.xlsx$/i.test(file.name);
    let data;
    if (isExcel) {
      els.fileInfo.textContent = `Leyendo Excel: ${file.name}…`;
      const buf = await file.arrayBuffer();
      const res = await fetch("/api/parse-excel", {
        method: "POST",
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        body: buf,
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.error || `No se pudo leer el Excel (${res.status})`);
      }
      data = body.evento;
    } else {
      const text = await file.text();
      data = JSON.parse(text);
    }

    const evento = normalizeEvento(data, file.name);
    evento.source = data.source || evento.source;
    evento.schemaVersion = data.schemaVersion ?? evento.schemaVersion;
    evento.clasificacion = data.clasificacion || evento.clasificacion;
    evento.resultados = data.resultados || evento.resultados;
    evento.categorias = data.categorias || evento.categorias;

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

    const srcLabel = evento.source === "manual" ? "Excel manual" : "Time";
    els.fileInfo.textContent = `Archivo: ${file.name} · ${srcLabel}`;
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
  els.editSearch.value = "";
  els.editSearch.disabled = false;
  els.editSearchMeta.hidden = true;
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
    els.editSearch.value = "";
    els.editSearch.disabled = true;
    els.editSearchMeta.hidden = true;
    return;
  }

  els.editSearch.disabled = false;
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
          const search = normalizeSearch(r.nombre);
          return `<tr class="${excl ? "is-excluded" : ""}" data-key="${escapeAttr(r.key)}" data-search="${escapeAttr(search)}">
            <td><input type="checkbox" data-field="incluir" ${excl ? "" : "checked"} /></td>
            <td><input type="text" data-field="nombre" value="${escapeAttr(r.nombre)}" /></td>
            <td><input type="number" data-field="puntosCircuito" step="0.5" value="${r.puntosCircuito ?? ""}" /></td>
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
          tr.setAttribute("data-search", normalizeSearch(input.value));
          applyEditSearchFilter();
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

  applyEditSearchFilter();
}

function normalizeSearch(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Filtra filas de edición por nombre (sin rearmar la tabla). */
function applyEditSearchFilter() {
  const q = normalizeSearch(els.editSearch.value);
  const rows = [...els.editTable.querySelectorAll("tr[data-key]")];
  if (!rows.length) {
    els.editSearchMeta.hidden = true;
    return;
  }

  let visible = 0;
  for (const tr of rows) {
    const hay = !q || (tr.getAttribute("data-search") || "").includes(q);
    tr.hidden = !hay;
    if (hay) visible += 1;
  }

  if (!q) {
    els.editSearchMeta.hidden = true;
    return;
  }

  els.editSearchMeta.hidden = false;
  els.editSearchMeta.textContent =
    visible === 0
      ? `Ningún competidor coincide con “${els.editSearch.value.trim()}”.`
      : `Mostrando ${visible} de ${rows.length}`;
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
    await refreshAliases();
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
    await refreshAliases();
  } catch (err) {
    showBanner(err.message || String(err), true);
  }
}

function wireAliasesPanel() {
  if (!els.aliasForm) return;

  const syncPreview = () => {
    updateAliasKeyPreview(els.aliasFrom, els.aliasFromKey);
    updateAliasKeyPreview(els.aliasTo, els.aliasToKey);
    renderAliasHints();
  };
  els.aliasFrom.addEventListener("input", syncPreview);
  els.aliasTo.addEventListener("input", syncPreview);

  els.aliasForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await onSaveAlias();
  });
}

function updateAliasKeyPreview(input, previewEl) {
  if (!input || !previewEl) return;
  const raw = String(input.value || "").trim();
  const key = normalizeAliasInput(raw);
  if (!key || key === raw) {
    previewEl.hidden = true;
    previewEl.textContent = "";
    return;
  }
  previewEl.hidden = false;
  previewEl.textContent = key;
}

function labelForKey(key) {
  const found = aliasesState.names.find((n) => n.key === key);
  if (found?.label) return found.label;
  return displayFromKey(key);
}

function applyAliasesPayload(body) {
  aliasesState = {
    aliases: Array.isArray(body.aliases) ? body.aliases : [],
    names: Array.isArray(body.names) ? body.names : [],
  };
  renderAliasesUi();
}

async function refreshAliases() {
  if (!els.aliasesList) return;
  try {
    const res = await fetch("/api/aliases");
    const body = await res.json();
    if (!res.ok || body.ok === false) throw new Error(body.error || "No se pudieron cargar aliases");
    applyAliasesPayload(body);
  } catch {
    els.aliasesList.innerHTML = `<li class="alias-empty">No hay API de aliases (¿publish-server corriendo?).</li>`;
    if (els.aliasHints) els.aliasHints.hidden = true;
  }
}

function renderAliasHints() {
  if (!els.aliasHints) return;
  const fromKey = normalizeAliasInput(els.aliasFrom?.value);
  if (!fromKey || !fromKey.startsWith("name:")) {
    els.aliasHints.hidden = true;
    els.aliasHints.innerHTML = "";
    return;
  }

  const aliasesDoc = { aliases: aliasesState.aliases };
  const people = aliasesState.names;
  const spelling = spellingNearMatches(fromKey, people, aliasesDoc);
  const surnamePeers = peersWithSameSurname(fromKey, people, aliasesDoc, {
    maxGroup: 5,
    limit: 5,
  });

  const parts = [];

  if (spelling.length) {
    parts.push(`<p class="alias-hints-label">Parecido (posible typo)</p>
      <div class="alias-hint-chips">${spelling
        .map(
          (p) =>
            `<button type="button" class="alias-chip" data-alias-fill-to="${escapeAttr(p.key)}">${escapeHtml(p.label)}</button>`
        )
        .join("")}</div>`);
  }

  if (surnamePeers.peers.length) {
    parts.push(`<p class="alias-hints-label">Mismo apellido “${escapeHtml(surnamePeers.surname)}” <span class="alias-hints-note">(poco común en temporada)</span></p>
      <div class="alias-hint-chips">${surnamePeers.peers
        .map(
          (p) =>
            `<button type="button" class="alias-chip" data-alias-fill-to="${escapeAttr(p.key)}">${escapeHtml(p.label)}</button>`
        )
        .join("")}</div>`);
  } else if (surnamePeers.suppressed) {
    parts.push(
      `<p class="alias-hints-note">Hay muchos con apellido “${escapeHtml(surnamePeers.surname)}” — elige el canónico a mano (autocomplete).</p>`
    );
  }

  if (!parts.length) {
    els.aliasHints.hidden = true;
    els.aliasHints.innerHTML = "";
    return;
  }

  els.aliasHints.hidden = false;
  els.aliasHints.innerHTML = parts.join("");
  els.aliasHints.querySelectorAll("[data-alias-fill-to]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-alias-fill-to");
      if (!els.aliasTo || !key) return;
      els.aliasTo.value = labelForKey(key);
      updateAliasKeyPreview(els.aliasTo, els.aliasToKey);
      els.aliasTo.focus();
    });
  });
}

function renderAliasesUi() {
  if (els.aliasNamesList) {
    els.aliasNamesList.innerHTML = aliasesState.names
      .map((n) => `<option value="${escapeAttr(n.label)}"></option>`)
      .join("");
  }

  if (els.aliasesList) {
    const list = aliasesState.aliases;
    els.aliasesList.innerHTML = list.length
      ? list
          .map((a) => {
            const fromLabel = labelForKey(a.from);
            const toLabel = labelForKey(a.to);
            return `<li>
              <div class="alias-pair">
                <span class="alias-from">${escapeHtml(fromLabel)}</span>
                <span class="alias-sep">→</span>
                <span class="alias-to">${escapeHtml(toLabel)}</span>
                ${a.nota ? `<span class="alias-nota">${escapeHtml(a.nota)}</span>` : ""}
                <span class="alias-keys">${escapeHtml(a.from)} → ${escapeHtml(a.to)}</span>
              </div>
              <button type="button" class="btn-danger btn-sm" data-alias-remove="${escapeAttr(a.from)}">Quitar</button>
            </li>`;
          })
          .join("")
      : `<li class="alias-empty">Ningún alias aún.</li>`;

    els.aliasesList.querySelectorAll("[data-alias-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        onRemoveAlias(btn.getAttribute("data-alias-remove"));
      });
    });
  }

  renderAliasHints();
}

async function onSaveAlias(preset) {
  const fromRaw = preset?.from ?? els.aliasFrom?.value;
  const toRaw = preset?.to ?? els.aliasTo?.value;
  const nota = preset?.nota ?? els.aliasNota?.value ?? "";
  const from = normalizeAliasInput(fromRaw);
  const to = normalizeAliasInput(toRaw);
  if (!from || !to) {
    showBanner("Indica ambos nombres para unificar.", true);
    return;
  }
  if (from === to) {
    showBanner("Los dos nombres ya son la misma clave.", true);
    return;
  }

  if (els.btnAliasSave) els.btnAliasSave.disabled = true;
  showBanner("Unificando y regenerando temporada…", false);
  try {
    const res = await fetch("/api/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, nota: nota.trim() || undefined }),
    });
    const body = await res.json();
    if (!res.ok || body.ok === false) throw new Error(body.error || "Error al guardar alias");
    applyAliasesPayload(body);
    if (els.aliasForm) els.aliasForm.reset();
    updateAliasKeyPreview(els.aliasFrom, els.aliasFromKey);
    updateAliasKeyPreview(els.aliasTo, els.aliasToKey);
    showBanner(
      `Unificado: ${displayFromKey(from)} → ${displayFromKey(to)}. Publica para el sitio.`,
      false
    );
    await refreshStatus();
  } catch (err) {
    showBanner(err.message || String(err), true);
  } finally {
    if (els.btnAliasSave) els.btnAliasSave.disabled = false;
  }
}

async function onRemoveAlias(from) {
  if (!from) return;
  if (!confirm(`¿Quitar el alias de “${displayFromKey(from)}”?`)) return;

  showBanner("Quitando alias y regenerando temporada…", false);
  try {
    const res = await fetch("/api/aliases/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from }),
    });
    const body = await res.json();
    if (!res.ok || body.ok === false) throw new Error(body.error || "Error al quitar alias");
    applyAliasesPayload(body);
    showBanner("Alias eliminado. Publica para actualizar el sitio.", false);
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
