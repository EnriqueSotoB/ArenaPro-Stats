/** Consola local admin — requiere publish-server.mjs */

let pendingEvento = null;
let pendingFileName = "";

const els = {
  statusMeta: document.getElementById("statusMeta"),
  banner: document.getElementById("banner"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  fileInfo: document.getElementById("fileInfo"),
  preview: document.getElementById("preview"),
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
    pendingFileName = file.name;
    els.fileInfo.textContent = `Archivo: ${file.name}`;
    renderPreview(data);
    const temp =
      data.temporada ||
      els.temporadaInput.value ||
      (await fetchStatusSafe())?.temporadaActiva ||
      "";
    els.temporadaInput.value = temp;
    els.btnIngest.disabled = false;
    showBanner(`Listo para agregar: ${data.nombreEvento || file.name}`, false);
  } catch (err) {
    pendingEvento = null;
    els.btnIngest.disabled = true;
    els.preview.classList.add("empty-preview");
    els.preview.textContent = "No se pudo leer el JSON.";
    showBanner(err.message || String(err), true);
  }
}

function renderPreview(data) {
  els.preview.classList.remove("empty-preview");
  const lines = [
    data.nombreEvento || data.eventoId || "Sin nombre",
    [data.fecha, data.sede].filter(Boolean).join(" · "),
    `${(data.resultados || []).length} filas de resultado`,
    `${(data.categorias || []).length} categorías`,
  ].filter(Boolean);
  els.preview.innerHTML = lines.map((l) => `<div>${escapeHtml(l)}</div>`).join("");
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
    pendingFileName = "";
    els.fileInfo.textContent = "";
    els.fileInput.value = "";
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

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
