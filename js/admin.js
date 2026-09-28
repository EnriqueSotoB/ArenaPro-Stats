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
  editsFromStoredEvento,
  listEditableFilas,
  upsertFilaEdit,
} from "../scripts/lib/stats-edits.mjs";
import { normalizeAliasInput } from "../scripts/lib/alias-store.mjs";
import {
  displayFromKey,
  peersWithSameSurname,
  spellingNearMatches,
} from "../scripts/lib/alias-suggest.mjs";
import { circuitosPorAsociacion, findCircuito, tipoAsociacionLabel } from "../scripts/lib/circuitos.mjs";
import { disciplinaKey } from "../scripts/lib/disciplinas.mjs";
import { isTeamRopingBase, parseTeamRopingPair } from "../scripts/lib/team-roping.mjs";
import { nombreMayusculas } from "../scripts/lib/nombres.mjs";

const LAST_CIRCUITOS_KEY = "arenapro.admin.circuitos";
/** La consola local inyecta un token por arranque; sin él rechaza cualquier cambio (CSRF). */
const API_TOKEN = document.querySelector('meta[name="arenapro-token"]')?.content || "";

function apiFetch(url, options = {}) {
  return fetch(url, { ...options, headers: { ...options.headers, "X-ArenaPro-Token": API_TOKEN } });
}

/** Última respuesta de /api/status (asociaciones, circuitos, eventos). */
let statusData = { asociaciones: [], circuitos: [], circuitoDefault: "", eventos: [] };
/** Circuitos marcados para el evento en revisión. @type {string[]} */
let selectedCircuitos = [];

let pendingEvento = null;
/** @type {ReturnType<typeof buildDefaultEdits>|null} */
let pendingEdits = null;
let previewCatId = null;
const expandedRows = new Set();
/** Id (manifest) del evento ya cargado que se está corrigiendo; null = evento nuevo. */
let editingId = null;

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
  circuitosPickList: document.getElementById("circuitosPickList"),
  circuitosTree: document.getElementById("circuitosTree"),
  circuitoForm: document.getElementById("circuitoForm"),
  circuitoFormTitle: document.getElementById("circuitoFormTitle"),
  circuitoId: document.getElementById("circuitoId"),
  circuitoAsociacion: document.getElementById("circuitoAsociacion"),
  circuitoNombre: document.getElementById("circuitoNombre"),
  circuitoTemporada: document.getElementById("circuitoTemporada"),
  circuitoPrincipal: document.getElementById("circuitoPrincipal"),
  btnCircuitoSave: document.getElementById("btnCircuitoSave"),
  circuitoDialog: document.getElementById("circuitoDialog"),
  btnNuevoCircuito: document.getElementById("btnNuevoCircuito"),
  asociacionDialog: document.getElementById("asociacionDialog"),
  btnNuevaAsociacion: document.getElementById("btnNuevaAsociacion"),
  asociacionForm: document.getElementById("asociacionForm"),
  asociacionFormTitle: document.getElementById("asociacionFormTitle"),
  asociacionId: document.getElementById("asociacionId"),
  asociacionSiglas: document.getElementById("asociacionSiglas"),
  asociacionNombre: document.getElementById("asociacionNombre"),
  asociacionTipo: document.getElementById("asociacionTipo"),
  asociacionEstado: document.getElementById("asociacionEstado"),
  asociacionHashtags: document.getElementById("asociacionHashtags"),
  asociacionLazadorRepetido: document.getElementById("asociacionLazadorRepetido"),
  asociacionLogo: document.getElementById("asociacionLogo"),
  asociacionLogoActual: document.getElementById("asociacionLogoActual"),
  asociacionLogoImg: document.getElementById("asociacionLogoImg"),
  btnAsociacionLogoRemove: document.getElementById("btnAsociacionLogoRemove"),
  portalCredencial: document.getElementById("portalCredencial"),
  portalCredencialTexto: document.getElementById("portalCredencialTexto"),
  btnPortalCopiar: document.getElementById("btnPortalCopiar"),
  btnPortalCerrar: document.getElementById("btnPortalCerrar"),
  btnAsociacionSave: document.getElementById("btnAsociacionSave"),
  btnIngest: document.getElementById("btnIngest"),
  btnCancelEdit: document.getElementById("btnCancelEdit"),
  btnPublish: document.getElementById("btnPublish"),
  pagesLink: document.getElementById("pagesLink"),
  dirtyNote: document.getElementById("dirtyNote"),
  eventosList: document.getElementById("eventosList"),
  btnDownloadPlantilla: document.getElementById("btnDownloadPlantilla"),
  aliasForm: document.getElementById("aliasForm"),
  aliasFrom: document.getElementById("aliasFrom"),
  aliasTo: document.getElementById("aliasTo"),
  aliasNota: document.getElementById("aliasNota"),
  aliasAsociacion: document.getElementById("aliasAsociacion"),
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
  els.btnCancelEdit.addEventListener("click", () => {
    resetPending();
    showBanner("Edición cancelada. El evento quedó como estaba.", false);
  });
  els.btnPublish.addEventListener("click", onPublish);
  els.banner.addEventListener("click", () => {
    els.banner.hidden = true;
  });
  wireCircuitosPanel();
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
      const res = await apiFetch("/api/parse-excel", {
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

    setEditing(null);
    setSelectedCircuitos(lastUsedCircuitos());
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

function setEditing(id) {
  editingId = id || null;
  els.btnIngest.textContent = editingId ? "Guardar cambios" : "Agregar a Estadísticas";
  els.btnCancelEdit.hidden = !editingId;
  els.eventosList.querySelectorAll("li[data-ev-id]").forEach((li) => {
    li.classList.toggle("is-editing", li.getAttribute("data-ev-id") === editingId);
  });
}

async function onEdit(id, nombre) {
  if (!id) return;
  if (pendingEvento && !confirm("Hay un evento en revisión sin guardar. ¿Descartarlo y editar este?")) {
    return;
  }
  showBanner(`Abriendo ${nombre || id}…`, false);
  try {
    const res = await apiFetch(`/api/evento?id=${encodeURIComponent(id)}`);
    const body = await res.json();
    if (!res.ok || body.ok === false) throw new Error(body.error || "No se pudo abrir el evento");

    const { evento, edits } = editsFromStoredEvento(body.evento);
    setSelectedCircuitos(body.entry?.circuitos || []);

    pendingEvento = evento;
    pendingEdits = edits;
    previewCatId = null;
    expandedRows.clear();
    els.fileInput.value = "";
    setEditing(id);

    els.fileInfo.textContent = `Editando evento ya cargado: ${body.entry?.nombre || id}. Lo que desmarques se borra de este evento.`;
    refreshPreviewUi();
    showBanner(
      `Editando: ${body.entry?.nombre || id}. Corrige y pulsa "Guardar cambios"; la temporada se recalcula sola.`,
      false
    );
    document.getElementById("step2")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    showBanner(err.message || String(err), true);
  }
}

function resetPending() {
  setEditing(null);
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
  const primero = findCircuito(statusData, selectedCircuitos[0]);
  if (primero) applied.temporada = primero.temporada;
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
  els.btnIngest.disabled = included.length === 0 || selectedCircuitos.length === 0;

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
  const circuitos = selectedCircuitos
    .map((id) => findCircuito(statusData, id)?.nombre)
    .filter(Boolean);
  const lines = [
    evento.nombreEvento || evento.eventoId || "Sin nombre",
    [evento.fecha, evento.sede].filter(Boolean).join(" · "),
    circuitos.length ? `Cuenta para: ${circuitos.join(" · ")}` : "Sin circuito elegido",
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
  const cat = (pendingEvento?.categorias || []).find((c) => String(c.id) === String(catId));
  const esLazo = isTeamRopingBase(disciplinaKey(cat || {}));
  const ayudaSelect = (r) => {
    const pair = parseTeamRopingPair(r.nombre);
    const opt = (value, label) =>
      `<option value="${value}"${r.lazoAyuda === value ? " selected" : ""}>${escapeHtml(label)}</option>`;
    return `<select data-field="lazoAyuda" title="El compañero de ayuda no suma puntos, sí dinero (FMR 1.13.10 d)">
        ${opt("", "No")}
        ${opt("header", pair ? `Cabecero: ${pair.header}` : "Cabecero")}
        ${opt("heeler", pair ? `Pialador: ${pair.heeler}` : "Pialador")}
      </select>`;
  };
  els.editTable.innerHTML = `<table class="edit-table">
    <thead>
      <tr>
        <th>Incluir</th>
        <th>Nombre</th>
        <th>Pts circuito</th>
        <th>$ MXN</th>
        ${esLazo ? "<th>Lazo de ayuda</th>" : ""}
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
            ${esLazo ? `<td>${ayudaSelect(r)}</td>` : ""}
          </tr>`;
        })
        .join("")}
    </tbody>
  </table>
  ${esLazo ? `<p class="meta">Lazo de ayuda: el compañero de ayuda no suma puntos, pero sí su parte del dinero; su pareja cuenta normal (Reglamento FMR 1.13.10 d y 5.12 e).</p>` : ""}`;

  els.editTable.querySelectorAll("tr[data-key]").forEach((tr) => {
    const key = tr.getAttribute("data-key");
    tr.querySelector('select[data-field="lazoAyuda"]')?.addEventListener("change", (e) => {
      upsertFilaEdit(pendingEdits, key, { lazoAyuda: e.target.value });
      refreshPreviewOnly();
    });
    tr.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => {
        const field = input.getAttribute("data-field");
        if (field === "incluir") {
          upsertFilaEdit(pendingEdits, key, { excluir: !input.checked });
          tr.classList.toggle("is-excluded", !input.checked);
        } else if (field === "nombre") {
          input.value = nombreMayusculas(input.value);
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
  els.btnIngest.disabled = included.length === 0 || selectedCircuitos.length === 0;
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
  if (!selectedCircuitos.length) {
    showBanner("Elige al menos un circuito (asociación y temporada) para el evento.", true);
    return;
  }
  const replaceId = editingId;
  if (
    replaceId &&
    !confirm(
      `¿Guardar los cambios en "${pendingEvento.nombreEvento || replaceId}"?\n\nSe reemplaza el evento y se recalcula la temporada. Luego publica para que se vea en el sitio.`
    )
  ) {
    return;
  }
  els.btnIngest.disabled = true;
  showBanner(replaceId ? "Guardando cambios…" : "Agregando evento…", false);
  try {
    const enviar = (permitirDuplicado) =>
      apiFetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: pendingEvento,
          circuitos: selectedCircuitos,
          statsEdits: pendingEdits,
          replaceId,
          permitirDuplicado,
        }),
      });
    let res = await enviar(false);
    let body = await res.json();
    if (
      body.duplicado &&
      confirm(`${body.error}\n\n¿Agregarlo de todos modos? Solo si de verdad son dos rodeos distintos.`)
    ) {
      res = await enviar(true);
      body = await res.json();
    }
    if (!res.ok || body.ok === false) throw new Error(body.error || "Error al guardar");
    localStorage.setItem(LAST_CIRCUITOS_KEY, JSON.stringify(selectedCircuitos));
    const warn =
      body.warnings?.length
        ? ` Avisos: ${body.warnings.join(" · ")}`
        : "";
    const nombres = (body.entry?.circuitos || [])
      .map((id) => findCircuito(statusData, id)?.nombre || id)
      .join(" · ");
    showBanner(
      `${replaceId ? "Actualizado" : "Agregado"}: ${body.entry?.nombre || body.file}. Cuenta para ${nombres}.${warn} Ya puedes publicar.`,
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
    const res = await apiFetch("/api/publish", { method: "POST" });
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

async function refreshStatus() {
  try {
    const res = await apiFetch("/api/status");
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      els.statusMeta.textContent =
        data.error ||
        "No hay API. Abre esta página con node scripts/publish-server.mjs (o publicar.bat).";
      els.btnPublish.disabled = true;
      return;
    }

    statusData = {
      asociaciones: data.asociaciones || [],
      circuitos: data.circuitos || [],
      circuitoDefault: data.circuitoDefault || "",
      eventos: data.eventos || [],
    };
    const principal = findCircuito(statusData, statusData.circuitoDefault);

    els.statusMeta.textContent = [
      principal ? `Principal: ${principal.nombre}` : "Sin circuitos: crea uno abajo",
      `${statusData.circuitos.length} circuito(s)`,
      data.branch ? `rama ${data.branch}` : "",
      data.dirty ? "hay cambios sin publicar" : "sin cambios pendientes",
    ]
      .filter(Boolean)
      .join(" · ");

    setSelectedCircuitos(selectedCircuitos.length ? selectedCircuitos : lastUsedCircuitos());
    renderCircuitosTree();
    renderAsociacionOptions();

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
            (e) => `<li class="ev-row${e.id === editingId ? " is-editing" : ""}" data-ev-id="${escapeAttr(e.id)}">
            <div class="ev-info">
              <span class="ev-name">${escapeHtml(e.nombre || e.id)}</span>
              <span class="ev-meta">${escapeHtml([e.fecha, e.sede].filter(Boolean).join(" · "))}</span>
              <span class="ev-circuitos">${
                (e.circuitos || []).length
                  ? e.circuitos
                      .map(
                        (id) =>
                          `<span class="badge badge-circuito">${escapeHtml(findCircuito(statusData, id)?.nombre || id)}</span>`
                      )
                      .join("")
                  : `<span class="badge badge-cut">Sin circuito: no suma</span>`
              }</span>
            </div>
            <div class="ev-actions">
              <button type="button" class="btn-secondary btn-sm" data-edit="${escapeAttr(e.id)}">Editar</button>
              <button type="button" class="btn-danger btn-sm" data-remove="${escapeAttr(e.id)}">Eliminar</button>
            </div>
          </li>`
          )
          .join("")
      : `<li class="ev-meta">Sin eventos aún.</li>`;

    els.eventosList.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const eventId = btn.getAttribute("data-edit");
        const nombre =
          btn.closest("li")?.querySelector(".ev-name")?.textContent?.trim() || eventId;
        onEdit(eventId, nombre);
      });
    });

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
    const res = await apiFetch("/api/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const body = await res.json();
    if (!res.ok || body.ok === false) throw new Error(body.error || "Error al eliminar");
    if (id === editingId) resetPending();
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

/* —— Circuitos del evento en revisión —— */

function lastUsedCircuitos() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_CIRCUITOS_KEY) || "[]");
    const valid = Array.isArray(saved) ? saved.filter((id) => findCircuito(statusData, id)) : [];
    if (valid.length) return valid;
  } catch {
    /* valor corrupto: usar default */
  }
  return statusData.circuitoDefault ? [statusData.circuitoDefault] : [];
}

function setSelectedCircuitos(ids) {
  selectedCircuitos = [...new Set(ids || [])].filter((id) => findCircuito(statusData, id));
  renderCircuitosPick();
}

function renderCircuitosPick() {
  if (!els.circuitosPickList) return;
  const grupos = circuitosPorAsociacion(statusData).filter((g) => g.circuitos.length);
  if (!grupos.length) {
    els.circuitosPickList.innerHTML = `<p class="meta">No hay circuitos. Crea uno en “Asociaciones y circuitos”.</p>`;
    return;
  }
  const selected = new Set(selectedCircuitos);
  els.circuitosPickList.innerHTML = grupos
    .map(
      (g) => `<div class="circuitos-pick-group">
        <p class="circuitos-pick-group-title">${escapeHtml(g.asociacion.siglas ? `${g.asociacion.siglas} · ${g.asociacion.nombre}` : g.asociacion.nombre)}</p>
        ${g.circuitos
          .map(
            (c) => `<label class="cherry-item">
              <input type="checkbox" data-circuito-id="${escapeAttr(c.id)}" ${selected.has(c.id) ? "checked" : ""} />
              <span>${escapeHtml(c.nombre)} <span class="meta">(temporada ${escapeHtml(c.temporada)})</span></span>
            </label>`
          )
          .join("")}
      </div>`
    )
    .join("");

  els.circuitosPickList.querySelectorAll("input[data-circuito-id]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.getAttribute("data-circuito-id");
      const set = new Set(selectedCircuitos);
      if (input.checked) set.add(id);
      else set.delete(id);
      selectedCircuitos = [...set];
      if (pendingEvento) refreshPreviewOnly();
    });
  });
}

/* —— Asociaciones y circuitos —— */

function wireCircuitosPanel() {
  wireDialog(els.circuitoDialog, resetCircuitoForm);
  wireDialog(els.asociacionDialog, resetAsociacionForm);
  els.btnNuevoCircuito?.addEventListener("click", () => {
    if (!statusData.asociaciones.length) {
      showBanner("Primero crea una asociación.", true);
      return;
    }
    resetCircuitoForm();
    openDialog(els.circuitoDialog, els.circuitoNombre);
  });
  els.btnNuevaAsociacion?.addEventListener("click", () => {
    resetAsociacionForm();
    openDialog(els.asociacionDialog, els.asociacionSiglas);
  });

  els.circuitoForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const principal = els.circuitoPrincipal.checked;
    setDialogMsg(els.circuitoDialog, "");
    els.btnCircuitoSave.disabled = true;
    const saved = await postConfig("/api/circuitos", {
      id: els.circuitoId.value || undefined,
      asociacionId: els.circuitoAsociacion.value,
      nombre: els.circuitoNombre.value,
      temporada: els.circuitoTemporada.value,
      principal,
    }, (body) => `Circuito guardado: ${body.circuito?.nombre}.${principal ? " Es el principal del sitio." : ""} Publica para el sitio.`);
    els.btnCircuitoSave.disabled = false;
    if (saved) els.circuitoDialog.close();
  });

  els.asociacionForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setDialogMsg(els.asociacionDialog, "");
    els.btnAsociacionSave.disabled = true;
    try {
      const saved = await postConfig("/api/asociaciones", {
        id: els.asociacionId.value || undefined,
        siglas: els.asociacionSiglas.value,
        nombre: els.asociacionNombre.value,
        tipo: els.asociacionTipo.value,
        estado: els.asociacionEstado.value,
        hashtags: els.asociacionHashtags.value,
        lazadorRepetido: els.asociacionLazadorRepetido.value,
      }, (body) => `Asociación guardada: ${body.asociacion?.siglas}. Publica para el sitio.`);
      if (!saved) return;
      const file = els.asociacionLogo.files?.[0];
      if (file && !(await uploadLogo(saved.asociacion.id, file))) {
        els.asociacionId.value = saved.asociacion.id;
        els.btnAsociacionSave.textContent = "Guardar asociación";
        return;
      }
      els.asociacionDialog.close();
    } finally {
      els.btnAsociacionSave.disabled = false;
    }
  });
  els.btnAsociacionLogoRemove?.addEventListener("click", async () => {
    const id = els.asociacionId.value;
    if (!id || !confirm("¿Quitar el logo de esta asociación?")) return;
    const ok = await postConfig("/api/asociaciones/logo/remove", { id }, () => "Logo quitado. Publica para el sitio.");
    if (ok) els.asociacionLogoActual.hidden = true;
  });

  els.btnPortalCopiar?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(els.portalCredencialTexto.value);
      showBanner("Mensaje copiado. Mándalo por WhatsApp o correo a la asociación.", false);
    } catch {
      els.portalCredencialTexto.select();
    }
  });
  els.btnPortalCerrar?.addEventListener("click", () => {
    els.portalCredencialTexto.value = "";
    els.portalCredencial.hidden = true;
  });
}

function portalUrl(asociacionId, publico = true) {
  const base = publico ? statusData.pagesUrl || "https://estadisticas.arenapro.mx/" : "/";
  return `${base}portal.html#${encodeURIComponent(asociacionId)}`;
}

async function darAccesoPortal(a) {
  const nueva = prompt(
    `Contraseña del portal de ${a.siglas || a.nombre}.\n\nDéjalo vacío para generar una segura, o escribe una de al menos 14 caracteres.` +
      (a.portal ? "\n\nLa contraseña anterior dejará de funcionar." : ""),
    ""
  );
  if (nueva === null) return;
  const body = await postConfig(
    "/api/asociaciones/portal",
    { id: a.id, password: nueva },
    () => `Acceso al portal listo para ${a.siglas || a.nombre}. Publica para activarlo.`
  );
  if (!body?.password) return;
  els.portalCredencialTexto.value = [
    `Portal ${a.siglas || a.nombre} — ArenaPro Estadísticas`,
    "",
    `Liga: ${portalUrl(a.id)}`,
    `Contraseña: ${body.password}`,
    "",
    "Ahí ven el tablero de su circuito y generan las imágenes para Facebook e Instagram.",
  ].join("\n");
  els.portalCredencial.hidden = false;
  els.portalCredencial.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function uploadLogo(asociacionId, file) {
  if (file.size > 2 * 1024 * 1024) {
    showBanner("El logo pesa más de 2 MB. Usa una versión más ligera.", true);
    return false;
  }
  showBanner("Subiendo logo…", false);
  try {
    const res = await apiFetch(`/api/asociaciones/logo?id=${encodeURIComponent(asociacionId)}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: await file.arrayBuffer(),
    });
    const body = await res.json();
    if (!res.ok || body.ok === false) throw new Error(body.error || "No se pudo subir el logo");
    showBanner(`Logo de ${body.asociacion.siglas || body.asociacion.nombre} guardado. Publica para el sitio.`, false);
    await refreshStatus();
    return true;
  } catch (err) {
    showBanner(err.message || String(err), true);
    return false;
  }
}

/** URL del logo con cache-busting (el archivo se reemplaza con el mismo nombre). */
function logoUrl(logo) {
  return logo ? `/data/${logo}?v=${Date.now()}` : "";
}

async function postConfig(url, payload, okMessage) {
  showBanner("Guardando y regenerando estadísticas…", false);
  try {
    const res = await apiFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok || body.ok === false) throw new Error(body.error || "No se pudo guardar");
    showBanner(okMessage(body), false);
    await refreshStatus();
    return body;
  } catch (err) {
    showBanner(err.message || String(err), true);
    return null;
  }
}

function resetCircuitoForm() {
  els.circuitoForm?.reset();
  els.circuitoId.value = "";
  els.circuitoFormTitle.textContent = "Nuevo circuito";
  els.btnCircuitoSave.textContent = "Crear circuito";
  renderAsociacionOptions();
}

function resetAsociacionForm() {
  els.asociacionForm?.reset();
  els.asociacionId.value = "";
  els.asociacionFormTitle.textContent = "Nueva asociación";
  els.btnAsociacionSave.textContent = "Crear asociación";
  els.asociacionLogoActual.hidden = true;
}

/** Cierra con la ✕, Cancelar, Esc o clic fuera; al cerrar deja el formulario limpio. */
function wireDialog(dialog, onClosed) {
  if (!dialog) return;
  dialog.querySelectorAll("[data-dialog-close]").forEach((btn) =>
    btn.addEventListener("click", () => dialog.close())
  );
  dialog.addEventListener("mousedown", (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    setDialogMsg(dialog, "");
    onClosed();
  });
}

function openDialog(dialog, focusEl) {
  if (!dialog) return;
  setDialogMsg(dialog, "");
  if (!dialog.open) dialog.showModal();
  dialog.querySelector(".dialog-body")?.scrollTo(0, 0);
  focusEl?.focus();
}

function setDialogMsg(dialog, msg) {
  const el = dialog?.querySelector(".dialog-msg");
  if (!el) return;
  el.hidden = !msg;
  el.textContent = msg || "";
}

function renderAsociacionOptions() {
  if (!els.circuitoAsociacion) return;
  const current = els.circuitoAsociacion.value;
  els.circuitoAsociacion.innerHTML = statusData.asociaciones
    .map(
      (a) => `<option value="${escapeAttr(a.id)}">${escapeHtml(a.siglas ? `${a.siglas} — ${a.nombre}` : a.nombre)}</option>`
    )
    .join("");
  if (current && statusData.asociaciones.some((a) => a.id === current)) {
    els.circuitoAsociacion.value = current;
  }

  if (els.aliasAsociacion) {
    const alcance = els.aliasAsociacion.value;
    els.aliasAsociacion.innerHTML = [
      `<option value="">Todas las asociaciones</option>`,
      ...statusData.asociaciones.map(
        (a) => `<option value="${escapeAttr(a.id)}">Solo ${escapeHtml(a.siglas || a.nombre)}</option>`
      ),
    ].join("");
    if (statusData.asociaciones.some((a) => a.id === alcance)) els.aliasAsociacion.value = alcance;
  }
}

function alcanceAliasLabel(asociacionId) {
  if (!asociacionId) return "Todas";
  const a = statusData.asociaciones.find((x) => x.id === asociacionId);
  return a ? `Solo ${a.siglas || a.nombre}` : `Solo ${asociacionId}`;
}

function renderCircuitosTree() {
  if (!els.circuitosTree) return;
  const grupos = circuitosPorAsociacion(statusData);
  if (!grupos.length) {
    els.circuitosTree.innerHTML = `<li class="tree-empty">Sin asociaciones. Crea la primera con <strong>+ Nueva asociación</strong>.</li>`;
    return;
  }
  els.circuitosTree.innerHTML = grupos
    .map((g) => {
      const a = g.asociacion;
      const nombreCorto = a.siglas || a.nombre || "";
      const circuitos = g.circuitos
        .map((c) => {
          const esPrincipal = c.id === statusData.circuitoDefault;
          return `<li class="tree-circuito">
            <div class="tree-circuito-info">
              <span class="tree-circuito-name">${escapeHtml(c.nombre)}</span>
              ${esPrincipal ? `<span class="pill pill-accent">Principal</span>` : ""}
              <span class="meta">Temporada ${escapeHtml(c.temporada)} · ${c.eventos ?? 0} ${(c.eventos ?? 0) === 1 ? "evento" : "eventos"}</span>
            </div>
            <div class="ev-actions">
              ${esPrincipal ? "" : `<button type="button" class="btn-ghost btn-sm" data-circuito-principal="${escapeAttr(c.id)}">Hacer principal</button>`}
              <button type="button" class="btn-ghost btn-sm" data-circuito-edit="${escapeAttr(c.id)}">Editar</button>
              <button type="button" class="btn-ghost btn-sm is-danger" data-circuito-remove="${escapeAttr(c.id)}">Eliminar</button>
            </div>
          </li>`;
        })
        .join("");
      const actions = a.id
        ? `<div class="ev-actions">
            <button type="button" class="btn-secondary btn-sm" data-asociacion-edit="${escapeAttr(a.id)}">Editar</button>
            <button type="button" class="btn-danger btn-sm" data-asociacion-remove="${escapeAttr(a.id)}">Eliminar</button>
          </div>`
        : "";
      const subtitulo = [a.siglas ? a.nombre : "", a.id ? tipoAsociacionLabel(a.tipo) : "", a.estado]
        .filter(Boolean)
        .join(" · ");
      const logo = a.logo
        ? `<img class="tree-logo" src="${escapeAttr(logoUrl(a.logo))}" alt="" />`
        : `<span class="tree-logo tree-logo-empty" aria-hidden="true">${escapeHtml(nombreCorto.slice(0, 2).toUpperCase())}</span>`;
      return `<li class="tree-card">
        <div class="tree-head">
          <div class="tree-id">
            ${logo}
            <div class="tree-id-text">
              <p class="tree-head-name">${escapeHtml(nombreCorto)}</p>
              <p class="meta">${escapeHtml(subtitulo)}</p>
            </div>
          </div>
          ${actions}
        </div>
        ${a.id ? `<dl class="tree-facts">
          <div><dt>Hashtags</dt><dd>${a.hashtags ? escapeHtml(a.hashtags) : `<span class="muted">Sin hashtags</span>`}</dd></div>
          <div><dt>Lazador en varias parejas</dt><dd>${a.lazadorRepetido === "sumar" ? "Suma completo" : "Regla FMR"}</dd></div>
        </dl>
        <div class="tree-portal">
          <div class="tree-portal-status">
            <span class="status-dot${a.portal ? " is-on" : ""}" aria-hidden="true"></span>
            <span>Portal ${a.portal ? "<strong>con acceso</strong>" : "sin acceso"}</span>
          </div>
          <div class="ev-actions">
            ${a.portal ? `<button type="button" class="btn-ghost btn-sm" data-portal-copy="${escapeAttr(a.id)}" title="${escapeAttr(portalUrl(a.id))}">Copiar liga</button>` : ""}
            <a class="btn-ghost btn-sm" href="${escapeAttr(portalUrl(a.id, false))}" target="_blank" rel="noopener">Abrir portal</a>
            <button type="button" class="btn-ghost btn-sm" data-portal-set="${escapeAttr(a.id)}">${a.portal ? "Nueva contraseña" : "Dar acceso"}</button>
            ${a.portal ? `<button type="button" class="btn-ghost btn-sm is-danger" data-portal-remove="${escapeAttr(a.id)}">Quitar acceso</button>` : ""}
          </div>
        </div>` : ""}
        <div class="tree-circuitos-head">
          <span class="tree-section-label">Circuitos</span>
          ${a.id ? `<button type="button" class="link-like" data-circuito-new="${escapeAttr(a.id)}">+ Agregar circuito</button>` : ""}
        </div>
        <ul class="tree-circuitos">${circuitos || `<li class="tree-empty">Sin circuitos todavía.</li>`}</ul>
      </li>`;
    })
    .join("");

  els.circuitosTree.querySelectorAll("[data-circuito-new]").forEach((btn) => {
    btn.addEventListener("click", () => {
      resetCircuitoForm();
      els.circuitoAsociacion.value = btn.getAttribute("data-circuito-new");
      openDialog(els.circuitoDialog, els.circuitoNombre);
    });
  });

  const circuitoById = (id) => statusData.circuitos.find((c) => c.id === id);

  els.circuitosTree.querySelectorAll("[data-circuito-principal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = circuitoById(btn.getAttribute("data-circuito-principal"));
      if (!c) return;
      postConfig("/api/circuitos", { ...c, principal: true }, () => `${c.nombre} es ahora el circuito principal. Publica para el sitio.`);
    });
  });

  els.circuitosTree.querySelectorAll("[data-circuito-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = circuitoById(btn.getAttribute("data-circuito-edit"));
      if (!c) return;
      resetCircuitoForm();
      els.circuitoId.value = c.id;
      els.circuitoAsociacion.value = c.asociacionId;
      els.circuitoNombre.value = c.nombre;
      els.circuitoTemporada.value = c.temporada;
      els.circuitoPrincipal.checked = c.id === statusData.circuitoDefault;
      els.circuitoFormTitle.textContent = `Editar ${c.nombre}`;
      els.btnCircuitoSave.textContent = "Guardar cambios";
      openDialog(els.circuitoDialog, els.circuitoNombre);
    });
  });

  els.circuitosTree.querySelectorAll("[data-circuito-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = circuitoById(btn.getAttribute("data-circuito-remove"));
      if (!c || !confirm(`¿Eliminar el circuito "${c.nombre}"?`)) return;
      postConfig("/api/circuitos/remove", { id: c.id }, () => `Circuito eliminado: ${c.nombre}. Publica para el sitio.`);
    });
  });

  els.circuitosTree.querySelectorAll("[data-asociacion-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = statusData.asociaciones.find((x) => x.id === btn.getAttribute("data-asociacion-edit"));
      if (!a) return;
      resetAsociacionForm();
      els.asociacionId.value = a.id;
      els.asociacionSiglas.value = a.siglas;
      els.asociacionNombre.value = a.nombre;
      els.asociacionTipo.value = a.tipo;
      els.asociacionEstado.value = a.estado || "";
      els.asociacionHashtags.value = a.hashtags || "";
      els.asociacionLazadorRepetido.value = a.lazadorRepetido || "fmr";
      els.asociacionLogo.value = "";
      els.asociacionLogoActual.hidden = !a.logo;
      if (a.logo) els.asociacionLogoImg.src = logoUrl(a.logo);
      els.asociacionFormTitle.textContent = `Editar ${a.siglas || a.nombre}`;
      els.btnAsociacionSave.textContent = "Guardar cambios";
      openDialog(els.asociacionDialog, els.asociacionNombre);
    });
  });

  els.circuitosTree.querySelectorAll("[data-asociacion-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = statusData.asociaciones.find((x) => x.id === btn.getAttribute("data-asociacion-remove"));
      if (!a || !confirm(`¿Eliminar la asociación "${a.siglas || a.nombre}"?`)) return;
      postConfig("/api/asociaciones/remove", { id: a.id }, () => `Asociación eliminada: ${a.siglas || a.nombre}.`);
    });
  });

  const asociacionById = (id) => statusData.asociaciones.find((x) => x.id === id);

  els.circuitosTree.querySelectorAll("[data-portal-set]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = asociacionById(btn.getAttribute("data-portal-set"));
      if (a) darAccesoPortal(a);
    });
  });

  els.circuitosTree.querySelectorAll("[data-portal-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const url = portalUrl(btn.getAttribute("data-portal-copy"));
      try {
        await navigator.clipboard.writeText(url);
        showBanner(`Liga copiada: ${url}`, false);
      } catch {
        prompt("Copia la liga del portal:", url);
      }
    });
  });

  els.circuitosTree.querySelectorAll("[data-portal-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = asociacionById(btn.getAttribute("data-portal-remove"));
      if (!a || !confirm(`¿Quitar el acceso al portal de ${a.siglas || a.nombre}? Su contraseña dejará de funcionar al publicar.`)) return;
      postConfig("/api/asociaciones/portal/remove", { id: a.id }, () => `Acceso al portal quitado. Publica para aplicarlo.`);
    });
  });
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
    const res = await apiFetch("/api/aliases");
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
                <span class="alias-nota">${escapeHtml(alcanceAliasLabel(a.asociacionId))}${a.nota ? ` · ${escapeHtml(a.nota)}` : ""}</span>
                <span class="alias-keys">${escapeHtml(a.from)} → ${escapeHtml(a.to)}</span>
              </div>
              <button type="button" class="btn-danger btn-sm" data-alias-remove="${escapeAttr(a.from)}" data-alias-scope="${escapeAttr(a.asociacionId || "")}">Quitar</button>
            </li>`;
          })
          .join("")
      : `<li class="alias-empty">Ningún alias aún.</li>`;

    els.aliasesList.querySelectorAll("[data-alias-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        onRemoveAlias(btn.getAttribute("data-alias-remove"), btn.getAttribute("data-alias-scope") || "");
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
    const res = await apiFetch("/api/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        nota: nota.trim() || undefined,
        asociacionId: preset?.asociacionId ?? els.aliasAsociacion?.value ?? "",
      }),
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

async function onRemoveAlias(from, asociacionId = "") {
  if (!from) return;
  if (!confirm(`¿Quitar el alias de “${displayFromKey(from)}” (${alcanceAliasLabel(asociacionId)})?`)) return;

  showBanner("Quitando alias y regenerando temporada…", false);
  try {
    const res = await apiFetch("/api/aliases/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, asociacionId }),
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

let bannerTimer = 0;

function showBanner(msg, isError) {
  const dialog = document.querySelector("dialog[open]");
  if (dialog && isError) {
    setDialogMsg(dialog, msg);
    return;
  }
  clearTimeout(bannerTimer);
  els.banner.hidden = !msg;
  els.banner.textContent = msg || "";
  els.banner.classList.toggle("is-error", Boolean(isError));
  els.banner.classList.toggle("is-ok", Boolean(msg && !isError));
  if (msg && !isError && !msg.endsWith("…")) {
    bannerTimer = setTimeout(() => {
      els.banner.hidden = true;
    }, 7000);
  }
}
