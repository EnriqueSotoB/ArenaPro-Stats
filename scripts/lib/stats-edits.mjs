/**
 * Edits semi-manuales sobre un export Time (cherry-pick + overrides).
 * Módulo puro (sin Node APIs) — usable desde admin (browser) y tests/server.
 */

/**
 * @param {object} entrada
 * @param {string|number} categoriaId
 * @param {"clasif"|"result"} [source]
 * @returns {string}
 */
export function filaKey(entrada, categoriaId, source = "clasif") {
  const id =
    entrada?.competidorId != null
      ? String(entrada.competidorId)
      : entrada?.inscripcionId != null
        ? String(entrada.inscripcionId)
        : String(entrada?.nombre || "");
  const lugar = entrada?.lugar != null ? String(entrada.lugar) : "";
  const vuelta = entrada?.vuelta != null ? String(entrada.vuelta) : "";
  return `${source}:${categoriaId}:${id}:${lugar}:${vuelta}`;
}

/**
 * @param {object} evento
 * @returns {{ version: number, categoriasIncluidas: string[], filas: object[] }}
 */
export function buildDefaultEdits(evento) {
  return {
    version: 1,
    categoriasIncluidas: (evento?.categorias || []).map((c) => String(c.id)),
    filas: [],
  };
}

/**
 * @param {object} edits
 * @param {string} key
 * @returns {object|null}
 */
export function findFilaEdit(edits, key) {
  if (!edits?.filas?.length) return null;
  return edits.filas.find((f) => f && f.key === key) || null;
}

/**
 * Upsert de override de fila en edits (mutación controlada del objeto edits).
 * @param {object} edits
 * @param {string} key
 * @param {object} patch
 */
export function upsertFilaEdit(edits, key, patch) {
  if (!edits.filas) edits.filas = [];
  const idx = edits.filas.findIndex((f) => f.key === key);
  const base = idx >= 0 ? edits.filas[idx] : { key };
  const next = { ...base, ...patch, key };
  // Limpiar campos undefined
  for (const k of Object.keys(next)) {
    if (next[k] === undefined) delete next[k];
  }
  if (idx >= 0) edits.filas[idx] = next;
  else edits.filas.push(next);
  return edits;
}

/**
 * Aplica cherry-pick y overrides. No muta el evento original.
 * @param {object} evento
 * @param {object|null|undefined} edits
 * @returns {object}
 */
export function aplicarStatsEdits(evento, edits) {
  if (!evento || typeof evento !== "object") {
    throw new Error("Evento inválido para aplicar statsEdits.");
  }

  const out = JSON.parse(JSON.stringify(evento));
  if (!edits || typeof edits !== "object") {
    return out;
  }

  const included = new Set(
    (edits.categoriasIncluidas || []).map((id) => String(id))
  );

  out.categorias = (out.categorias || []).filter((c) =>
    included.has(String(c.id))
  );

  const filaMap = new Map(
    (edits.filas || []).filter((f) => f && f.key).map((f) => [f.key, f])
  );

  out.clasificacion = (out.clasificacion || [])
    .filter((b) => included.has(String(b.categoriaId)))
    .map((bloque) => {
      const catId = bloque.categoriaId;
      const entradas = [];
      for (const ent of bloque.entradas || []) {
        const key = filaKey(ent, catId, "clasif");
        const patch = filaMap.get(key);
        if (patch?.excluir) continue;
        entradas.push(mergeEntrada(ent, patch));
      }
      return { ...bloque, entradas };
    });

  out.resultados = (out.resultados || [])
    .filter((r) => included.has(String(r.categoriaId)))
    .map((r) => {
      const key = filaKey(r, r.categoriaId, "result");
      const patch = filaMap.get(key);
      if (patch?.excluir) return null;
      return mergeEntrada(r, patch);
    })
    .filter(Boolean);

  out.statsEdits = {
    version: edits.version || 1,
    categoriasIncluidas: [...included],
    filas: edits.filas || [],
    editadoEn: new Date().toISOString(),
  };

  return out;
}

/**
 * @param {object} ent
 * @param {object|undefined} patch
 */
function mergeEntrada(ent, patch) {
  if (!patch) return { ...ent };
  const next = { ...ent };
  if (patch.nombre != null) next.nombre = String(patch.nombre);
  if (patch.puntosCircuito != null && patch.puntosCircuito !== "") {
    next.puntosCircuito = Number(patch.puntosCircuito);
  }
  if (patch.montoGanado != null && patch.montoGanado !== "") {
    next.montoGanado = Number(patch.montoGanado);
  }
  return next;
}

/**
 * Lista filas editables de una categoría (preferir clasificación).
 * @param {object} evento — evento base SIN aplicar excluidos de categoría
 * @param {string} categoriaId
 * @param {object} [edits] — para reflejar overrides actuales en la UI
 * @returns {Array<{ key: string, nombre: string, puntosCircuito: number|null, montoGanado: number|null, excluir: boolean }>}
 */
export function listEditableFilas(evento, categoriaId, edits = null) {
  const catId = String(categoriaId);
  const block = (evento?.clasificacion || []).find(
    (c) => String(c.categoriaId) === catId
  );

  /** @type {Array<object>} */
  let raw = [];
  let source = "clasif";

  if (block?.entradas?.length) {
    raw = block.entradas;
  } else {
    source = "result";
    const byComp = new Map();
    for (const r of evento?.resultados || []) {
      if (String(r.categoriaId) !== catId) continue;
      const k = r.competidorId || r.inscripcionId || r.nombre;
      if (!byComp.has(k)) byComp.set(k, r);
    }
    raw = [...byComp.values()];
  }

  return raw.map((ent) => {
    const key = filaKey(ent, catId, source);
    const patch = findFilaEdit(edits, key);
    return {
      key,
      nombre: patch?.nombre != null ? String(patch.nombre) : ent.nombre || "",
      puntosCircuito:
        patch?.puntosCircuito != null
          ? Number(patch.puntosCircuito)
          : ent.puntosCircuito != null
            ? Number(ent.puntosCircuito)
            : null,
      montoGanado:
        patch?.montoGanado != null
          ? Number(patch.montoGanado)
          : ent.montoGanado != null
            ? Number(ent.montoGanado)
            : null,
      excluir: Boolean(patch?.excluir),
    };
  });
}
