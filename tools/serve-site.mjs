#!/usr/bin/env node
/**
 * Sirve _site/ como lo hace GitHub Pages (404.html para rutas inexistentes).
 * Uso: node tools/serve-site.mjs [puerto]   — lo usan las pruebas E2E.
 */
import http from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const site = join(dirname(fileURLToPath(import.meta.url)), "..", "_site");
const port = Number(process.argv[2]) || 4173;

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

if (!existsSync(join(site, "index.html"))) {
  console.error("Falta _site/. Corre primero: node tools/build-site.mjs");
  process.exit(1);
}

http
  .createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = normalize(join(site, rel));
    const dentro = file === site || file.startsWith(site + sep);
    if (dentro && existsSync(file) && statSync(file).isFile()) {
      res.writeHead(200, { "Content-Type": TIPOS[extname(file)] || "application/octet-stream" });
      res.end(readFileSync(file));
      return;
    }
    res.writeHead(404, { "Content-Type": TIPOS[".html"] });
    res.end(readFileSync(join(site, "404.html")));
  })
  .listen(port, "127.0.0.1", () => console.log(`_site en http://127.0.0.1:${port}/`));
