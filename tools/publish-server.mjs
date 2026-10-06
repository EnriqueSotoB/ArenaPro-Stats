#!/usr/bin/env node
/**
 * Consola local de publicación ArenaPro Stats.
 * Uso: node tools/publish-server.mjs
 * Solo escucha en 127.0.0.1 — no exponer a la red.
 */
import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, unlinkSync, readdirSync } from "node:fs";
import { dirname, join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { validateEvento } from "./lib/validate-evento.mjs";
import { motivoRechazo } from "./lib/local-guard.mjs";
import { buscarRodeoDuplicado, problemasDePublicacion } from "./lib/integridad.mjs";
import { eventoConNombresMayusculas } from "../web/lib/nombres.mjs";
import { normalizeText } from "../web/lib/disciplinas.mjs";
import { sincronizarConRemoto } from "./lib/git-sync.mjs";
import { archivoParaRuta } from "./lib/rutas.mjs";
import { asociacionDeRuta, destinoPortal, rutasOcupadas } from "./lib/ligas-portal.mjs";
import {
  aplicarStatsEdits,
  buildDefaultEdits,
} from "../web/lib/stats-edits.mjs";
import { appendAlias, removeAlias } from "../web/lib/alias-store.mjs";
import { displayFromKey } from "../web/lib/alias-suggest.mjs";
import { parseExcelEvento, normalizeFechaYmd } from "./lib/excel-evento.mjs";
import {
  normalizeManifest,
  findAsociacion,
  findCircuito,
  validarCircuitosEvento,
  eventosDeCircuito,
  upsertAsociacion,
  removeAsociacion,
  setAsociacionLogo,
  setAsociacionPortal,
  logoFileName,
  LOGO_TYPES,
  upsertCircuito,
  removeCircuito,
  circuitoDataFile,
} from "../web/lib/circuitos.mjs";
import { crearAccesoPortal, generarPassword } from "../web/lib/portal-auth.mjs";

const PORT = Number(process.env.STATS_PUBLISH_PORT) || 8787;
const HOST = "127.0.0.1";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, "..");
const PAGES_URL = "https://estadisticas.arenapro.mx/";
/** Cambia en cada arranque; solo admin.html servido por esta consola lo conoce. */
const SESSION_TOKEN = randomBytes(24).toString("hex");
const ADMIN_HTML = join(ROOT, "admin", "admin.html");

/** Siempre proceso Node nuevo: el import() en caliente NO invalida caché ESM en file://. */
function runRebuild() {
  const script = join(SCRIPT_DIR, "rebuild-temporada.mjs");
  let stdout = "";
  try {
    stdout = execFileSync(process.execPath, [script], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    const detail = String(e.stderr || e.stdout || e.message || e).trim();
    const err = new Error(`Falló regenerar las estadísticas. ${detail}`);
    err.statusCode = 500;
    throw err;
  }

  const circuitos = loadManifest().circuitos.map((c) => {
    const payload = loadCircuitoPayload(c.id);
    if (!payload) {
      const err = new Error(`El rebuild no generó ${circuitoDataFile(c.id)}. Reinicia publicar.bat.`);
      err.statusCode = 500;
      throw err;
    }
    assertTemporadaCircuito(payload, c.nombre);
    return {
      circuitoId: c.id,
      titulo: c.nombre,
      standings: payload.standings?.length ?? 0,
      eventosContados: payload.eventosContados ?? 0,
    };
  });
  return { circuitos, log: String(stdout || "").trim() };
}

/** Los mismos tests que CI: si fallan aquí, no se sube nada al sitio público. */
function runTests() {
  try {
    execFileSync(process.execPath, [join(SCRIPT_DIR, "run-tests.mjs")], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    const salida = String(e.stdout || "") + String(e.stderr || "");
    const fallas = salida
      .split("\n")
      .filter((l) => /✖|not ok|AssertionError/.test(l))
      .slice(0, 6)
      .map((l) => l.trim())
      .join(" · ");
    const err = new Error(`No se publicó: fallaron las pruebas. ${fallas || "Corre npm test para ver el detalle."}`);
    err.statusCode = 409;
    throw err;
  }
}

function loadCircuitoPayload(circuitoId) {
  const path = join(ROOT, "data", circuitoDataFile(circuitoId));
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

/** No publicar acumulado agrupado por local:{id} / cat_* (rompe el circuito). */
function assertTemporadaCircuito(payload, nombre) {
  if (!payload.eventosContados) return;
  const bad = (payload.standings || []).filter((s) => {
    const id = String(s.disciplinaId || s.categoriaId || "");
    return !id || id.startsWith("local:") || id.startsWith("cat_") || id === "_";
  });
  if (bad.length) {
    const sample = bad
      .slice(0, 5)
      .map((s) => s.disciplinaId || s.categoriaId)
      .join(", ");
    const err = new Error(
      `${nombre}: ${bad.length} filas sin disciplina de circuito (ej. ${sample}). Reinicia publicar.bat.`
    );
    err.statusCode = 500;
    throw err;
  }
  if (!(payload.standings || []).some((s) => s.disciplinaId)) {
    const err = new Error(
      `${nombre}: acumulado sin disciplinaId — el rebuild viejo sigue en memoria. Cierra y abre publicar.bat.`
    );
    err.statusCode = 500;
    throw err;
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function assertLocal(req) {
  const ra = req.socket.remoteAddress || "";
  const ok =
    ra === "127.0.0.1" ||
    ra === "::1" ||
    ra === "::ffff:127.0.0.1";
  if (!ok) {
    const err = new Error("Solo se aceptan peticiones desde este equipo (localhost).");
    err.statusCode = 403;
    throw err;
  }
}

function readJsonBody(req) {
  return readRawBody(req).then((buf) => {
    try {
      const raw = buf.toString("utf8");
      return raw ? JSON.parse(raw) : {};
    } catch {
      throw Object.assign(new Error("JSON inválido."), { statusCode: 400 });
    }
  });
}

function readRawBody(req, max = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > max) {
        reject(Object.assign(new Error("Archivo demasiado grande."), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(data);
}

function git(args, opts = {}) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  }).trim();
}

function safeSlug(text) {
  return String(text || "evento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "evento";
}

function loadManifest() {
  const path = join(ROOT, "data", "manifest.json");
  return normalizeManifest(JSON.parse(readFileSync(path, "utf8")));
}

function saveManifest(manifest) {
  const path = join(ROOT, "data", "manifest.json");
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

function getStatus() {
  const manifest = loadManifest();
  let dirty = false;
  let branch = "";
  let ahead = "";
  try {
    branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
    const porcelain = git(["status", "--porcelain", "--", "data"]);
    dirty = porcelain.length > 0;
    ahead = git(["status", "-sb"]).split("\n")[0] || "";
  } catch (e) {
    return {
      ok: false,
      error: `Git no disponible: ${e.message || e}`,
      pagesUrl: PAGES_URL,
    };
  }

  return {
    ok: true,
    pagesUrl: PAGES_URL,
    circuitoDefault: manifest.circuitoDefault,
    asociaciones: manifest.asociaciones,
    circuitos: manifest.circuitos.map((c) => ({
      ...c,
      eventos: eventosDeCircuito(manifest, c.id).length,
    })),
    eventos: manifest.eventos,
    dirty,
    branch,
    gitSummary: ahead,
  };
}

function conflicto(message) {
  return Object.assign(new Error(message), { statusCode: 409 });
}

function loadEventoEntry(entry) {
  const abs = eventoAbsFile(entry.file);
  if (!abs || !existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, "utf8"));
  } catch {
    return null;
  }
}

async function ingest({ evento, circuitos, statsEdits, replaceId, permitirDuplicado }) {
  if (!evento || typeof evento !== "object") {
    const err = new Error("Falta el JSON del evento.");
    err.statusCode = 400;
    throw err;
  }
  const circuitoIds = validarCircuitosEvento(loadManifest(), circuitos);
  if (replaceId != null && replaceId !== "") {
    findManifestEvento(loadManifest(), replaceId);
  }

  // Quitar statsEdits embebidos del export crudo; se reaplica limpio.
  const { statsEdits: _embedded, ...rawEvento } = evento;
  const edits =
    statsEdits && typeof statsEdits === "object"
      ? statsEdits
      : buildDefaultEdits(rawEvento);
  const applied = eventoConNombresMayusculas(aplicarStatsEdits(rawEvento, edits));

  const validation = validateEvento(applied);
  if (!validation.ok) {
    const err = new Error(validation.errors.join(" "));
    err.statusCode = 400;
    err.errors = validation.errors;
    err.warnings = validation.warnings;
    throw err;
  }

  const temp = findCircuito(loadManifest(), circuitoIds[0]).temporada;
  applied.temporada = temp;
  if (!applied.nombreEvento && applied.eventoId) {
    applied.nombreEvento = String(applied.eventoId);
  }

  const fecha =
    normalizeFechaYmd(applied.fecha) ||
    normalizeFechaYmd(applied.exportedAt) ||
    new Date().toISOString().slice(0, 10);
  applied.fecha = fecha;

  const manifest = loadManifest();
  const replaceKey = replaceId != null && replaceId !== "" ? String(replaceId).trim() : "";
  const replaceIdx = replaceKey ? findManifestEvento(manifest, replaceKey) : -1;
  const mismoEvento = (e) =>
    e.fecha === fecha && normalizeText(e.nombre) === normalizeText(applied.nombreEvento);

  let id =
    (applied.eventoId && String(applied.eventoId).trim()) ||
    `evt_${fecha}_${safeSlug(applied.nombreEvento)}`;
  let idx = manifest.eventos.findIndex((e) => e.id === id);
  if (replaceIdx < 0 && idx >= 0 && !mismoEvento(manifest.eventos[idx])) {
    // Cada instalación de Time numera desde local:1: el mismo id puede ser otro rodeo.
    id = `${id}-${fecha}`;
    idx = manifest.eventos.findIndex((e) => e.id === id);
    if (idx >= 0 && !mismoEvento(manifest.eventos[idx])) {
      throw conflicto(`Ya existe otro evento con el id "${id}" ("${manifest.eventos[idx].nombre}").`);
    }
  }
  if (replaceIdx >= 0) {
    if (idx >= 0 && idx !== replaceIdx) {
      throw conflicto(`Ya existe otro evento con el mismo id ("${manifest.eventos[idx].nombre}").`);
    }
    idx = replaceIdx;
  }
  applied.eventoId = id;

  const ocupado = (rel) => manifest.eventos.some((e, i) => i !== idx && e.file === rel);
  let fileName = `${fecha}-${safeSlug(applied.nombreEvento)}.json`;
  if (ocupado(`eventos/${fileName}`)) fileName = `${fecha}-${safeSlug(applied.nombreEvento)}-${safeSlug(id)}.json`;
  const relFile = `eventos/${fileName}`;
  if (ocupado(relFile)) throw conflicto(`Ya existe otro evento guardado como ${relFile}.`);

  if (!permitirDuplicado) {
    const existentes = manifest.eventos
      .filter((e, i) => i !== idx && e.circuitos.some((c) => circuitoIds.includes(c)))
      .map((entry) => ({ entry, evento: loadEventoEntry(entry) }))
      .filter((x) => x.evento);
    const dup = buscarRodeoDuplicado(applied, existentes);
    if (dup) {
      throw Object.assign(
        conflicto(
          `Parece el mismo rodeo que “${dup.entry.nombre}” (${dup.entry.fecha}): ${dup.comunes} de ${dup.total} competidores en común. Si es una corrección, usa Editar en ese evento.`
        ),
        { duplicado: dup.entry.id }
      );
    }
  }

  const absDir = join(ROOT, "data", "eventos");
  mkdirSync(absDir, { recursive: true });
  writeFileSync(join(absDir, fileName), JSON.stringify(applied, null, 2) + "\n", "utf8");

  const entry = {
    id,
    nombre: applied.nombreEvento || id,
    fecha,
    sede: applied.sede || "",
    file: relFile,
    circuitos: circuitoIds,
  };

  if (idx >= 0) {
    const prevFile = manifest.eventos[idx].file;
    if (prevFile && prevFile !== relFile) {
      const prevAbs = eventoAbsFile(prevFile);
      if (prevAbs && existsSync(prevAbs) && statSync(prevAbs).isFile()) unlinkSync(prevAbs);
    }
    manifest.eventos[idx] = entry;
  } else {
    manifest.eventos.push(entry);
  }

  manifest.eventos.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  saveManifest(manifest);

  const rebuilt = runRebuild();

  return {
    ok: true,
    file: relFile,
    entry,
    temporada: temp,
    rebuilt,
    warnings: validation.warnings,
    statsEdits: applied.statsEdits || null,
  };
}

function loadAliasesDoc() {
  const path = join(ROOT, "data", "competidor-aliases.json");
  if (!existsSync(path)) return { version: 1, aliases: [] };
  return JSON.parse(readFileSync(path, "utf8"));
}

function saveAliasesDoc(doc) {
  const path = join(ROOT, "data", "competidor-aliases.json");
  writeFileSync(path, JSON.stringify(doc, null, 2) + "\n", "utf8");
}

function uniqueCompetitorNames(standings) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const row of standings || []) {
    const key = String(row.competidorKey || "").trim();
    if (!key || key === "anon") continue;
    const label =
      (row.nombre && String(row.nombre).trim()) || displayFromKey(key);
    if (!map.has(key)) map.set(key, label);
  }
  return [...map.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/** Standings de todos los circuitos: los aliases son globales. */
function loadTemporadaStandings() {
  return loadManifest().circuitos.flatMap((c) => {
    try {
      const payload = loadCircuitoPayload(c.id);
      return Array.isArray(payload?.standings) ? payload.standings : [];
    } catch {
      return [];
    }
  });
}

function getAliasesPayload() {
  const doc = loadAliasesDoc();
  const standings = loadTemporadaStandings();
  const names = uniqueCompetitorNames(standings);
  /** Incluir variantes ya aliasadas para el datalist. */
  const seen = new Set(names.map((n) => n.key));
  for (const a of doc.aliases || []) {
    const from = String(a.from || "").trim();
    if (from && !seen.has(from)) {
      seen.add(from);
      names.push({ key: from, label: displayFromKey(from) });
    }
    const to = String(a.to || "").trim();
    if (to && !seen.has(to)) {
      seen.add(to);
      names.push({ key: to, label: displayFromKey(to) });
    }
  }
  names.sort((a, b) => a.label.localeCompare(b.label, "es"));
  return {
    ok: true,
    version: doc.version || 1,
    aliases: doc.aliases || [],
    names,
  };
}

function addAlias(body) {
  const asociacionId = String(body?.asociacionId || "").trim();
  if (asociacionId && !findAsociacion(loadManifest(), asociacionId)) {
    throw Object.assign(new Error(`No existe la asociación "${asociacionId}".`), { statusCode: 400 });
  }
  const next = appendAlias(loadAliasesDoc(), {
    from: body?.from,
    to: body?.to,
    nota: body?.nota,
    asociacionId,
  });
  saveAliasesDoc(next);
  const rebuilt = runRebuild();
  return {
    ok: true,
    aliases: next.aliases,
    count: next.aliases.length,
    rebuilt,
    ...getAliasesPayload(),
  };
}

function deleteAlias(body) {
  const next = removeAlias(loadAliasesDoc(), body?.from, body?.asociacionId);
  saveAliasesDoc({ version: next.version, aliases: next.aliases });
  const rebuilt = runRebuild();
  return {
    ok: true,
    removed: next.removed,
    aliases: next.aliases,
    count: next.aliases.length,
    rebuilt,
    ...getAliasesPayload(),
  };
}

/** Ruta absoluta del JSON del evento, solo si está dentro de data/eventos/. */
function eventoAbsFile(relFile) {
  const rel = String(relFile || "").replace(/\\/g, "/");
  if (!rel || rel.includes("..") || !rel.startsWith("eventos/")) return null;
  const absFile = join(ROOT, "data", ...rel.split("/"));
  if (relative(ROOT, absFile).startsWith("..")) return null;
  return absFile;
}

function findManifestEvento(manifest, id) {
  const eventId = id != null ? String(id).trim() : "";
  if (!eventId) {
    const err = new Error("Falta el id del evento.");
    err.statusCode = 400;
    throw err;
  }
  const idx = (manifest.eventos || []).findIndex((e) => e.id === eventId);
  if (idx < 0) {
    const err = new Error(`No se encontró el evento "${eventId}".`);
    err.statusCode = 404;
    throw err;
  }
  return idx;
}

function getEvento(id) {
  const manifest = loadManifest();
  const entry = manifest.eventos[findManifestEvento(manifest, id)];
  const absFile = eventoAbsFile(entry.file);
  if (!absFile || !existsSync(absFile) || !statSync(absFile).isFile()) {
    const err = new Error(`No existe el archivo del evento "${entry.nombre || entry.id}".`);
    err.statusCode = 404;
    throw err;
  }
  return { ok: true, entry, evento: JSON.parse(readFileSync(absFile, "utf8")) };
}

function removeEvent({ id }) {
  const manifest = loadManifest();
  manifest.eventos = Array.isArray(manifest.eventos) ? manifest.eventos : [];
  const idx = findManifestEvento(manifest, id);

  const entry = manifest.eventos[idx];
  const absFile = eventoAbsFile(entry.file);
  if (absFile && existsSync(absFile) && statSync(absFile).isFile()) {
    unlinkSync(absFile);
  }

  manifest.eventos.splice(idx, 1);
  saveManifest(manifest);
  const rebuilt = runRebuild();

  return {
    ok: true,
    removed: entry,
    rebuilt,
  };
}

/** Borra data/logos/{id}.* (todas las extensiones). */
function deleteLogoFiles(asociacionId) {
  for (const ext of new Set(Object.values(LOGO_TYPES))) {
    const abs = join(ROOT, "data", "logos", `${asociacionId}.${ext}`);
    if (existsSync(abs)) unlinkSync(abs);
  }
}

function saveLogo(asociacionId, contentType, buf) {
  if (!buf.length) {
    const err = new Error("Archivo de logo vacío.");
    err.statusCode = 400;
    throw err;
  }
  const manifest = loadManifest();
  const rel = logoFileName(asociacionId, contentType);
  const { manifest: next, asociacion } = setAsociacionLogo(manifest, asociacionId, rel);
  mkdirSync(join(ROOT, "data", "logos"), { recursive: true });
  deleteLogoFiles(asociacion.id);
  writeFileSync(join(ROOT, "data", ...rel.split("/")), buf);
  saveManifest(next);
  return { ok: true, asociacion };
}

function removeLogo(asociacionId) {
  const { manifest, asociacion } = setAsociacionLogo(loadManifest(), asociacionId, "");
  deleteLogoFiles(asociacion.id);
  saveManifest(manifest);
  return { ok: true, asociacion };
}

/** Sin password en el body se genera una; se devuelve una sola vez (el manifest solo guarda el hash). */
async function setPortalPassword({ id, password } = {}) {
  const plano = String(password ?? "").trim() || generarPassword();
  const acceso = await crearAccesoPortal(plano);
  const { manifest, asociacion } = setAsociacionPortal(loadManifest(), id, acceso);
  saveManifest(manifest);
  return { ok: true, asociacion, password: plano };
}

function removePortalPassword({ id } = {}) {
  const { manifest, asociacion } = setAsociacionPortal(loadManifest(), id, null);
  saveManifest(manifest);
  return { ok: true, asociacion };
}

/** Aplica un cambio al manifest (asociaciones / circuitos), guarda y regenera. */
function mutateManifest(fn) {
  const result = fn(loadManifest());
  saveManifest(result.manifest);
  const rebuilt = runRebuild();
  const { manifest: _m, ...rest } = result;
  return { ok: true, ...rest, rebuilt };
}

function syncWithRemote() {
  return sincronizarConRemoto({ root: ROOT, regenerar: runRebuild });
}

async function publish() {
  // Siempre regenerar en proceso fresco antes de commitear (no confiar en ingest previo).
  runRebuild();

  const statusBefore = git(["status", "--porcelain", "--", "data"]);
  if (!statusBefore) {
    return { ok: true, published: false, message: "No hay cambios en data/ para publicar." };
  }

  const problemas = problemasDePublicacion(loadManifest(), loadEventoEntry);
  if (problemas.length) throw conflicto(`No se publicó. ${problemas.join(" ")}`);
  runTests();

  git(["add", "--", "data"]);
  const staged = git(["diff", "--cached", "--name-only"]);
  if (!staged) {
    return { ok: true, published: false, message: "Nada que publicar." };
  }

  const msg = "stats: actualizar estadísticas";
  try {
    git(["commit", "-m", msg]);
  } catch (e) {
    const stderr = String(e.stderr || e.message || e);
    if (/nothing to commit/i.test(stderr)) {
      return { ok: true, published: false, message: "Nada que publicar." };
    }
    throw e;
  }

  syncWithRemote();
  git(["push", "origin", "HEAD"]);
  return {
    ok: true,
    published: true,
    message: "Publicado. El sitio se actualiza en 2–4 minutos, cuando GitHub termina de revisarlo.",
    pagesUrl: PAGES_URL,
  };
}

function serveStatic(req, res, urlPath) {
  const candidate = archivoParaRuta(ROOT, urlPath);
  if (!candidate) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!existsSync(candidate) || !statSync(candidate).isFile()) {
    res.writeHead(404);
    res.end("No encontrado");
    return;
  }

  const type = MIME[extname(candidate).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
  if (candidate === ADMIN_HTML) {
    const html = readFileSync(candidate, "utf8").replace(
      '<meta name="arenapro-token" content="" />',
      `<meta name="arenapro-token" content="${SESSION_TOKEN}" />`
    );
    res.end(html);
    return;
  }
  res.end(readFileSync(candidate));
}

const server = http.createServer(async (req, res) => {
  try {
    assertLocal(req);
    const rechazo = motivoRechazo(req, { port: PORT, token: SESSION_TOKEN });
    if (rechazo) throw Object.assign(new Error(rechazo), { statusCode: 403 });
    const method = req.method || "GET";
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

    if (method === "GET" && url.pathname === "/api/status") {
      sendJson(res, 200, getStatus());
      return;
    }

    if (method === "POST" && url.pathname === "/api/parse-excel") {
      const buf = await readRawBody(req);
      if (!buf.length) {
        sendJson(res, 400, { ok: false, error: "Archivo Excel vacío." });
        return;
      }
      const evento = await parseExcelEvento(buf);
      const validation = validateEvento(evento);
      sendJson(res, 200, {
        ok: true,
        evento,
        errors: validation.errors || [],
        warnings: validation.warnings || [],
      });
      return;
    }

    if (method === "POST" && url.pathname === "/api/ingest") {
      const body = await readJsonBody(req);
      const result = await ingest(body);
      sendJson(res, 200, result);
      return;
    }

    if (method === "GET" && url.pathname === "/api/evento") {
      sendJson(res, 200, getEvento(url.searchParams.get("id")));
      return;
    }

    if (method === "GET" && url.pathname === "/api/aliases") {
      sendJson(res, 200, getAliasesPayload());
      return;
    }

    if (method === "POST" && url.pathname === "/api/aliases") {
      const body = await readJsonBody(req);
      const result = addAlias(body);
      sendJson(res, 200, result);
      return;
    }

    if (method === "POST" && url.pathname === "/api/aliases/remove") {
      const body = await readJsonBody(req);
      const result = deleteAlias(body);
      sendJson(res, 200, result);
      return;
    }

    if (method === "POST" && url.pathname === "/api/asociaciones") {
      const body = await readJsonBody(req);
      sendJson(res, 200, mutateManifest((m) => upsertAsociacion(m, body)));
      return;
    }

    if (method === "POST" && url.pathname === "/api/asociaciones/remove") {
      const body = await readJsonBody(req);
      const result = mutateManifest((m) => removeAsociacion(m, body?.id));
      deleteLogoFiles(result.asociacion.id);
      sendJson(res, 200, result);
      return;
    }

    if (method === "POST" && url.pathname === "/api/asociaciones/logo") {
      const buf = await readRawBody(req, 2 * 1024 * 1024);
      sendJson(res, 200, saveLogo(url.searchParams.get("id"), req.headers["content-type"], buf));
      return;
    }

    if (method === "POST" && url.pathname === "/api/asociaciones/logo/remove") {
      const body = await readJsonBody(req);
      sendJson(res, 200, removeLogo(body?.id));
      return;
    }

    if (method === "POST" && url.pathname === "/api/asociaciones/portal") {
      const body = await readJsonBody(req);
      sendJson(res, 200, await setPortalPassword(body));
      return;
    }

    if (method === "POST" && url.pathname === "/api/asociaciones/portal/remove") {
      const body = await readJsonBody(req);
      sendJson(res, 200, removePortalPassword(body));
      return;
    }

    if (method === "POST" && url.pathname === "/api/circuitos") {
      const body = await readJsonBody(req);
      sendJson(res, 200, mutateManifest((m) => upsertCircuito(m, body)));
      return;
    }

    if (method === "POST" && url.pathname === "/api/circuitos/remove") {
      const body = await readJsonBody(req);
      sendJson(res, 200, mutateManifest((m) => removeCircuito(m, body?.id)));
      return;
    }

    if (method === "POST" && url.pathname === "/api/remove") {
      const body = await readJsonBody(req);
      const result = removeEvent(body);
      sendJson(res, 200, result);
      return;
    }

    if (method === "POST" && url.pathname === "/api/rebuild") {
      const rebuilt = runRebuild();
      sendJson(res, 200, { ok: true, rebuilt });
      return;
    }

    if (method === "POST" && url.pathname === "/api/publish") {
      const result = await publish();
      sendJson(res, 200, result);
      return;
    }

    if (method === "GET") {
      const ocupadas = rutasOcupadas([...readdirSync(join(ROOT, "web")), "admin", "admin.html", "api", "data", "templates"]);
      const liga = asociacionDeRuta(loadManifest(), url.pathname, ocupadas, { todas: true });
      if (liga) {
        res.writeHead(302, { Location: destinoPortal(liga.id), "Cache-Control": "no-store" });
        res.end();
        return;
      }
      serveStatic(req, res, url.pathname);
      return;
    }

    sendJson(res, 405, { ok: false, error: "Método no permitido." });
  } catch (e) {
    const status = e.statusCode || 500;
    const message = e.stderr ? String(e.stderr).trim() || e.message : e.message || String(e);
    sendJson(res, status, {
      ok: false,
      error: message,
      ...(Array.isArray(e.errors) ? { errors: e.errors } : {}),
      ...(Array.isArray(e.warnings) ? { warnings: e.warnings } : {}),
      ...(e.duplicado ? { duplicado: e.duplicado } : {}),
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ArenaPro Stats — consola de publicación`);
  console.log(`Abre: http://${HOST}:${PORT}/admin.html`);
  console.log(`Sitio: http://${HOST}:${PORT}/`);
  console.log(`Ctrl+C para salir.`);
});
