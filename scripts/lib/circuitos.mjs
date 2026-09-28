/**
 * Asociaciones, circuitos (una temporada de una asociación) y membresía de eventos
 * en data/manifest.json (version 2). Sin imports de Node: lo usan el sitio público,
 * el admin y el rebuild.
 */

export const MANIFEST_VERSION = 2;

/** Ids que chocan con secciones del router público (#temporada, #eventos, #competidor). */
const RESERVED_IDS = new Set(["temporada", "eventos", "competidor"]);

const TIPOS_ASOCIACION = new Set(["estatal", "federacion"]);

function fail(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function str(v) {
  return v == null ? "" : String(v).trim();
}

export function slugId(text) {
  return str(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normalizeAsociacion(a) {
  const tipo = str(a?.tipo);
  return {
    id: str(a?.id),
    siglas: str(a?.siglas),
    nombre: str(a?.nombre),
    tipo: TIPOS_ASOCIACION.has(tipo) ? tipo : "estatal",
    estado: str(a?.estado),
    logo: logoPath(a?.logo),
    hashtags: normalizeHashtags(a?.hashtags),
  };
}

/** "aerch, #Rodeo  rodeo" → "#aerch #Rodeo" (con #, sin repetidos sin importar mayúsculas). */
export function normalizeHashtags(v) {
  const seen = new Set();
  const out = [];
  for (const raw of str(v).split(/[\s,]+/)) {
    const tag = raw.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(`#${tag}`);
  }
  return out.join(" ");
}

/** Logo relativo a data/ (logos/{id}.png|jpg|webp); cualquier otra ruta se descarta. */
function logoPath(v) {
  const s = str(v).replace(/\\/g, "/");
  return /^logos\/[a-z0-9-]+\.(png|jpe?g|webp)$/.test(s) ? s : "";
}

export const LOGO_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function logoFileName(asociacionId, contentType) {
  const ext = LOGO_TYPES[str(contentType).split(";")[0].toLowerCase()];
  if (!ext) throw fail("El logo debe ser PNG, JPG o WEBP.");
  return `logos/${slugId(asociacionId)}.${ext}`;
}

function normalizeCircuito(c) {
  return {
    id: str(c?.id),
    asociacionId: str(c?.asociacionId),
    nombre: str(c?.nombre),
    temporada: str(c?.temporada),
    cutLine: c?.cutLine ?? null,
    cutLineVisible: c?.cutLineVisible === true,
    cutLinePorDisciplina:
      c?.cutLinePorDisciplina && typeof c.cutLinePorDisciplina === "object"
        ? { ...c.cutLinePorDisciplina }
        : {},
  };
}

function normalizeEventoEntry(e, fallbackCircuitos) {
  const ids = Array.isArray(e?.circuitos) ? e.circuitos.map(str).filter(Boolean) : fallbackCircuitos;
  return { ...e, circuitos: [...new Set(ids)] };
}

/**
 * Devuelve siempre un manifest v2. Un manifest v1 (un solo circuito: temporadaActiva + titulo)
 * se convierte a una asociación y un circuito con todos sus eventos.
 * @param {any} raw
 */
export function normalizeManifest(raw) {
  const m = raw && typeof raw === "object" ? raw : {};
  const eventosRaw = Array.isArray(m.eventos) ? m.eventos : [];

  if (Number(m.version) >= MANIFEST_VERSION) {
    const asociaciones = (Array.isArray(m.asociaciones) ? m.asociaciones : [])
      .map(normalizeAsociacion)
      .filter((a) => a.id);
    const circuitos = (Array.isArray(m.circuitos) ? m.circuitos : [])
      .map(normalizeCircuito)
      .filter((c) => c.id);
    const out = {
      version: MANIFEST_VERSION,
      circuitoDefault: str(m.circuitoDefault),
      asociaciones,
      circuitos,
      eventos: eventosRaw.map((e) => normalizeEventoEntry(e, [])),
    };
    out.circuitoDefault = defaultCircuitoId(out);
    return out;
  }

  const titulo = str(m.titulo) || "Temporada";
  const circuitoId = slugId(titulo) || "circuito";
  return {
    version: MANIFEST_VERSION,
    circuitoDefault: circuitoId,
    asociaciones: [
      { id: "general", siglas: "", nombre: "General", tipo: "federacion", estado: "", logo: "", hashtags: "" },
    ],
    circuitos: [
      normalizeCircuito({
        id: circuitoId,
        asociacionId: "general",
        nombre: titulo,
        temporada: str(m.temporadaActiva),
        cutLine: m.cutLine,
        cutLineVisible: m.cutLineVisible,
        cutLinePorDisciplina: m.cutLinePorDisciplina,
      }),
    ],
    eventos: eventosRaw.map((e) => normalizeEventoEntry(e, [circuitoId])),
  };
}

export function findAsociacion(manifest, id) {
  const key = str(id);
  return (manifest?.asociaciones || []).find((a) => a.id === key) || null;
}

export function findCircuito(manifest, id) {
  const key = str(id);
  return (manifest?.circuitos || []).find((c) => c.id === key) || null;
}

export function defaultCircuitoId(manifest) {
  const wanted = str(manifest?.circuitoDefault);
  if (wanted && findCircuito(manifest, wanted)) return wanted;
  return manifest?.circuitos?.[0]?.id || "";
}

export function eventosDeCircuito(manifest, circuitoId) {
  const key = str(circuitoId);
  return (manifest?.eventos || []).filter((e) => (e.circuitos || []).includes(key));
}

/**
 * Circuitos agrupados por asociación (para selects). Temporadas más recientes primero.
 * @returns {Array<{ asociacion: object, circuitos: object[] }>}
 */
export function circuitosPorAsociacion(manifest) {
  const byTemporadaDesc = (a, b) =>
    b.temporada.localeCompare(a.temporada, "es", { numeric: true }) ||
    a.nombre.localeCompare(b.nombre, "es");
  const grupos = (manifest?.asociaciones || []).map((asociacion) => ({
    asociacion,
    circuitos: (manifest.circuitos || [])
      .filter((c) => c.asociacionId === asociacion.id)
      .sort(byTemporadaDesc),
  }));
  const huerfanos = (manifest?.circuitos || []).filter(
    (c) => !findAsociacion(manifest, c.asociacionId)
  );
  if (huerfanos.length) {
    grupos.push({
      asociacion: { id: "", siglas: "", nombre: "Sin asociación", tipo: "estatal", estado: "" },
      circuitos: huerfanos.sort(byTemporadaDesc),
    });
  }
  return grupos;
}

/** Valida y limpia la lista de circuitos de un evento. */
export function validarCircuitosEvento(manifest, ids) {
  const list = [...new Set((Array.isArray(ids) ? ids : []).map(str).filter(Boolean))];
  if (!list.length) throw fail("Elige al menos un circuito para el evento.");
  const unknown = list.filter((id) => !findCircuito(manifest, id));
  if (unknown.length) throw fail(`Circuito no existe: ${unknown.join(", ")}.`);
  return list;
}

function assertIdLibre(id, taken, what) {
  if (!id) throw fail(`No se pudo generar un id para ${what}.`);
  if (RESERVED_IDS.has(id)) throw fail(`"${id}" es una palabra reservada; usa otro nombre.`);
  if (taken) throw fail(`Ya existe ${what} con id "${id}".`, 409);
}

/**
 * Crea o edita una asociación. Si `input.id` existe se edita; si no, se crea con id = siglas.
 * @returns {{ manifest: object, asociacion: object }}
 */
export function upsertAsociacion(manifest, input) {
  const next = normalizeManifest(manifest);
  const data = normalizeAsociacion(input);
  if (!data.siglas) throw fail("Faltan las siglas de la asociación.");
  if (!data.nombre) throw fail("Falta el nombre de la asociación.");

  const editId = str(input?.id);
  if (editId) {
    const idx = next.asociaciones.findIndex((a) => a.id === editId);
    if (idx < 0) throw fail(`No se encontró la asociación "${editId}".`, 404);
    const prev = next.asociaciones[idx];
    const logo = input?.logo === undefined ? prev.logo : data.logo;
    const hashtags = input?.hashtags === undefined ? prev.hashtags : data.hashtags;
    const asociacion = { ...data, id: editId, logo, hashtags };
    next.asociaciones[idx] = asociacion;
    return { manifest: next, asociacion };
  }

  const id = slugId(data.siglas);
  assertIdLibre(id, Boolean(findAsociacion(next, id)), "una asociación");
  const asociacion = { ...data, id };
  next.asociaciones.push(asociacion);
  return { manifest: next, asociacion };
}

/** Asigna (o quita con logo = "") el logo de una asociación. */
export function setAsociacionLogo(manifest, id, logo) {
  const next = normalizeManifest(manifest);
  const asociacion = findAsociacion(next, id);
  if (!asociacion) throw fail(`No se encontró la asociación "${str(id)}".`, 404);
  asociacion.logo = logoPath(logo);
  return { manifest: next, asociacion };
}

export function removeAsociacion(manifest, id) {
  const next = normalizeManifest(manifest);
  const key = str(id);
  const asociacion = findAsociacion(next, key);
  if (!asociacion) throw fail(`No se encontró la asociación "${key}".`, 404);
  const usados = next.circuitos.filter((c) => c.asociacionId === key);
  if (usados.length) {
    throw fail(
      `${asociacion.siglas || asociacion.nombre} tiene ${usados.length} circuito(s). Elimínalos primero.`,
      409
    );
  }
  next.asociaciones = next.asociaciones.filter((a) => a.id !== key);
  return { manifest: next, asociacion };
}

/**
 * Crea o edita un circuito. Si `input.id` existe se edita (conserva la línea de corte);
 * si no, se crea con id = slug del nombre. `input.principal === true` lo vuelve el default del sitio.
 * @returns {{ manifest: object, circuito: object }}
 */
export function upsertCircuito(manifest, input) {
  const next = normalizeManifest(manifest);
  const asociacionId = str(input?.asociacionId);
  const nombre = str(input?.nombre);
  const temporada = str(input?.temporada);
  if (!findAsociacion(next, asociacionId)) throw fail("Elige una asociación válida.");
  if (!nombre) throw fail("Falta el nombre del circuito.");
  if (!temporada) throw fail("Falta la temporada del circuito.");

  const editId = str(input?.id);
  let circuito;
  if (editId) {
    const idx = next.circuitos.findIndex((c) => c.id === editId);
    if (idx < 0) throw fail(`No se encontró el circuito "${editId}".`, 404);
    circuito = { ...next.circuitos[idx], asociacionId, nombre, temporada };
    next.circuitos[idx] = circuito;
  } else {
    const id = slugId(nombre);
    assertIdLibre(id, Boolean(findCircuito(next, id)), "un circuito");
    circuito = normalizeCircuito({ id, asociacionId, nombre, temporada });
    next.circuitos.push(circuito);
  }

  if (input?.principal === true || !next.circuitoDefault) next.circuitoDefault = circuito.id;
  return { manifest: next, circuito };
}

export function removeCircuito(manifest, id) {
  const next = normalizeManifest(manifest);
  const key = str(id);
  const circuito = findCircuito(next, key);
  if (!circuito) throw fail(`No se encontró el circuito "${key}".`, 404);
  const usados = eventosDeCircuito(next, key);
  if (usados.length) {
    throw fail(
      `${circuito.nombre} tiene ${usados.length} evento(s). Quítalo de esos eventos (Editar) antes de eliminarlo.`,
      409
    );
  }
  next.circuitos = next.circuitos.filter((c) => c.id !== key);
  next.circuitoDefault = defaultCircuitoId(next);
  return { manifest: next, circuito };
}

/** Archivo de salida del rebuild para un circuito, relativo a data/. */
export function circuitoDataFile(circuitoId) {
  return `circuitos/${str(circuitoId)}.json`;
}
