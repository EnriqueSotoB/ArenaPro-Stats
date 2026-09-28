/**
 * Qué carpeta del repo responde a cada URL. Las URLs no cambian aunque el repo esté
 * separado en web/, admin/ y data/: el sitio publicado y la consola local se ven igual.
 */
import { join, normalize, sep } from "node:path";

/** Prefijo de URL → carpeta del repo (el primero que coincide gana). */
export const MONTAJES_LOCALES = [
  ["/admin/", "admin"],
  ["/data/", "data"],
  ["/templates/", "templates"],
  ["/", "web"],
];

/**
 * @param {string} root raíz del repo
 * @param {string} urlPath ruta pedida (puede traer ?query)
 * @returns {string|null} archivo absoluto, o null si la ruta intenta salir de su carpeta
 */
export function archivoParaRuta(root, urlPath) {
  let ruta;
  try {
    ruta = decodeURIComponent(String(urlPath).split("?")[0]);
  } catch {
    return null;
  }
  if (ruta.includes("\0")) return null;
  if (ruta === "/admin.html") ruta = "/admin/admin.html";
  if (ruta.endsWith("/")) ruta += "index.html";

  const [prefijo, carpeta] = MONTAJES_LOCALES.find(([p]) => ruta.startsWith(p));
  const base = join(root, carpeta);
  const archivo = normalize(join(base, ruta.slice(prefijo.length)));
  return archivo.startsWith(base + sep) ? archivo : null;
}
