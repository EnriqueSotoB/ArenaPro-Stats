/**
 * Marcas de cada recorrido (tiempo o calificación) y resumen por competidor para su ficha.
 * Sin imports de Node: lo usan el rebuild, el portal y el sitio público.
 */

import { DISCIPLINAS_CALIFICADAS } from "./disciplinas.mjs";

/** Disciplinas calificadas por jueces (más es mejor); el resto es por tiempo (menos es mejor). */
export function esDisciplinaPuntos(id) {
  return DISCIPLINAS_CALIFICADAS.test(String(id || ""));
}

/** Recorridos individuales de una entrada de clasificación: `[{ ronda, valor }]`. NT/NP no cuentan. */
export function recorridosDeEntrada(e, esPuntos) {
  const out = [];
  for (const parte of String(e?.detalleVueltas || "").split("·")) {
    const m = /^\s*([^:]+):\s*([\d.,]+)\s*(?:pts)?\s*$/.exec(parte);
    if (!m) continue;
    const valor = Number(m[2].replace(",", "."));
    if (Number.isFinite(valor) && valor > 0) out.push({ ronda: m[1].trim(), valor });
  }
  if (!out.length) {
    ["t1", "t2", "t3"].forEach((k, i) => {
      const valor = Number(e?.[k]);
      if (e?.[k] != null && e[k] !== "" && Number.isFinite(valor) && valor > 0) out.push({ ronda: `Ronda ${i + 1}`, valor });
    });
  }
  if (!out.length) {
    const valor = Number(esPuntos ? e?.puntos : e?.tiempoTotal);
    if ((esPuntos ? e?.puntos : e?.tiempoTotal) != null && Number.isFinite(valor) && valor > 0) {
      out.push({ ronda: "", valor });
    }
  }
  return out;
}

/** Rondas que se corrieron en la entrada, con o sin tiempo (para saber si hubo NT/NP). */
function rondasDeEntrada(e) {
  const partes = String(e?.detalleVueltas || "")
    .split("·")
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length) return partes.length;
  return ["t1", "t2", "t3"].filter((k) => e?.[k] != null && e[k] !== "").length;
}

/**
 * Lo que la ficha necesita de una entrada de clasificación. `limpio`: todas las rondas con
 * marca (sin NT/NP), así la suma no trae tiempos de castigo.
 * @returns {{ lugar: number|null, marca: number|null, recorridos: number[], rondas: string[], limpio: boolean, detalle: string }}
 */
export function marcasDeEntrada(e, esPuntos) {
  const recorridos = recorridosDeEntrada(e, esPuntos);
  const rondas = rondasDeEntrada(e);
  const lugar = !e?.sinPosicion && Number(e?.lugar) > 0 ? Number(e.lugar) : null;
  const total = Number(esPuntos ? e?.puntos : e?.tiempoTotal);
  const marca = Number.isFinite(total) && total > 0
    ? total
    : recorridos.length
      ? recorridos.reduce((s, r) => s + r.valor, 0)
      : null;
  const limpio =
    e?.recorridoCompleto !== false &&
    recorridos.length > 0 &&
    recorridos.length >= rondas &&
    marca != null;
  return {
    lugar,
    marca: marca == null ? null : Math.round(marca * 1000) / 1000,
    recorridos: recorridos.map((r) => r.valor),
    rondas: recorridos.map((r) => r.ronda),
    limpio,
    detalle: String(e?.detalleVueltas || ""),
  };
}

/**
 * Mismo competidor con dos entradas en una disciplina y evento (lazador en varias parejas):
 * queda la de mejor lugar y se juntan todos sus recorridos.
 */
export function combinarMarcas(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const lugarA = a.lugar ?? Infinity;
  const lugarB = b.lugar ?? Infinity;
  const mejor = lugarB < lugarA ? b : a;
  return {
    ...mejor,
    recorridos: [...a.recorridos, ...b.recorridos],
    rondas: [...a.rondas, ...b.rondas],
  };
}

const mejorQue = (esPuntos) => (x, y) => (esPuntos ? x > y : x < y);

function eventoDe(h) {
  return { eventoId: h.eventoId, eventoNombre: h.eventoNombre || h.eventoId, fecha: h.fecha || "" };
}

/** Mejor recorrido individual por disciplina entre todos los competidores del circuito. */
function recordsPorDisciplina(competidores) {
  const records = new Map();
  for (const c of competidores || []) {
    for (const h of c.historial || []) {
      const esPuntos = esDisciplinaPuntos(h.disciplinaId);
      for (const v of h.recorridos || []) {
        const prev = records.get(h.disciplinaId);
        if (prev == null || mejorQue(esPuntos)(v, prev)) records.set(h.disciplinaId, v);
      }
    }
  }
  return records;
}

/**
 * Mejor suma comparable: solo rodeos sin NT/NP y con el número de rondas más común del
 * competidor en esa disciplina (un rodeo de 1 ronda no le gana a uno de 2).
 */
function mejorSuma(historial, esPuntos) {
  const limpios = historial.filter((h) => h.limpio && h.marca > 0);
  if (!limpios.length) return null;
  const conteo = new Map();
  for (const h of limpios) {
    const n = (h.recorridos || []).length;
    conteo.set(n, (conteo.get(n) || 0) + 1);
  }
  const rondas = [...conteo.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  const mejor = limpios
    .filter((h) => (h.recorridos || []).length === rondas)
    .reduce((m, h) => (!m || mejorQue(esPuntos)(h.marca, m.marca) ? h : m), null);
  return { valor: mejor.marca, rondas, ...eventoDe(mejor) };
}

/**
 * Resumen para la ficha del competidor: victorias, podios y mejores marcas por disciplina.
 * `conMarcas` es false con acumulados viejos que no traen lugar ni tiempos.
 * @param {any} comp competidor del acumulado (data/circuitos/{id}.json)
 * @param {any[]} competidores todos los del circuito, para saber si tiene el récord
 */
export function resumenCompetidor(comp, competidores = []) {
  const historial = comp?.historial || [];
  const conMarcas = historial.some((h) => "lugar" in h || "recorridos" in h);
  const lugares = historial.map((h) => Number(h.lugar)).filter((n) => n > 0);
  const records = conMarcas ? recordsPorDisciplina(competidores) : new Map();

  const ids = [...new Set([...(comp?.disciplinas || []).map((d) => d.disciplinaId), ...historial.map((h) => h.disciplinaId)])];
  const porDisciplina = ids.map((id) => {
    const hs = historial.filter((h) => h.disciplinaId === id);
    const esPuntos = esDisciplinaPuntos(id);
    const mejor = mejorQue(esPuntos);

    let mejorRecorrido = null;
    const valores = [];
    for (const h of hs) {
      (h.recorridos || []).forEach((valor, i) => {
        valores.push(valor);
        if (!mejorRecorrido || mejor(valor, mejorRecorrido.valor)) {
          mejorRecorrido = { valor, ronda: h.rondas?.[i] || "", ...eventoDe(h) };
        }
      });
    }
    const lugaresDisc = hs.map((h) => Number(h.lugar)).filter((n) => n > 0);
    const record = records.get(id);
    return {
      disciplinaId: id,
      disciplinaNombre: hs[0]?.disciplinaNombre || comp?.disciplinas?.find((d) => d.disciplinaId === id)?.disciplinaNombre || id,
      esPuntos,
      mejorRecorrido,
      mejorSuma: mejorSuma(hs, esPuntos),
      promedio: valores.length ? Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 1000) / 1000 : null,
      recorridos: valores.length,
      mejorLugar: lugaresDisc.length ? Math.min(...lugaresDisc) : null,
      victorias: lugaresDisc.filter((n) => n === 1).length,
      podios: lugaresDisc.filter((n) => n <= 3).length,
      cobros: hs.filter((h) => Number(h.dinero) > 0).length,
      esRecord: mejorRecorrido != null && record != null && Math.abs(record - mejorRecorrido.valor) < 1e-9,
    };
  });

  return {
    conMarcas,
    victorias: lugares.filter((n) => n === 1).length,
    podios: lugares.filter((n) => n <= 3).length,
    mejorLugar: lugares.length ? Math.min(...lugares) : null,
    cobros: historial.filter((h) => Number(h.dinero) > 0).length,
    porDisciplina,
  };
}
