/**
 * Portal de asociaciones: tablero del circuito e imágenes para redes. Solo lectura;
 * publicar sigue siendo exclusivo del admin local.
 */

import { normalizeEvento, categoriesWithResults, escapeHtml, escapeAttr, fmtNum } from "./event-model.js";
import { fmtMxn } from "../scripts/lib/money.mjs";
import {
  normalizeManifest,
  findAsociacion,
  findCircuito,
  eventosDeCircuito,
  circuitoDataFile,
} from "../scripts/lib/circuitos.mjs";
import { verificarPassword, normalizePortal } from "../scripts/lib/portal-auth.mjs";
import { FORMATOS, TOPS, planPaginas, drawSocialCard, canvasToPngBlob } from "./social-card.js";
import {
  ALL_AROUND_ID,
  disciplinasDeTemporada,
  specTemporada,
  specEvento,
  withContexto,
  shareCaption,
  fmtFecha,
  publicUrl,
} from "./share-specs.js";
import { calcularTablero } from "./portal-stats.js";

const SESSION_PREFIX = "arenapro-portal:";
const ES_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

const $ = (id) => document.getElementById(id);
const els = {
  status: $("status"),
  portalTools: $("portalTools"),
  circuitoSelect: $("circuitoSelect"),
  btnSalir: $("btnSalir"),
  viewLogin: $("viewLogin"),
  viewPortal: $("viewPortal"),
  loginForm: $("loginForm"),
  loginLogo: $("loginLogo"),
  loginTitle: $("loginTitle"),
  loginAsociacionField: $("loginAsociacionField"),
  loginAsociacion: $("loginAsociacion"),
  loginPassword: $("loginPassword"),
  loginError: $("loginError"),
  btnEntrar: $("btnEntrar"),
  btnEntrarLocal: $("btnEntrarLocal"),
  portalLogo: $("portalLogo"),
  portalEyebrow: $("portalEyebrow"),
  portalTitle: $("portalTitle"),
  portalMeta: $("portalMeta"),
  linkPublico: $("linkPublico"),
  tabTablero: $("tabTablero"),
  tabRedes: $("tabRedes"),
  kpis: $("kpis"),
  chartEventos: $("chartEventos"),
  chartDisciplinas: $("chartDisciplinas"),
  panelDinero: $("panelDinero"),
  chartDinero: $("chartDinero"),
  tablaLideres: $("tablaLideres"),
  tablaActivos: $("tablaActivos"),
  fuenteTemporada: $("fuenteTemporada"),
  fuenteEvento: $("fuenteEvento"),
  redesDisciplina: $("redesDisciplina"),
  redesMetrica: $("redesMetrica"),
  redesEvento: $("redesEvento"),
  redesCategoria: $("redesCategoria"),
  redesCaption: $("redesCaption"),
  redesCompartir: $("redesCompartir"),
  redesDescargar: $("redesDescargar"),
  redesCopiar: $("redesCopiar"),
  redesHint: $("redesHint"),
  redesPreview: $("redesPreview"),
  redesPreviewLabel: $("redesPreviewLabel"),
  footerText: $("footerText"),
};

/** @type {any} */
let manifest = null;
/** @type {any} */
let asociacion = null;
let circuitoId = "";
/** @type {any} */
let temporada = null;
let tab = "tablero";
const circuitoCache = new Map();
const eventoCache = new Map();

const redes = {
  fuente: "temporada",
  disciplina: "",
  metrica: "puntos",
  eventoId: "",
  categoriaId: "",
  formato: "post",
  top: "top10",
  /** @type {any} */
  spec: null,
  /** @type {HTMLCanvasElement[]} */
  canvases: [],
  renderSeq: 0,
};

init().catch((err) => setStatus(err.message || String(err), true));

async function init() {
  setStatus("Cargando…");
  manifest = normalizeManifest(await fetchJson("data/manifest.json"));
  wireLogin();
  wirePortal();
  wireRedes();
  setStatus("");

  const [idHash, circuitoHash, tabHash] = parseHash();
  const a = findAsociacion(manifest, idHash);
  if (a && sesionValida(a)) {
    await entrar(a, circuitoHash, tabHash);
    return;
  }
  mostrarLogin(a);
}

function parseHash() {
  return (location.hash || "")
    .replace(/^#/, "")
    .split("/")
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
}

function syncHash() {
  if (!asociacion) return;
  const parts = [asociacion.id, circuitoId, tab].map(encodeURIComponent);
  history.replaceState(null, "", `#${parts.join("/")}`);
}

/* —— Acceso —— */

function sesionKey(a) {
  return `${SESSION_PREFIX}${a.id}`;
}

/** La sesión guarda el hash vigente: si el admin cambia la contraseña, se invalida sola. */
function sesionValida(a) {
  const portal = normalizePortal(a.portal);
  const guardado = localStorage.getItem(sesionKey(a));
  if (ES_LOCAL && guardado === "local") return true;
  return Boolean(portal && guardado && guardado === portal.hash);
}

function asociacionesConPortal() {
  return (manifest.asociaciones || []).filter((a) => ES_LOCAL || normalizePortal(a.portal));
}

function mostrarLogin(preseleccion) {
  els.viewPortal.hidden = true;
  els.portalTools.hidden = true;
  els.viewLogin.hidden = false;
  const lista = asociacionesConPortal();
  els.loginAsociacion.innerHTML = lista
    .map((a) => `<option value="${escapeAttr(a.id)}">${escapeHtml(a.siglas ? `${a.siglas} — ${a.nombre}` : a.nombre)}</option>`)
    .join("");
  if (preseleccion && lista.some((a) => a.id === preseleccion.id)) {
    els.loginAsociacion.value = preseleccion.id;
    els.loginAsociacionField.hidden = true;
  } else {
    els.loginAsociacionField.hidden = lista.length < 2;
  }
  els.btnEntrarLocal.hidden = !ES_LOCAL;
  syncLoginBrand();
  if (!lista.length) {
    els.loginError.hidden = false;
    els.loginError.textContent = "Todavía no hay asociaciones con acceso al portal.";
    els.btnEntrar.disabled = true;
  }
  els.loginPassword.focus();
}

function syncLoginBrand() {
  const a = findAsociacion(manifest, els.loginAsociacion.value);
  els.loginTitle.textContent = a ? `Portal ${a.siglas || a.nombre}` : "Entrar";
  els.loginLogo.hidden = !a?.logo;
  if (a?.logo) els.loginLogo.src = `data/${a.logo}`;
}

function wireLogin() {
  els.loginAsociacion.addEventListener("change", syncLoginBrand);
  els.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const a = findAsociacion(manifest, els.loginAsociacion.value);
    if (!a) return;
    els.btnEntrar.disabled = true;
    els.loginError.hidden = true;
    try {
      const ok = await verificarPassword(els.loginPassword.value, a.portal);
      if (!ok) throw new Error("Contraseña incorrecta.");
      localStorage.setItem(sesionKey(a), normalizePortal(a.portal).hash);
      els.loginPassword.value = "";
      await entrar(a);
    } catch (err) {
      els.loginError.hidden = false;
      els.loginError.textContent = err.message || String(err);
    } finally {
      els.btnEntrar.disabled = false;
    }
  });
  els.btnEntrarLocal.addEventListener("click", async () => {
    const a = findAsociacion(manifest, els.loginAsociacion.value);
    if (!a || !ES_LOCAL) return;
    localStorage.setItem(sesionKey(a), "local");
    await entrar(a);
  });
}

async function entrar(a, circuitoPreferido, tabPreferido) {
  asociacion = a;
  els.viewLogin.hidden = true;
  els.viewPortal.hidden = false;
  els.portalTools.hidden = false;
  els.portalLogo.hidden = !a.logo;
  if (a.logo) {
    els.portalLogo.src = `data/${a.logo}`;
    els.portalLogo.alt = `Logo ${a.siglas || a.nombre}`;
  }
  els.portalEyebrow.textContent = a.nombre || a.siglas;
  els.footerText.textContent = `${a.siglas || a.nombre} · Portal ArenaPro Estadísticas`;
  document.title = `Portal ${a.siglas || a.nombre} — ArenaPro Estadísticas`;

  const circuitos = circuitosDeAsociacion();
  els.circuitoSelect.innerHTML = circuitos
    .map((c) => `<option value="${escapeAttr(c.id)}">${escapeHtml(c.nombre)}</option>`)
    .join("");
  els.circuitoSelect.parentElement.hidden = circuitos.length < 2;

  if (!circuitos.length) {
    els.portalTitle.textContent = "Sin circuitos";
    els.portalMeta.textContent = "Esta asociación aún no tiene circuitos. ArenaPro los da de alta.";
    els.tabTablero.hidden = true;
    els.tabRedes.hidden = true;
    return;
  }
  const inicial = circuitos.find((c) => c.id === circuitoPreferido) || circuitos[0];
  setTab(tabPreferido === "redes" ? "redes" : "tablero", false);
  await usarCircuito(inicial.id);
}

function circuitosDeAsociacion() {
  return (manifest.circuitos || [])
    .filter((c) => c.asociacionId === asociacion?.id)
    .sort((a, b) => b.temporada.localeCompare(a.temporada, "es", { numeric: true }) || a.nombre.localeCompare(b.nombre, "es"));
}

function salir() {
  if (asociacion) localStorage.removeItem(sesionKey(asociacion));
  const a = asociacion;
  asociacion = null;
  history.replaceState(null, "", a ? `#${encodeURIComponent(a.id)}` : "#");
  mostrarLogin(a);
}

/* —— Circuito y pestañas —— */

function wirePortal() {
  els.btnSalir.addEventListener("click", salir);
  els.circuitoSelect.addEventListener("change", () => usarCircuito(els.circuitoSelect.value));
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.getAttribute("data-tab")));
  });
}

function setTab(next, render = true) {
  tab = next === "redes" ? "redes" : "tablero";
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-tab") === tab);
  });
  els.tabTablero.hidden = tab !== "tablero";
  els.tabRedes.hidden = tab !== "redes";
  syncHash();
  if (render && tab === "redes" && temporada) renderRedes();
}

async function usarCircuito(id) {
  const circuito = findCircuito(manifest, id);
  if (!circuito) return;
  circuitoId = circuito.id;
  els.circuitoSelect.value = circuitoId;
  setStatus("Cargando circuito…");
  if (!circuitoCache.has(circuitoId)) {
    let payload = null;
    try {
      payload = await fetchJson(`data/${circuitoDataFile(circuitoId)}`);
    } catch {
      /* circuito sin eventos todavía */
    }
    circuitoCache.set(circuitoId, payload || { circuitoId, temporada: circuito.temporada, eventosContados: 0, standings: [], allAround: [], competidores: [] });
  }
  temporada = circuitoCache.get(circuitoId);
  setStatus("");

  els.portalTitle.textContent = circuito.nombre;
  els.portalMeta.textContent = [
    circuito.temporada ? `Temporada ${circuito.temporada}` : "",
    temporada.actualizadoEn ? `Actualizado ${fmtFecha(temporada.actualizadoEn)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  els.linkPublico.href = publicUrl(`#${encodeURIComponent(circuitoId)}/temporada`);
  syncHash();

  renderTablero();
  prepararRedes();
  if (tab === "redes") await renderRedes();
}

/* —— Tablero —— */

function renderTablero() {
  const eventos = eventosDeCircuito(manifest, circuitoId);
  const t = calcularTablero(temporada, eventos);
  const k = t.kpis;
  const kpi = (label, value, sub = "") => `<div class="kpi">
      <span class="kpi-label">${escapeHtml(label)}</span>
      <span class="kpi-value">${escapeHtml(value)}</span>
      ${sub ? `<span class="kpi-sub">${escapeHtml(sub)}</span>` : ""}
    </div>`;
  els.kpis.innerHTML = [
    kpi("Eventos", fmtNum(k.eventos)),
    kpi("Competidores", fmtNum(k.competidores), `${k.pctRecurrentes}% corrió 2+ eventos`),
    kpi("Inscripciones", fmtNum(k.participaciones), k.eventos ? `${fmtNum(Math.round(k.participaciones / k.eventos))} por evento` : ""),
    kpi("Disciplinas", fmtNum(k.disciplinas)),
    kpi("Dinero repartido", fmtMxn(k.dinero), k.dinero ? "" : "Sin montos capturados"),
  ].join("");

  if (!t.porEvento.length) {
    const vacio = `<p class="empty-state">Este circuito aún no tiene eventos publicados.</p>`;
    els.chartEventos.innerHTML = vacio;
    els.chartDisciplinas.innerHTML = vacio;
    els.tablaLideres.innerHTML = vacio;
    els.tablaActivos.innerHTML = vacio;
    els.panelDinero.hidden = true;
    return;
  }

  els.chartEventos.innerHTML = `<div class="solo-ancho">${columnasSvg(t.porEvento)}</div>
    <div class="solo-movil">${barrasHtml(
      t.porEvento.map((e) => ({
        label: e.nombre,
        sub: `${fmtFecha(e.fecha)} · ${fmtNum(e.competidores)} competidores`,
        value: e.participaciones,
        text: fmtNum(e.participaciones),
      }))
    )}</div>`;
  els.chartDisciplinas.innerHTML = barrasHtml(
    t.porDisciplina.map((d) => ({ label: d.nombre, value: d.competidores, text: fmtNum(d.competidores) }))
  );
  const conDinero = t.porEvento.filter((e) => e.dinero > 0);
  els.panelDinero.hidden = !conDinero.length;
  els.chartDinero.innerHTML = barrasHtml(
    conDinero.map((e) => ({ label: e.nombre, sub: fmtFecha(e.fecha), value: e.dinero, text: fmtMxn(e.dinero) }))
  );

  els.tablaLideres.innerHTML = tablaHtml(
    ["Disciplina", "Líder", "Puntos", "Ventaja sobre 2º", "Competidores"],
    t.porDisciplina.map((d) => [
      escapeHtml(d.nombre),
      escapeHtml(d.lider?.nombre || "—"),
      fmtNum(d.lider?.puntos ?? 0),
      d.ventaja == null ? "—" : `${fmtNum(d.ventaja)} pts`,
      fmtNum(d.competidores),
    ]),
    [false, false, true, true, true]
  );
  els.tablaActivos.innerHTML = tablaHtml(
    ["#", "Competidor", "Eventos", "Disciplinas", "Puntos", "Dinero"],
    t.masActivos.map((c, i) => [
      String(i + 1),
      escapeHtml(c.nombre),
      fmtNum(c.eventos),
      fmtNum(c.disciplinas),
      fmtNum(c.puntos),
      c.dinero ? escapeHtml(fmtMxn(c.dinero)) : "—",
    ]),
    [true, false, true, true, true, true]
  );
}

function recortar(s, n) {
  const t = String(s || "");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Columnas por evento (orden cronológico): inscripciones y, encima, competidores distintos. */
function columnasSvg(eventos) {
  const W = 720;
  const H = 280;
  const top = 28;
  const bottom = 58;
  const left = 8;
  const plotH = H - top - bottom;
  const max = Math.max(1, ...eventos.map((e) => e.participaciones));
  const slot = (W - left * 2) / eventos.length;
  const barW = Math.min(64, slot * 0.6);
  const maxChars = Math.max(6, Math.floor(slot / 8));
  const cols = eventos
    .map((e, i) => {
      const cx = left + slot * i + slot / 2;
      const h = (e.participaciones / max) * plotH;
      const hc = (e.competidores / max) * plotH;
      const y = top + plotH - h;
      const yc = top + plotH - hc;
      return `<g>
        <title>${escapeHtml(`${e.nombre} · ${e.participaciones} inscripciones · ${e.competidores} competidores`)}</title>
        <rect x="${cx - barW / 2}" y="${y}" width="${barW}" height="${Math.max(h, 1)}" rx="6" class="col-bar" />
        <rect x="${cx - barW / 2 + barW * 0.2}" y="${yc}" width="${barW * 0.6}" height="${Math.max(hc, 1)}" rx="4" class="col-bar-2" />
        <text x="${cx}" y="${y - 8}" class="col-value">${e.participaciones}</text>
        <text x="${cx}" y="${H - bottom + 20}" class="col-label">${escapeHtml(recortar(e.nombre, maxChars))}</text>
        <text x="${cx}" y="${H - bottom + 38}" class="col-sub">${escapeHtml(fmtFecha(e.fecha))}</text>
      </g>`;
    })
    .join("");
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Participación por evento">
      <line x1="0" x2="${W}" y1="${top + plotH}" y2="${top + plotH}" class="col-axis" />
      ${cols}
    </svg>
    <p class="chart-legend"><span class="legend-dot is-bar"></span>Inscripciones <span class="legend-dot is-bar-2"></span>Competidores distintos</p>`;
}

function barrasHtml(items) {
  if (!items.length) return `<p class="empty-state">Sin datos.</p>`;
  const max = Math.max(1, ...items.map((i) => i.value));
  return `<ul class="bars">${items
    .map(
      (i) => `<li class="bar-row">
        <span class="bar-label">${escapeHtml(i.label)}${i.sub ? `<span class="bar-sub">${escapeHtml(i.sub)}</span>` : ""}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${((i.value / max) * 100).toFixed(1)}%"></span></span>
        <span class="bar-value">${escapeHtml(i.text)}</span>
      </li>`
    )
    .join("")}</ul>`;
}

function tablaHtml(headers, rows, numericas) {
  const th = headers.map((h, i) => `<th${numericas[i] ? ' class="num"' : ""}>${escapeHtml(h)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((c, i) => `<td${numericas[i] ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`)
    .join("");
  return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/* —— Redes sociales —— */

function wireRedes() {
  document.querySelectorAll("[data-fuente]").forEach((btn) =>
    btn.addEventListener("click", () => {
      redes.fuente = btn.getAttribute("data-fuente");
      renderRedes({ nuevoTexto: true });
    })
  );
  els.redesMetrica.querySelectorAll("[data-metrica]").forEach((btn) =>
    btn.addEventListener("click", () => {
      redes.metrica = btn.getAttribute("data-metrica");
      renderRedes({ nuevoTexto: true });
    })
  );
  document.querySelectorAll("[data-formato]").forEach((btn) =>
    btn.addEventListener("click", () => {
      redes.formato = btn.getAttribute("data-formato");
      renderRedes();
    })
  );
  document.querySelectorAll("[data-top]").forEach((btn) =>
    btn.addEventListener("click", () => {
      redes.top = btn.getAttribute("data-top");
      renderRedes();
    })
  );
  els.redesDisciplina.addEventListener("change", () => {
    redes.disciplina = els.redesDisciplina.value;
    renderRedes({ nuevoTexto: true });
  });
  els.redesEvento.addEventListener("change", async () => {
    redes.eventoId = els.redesEvento.value;
    redes.categoriaId = "";
    await renderRedes({ nuevoTexto: true });
  });
  els.redesCategoria.addEventListener("change", () => {
    redes.categoriaId = els.redesCategoria.value;
    renderRedes({ nuevoTexto: true });
  });
  els.redesDescargar.addEventListener("click", descargar);
  els.redesCopiar.addEventListener("click", copiarTexto);
  els.redesCompartir.addEventListener("click", compartir);
  els.redesCompartir.hidden = !puedeCompartirArchivos();
}

/** Llena selects de disciplina y evento para el circuito activo. */
function prepararRedes() {
  const discs = disciplinasDeTemporada(temporada);
  const opciones = [
    ...((temporada?.allAround || []).length ? [{ id: ALL_AROUND_ID, nombre: "Vaquero Completo" }] : []),
    ...discs,
  ];
  els.redesDisciplina.innerHTML = opciones
    .map((d) => `<option value="${escapeAttr(d.id)}">${escapeHtml(d.nombre)}${d.competidores ? ` (${d.competidores})` : ""}</option>`)
    .join("");
  if (!opciones.some((d) => d.id === redes.disciplina)) redes.disciplina = discs[0]?.id || opciones[0]?.id || "";
  els.redesDisciplina.value = redes.disciplina;

  const eventos = [...eventosDeCircuito(manifest, circuitoId)].sort((a, b) =>
    String(b.fecha || "").localeCompare(String(a.fecha || ""))
  );
  els.redesEvento.innerHTML = eventos
    .map((e) => `<option value="${escapeAttr(e.id)}">${escapeHtml([e.nombre || e.id, fmtFecha(e.fecha)].filter(Boolean).join(" · "))}</option>`)
    .join("");
  if (!eventos.some((e) => e.id === redes.eventoId)) {
    redes.eventoId = eventos[0]?.id || "";
    redes.categoriaId = "";
  }
  els.redesEvento.value = redes.eventoId;
  redes.spec = null;
  els.redesCaption.value = "";
}

async function cargarEvento(eventoId) {
  const entry = (manifest.eventos || []).find((e) => e.id === eventoId);
  if (!entry) return null;
  if (!eventoCache.has(entry.file)) {
    eventoCache.set(entry.file, normalizeEvento(await fetchJson(`data/${entry.file}`)));
  }
  return eventoCache.get(entry.file);
}

async function specActual() {
  const circuito = findCircuito(manifest, circuitoId);
  let base = null;
  if (redes.fuente === "evento") {
    const evento = redes.eventoId ? await cargarEvento(redes.eventoId) : null;
    const cats = evento ? categoriesWithResults(evento) : [];
    els.redesCategoria.innerHTML = cats
      .map((c) => `<option value="${escapeAttr(c.id)}">${escapeHtml(c.nombre)}</option>`)
      .join("");
    if (!cats.some((c) => c.id === redes.categoriaId)) redes.categoriaId = cats[0]?.id || "";
    els.redesCategoria.value = redes.categoriaId;
    const cat = cats.find((c) => c.id === redes.categoriaId);
    if (evento && cat) base = specEvento(evento, cat, circuitoId);
  } else if (redes.disciplina) {
    base = specTemporada(temporada, redes.disciplina, redes.metrica);
  }
  return base ? withContexto(base, { asociacion, circuito, temporada }) : null;
}

function syncRedesControles() {
  const toggle = (attr, value) =>
    document.querySelectorAll(`[${attr}]`).forEach((b) => b.classList.toggle("is-active", b.getAttribute(attr) === value));
  toggle("data-fuente", redes.fuente);
  toggle("data-metrica", redes.metrica);
  toggle("data-formato", redes.formato);
  toggle("data-top", redes.top);
  els.fuenteTemporada.hidden = redes.fuente !== "temporada";
  els.fuenteEvento.hidden = redes.fuente !== "evento";
  els.redesMetrica.hidden = redes.disciplina === ALL_AROUND_ID;
}

async function renderRedes({ nuevoTexto = false } = {}) {
  const seq = ++redes.renderSeq;
  syncRedesControles();
  let spec;
  try {
    spec = await specActual();
  } catch (err) {
    setStatus(err.message || String(err), true);
    return;
  }
  if (seq !== redes.renderSeq) return;

  if (nuevoTexto || !redes.spec || !els.redesCaption.value) {
    els.redesCaption.value = spec?.filas?.length ? shareCaption(spec) : "";
  }
  redes.spec = spec;

  const disponibles = Boolean(spec?.filas?.length);
  els.redesDescargar.disabled = !disponibles;
  els.redesCompartir.disabled = !disponibles;
  els.redesCopiar.disabled = !disponibles;
  if (!disponibles) {
    els.redesPreview.innerHTML = `<p class="empty-state">No hay resultados para esta selección.</p>`;
    els.redesPreviewLabel.textContent = "Vista previa";
    els.redesHint.textContent = "";
    redes.canvases = [];
    return;
  }

  const paginas = planPaginas(spec, redes.formato, redes.top);
  const canvases = paginas.map(() => document.createElement("canvas"));
  await Promise.all(
    paginas.map((p, i) =>
      drawSocialCard(canvases[i], spec, redes.formato, { ...p, indice: i, total: paginas.length })
    )
  );
  if (seq !== redes.renderSeq) return;

  redes.canvases = canvases;
  els.redesPreview.classList.toggle("is-carrusel", canvases.length > 1);
  els.redesPreview.classList.toggle("is-historia", redes.formato === "historia");
  els.redesPreview.replaceChildren(...canvases);

  const mostrados = paginas.reduce((n, p) => n + p.filas.length, 0);
  const total = spec.filas.length;
  const formato = FORMATOS[redes.formato];
  els.redesPreviewLabel.textContent =
    canvases.length > 1
      ? `Vista previa · carrusel de ${canvases.length} imágenes (${mostrados} lugares)`
      : `Vista previa · ${formato.label} · ${mostrados} de ${total} lugares`;
  els.redesDescargar.textContent = canvases.length > 1 ? `Descargar ${canvases.length} imágenes` : "Descargar imagen";
  const topLabel = TOPS[redes.top]?.label || "";
  els.redesHint.textContent =
    canvases.length > 1
      ? "Súbelas juntas como carrusel en Instagram o Facebook, en el orden 1, 2, 3…"
      : redes.formato === "historia"
        ? "Historia 9:16: deja libre arriba y abajo para los stickers de Instagram."
        : total < (TOPS[redes.top]?.n ?? 0) && redes.top !== "todos"
          ? `Solo hay ${total} lugares con resultado (${topLabel} completo no aplica).`
          : "Post 4:5 es el formato que más ocupa en el feed de Instagram y Facebook.";
}

function nombreArchivo(i) {
  const n = redes.canvases.length > 1 ? `-${i + 1}` : "";
  return `${redes.spec.archivo}-${redes.formato}-${redes.top}${n}.png`;
}

async function archivos() {
  return Promise.all(
    redes.canvases.map(async (c, i) => new File([await canvasToPngBlob(c)], nombreArchivo(i), { type: "image/png" }))
  );
}

async function descargar() {
  if (!redes.canvases.length) return;
  const files = await archivos();
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    if (files.length > 1) await new Promise((r) => setTimeout(r, 350));
  }
}

async function copiarTexto() {
  try {
    await navigator.clipboard.writeText(els.redesCaption.value);
    els.redesHint.textContent = "Texto copiado. Pégalo en la publicación.";
  } catch {
    els.redesCaption.select();
    els.redesHint.textContent = "Selecciona el texto y cópialo manualmente.";
  }
}

function puedeCompartirArchivos() {
  try {
    const probe = new File([new Blob()], "x.png", { type: "image/png" });
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

async function compartir() {
  try {
    const files = await archivos();
    // Instagram ignora el texto del share sheet: dejarlo en el portapapeles para pegarlo.
    await navigator.clipboard?.writeText(els.redesCaption.value).catch(() => {});
    await navigator.share({ files, text: els.redesCaption.value });
    els.redesHint.textContent = "Listo. El texto quedó copiado para pegarlo en la publicación.";
  } catch (err) {
    if (err?.name !== "AbortError") els.redesHint.textContent = err.message || String(err);
  }
}

/* —— Utils —— */

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return res.json();
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg || "";
  els.status.classList.toggle("is-error", Boolean(isError && msg));
}
