/**
 * Contenido de las imágenes para redes (qué filas, títulos y texto de la publicación).
 * Sin DOM: lo usa el portal de asociaciones y se prueba en Node.
 */

import { buildEventoRanking, formatResultadoValor, fmtNum, fmtTime } from "./event-model.js";
import { fmtMxn } from "../scripts/lib/money.mjs";

export const PUBLIC_SITE = "https://estadisticas.arenapro.mx/";
export const ALL_AROUND_ID = "__all-around";

export function fmtFecha(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!m) return "";
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function slugArchivo(text) {
  return (
    String(text || "estadisticas")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 80) || "estadisticas"
  );
}

/** Link al sitio público (desde localhost apunta al dominio real, para que sirva en la publicación). */
export function publicUrl(hash = "", loc = globalThis.location) {
  const host = loc?.hostname || "";
  const local = !host || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host) || loc?.protocol === "file:";
  const base = local ? PUBLIC_SITE : new URL("./", loc.href).href;
  return `${base}${hash}`;
}

function routeHash(circuitoId, section, id) {
  return `#${encodeURIComponent(circuitoId)}/${section}${id ? `/${encodeURIComponent(id)}` : ""}`;
}

function disciplinaKey(s) {
  return s.disciplinaId || s.categoriaId || s.categoriaNombre || "_";
}

/** Disciplinas del acumulado con su número de competidores, en orden alfabético. */
export function disciplinasDeTemporada(temporada) {
  const map = new Map();
  for (const s of temporada?.standings || []) {
    const id = disciplinaKey(s);
    const d = map.get(id) || { id, nombre: s.disciplinaNombre || s.categoriaNombre || id, competidores: 0 };
    d.competidores += 1;
    map.set(id, d);
  }
  return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * Clasificación de temporada de una disciplina (o Vaquero Completo con ALL_AROUND_ID).
 * @param {"puntos"|"dinero"} metric
 */
export function specTemporada(temporada, disciplinaId, metric = "puntos") {
  const circuitoId = temporada?.circuitoId || "";
  if (disciplinaId === ALL_AROUND_ID) {
    const rows = temporada?.allAround || [];
    return {
      titulo: "Vaquero Completo",
      subtitulo: `Dinero ganado en 2+ disciplinas · ${rows.length} clasificados`,
      filas: rows.map((r, i) => ({
        lugar: i + 1,
        nombre: r.nombre || "—",
        detalle: `${(r.disciplinasConDinero || []).length} disciplinas`,
        valor: fmtMxn(r.dineroTotal),
      })),
      hash: routeHash(circuitoId, "temporada", ALL_AROUND_ID),
      archivo: "vaquero-completo",
    };
  }

  const dinero = metric === "dinero";
  const valueOf = (r) => (dinero ? Number(r.dineroTotal) || 0 : Number(r.puntosTotales) || 0);
  const rows = (temporada?.standings || [])
    .filter((s) => disciplinaKey(s) === disciplinaId)
    .sort((a, b) => valueOf(b) - valueOf(a));
  const nombre = rows[0]?.disciplinaNombre || rows[0]?.categoriaNombre || disciplinaId;
  return {
    titulo: nombre,
    subtitulo: `${dinero ? "Clasificación por dinero" : "Clasificación por puntos"} · ${temporada?.eventosContados ?? 0} eventos`,
    filas: rows.map((r, i) => ({
      lugar: i + 1,
      nombre: r.nombre || r.competidorId || "—",
      detalle: `${r.eventos ?? 0} evento${r.eventos === 1 ? "" : "s"}`,
      valor: dinero ? fmtMxn(r.dineroTotal ?? 0) : `${fmtNum(r.puntosTotales)} pts`,
      valorCorto: dinero ? fmtMxn(r.dineroTotal ?? 0) : fmtNum(r.puntosTotales),
    })),
    hash: routeHash(circuitoId, "temporada", disciplinaId),
    archivo: `${disciplinaId}-${metric}`,
  };
}

/** Resultados de una categoría de un evento (evento ya normalizado con normalizeEvento). */
export function specEvento(evento, cat, circuitoId) {
  const ranking = buildEventoRanking(evento, cat);
  return {
    linea: evento.nombreEvento || evento.eventoId || "Evento",
    titulo: cat.nombre,
    subtitulo: ["Resultados", fmtFecha(evento.fecha), evento.sede].filter(Boolean).join(" · "),
    filas: ranking
      .filter((r) => !r.sinPosicion && r.lugar != null)
      .map((r) => ({
        lugar: r.lugar,
        nombre: r.nombre,
        detalle: Number(r.montoGanado) > 0 ? fmtMxn(r.montoGanado) : r.equipo || "",
        valor: formatResultadoValor(r),
      })),
    hash: routeHash(circuitoId, "eventos", evento.eventoId),
    archivo: `${evento.nombreEvento || "evento"}-${cat.nombre}`,
    pie: fmtFecha(evento.fecha),
  };
}

function movimientoDe(f) {
  if (f.nuevo) return { tipo: "nuevo" };
  if (!f.cambio) return { tipo: "igual" };
  return { tipo: f.cambio > 0 ? "sube" : "baja", n: Math.abs(f.cambio) };
}

/**
 * Clasificación de una disciplina después del último rodeo, con flechas de lugares movidos.
 * @param {ReturnType<typeof import("./portal-stats.js").calcularMovimientos>} mv
 */
export function specMovimientos(mv, disciplinaId, circuitoId) {
  const tabla = (mv?.tablas || []).find((t) => t.disciplinaId === disciplinaId);
  if (!tabla || !mv.evento) return null;
  const pts = (n) => `${fmtNum(n)} ${n === 1 ? "pt" : "pts"}`;
  const lider = (mv.cambiosLider || []).find((c) => c.disciplinaId === disciplinaId);
  const subio = tabla.filas
    .filter((f) => f.cambio > 0)
    .sort((a, b) => b.cambio - a.cambio || a.lugar - b.lugar)[0];
  const resumen = [
    lider ? `Nuevo líder: ${lider.ahora.join(", ")}` : "",
    subio ? `Mayor subida: ${subio.nombre} (del #${subio.lugarAntes} al #${subio.lugar})` : "",
  ].filter(Boolean);
  return {
    titulo: tabla.disciplinaNombre,
    subtitulo: `Clasificación después de ${mv.evento.nombre}`,
    filas: tabla.filas.map((f) => ({
      lugar: f.lugar,
      nombre: f.nombre,
      detalle: f.corrio ? `${pts(f.puntosEvento)} en el rodeo` : "No corrió",
      valor: pts(f.puntos),
      valorCorto: fmtNum(f.puntos),
      movimiento: movimientoDe(f),
    })),
    resumen: resumen.join("\n"),
    hash: routeHash(circuitoId, "temporada", disciplinaId),
    archivo: `${disciplinaId}-movimientos`,
  };
}

export function fmtMarca(valor, esPuntos) {
  return esPuntos ? `${fmtNum(valor)} pts` : `${fmtTime(valor)} s`;
}

function nombresTitulares(titulares) {
  return (titulares || []).map((t) => t.nombre).join(", ");
}

/**
 * Récords de la temporada: una fila por disciplina (sin lugar), con NUEVO si lo impuso el último rodeo.
 * @param {ReturnType<typeof import("./portal-stats.js").calcularRecords>} records
 */
export function specRecords(records, circuitoId) {
  if (!records?.length) return null;
  return {
    titulo: "Récords de la temporada",
    subtitulo: "Mejor tiempo o calificación en cualquier rodeo",
    lista: true,
    filas: records.map((r) => {
      const t = r.titulares || [];
      const eventos = [...new Set(t.map((x) => x.eventoNombre))];
      return {
        lugar: "",
        nombre: r.disciplinaNombre,
        detalle: [nombresTitulares(t) + (t.length > 1 ? " (empate)" : ""), eventos.join(", ")].filter(Boolean).join(" · "),
        valor: fmtMarca(r.valor, r.esPuntos),
        ...(r.nuevo ? { movimiento: { tipo: "nuevo" } } : {}),
      };
    }),
    hash: routeHash(circuitoId, "temporada"),
    archivo: "records-temporada",
  };
}

/**
 * Récords que se rompieron en un evento, con la marca que tenían antes.
 * @param {ReturnType<typeof import("./portal-stats.js").calcularRecordsNuevos>} nuevos
 * @param {{ id: string, nombre?: string, fecha?: string }} evento
 */
export function specRecordsNuevos(nuevos, evento, circuitoId) {
  if (!nuevos?.length || !evento) return null;
  return {
    titulo: nuevos.length === 1 ? "¡Nuevo récord!" : "¡Récords nuevos!",
    subtitulo: [evento.nombre || evento.id, fmtFecha(evento.fecha)].filter(Boolean).join(" · "),
    lista: true,
    filas: nuevos.map((r) => ({
      lugar: "",
      nombre: nombresTitulares(r.titulares),
      detalle: `${r.disciplinaNombre} · antes ${fmtMarca(r.anterior.valor, r.esPuntos)}`,
      valor: fmtMarca(r.valor, r.esPuntos),
      caption: `${r.disciplinaNombre}: ${nombresTitulares(r.titulares)} · ${fmtMarca(r.valor, r.esPuntos)} (antes ${fmtMarca(
        r.anterior.valor,
        r.esPuntos
      )}, ${nombresTitulares(r.anterior.titulares)})`,
    })),
    hash: routeHash(circuitoId, "eventos", evento.id),
    archivo: `${evento.nombre || evento.id}-records-nuevos`,
    pie: fmtFecha(evento.fecha),
  };
}

function flechaTexto(m) {
  if (!m) return "";
  if (m.tipo === "sube") return ` (▲${m.n})`;
  if (m.tipo === "baja") return ` (▼${m.n})`;
  if (m.tipo === "nuevo") return " (nuevo)";
  return "";
}

/** Agrega asociación, circuito, logo, hashtags y fecha de actualización al spec. */
export function withContexto(spec, { asociacion, circuito, temporada, logoBase = "data/" }) {
  const actualizado = fmtFecha(temporada?.actualizadoEn);
  return {
    kicker: [asociacion?.siglas, asociacion?.nombre].filter(Boolean).join(" · "),
    linea: circuito?.nombre || "",
    pie: actualizado ? `Actualizado ${actualizado}` : "",
    sitio: new URL(publicUrl()).host,
    logo: asociacion?.logo ? `${logoBase}${asociacion.logo}` : "",
    hashtags: asociacion?.hashtags || "",
    ...spec,
    archivo: `${slugArchivo(circuito?.id)}-${slugArchivo(spec.archivo)}`,
  };
}

/** Texto sugerido para la publicación: encabezado, podio, link y hashtags. */
export function shareCaption(spec) {
  const linea = (f) => {
    if (f.caption) return f.caption;
    if (f.lugar === "" || f.lugar == null) {
      return `${f.nombre}: ${f.valor}${f.movimiento?.tipo === "nuevo" ? " (nuevo)" : ""}${f.detalle ? ` · ${f.detalle}` : ""}`;
    }
    return `${f.lugar}. ${f.nombre} · ${f.valor}${flechaTexto(f.movimiento)}`;
  };
  const top = (spec.filas || [])
    .slice(0, spec.lista ? Infinity : 3)
    .map(linea)
    .join("\n");
  const encabezado = [spec.titulo, spec.linea].filter(Boolean).join(" · ");
  return [
    [encabezado, spec.subtitulo].filter(Boolean).join("\n"),
    spec.resumen,
    top,
    `Resultados completos: ${publicUrl(spec.hash)}`,
    spec.hashtags,
  ]
    .filter(Boolean)
    .join("\n\n");
}
