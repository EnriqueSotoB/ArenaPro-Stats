/**
 * Portal de asociaciones: tablero del circuito e imágenes para redes. Solo lectura;
 * publicar sigue siendo exclusivo del admin local.
 */

import { normalizeEvento, categoriesWithResults, escapeHtml, escapeAttr, fmtNum } from "./event-model.js";
import { fmtMxn } from "../lib/money.mjs";
import {
  normalizeManifest,
  findAsociacion,
  findCircuito,
  eventosDeCircuito,
  circuitoDataFile,
} from "../lib/circuitos.mjs";
import { llavePortal, verificarLlave, normalizePortal } from "../lib/portal-auth.mjs";
import { FORMATOS, TOPS, planPaginas, drawSocialCard, canvasToPngBlob } from "./social-card.js";
import {
  ALL_AROUND_ID,
  disciplinasDeTemporada,
  specTemporada,
  specEvento,
  specMovimientos,
  specRecords,
  specRecordsNuevos,
  fmtMarca,
  withContexto,
  shareCaption,
  fmtFecha,
  publicUrl,
  slugArchivo,
} from "./share-specs.js";
import { toCsv, filasClasificacion, filasVaqueroCompleto } from "../lib/csv-tablas.mjs";
import { calcularTablero, calcularMovimientos, calcularRecords, calcularRecordsNuevos } from "./portal-stats.js";

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
  panelCsv: $("panelCsv"),
  csvTabla: $("csvTabla"),
  btnCsv: $("btnCsv"),
  movimientos: $("movimientos"),
  movimientosMeta: $("movimientosMeta"),
  movPicker: $("movPicker"),
  movDisciplina: $("movDisciplina"),
  chartDisciplinas: $("chartDisciplinas"),
  panelDinero: $("panelDinero"),
  chartDinero: $("chartDinero"),
  tablaRecords: $("tablaRecords"),
  tablaLideres: $("tablaLideres"),
  tablaActivos: $("tablaActivos"),
  fuenteTemporada: $("fuenteTemporada"),
  fuenteEvento: $("fuenteEvento"),
  fuenteMovimientos: $("fuenteMovimientos"),
  redesMovDisciplina: $("redesMovDisciplina"),
  fuenteRecords: $("fuenteRecords"),
  redesRecords: $("redesRecords"),
  redesTop: $("redesTop"),
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
/** @type {Map<string, Promise<any[]>>} eventos del circuito ya cargados, para récords */
const eventosCargadosCache = new Map();

const redes = {
  fuente: "temporada",
  disciplina: "",
  metrica: "puntos",
  eventoId: "",
  categoriaId: "",
  /** @type {ReturnType<typeof calcularMovimientos>|null} */
  mov: null,
  movDisciplina: "",
  /** "" = récords de la temporada; id de evento = récords nuevos en ese evento; null = elegir solo */
  /** @type {string|null} */
  recordsVal: null,
  /** @type {{ circuitoId: string, eventos: any[], records: any[], nuevos: Map<string, any[]> }|null} */
  rec: null,
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
  if (a && (await sesionValida(a))) {
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

/** En una compu compartida de la asociación la sesión no debe quedar abierta para siempre. */
const SESION_DIAS = 30;

function guardarSesion(a, llave) {
  localStorage.setItem(sesionKey(a), `${llave}.${Date.now() + SESION_DIAS * 24 * 60 * 60 * 1000}`);
}

/** La sesión guarda la llave derivada de la contraseña: si el admin la cambia, se invalida sola. */
async function sesionValida(a) {
  const guardado = localStorage.getItem(sesionKey(a)) || "";
  if (ES_LOCAL && guardado === "local") return true;
  const [llave, vence] = guardado.split(".");
  if (!(Number(vence) > Date.now())) {
    localStorage.removeItem(sesionKey(a));
    return false;
  }
  try {
    return await verificarLlave(llave, a.portal);
  } catch {
    return false;
  }
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
      const llave = await llavePortal(els.loginPassword.value, a.portal);
      if (!llave) throw new Error("Contraseña incorrecta.");
      guardarSesion(a, llave);
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
  els.btnCsv.addEventListener("click", descargarCsv);
  els.circuitoSelect.addEventListener("change", () => usarCircuito(els.circuitoSelect.value));
  els.movDisciplina.addEventListener("change", () => {
    mov.disciplina = els.movDisciplina.value;
    mov.todos = false;
    renderTablaMovimientos();
  });
  els.tablaRecords.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-records-post]");
    if (!btn) return;
    redes.fuente = "records";
    redes.recordsVal = btn.getAttribute("data-records-post") || "";
    redes.spec = null;
    llenarSelectRecords();
    setTab("redes");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  els.movimientos.addEventListener("click", (e) => {
    if (!e.target.closest("[data-mov-todos]")) return;
    mov.todos = !mov.todos;
    renderTablaMovimientos();
  });
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

  llenarSelectCsv();

  if (!t.porEvento.length) {
    const vacio = `<p class="empty-state">Este circuito aún no tiene eventos publicados.</p>`;
    els.movimientos.innerHTML = vacio;
    els.chartDisciplinas.innerHTML = vacio;
    els.tablaRecords.innerHTML = vacio;
    els.tablaLideres.innerHTML = vacio;
    els.tablaActivos.innerHTML = vacio;
    els.panelDinero.hidden = true;
    return;
  }

  renderMovimientos();
  renderRecords();
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

const CSV_TODAS = "__todas";

function llenarSelectCsv() {
  const discs = disciplinasDeTemporada(temporada);
  els.panelCsv.hidden = !discs.length;
  const opciones = [
    { id: CSV_TODAS, nombre: "Todas las disciplinas" },
    ...discs,
    ...((temporada?.allAround || []).length ? [{ id: ALL_AROUND_ID, nombre: "Vaquero Completo" }] : []),
  ];
  const previa = els.csvTabla.value;
  els.csvTabla.innerHTML = opciones
    .map((d) => `<option value="${escapeAttr(d.id)}">${escapeHtml(d.nombre)}${d.competidores ? ` (${d.competidores})` : ""}</option>`)
    .join("");
  els.csvTabla.value = opciones.some((d) => d.id === previa) ? previa : CSV_TODAS;
}

function descargarCsv() {
  const circuito = findCircuito(manifest, circuitoId);
  const sel = els.csvTabla.value;
  let filas;
  let nombre;
  if (sel === ALL_AROUND_ID) {
    filas = filasVaqueroCompleto(temporada);
    nombre = "vaquero-completo";
  } else {
    const disciplinaId = sel === CSV_TODAS ? "" : sel;
    filas = filasClasificacion(temporada, eventosDeCircuito(manifest, circuitoId), disciplinaId);
    nombre = disciplinaId
      ? disciplinasDeTemporada(temporada).find((d) => d.id === disciplinaId)?.nombre || disciplinaId
      : "todas-las-disciplinas";
  }
  const fecha = String(temporada?.actualizadoEn || "").slice(0, 10);
  const archivo = [slugArchivo(circuito?.nombre || circuitoId), slugArchivo(nombre), fecha].filter(Boolean).join("-");
  const url = URL.createObjectURL(new Blob([toCsv(filas)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${archivo}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function nombresHtml(nombres, max = 3) {
  if (nombres.length <= max) return escapeHtml(nombres.join(", "));
  return `${escapeHtml(nombres.slice(0, max).join(", "))} y ${nombres.length - max} más`;
}

const MOV_TOP = 15;
const mov = { data: null, disciplina: "", todos: false };

function renderMovimientos() {
  mov.data = calcularMovimientos(temporada);
  const { evento, tablas } = mov.data;
  els.movPicker.hidden = !tablas.length;
  if (!evento) {
    els.movimientosMeta.textContent = "Cómo cambió la clasificación de cada disciplina con el rodeo más reciente.";
    els.movimientos.innerHTML = `<p class="empty-state">Sin datos.</p>`;
    return;
  }
  els.movimientosMeta.textContent = `Clasificación después de ${evento.nombre}${
    evento.fecha ? ` (${fmtFecha(evento.fecha)})` : ""
  } y cuántos lugares se movió cada quien contra cómo iba antes de ese rodeo.`;
  if (!tablas.length) {
    els.movimientos.innerHTML = `<p class="empty-state">Con un solo rodeo todavía no hay contra qué comparar. Aparecerá desde el segundo.</p>`;
    return;
  }

  const lideres = new Set(mov.data.cambiosLider.map((c) => c.disciplinaId));
  els.movDisciplina.innerHTML = tablas
    .map(
      (t) =>
        `<option value="${escapeAttr(t.disciplinaId)}">${escapeHtml(t.disciplinaNombre)}${
          lideres.has(t.disciplinaId) ? " · nuevo líder" : t.corrieron ? "" : " · no se corrió"
        }</option>`
    )
    .join("");
  if (!tablas.some((t) => t.disciplinaId === mov.disciplina)) {
    mov.disciplina = [...tablas].sort((a, b) => b.corrieron - a.corrieron)[0].disciplinaId;
    mov.todos = false;
  }
  els.movDisciplina.value = mov.disciplina;
  renderTablaMovimientos();
}

function movIndicador(f) {
  if (f.nuevo) return `<span class="rank-mov is-new" title="Primer rodeo en esta disciplina">NUEVO</span>`;
  if (!f.cambio) return `<span class="rank-mov is-same" title="Mismo lugar">–</span>`;
  const sube = f.cambio > 0;
  return `<span class="rank-mov ${sube ? "is-up" : "is-down"}" title="${sube ? "Subió" : "Bajó"} del #${f.lugarAntes} al #${f.lugar}">
      <span class="rank-arrow" aria-hidden="true">${sube ? "▲" : "▼"}</span>${Math.abs(f.cambio)}
    </span>`;
}

function renderTablaMovimientos() {
  const tabla = mov.data?.tablas.find((t) => t.disciplinaId === mov.disciplina);
  if (!tabla) return;
  const cambio = mov.data.cambiosLider.find((c) => c.disciplinaId === tabla.disciplinaId);
  const lider = cambio
    ? `<div class="mov-lider"><p><strong>Nuevo líder:</strong> ${nombresHtml(cambio.ahora)} (${fmtNum(cambio.puntos)} pts)${
        cambio.antes.length ? `, antes ${nombresHtml(cambio.antes)}` : ""
      }.</p></div>`
    : "";
  const visibles = mov.todos ? tabla.filas : tabla.filas.slice(0, MOV_TOP);
  const pts = (n) => `${fmtNum(n)} ${n === 1 ? "pt" : "pts"}`;
  const filas = visibles
    .map((f) => {
      const sub = f.corrio ? `${pts(f.puntosEvento)} en el rodeo` : "No corrió";
      return `<li class="rank-row${f.lugar === 1 ? " is-lider" : ""}">
        <span class="rank-pos">${f.lugar}</span>
        <span class="rank-name">${escapeHtml(f.nombre)}<span class="rank-sub">${escapeHtml(sub)}</span></span>
        <span class="rank-pts">${fmtNum(f.puntos)}<small>pts</small></span>
        ${movIndicador(f)}
      </li>`;
    })
    .join("");
  const resto = tabla.filas.length - MOV_TOP;
  const boton =
    resto > 0
      ? `<button type="button" class="btn-share rank-more" data-mov-todos>${
          mov.todos ? `Ver solo el top ${MOV_TOP}` : `Ver los ${fmtNum(tabla.filas.length)}`
        }</button>`
      : "";
  const aviso = tabla.corrieron ? "" : `<p class="meta">Esta disciplina no se corrió en el último rodeo.</p>`;
  els.movimientos.innerHTML = `${lider}<div class="rank-card">
      <div class="rank-head"><span>${escapeHtml(tabla.disciplinaNombre)}</span><span>Puntos</span></div>
      <ol class="rank">${filas}</ol>
    </div>${aviso}${boton}`;
}

let recordsSeq = 0;

/** Eventos del circuito activo con su archivo cargado (una sola descarga por circuito). */
function cargarEventosCircuito() {
  const id = circuitoId;
  if (!eventosCargadosCache.has(id)) {
    const p = Promise.all(
      eventosDeCircuito(manifest, id).map(async (e) => ({ id: e.id, nombre: e.nombre, fecha: e.fecha, evento: await cargarEvento(e.id) }))
    ).then((l) => l.filter((e) => e.evento));
    p.catch(() => eventosCargadosCache.delete(id));
    eventosCargadosCache.set(id, p);
  }
  return eventosCargadosCache.get(id);
}

/** Récords de la temporada y récords nuevos por evento del circuito activo. */
async function datosRecords() {
  const id = circuitoId;
  if (redes.rec?.circuitoId === id) return redes.rec;
  const eventos = await cargarEventosCircuito();
  const nuevos = new Map(eventos.map((e) => [e.id, calcularRecordsNuevos(eventos, e.id)]));
  const rec = { circuitoId: id, eventos, records: calcularRecords(eventos), nuevos };
  if (circuitoId === id) redes.rec = rec;
  return rec;
}

async function renderRecords() {
  const seq = ++recordsSeq;
  els.tablaRecords.innerHTML = `<p class="empty-state">Cargando récords…</p>`;
  let records;
  try {
    records = (await datosRecords()).records;
  } catch (err) {
    if (seq === recordsSeq) els.tablaRecords.innerHTML = `<p class="empty-state">${escapeHtml(err.message || String(err))}</p>`;
    return;
  }
  if (seq !== recordsSeq) return;
  if (!records.length) {
    els.tablaRecords.innerHTML = `<p class="empty-state">Sin recorridos con tiempo o calificación.</p>`;
    return;
  }
  const nuevos = records.filter((r) => r.nuevo);
  const ultimo = nuevos[0]?.titulares[0];
  const aviso = ultimo
    ? `<p class="records-aviso"><span class="record-nuevo">Nuevo</span> ${
        nuevos.length === 1 ? "1 récord nuevo" : `${nuevos.length} récords nuevos`
      } en ${escapeHtml(ultimo.eventoNombre)}.</p>`
    : "";
  const boton = `<button type="button" class="btn-share rank-more" data-records-post="${escapeAttr(ultimo?.eventoId || "")}">${
    ultimo ? "Hacer post de los récords nuevos" : "Hacer post de récords"
  }</button>`;
  els.tablaRecords.innerHTML = aviso + tablaHtml(
    ["Disciplina", "Récord", "Quién y dónde"],
    records.map((r) => {
      const t = r.titulares;
      const donde = t
        .map((x) => [x.eventoNombre, fmtFecha(x.fecha), x.ronda].filter(Boolean).join(" · "))
        .filter((v, i, arr) => arr.indexOf(v) === i);
      const quien = t.length > 1 ? `${nombresHtml(t.map((x) => x.nombre))} (empate)` : escapeHtml(t[0].nombre);
      return [
        escapeHtml(r.disciplinaNombre) + (r.nuevo ? ` <span class="record-nuevo">Nuevo</span>` : ""),
        `<span class="record-valor">${escapeHtml(fmtMarca(r.valor, r.esPuntos))}</span>`,
        `<span class="mov-name">${quien}<span class="mov-sub">${escapeHtml(donde.join(" / "))}</span></span>`,
      ];
    }),
    [false, true, false]
  ) + boton;
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
  els.redesMovDisciplina.addEventListener("change", () => {
    redes.movDisciplina = els.redesMovDisciplina.value;
    renderRedes({ nuevoTexto: true });
  });
  els.redesRecords.addEventListener("change", () => {
    redes.recordsVal = els.redesRecords.value;
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

  redes.mov = calcularMovimientos(temporada);
  const tablas = redes.mov.tablas;
  els.redesMovDisciplina.innerHTML = tablas
    .map(
      (t) =>
        `<option value="${escapeAttr(t.disciplinaId)}">${escapeHtml(t.disciplinaNombre)}${t.corrieron ? "" : " · no se corrió"}</option>`
    )
    .join("");
  if (!tablas.some((t) => t.disciplinaId === redes.movDisciplina)) {
    redes.movDisciplina =
      (tablas.some((t) => t.disciplinaId === mov.disciplina) ? mov.disciplina : "") ||
      [...tablas].sort((a, b) => b.corrieron - a.corrieron)[0]?.disciplinaId ||
      "";
  }
  els.redesMovDisciplina.value = redes.movDisciplina;

  if (redes.rec?.circuitoId !== circuitoId) {
    redes.rec = null;
    redes.recordsVal = null;
  }
  llenarSelectRecords();
  redes.spec = null;
  els.redesCaption.value = "";
}

/**
 * Opciones de récords: los de la temporada y, por evento (más reciente primero), los que se rompieron ahí.
 * Si no hay elección, abre en el último rodeo cuando impuso récords.
 */
function llenarSelectRecords() {
  const rec = redes.rec?.circuitoId === circuitoId ? redes.rec : null;
  if (!rec) {
    els.redesRecords.innerHTML = `<option value="">Cargando récords…</option>`;
    return;
  }
  const eventos = [...rec.eventos].sort(
    (a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")) || String(b.id).localeCompare(String(a.id))
  );
  const nuevosEn = (id) => rec.nuevos.get(id)?.length || 0;
  els.redesRecords.innerHTML = [
    `<option value="">Récords de la temporada (${rec.records.length})</option>`,
    ...eventos.map((e) => {
      const n = nuevosEn(e.id);
      const nombre = [e.nombre || e.id, fmtFecha(e.fecha)].filter(Boolean).join(" · ");
      return `<option value="${escapeAttr(e.id)}"${n ? "" : " disabled"}>${escapeHtml(
        n ? `Récords nuevos en ${nombre} (${n})` : `${nombre}: sin récords nuevos`
      )}</option>`;
    }),
  ].join("");
  const valido = (v) => v === "" || nuevosEn(v) > 0;
  if (redes.recordsVal == null || !valido(redes.recordsVal)) {
    const ultimo = eventos[0];
    redes.recordsVal = ultimo && nuevosEn(ultimo.id) ? ultimo.id : "";
  }
  els.redesRecords.value = redes.recordsVal;
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
  } else if (redes.fuente === "movimientos") {
    base = specMovimientos(redes.mov, redes.movDisciplina, circuitoId);
  } else if (redes.fuente === "records") {
    const rec = await datosRecords();
    llenarSelectRecords();
    if (redes.recordsVal) {
      const ev = rec.eventos.find((e) => e.id === redes.recordsVal);
      base = specRecordsNuevos(rec.nuevos.get(redes.recordsVal) || [], ev, circuitoId);
    } else {
      base = specRecords(rec.records, circuitoId);
    }
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
  els.fuenteMovimientos.hidden = redes.fuente !== "movimientos";
  els.fuenteRecords.hidden = redes.fuente !== "records";
  els.redesTop.hidden = redes.fuente === "records";
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
    els.redesPreview.innerHTML = `<p class="empty-state">${
      redes.fuente === "movimientos" && !redes.mov?.tablas.length
        ? "Los movimientos aparecen desde el segundo rodeo del circuito."
        : redes.fuente === "records"
          ? "Todavía no hay recorridos con tiempo o calificación."
          : "No hay resultados para esta selección."
    }</p>`;
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
  const unidad = spec.lista ? (mostrados === 1 ? "récord" : "récords") : "lugares";
  els.redesPreviewLabel.textContent =
    canvases.length > 1
      ? `Vista previa · carrusel de ${canvases.length} imágenes (${mostrados} ${unidad})`
      : spec.lista
        ? `Vista previa · ${formato.label} · ${mostrados} ${unidad}`
        : `Vista previa · ${formato.label} · ${mostrados} de ${total} lugares`;
  els.redesDescargar.textContent = canvases.length > 1 ? `Descargar ${canvases.length} imágenes` : "Descargar imagen";
  const topLabel = TOPS[redes.top]?.label || "";
  els.redesHint.textContent =
    canvases.length > 1
      ? "Súbelas juntas como carrusel en Instagram o Facebook, en el orden 1, 2, 3…"
      : redes.formato === "historia"
        ? "Historia 9:16: deja libre arriba y abajo para los stickers de Instagram."
        : !spec.lista && total < (TOPS[redes.top]?.n ?? 0) && redes.top !== "todos"
          ? `Solo hay ${total} lugares con resultado (${topLabel} completo no aplica).`
          : "Post 4:5 es el formato que más ocupa en el feed de Instagram y Facebook.";
}

function nombreArchivo(i) {
  const n = redes.canvases.length > 1 ? `-${i + 1}` : "";
  return `${redes.spec.archivo}-${redes.formato}${redes.spec.lista ? "" : `-${redes.top}`}${n}.png`;
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
