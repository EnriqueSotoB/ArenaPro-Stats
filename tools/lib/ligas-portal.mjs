/**
 * Liga corta del portal para cada asociación: estadisticas.arenapro.mx/{id} → portal.html#{id}.
 * GitHub Pages es estático: el build deja {id}/index.html que redirige, y la consola local
 * responde la misma ruta con un redirect.
 */
import { normalizePortal } from "../../web/lib/portal-auth.mjs";

const ID_VALIDO = /^[a-z0-9][a-z0-9-]*$/;

export function destinoPortal(id) {
  return `/portal.html#${encodeURIComponent(id)}`;
}

/** Nombres de primer nivel del sitio (con y sin extensión): una liga corta no puede taparlos. */
export function rutasOcupadas(nombres) {
  return new Set([...nombres].flatMap((n) => [n.toLowerCase(), n.toLowerCase().replace(/\.[^.]+$/, "")]));
}

/**
 * Asociaciones que llevan liga corta: con acceso al portal (salvo `todas`) y cuyo id no
 * choca con un archivo o carpeta del sitio.
 * @param {any} manifest normalizado
 * @param {Set<string>} ocupadas ver rutasOcupadas
 */
export function asociacionesConLiga(manifest, ocupadas = new Set(), { todas = false } = {}) {
  return (manifest?.asociaciones || []).filter(
    (a) => ID_VALIDO.test(a.id || "") && !ocupadas.has(a.id) && (todas || normalizePortal(a.portal))
  );
}

/** Asociación cuya liga corta es esta ruta (`/aerch`, `/aerch/`, `/AERCH`), o null. */
export function asociacionDeRuta(manifest, pathname, ocupadas = new Set(), opciones = {}) {
  const m = /^\/([^/]+)\/?$/.exec(String(pathname || ""));
  if (!m) return null;
  const id = m[1].toLowerCase();
  return asociacionesConLiga(manifest, ocupadas, opciones).find((a) => a.id === id) || null;
}

const esc = (s) =>
  String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function paginaLigaPortal(a) {
  const destino = esc(destinoPortal(a.id));
  const nombre = esc(a.siglas || a.nombre || a.id);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Portal ${nombre} — ArenaPro Estadísticas</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta http-equiv="refresh" content="0; url=${destino}" />
</head>
<body>
  <p><a href="${destino}">Entrar al portal ${nombre}</a></p>
</body>
</html>
`;
}
