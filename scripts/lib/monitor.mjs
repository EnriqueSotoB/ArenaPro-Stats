/**
 * Revisión del sitio en vivo: disponible, con datos válidos, sin archivos internos
 * y con la misma versión que main (si no, el último deploy falló).
 */

/** Tiempo que se le da a un deploy antes de considerarlo atorado. */
export const GRACIA_DEPLOY_MS = 30 * 60 * 1000;

/**
 * @param {{
 *   baseUrl: string,
 *   fetchFn?: typeof fetch,
 *   commitMain?: string,
 *   fechaCommitMain?: Date,
 *   ahora?: Date,
 * }} opts
 * @returns {Promise<string[]>} problemas encontrados (vacío = todo bien)
 */
export async function revisarSitio({ baseUrl, fetchFn = fetch, commitMain, fechaCommitMain, ahora = new Date() }) {
  const problemas = [];
  const url = (p) => new URL(p, baseUrl).toString();
  const get = async (p) => {
    try {
      return await fetchFn(url(p), { cache: "no-store", redirect: "follow" });
    } catch (e) {
      problemas.push(`${p}: no respondió (${e?.message || e}).`);
      return null;
    }
  };

  const portada = await get("/");
  let html = "";
  if (portada) {
    if (portada.status !== 200) problemas.push(`La portada respondió ${portada.status}.`);
    else html = await portada.text();
    if (html && !html.includes("ArenaPro")) problemas.push("La portada no contiene la marca ArenaPro.");
  }

  let manifest = null;
  const resManifest = await get("/data/manifest.json");
  if (resManifest) {
    if (resManifest.status !== 200) problemas.push(`data/manifest.json respondió ${resManifest.status}.`);
    else {
      try {
        manifest = await resManifest.json();
      } catch {
        problemas.push("data/manifest.json no es JSON válido.");
      }
    }
  }

  if (manifest) {
    const principal = String(manifest.circuitoDefault || "");
    if (!principal) problemas.push("El manifest no tiene circuito principal.");
    else {
      const resCircuito = await get(`/data/circuitos/${principal}.json`);
      if (resCircuito && resCircuito.status !== 200) {
        problemas.push(`El circuito principal (${principal}) respondió ${resCircuito.status}.`);
      } else if (resCircuito) {
        try {
          const circuito = await resCircuito.json();
          if (!(Number(circuito?.eventosContados) > 0)) {
            problemas.push(`El circuito principal (${principal}) no tiene eventos publicados.`);
          }
        } catch {
          problemas.push(`El circuito principal (${principal}) no es JSON válido.`);
        }
      }
    }
  }

  for (const interno of ["/admin.html", "/data/competidor-aliases.json"]) {
    const res = await get(interno);
    if (res && res.status === 200) problemas.push(`${interno} está expuesto públicamente.`);
  }

  if (html && commitMain && fechaCommitMain) {
    const version = html.match(/css\/styles\.css\?v=([0-9a-f]+)/)?.[1];
    const esperado = commitMain.slice(0, 12);
    const vencido = ahora.getTime() - fechaCommitMain.getTime() > GRACIA_DEPLOY_MS;
    if (vencido && version !== esperado) {
      problemas.push(
        `El sitio tiene la versión ${version || "desconocida"} pero main va en ${esperado} desde hace más de 30 min: revisa el workflow "Deploy Pages".`
      );
    }
  }

  return problemas;
}
