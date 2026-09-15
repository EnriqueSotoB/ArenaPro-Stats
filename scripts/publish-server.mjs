#!/usr/bin/env node
/**
 * Consola local de publicación ArenaPro Stats.
 * Uso: node scripts/publish-server.mjs
 * Solo escucha en 127.0.0.1 — no exponer a la red.
 */
import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, unlinkSync } from "node:fs";
import { dirname, join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const PORT = Number(process.env.STATS_PUBLISH_PORT) || 8787;
const HOST = "127.0.0.1";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, "..");
const PAGES_URL = "https://enriquesotob.github.io/ArenaPro-Stats/";

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
    const err = new Error(`Falló regenerar temporada.json. ${detail}`);
    err.statusCode = 500;
    throw err;
  }

  const outPath = join(ROOT, "data", "temporada.json");
  const payload = JSON.parse(readFileSync(outPath, "utf8"));
  assertTemporadaCircuito(payload);
  return {
    standings: payload.standings?.length ?? 0,
    eventosContados: payload.eventosContados ?? 0,
    temporada: payload.temporada,
    outPath,
    disciplinas: [
      ...new Set((payload.standings || []).map((s) => s.disciplinaId).filter(Boolean)),
    ],
    log: String(stdout || "").trim(),
  };
}

/** No publicar acumulado agrupado por local:{id} / cat_* (rompe el circuito). */
function assertTemporadaCircuito(payload) {
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
      `temporada.json inválida: ${bad.length} filas sin disciplina de circuito (ej. ${sample}). Reinicia publicar.bat.`
    );
    err.statusCode = 500;
    throw err;
  }
  if (!(payload.standings || []).some((s) => s.disciplinaId)) {
    const err = new Error(
      "temporada.json sin disciplinaId — el rebuild viejo sigue en memoria. Cierra y abre publicar.bat."
    );
    err.statusCode = 500;
    throw err;
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
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
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const max = 8 * 1024 * 1024;
    req.on("data", (c) => {
      size += c.length;
      if (size > max) {
        reject(Object.assign(new Error("Archivo demasiado grande."), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error("JSON inválido."), { statusCode: 400 }));
      }
    });
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
  return JSON.parse(readFileSync(path, "utf8"));
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
    temporadaActiva: manifest.temporadaActiva || "",
    titulo: manifest.titulo || "",
    cutLine: manifest.cutLine ?? null,
    eventos: manifest.eventos || [],
    dirty,
    branch,
    gitSummary: ahead,
  };
}

async function ingest({ evento, temporada }) {
  if (!evento || typeof evento !== "object") {
    const err = new Error("Falta el JSON del evento.");
    err.statusCode = 400;
    throw err;
  }

  const temp =
    (temporada != null && String(temporada).trim()) ||
    (evento.temporada != null && String(evento.temporada).trim()) ||
    loadManifest().temporadaActiva ||
    String(new Date().getFullYear());

  evento.temporada = temp;
  if (!evento.nombreEvento && evento.eventoId) {
    evento.nombreEvento = String(evento.eventoId);
  }

  const fecha =
    evento.fecha ||
    (evento.exportedAt ? String(evento.exportedAt).slice(0, 10) : "") ||
    new Date().toISOString().slice(0, 10);
  evento.fecha = fecha;

  const id =
    (evento.eventoId && String(evento.eventoId).trim()) ||
    `evt_${fecha}_${safeSlug(evento.nombreEvento)}`;
  evento.eventoId = id;

  const fileName = `${fecha}-${safeSlug(evento.nombreEvento)}.json`;
  const relFile = `eventos/${fileName}`;
  const absDir = join(ROOT, "data", "eventos");
  mkdirSync(absDir, { recursive: true });
  const absFile = join(absDir, fileName);
  writeFileSync(absFile, JSON.stringify(evento, null, 2) + "\n", "utf8");

  const manifest = loadManifest();
  manifest.temporadaActiva = temp;
  manifest.eventos = Array.isArray(manifest.eventos) ? manifest.eventos : [];

  const entry = {
    id,
    nombre: evento.nombreEvento || id,
    fecha,
    sede: evento.sede || "",
    file: relFile,
  };

  const idx = manifest.eventos.findIndex((e) => e.id === id || e.file === relFile);
  if (idx >= 0) manifest.eventos[idx] = entry;
  else manifest.eventos.push(entry);

  manifest.eventos.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  saveManifest(manifest);

  const rebuilt = runRebuild();

  return {
    ok: true,
    file: relFile,
    entry,
    temporada: temp,
    rebuilt,
  };
}

function removeEvent({ id }) {
  const eventId = id != null ? String(id).trim() : "";
  if (!eventId) {
    const err = new Error("Falta el id del evento.");
    err.statusCode = 400;
    throw err;
  }

  const manifest = loadManifest();
  manifest.eventos = Array.isArray(manifest.eventos) ? manifest.eventos : [];
  const idx = manifest.eventos.findIndex((e) => e.id === eventId);
  if (idx < 0) {
    const err = new Error(`No se encontró el evento "${eventId}".`);
    err.statusCode = 404;
    throw err;
  }

  const entry = manifest.eventos[idx];
  const rel = String(entry.file || "").replace(/\\/g, "/");
  if (rel && !rel.includes("..") && rel.startsWith("eventos/")) {
    const absFile = join(ROOT, "data", ...rel.split("/"));
    const relToRoot = relative(ROOT, absFile);
    if (!relToRoot.startsWith("..") && existsSync(absFile) && statSync(absFile).isFile()) {
      unlinkSync(absFile);
    }
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

async function syncWithRemote() {
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  git(["fetch", "origin"]);

  const rebaseMerge = join(ROOT, ".git", "rebase-merge");
  try {
    git(["pull", "--rebase", "origin", branch]);
  } catch (e) {
    const inRebase = existsSync(rebaseMerge);
    const msg = String(e.stderr || e.message || e);
    if (!inRebase && !/conflict/i.test(msg)) throw e;

    // Fuente de verdad local: regenerar acumulado y continuar el rebase.
    runRebuild();
    try {
      git(["add", "--", "data"]);
      execFileSync("git", ["-c", "core.editor=true", "rebase", "--continue"], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GIT_EDITOR: "true" },
      });
    } catch (e2) {
      try {
        git(["rebase", "--abort"]);
      } catch {
        /* ignore */
      }
      const err = new Error(
        `No se pudo sincronizar con GitHub. ${String(e2.stderr || e2.message || e2).trim()}`
      );
      err.statusCode = 409;
      throw err;
    }
  }
}

async function publish() {
  // Siempre regenerar en proceso fresco antes de commitear (no confiar en ingest previo).
  runRebuild();

  const statusBefore = git(["status", "--porcelain", "--", "data"]);
  if (!statusBefore) {
    return { ok: true, published: false, message: "No hay cambios en data/ para publicar." };
  }

  git(["add", "--", "data"]);
  const staged = git(["diff", "--cached", "--name-only"]);
  if (!staged) {
    return { ok: true, published: false, message: "Nada que publicar." };
  }

  const msg = `stats: actualizar datos de temporada ${loadManifest().temporadaActiva || ""}`.trim();
  try {
    git(["commit", "-m", msg]);
  } catch (e) {
    const stderr = String(e.stderr || e.message || e);
    if (/nothing to commit/i.test(stderr)) {
      return { ok: true, published: false, message: "Nada que publicar." };
    }
    throw e;
  }

  await syncWithRemote();
  git(["push", "origin", "HEAD"]);
  return {
    ok: true,
    published: true,
    message: "Publicado. GitHub Pages puede tardar 1–2 minutos.",
    pagesUrl: PAGES_URL,
  };
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  if (rel.includes("\0")) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  const parts = rel.replace(/^\/+/, "").split("/").filter((p) => p && p !== ".");
  if (parts.some((p) => p === "..")) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const candidate = join(ROOT, ...parts);
  const relToRoot = relative(ROOT, candidate);
  if (relToRoot.startsWith("..")) {
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
  res.end(readFileSync(candidate));
}

const server = http.createServer(async (req, res) => {
  try {
    assertLocal(req);
    const method = req.method || "GET";
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

    if (method === "GET" && url.pathname === "/api/status") {
      sendJson(res, 200, getStatus());
      return;
    }

    if (method === "POST" && url.pathname === "/api/ingest") {
      const body = await readJsonBody(req);
      const result = await ingest(body);
      sendJson(res, 200, result);
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
      serveStatic(req, res, url.pathname);
      return;
    }

    sendJson(res, 405, { ok: false, error: "Método no permitido." });
  } catch (e) {
    const status = e.statusCode || 500;
    const message = e.stderr ? String(e.stderr).trim() || e.message : e.message || String(e);
    sendJson(res, status, { ok: false, error: message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ArenaPro Stats — consola de publicación`);
  console.log(`Abre: http://${HOST}:${PORT}/admin.html`);
  console.log(`Sitio: http://${HOST}:${PORT}/`);
  console.log(`Ctrl+C para salir.`);
});
