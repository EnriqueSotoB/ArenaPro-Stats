/**
 * Guardia de la consola local. La IP 127.0.0.1 no basta: es el propio navegador quien
 * hace la petición, así que cualquier página abierta podría mandar POST (CSRF) o leer
 * respuestas con DNS rebinding. Se exige Host local, Origin local y un token por arranque
 * en un header propio (que además obliga al navegador a hacer preflight).
 */

export const TOKEN_HEADER = "x-arenapro-token";

function hostsLocales(port) {
  return new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
}

function igualConstante(a, b) {
  const x = String(a ?? "");
  const y = String(b ?? "");
  if (!x || x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/**
 * Motivo del rechazo, o null si la petición es aceptable.
 * @param {{ method?: string, headers: Record<string, string|string[]|undefined> }} req
 * @param {{ port: number, token: string }} cfg
 */
export function motivoRechazo(req, { port, token }) {
  const headers = req.headers || {};
  const locales = hostsLocales(port);
  const host = String(headers.host || "").toLowerCase();
  if (!locales.has(host)) {
    return "Host no permitido: abre la consola en http://127.0.0.1:" + port + "/admin.html.";
  }
  const method = String(req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return null;

  const origin = String(headers.origin || "").toLowerCase();
  if (!origin || !locales.has(origin.replace(/^http:\/\//, ""))) {
    return "Origen no permitido: los cambios solo se aceptan desde la consola local.";
  }
  if (!igualConstante(headers[TOKEN_HEADER], token)) {
    return "Sesión de consola vencida: recarga la página (publicar.bat se reinició).";
  }
  return null;
}
