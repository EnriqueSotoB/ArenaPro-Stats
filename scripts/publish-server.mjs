#!/usr/bin/env node
/**
 * Consola local de publicación ArenaPro Stats.
 * Uso: node scripts/publish-server.mjs
 * Solo escucha en 127.0.0.1 — no exponer a la red.
 */
import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { rebuildTemporada } from "./rebuild-temporada.mjs";

const PORT = Number(process.env.STATS_PUBLISH_PORT) || 8787;
const HOST = "127.0.0.1";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES_URL = "https://enriquesotob.github.io/ArenaPro-Stats/";

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

function ingest({ evento, temporada }) {
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

  const rebuilt = rebuildTemporada(ROOT);

  return {
    ok: true,
    file: relFile,
    entry,
    temporada: temp,
    rebuilt,
  };
}

function publish() {
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
      const result = ingest(body);
      sendJson(res, 200, result);
      return;
    }

    if (method === "POST" && url.pathname === "/api/rebuild") {
      const rebuilt = rebuildTemporada(ROOT);
      sendJson(res, 200, { ok: true, rebuilt });
      return;
    }

    if (method === "POST" && url.pathname === "/api/publish") {
      const result = publish();
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
