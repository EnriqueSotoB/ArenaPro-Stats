/**
 * Tablas de temporada en CSV para que la asociación las abra en Excel o Google Sheets.
 * Sin DOM: lo usa el portal y se prueba en Node.
 *
 * Coma como separador y punto decimal (configuración regional es-MX de Excel); BOM para que
 * Excel lea los acentos como UTF-8.
 */

const BOM = "\uFEFF";

/** Excel ejecuta como fórmula un texto que empieza con = + - @ (inyección CSV). */
function celdaTexto(v) {
  const s = String(v ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function celda(v) {
  if (v == null || v === "") return "";
  const s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : celdaTexto(v);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** @param {Array<Array<string|number|null|undefined>>} filas primera fila = encabezados */
export function toCsv(filas) {
  return BOM + filas.map((f) => f.map(celda).join(",")).join("\r\n") + "\r\n";
}

function idDisciplina(s) {
  return s.disciplinaId || s.categoriaId || s.categoriaNombre || "_";
}

/** Mismo orden que la clasificación del sitio público (por puntos; el acumulado ya desempata por dinero). */
function ordenPorPuntos(rows) {
  return [...rows].sort((a, b) => (Number(b.puntosTotales) || 0) - (Number(a.puntosTotales) || 0));
}

function eventosOrdenados(eventos) {
  return [...(eventos || [])].sort(
    (a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")) || String(a.id).localeCompare(String(b.id))
  );
}

/**
 * Clasificación por puntos de una disciplina (o de todas, una debajo de otra) con los puntos
 * de cada rodeo del circuito en columnas.
 * @param {any} temporada acumulado del circuito
 * @param {Array<{ id: string, nombre?: string, fecha?: string }>} eventos del circuito (manifest)
 * @param {string} [disciplinaId] vacío = todas
 */
export function filasClasificacion(temporada, eventos = [], disciplinaId = "") {
  const standings = (temporada?.standings || []).filter((s) => !disciplinaId || idDisciplina(s) === disciplinaId);
  const evs = eventosOrdenados(eventos);

  /** puntos por competidor+disciplina+evento */
  const puntosEvento = new Map();
  for (const c of temporada?.competidores || []) {
    for (const h of c.historial || []) {
      const k = `${c.competidorKey}::${h.disciplinaId}::${h.eventoId}`;
      puntosEvento.set(k, (puntosEvento.get(k) || 0) + (Number(h.puntos) || 0));
    }
  }

  const conEquipo = standings.some((s) => String(s.equipo || "").trim());
  const conDinero = temporada?.mostrarDinero !== false;
  const encabezados = [
    "Disciplina",
    "Lugar",
    "Competidor",
    ...(conEquipo ? ["Equipo"] : []),
    "Eventos",
    "Puntos",
    ...(conDinero ? ["Dinero (MXN)"] : []),
    ...evs.map((e) => (e.fecha ? `${e.nombre || e.id} (${e.fecha})` : e.nombre || e.id)),
  ];

  const porDisciplina = new Map();
  for (const s of standings) {
    const id = idDisciplina(s);
    if (!porDisciplina.has(id)) porDisciplina.set(id, []);
    porDisciplina.get(id).push(s);
  }
  const grupos = [...porDisciplina.values()].sort((a, b) =>
    String(a[0].disciplinaNombre || a[0].categoriaNombre || "").localeCompare(String(b[0].disciplinaNombre || b[0].categoriaNombre || ""), "es")
  );

  const filas = [encabezados];
  for (const rows of grupos) {
    ordenPorPuntos(rows).forEach((s, i) => {
      const id = idDisciplina(s);
      filas.push([
        s.disciplinaNombre || s.categoriaNombre || id,
        i + 1,
        s.nombre || s.competidorId || "",
        ...(conEquipo ? [s.equipo || ""] : []),
        Number(s.eventos) || 0,
        Number(s.puntosTotales) || 0,
        ...(conDinero ? [Number(s.dineroTotal) || 0] : []),
        ...evs.map((e) => puntosEvento.get(`${s.competidorKey}::${id}::${e.id}`) ?? null),
      ]);
    });
  }
  return filas;
}

/** Vaquero Completo: total y lo que ganó en cada disciplina, en dinero o en puntos según la asociación. */
export function filasVaqueroCompleto(temporada) {
  const rows = temporada?.allAround || [];
  const porPuntos = temporada?.vaqueroCompleto === "puntos";
  const discs = new Map();
  for (const r of rows) {
    for (const d of r.detalle || []) discs.set(d.disciplinaId, d.disciplinaNombre || d.disciplinaId);
  }
  const ids = [...discs.keys()].sort((a, b) => String(discs.get(a)).localeCompare(String(discs.get(b)), "es"));
  const encabezados = porPuntos
    ? ["Lugar", "Competidor", "Disciplinas con puntos", "Puntos totales", ...ids.map((id) => `${discs.get(id)} (pts)`)]
    : ["Lugar", "Competidor", "Disciplinas con dinero", "Dinero total (MXN)", ...ids.map((id) => `${discs.get(id)} (MXN)`)];
  const filas = [encabezados];
  rows.forEach((r, i) => {
    const porDisc = new Map(
      (r.detalle || []).map((d) => [d.disciplinaId, Number(porPuntos ? d.puntos : d.dinero) || 0])
    );
    filas.push([
      i + 1,
      r.nombre || "",
      (r.disciplinas || []).length,
      Number(porPuntos ? r.puntosTotales : r.dineroTotal) || 0,
      ...ids.map((id) => porDisc.get(id) ?? null),
    ]);
  });
  return filas;
}
