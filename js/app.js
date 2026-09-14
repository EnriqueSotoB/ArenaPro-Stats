const MANIFEST_URL = "data/manifest.json";
const TEMPORADA_URL = "data/temporada.json";

const els = {
  eventoSelect: document.getElementById("eventoSelect"),
  fileInput: document.getElementById("fileInput"),
  status: document.getElementById("status"),
  eventoMeta: document.getElementById("eventoMeta"),
  eventoTables: document.getElementById("eventoTables"),
  tempMeta: document.getElementById("tempMeta"),
  tempTable: document.getElementById("tempTable"),
};

let manifest = null;
let temporada = null;

init().catch((err) => setStatus(err.message || String(err), true));

async function init() {
  setStatus("Cargando datos…");
  const [m, t] = await Promise.all([
    fetchJson(MANIFEST_URL),
    fetchJson(TEMPORADA_URL),
  ]);
  manifest = m;
  temporada = t;
  fillEventoSelect(manifest.eventos || []);
  renderTemporada(temporada);

  if (manifest.eventos?.length) {
    await loadEventoByPath(manifest.eventos[0].file);
  } else {
    els.eventoMeta.textContent = "No hay eventos en data/manifest.json";
    els.eventoTables.innerHTML = `<p class="empty">Agrega un JSON en data/eventos/ y regístralo en el manifest.</p>`;
  }

  els.eventoSelect.addEventListener("change", async () => {
    const file = els.eventoSelect.value;
    if (file) await loadEventoByPath(file);
  });

  els.fileInput.addEventListener("change", async () => {
    const file = els.fileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      renderEvento(normalizeEvento(data, file.name));
      setStatus(`Vista previa local: ${file.name} (no se guarda en el repo)`);
    } catch (err) {
      setStatus(`No se pudo leer el archivo: ${err.message}`, true);
    }
  });

  setStatus("");
}

function fillEventoSelect(eventos) {
  els.eventoSelect.innerHTML = "";
  for (const ev of eventos) {
    const opt = document.createElement("option");
    opt.value = ev.file;
    opt.textContent = `${ev.fecha || "—"} · ${ev.nombre || ev.id}`;
    els.eventoSelect.appendChild(opt);
  }
}

async function loadEventoByPath(relativePath) {
  setStatus("Cargando evento…");
  const data = await fetchJson(`data/${relativePath}`);
  renderEvento(normalizeEvento(data));
  setStatus("");
}

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

function renderEvento(evento) {
  const parts = [evento.nombreEvento, evento.fecha, evento.sede, evento.temporada ? `Temp. ${evento.temporada}` : ""]
    .filter(Boolean);
  els.eventoMeta.textContent = parts.join(" · ");

  if (!evento.resultados.length) {
    els.eventoTables.innerHTML = `<p class="empty">Sin resultados en este archivo.</p>`;
    return;
  }

  const byCat = groupBy(evento.resultados, (r) => r.categoriaId || "_");
  const catMap = Object.fromEntries(
    (evento.categorias || []).map((c) => [c.id || "_", c])
  );

  const blocks = [];
  for (const [catId, rows] of Object.entries(byCat)) {
    const cat = catMap[catId] || { nombre: catId === "_" ? "Sin categoría" : catId, tipo: "" };
    const ranking = buildEventoRanking(rows, cat);
    blocks.push(renderCategoriaTable(cat, ranking));
  }
  els.eventoTables.innerHTML = blocks.join("");
}

function buildEventoRanking(rows, cat) {
  const byCompetidor = groupBy(rows, (r) => r.competidorId || r.inscripcionId || r.nombre || "anon");
  const entries = [];

  for (const [, comps] of Object.entries(byCompetidor)) {
    const sample = comps[0];
    const esPuntos = cat.tipo && /Jineteos|Montura|Pretal/i.test(cat.tipo);
    const noTime = comps.some((r) => r.esNoTime);
    const tiempos = comps
      .filter((r) => r.tiempoOficial != null && !r.esNoTime)
      .map((r) => Number(r.tiempoOficial));
    const puntosDisc = comps
      .map((r) => r.puntos)
      .filter((p) => p != null)
      .map(Number);
    const puntosCircuito = comps
      .map((r) => r.puntosCircuito)
      .filter((p) => p != null)
      .map(Number);

    const mejorTiempo = tiempos.length ? Math.min(...tiempos) : null;
    const sumaTiempos = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) : null;
    const puntosCalif = puntosDisc.length ? Math.max(...puntosDisc) : null;
    const ptsCirc = puntosCircuito.length ? Math.max(...puntosCircuito) : null;

    entries.push({
      nombre: sample.nombre || sample.competidorId || "—",
      equipo: sample.equipo || "",
      noTime,
      mejorTiempo,
      sumaTiempos,
      puntosCalif,
      puntosCircuito: ptsCirc,
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
    if (a.esPuntos) {
      const pa = a.puntosCalif ?? -1;
      const pb = b.puntosCalif ?? -1;
      return pb - pa;
    }
    const ta = a.sumaTiempos ?? a.mejorTiempo;
    const tb = b.sumaTiempos ?? b.mejorTiempo;
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return ta - tb;
  });

  return entries.map((e, i) => ({ ...e, lugar: i + 1 }));
}

function renderCategoriaTable(cat, ranking) {
  const subtitle = [cat.nombre, cat.tipo, cat.numeroRondas ? `${cat.numeroRondas} rondas` : ""]
    .filter(Boolean)
    .join(" · ");

  const esPuntos = ranking.some((r) => r.esPuntos);
  const head = esPuntos
    ? `<th class="num">Lugar</th><th>Competidor</th><th>Equipo</th><th>Detalle</th><th class="num">Puntos</th><th class="num">Circuito</th>`
    : `<th class="num">Lugar</th><th>Competidor</th><th>Equipo</th><th>Detalle</th><th class="num">Tiempo</th><th class="num">Circuito</th>`;

  const body = ranking
    .map((r) => {
      const mark = r.noTime ? `<span class="badge badge-nt">No Time</span>` : "";
      const valor = esPuntos
        ? r.noTime
          ? "—"
          : fmtNum(r.puntosCalif)
        : r.noTime
          ? "—"
          : fmtTime(r.sumaTiempos ?? r.mejorTiempo);
      const circ =
        r.puntosCircuito != null
          ? `<span class="badge badge-pts">${fmtNum(r.puntosCircuito)}</span>`
          : "—";
      return `<tr>
        <td class="num">${r.lugar}</td>
        <td>${escapeHtml(r.nombre)} ${mark}</td>
        <td>${escapeHtml(r.equipo || "—")}</td>
        <td>${escapeHtml(r.detalleVueltas)}</td>
        <td class="num">${valor}</td>
        <td class="num">${circ}</td>
      </tr>`;
    })
    .join("");

  return `<div class="cat-block">
    <h3>${escapeHtml(subtitle)}</h3>
    <div class="table-wrap">
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${body || `<tr><td colspan="6">Sin filas</td></tr>`}</tbody>
      </table>
    </div>
  </div>`;
}

function renderTemporada(data) {
  if (!data || !Array.isArray(data.standings) || !data.standings.length) {
    els.tempMeta.textContent = "Sin acumulado todavía";
    els.tempTable.innerHTML = `<p class="empty">Ejecuta <code>node scripts/rebuild-temporada.mjs</code> tras agregar eventos.</p>`;
    return;
  }

  els.tempMeta.textContent = [
    data.temporada ? `Temporada ${data.temporada}` : "",
    data.actualizadoEn ? `Actualizado ${data.actualizadoEn.slice(0, 10)}` : "",
    `${data.eventosContados ?? data.standings.length} eventos`,
  ]
    .filter(Boolean)
    .join(" · ");

  const byCat = groupBy(data.standings, (s) => s.categoriaNombre || s.categoriaId || "General");
  const blocks = [];

  for (const [catName, rows] of Object.entries(byCat)) {
    const sorted = [...rows].sort((a, b) => (b.puntosTotales ?? 0) - (a.puntosTotales ?? 0));
    const body = sorted
      .map((r, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td>${escapeHtml(r.nombre || r.competidorId || "—")}</td>
        <td>${escapeHtml(r.equipo || "—")}</td>
        <td class="num">${r.eventos ?? "—"}</td>
        <td class="num">${fmtNum(r.puntosTotales)}</td>
      </tr>`)
      .join("");

    blocks.push(`<div class="cat-block">
      <h3>${escapeHtml(catName)}</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="num">#</th>
              <th>Competidor</th>
              <th>Equipo</th>
              <th class="num">Eventos</th>
              <th class="num">Puntos</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`);
  }

  els.tempTable.innerHTML = blocks.join("");
}

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

function setStatus(msg, isError = false) {
  els.status.textContent = msg || "";
  els.status.classList.toggle("error", Boolean(isError && msg));
}
