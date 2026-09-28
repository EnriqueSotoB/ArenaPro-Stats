/**
 * Chequeos de integridad antes de agregar o publicar: rodeos duplicados y portada vacía.
 * Sin imports de Node: lo usan la consola local, el publicador y los tests de datos.
 */

import { normalizeText } from "./disciplinas.mjs";
import { eventosDeCircuito, findCircuito } from "./circuitos.mjs";

const DIA_MS = 24 * 60 * 60 * 1000;
/** Con menos competidores la coincidencia es casualidad (p. ej. dos rodeos chicos con los mismos 2 jinetes). */
const MIN_COMPETIDORES = 3;

/** Nombres normalizados de todos los que aparecen en el evento (clasificación y resultados). */
export function competidoresDeEvento(evento) {
  const set = new Set();
  for (const bloque of evento?.clasificacion || []) {
    for (const ent of bloque.entradas || []) {
      const n = normalizeText(ent?.nombre);
      if (n) set.add(n);
    }
  }
  for (const r of evento?.resultados || []) {
    const n = normalizeText(r?.nombre);
    if (n) set.add(n);
  }
  return set;
}

function diasEntre(a, b) {
  const da = Date.parse(String(a || "").slice(0, 10));
  const db = Date.parse(String(b || "").slice(0, 10));
  if (Number.isNaN(da) || Number.isNaN(db)) return Infinity;
  return Math.abs(da - db) / DIA_MS;
}

/**
 * true si dos eventos parecen el mismo rodeo capturado dos veces (Time + Excel, doble export…):
 * fechas a ≤ maxDias y al menos minCoincidencia de los competidores del evento más chico en común.
 * @returns {{ comunes: number, total: number }|null}
 */
export function coincidenciaRodeo(a, b, { maxDias = 1, minCoincidencia = 0.5 } = {}) {
  if (diasEntre(a?.fecha, b?.fecha) > maxDias) return null;
  const sa = competidoresDeEvento(a);
  const sb = competidoresDeEvento(b);
  const [chico, grande] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
  if (chico.size < MIN_COMPETIDORES) return null;
  let comunes = 0;
  for (const n of chico) if (grande.has(n)) comunes++;
  return comunes / chico.size >= minCoincidencia ? { comunes, total: chico.size } : null;
}

/**
 * Primer evento existente que parece el mismo rodeo que `evento`.
 * @param {object} evento evento nuevo (con fecha)
 * @param {Array<{ entry: object, evento: object }>} existentes
 * @returns {{ entry: object, comunes: number, total: number }|null}
 */
export function buscarRodeoDuplicado(evento, existentes) {
  for (const { entry, evento: otro } of existentes) {
    const m = coincidenciaRodeo(evento, { ...otro, fecha: entry.fecha || otro?.fecha });
    if (m) return { entry, ...m };
  }
  return null;
}

/**
 * Problemas que impiden publicar: portada vacía y rodeos duplicados dentro de un mismo circuito.
 * @param {object} manifest normalizado
 * @param {(entry: object) => object} loadEvento
 * @returns {string[]}
 */
export function problemasDePublicacion(manifest, loadEvento) {
  const problemas = [];
  const principal = findCircuito(manifest, manifest.circuitoDefault);
  const conEventos = manifest.circuitos.filter((c) => eventosDeCircuito(manifest, c.id).length);
  if (principal && conEventos.length && !eventosDeCircuito(manifest, principal.id).length) {
    problemas.push(
      `El circuito principal “${principal.nombre}” no tiene eventos: la portada pública se vería vacía. Elige otro principal (p. ej. “${conEventos[0].nombre}”).`
    );
  }

  const cache = new Map();
  const cargar = (entry) => {
    if (!cache.has(entry.file)) cache.set(entry.file, { ...loadEvento(entry), fecha: entry.fecha });
    return cache.get(entry.file);
  };
  const reportados = new Set();
  for (const circuito of manifest.circuitos) {
    const eventos = eventosDeCircuito(manifest, circuito.id);
    for (let i = 0; i < eventos.length; i++) {
      for (let j = i + 1; j < eventos.length; j++) {
        const [a, b] = [eventos[i], eventos[j]];
        const par = [a.id, b.id].sort().join("|");
        if (reportados.has(par)) continue;
        const m = coincidenciaRodeo(cargar(a), cargar(b));
        if (!m) continue;
        reportados.add(par);
        problemas.push(
          `“${a.nombre}” (${a.fecha}) y “${b.nombre}” (${b.fecha}) parecen el mismo rodeo: ${m.comunes} de ${m.total} competidores en común. Contarlo dos veces duplica puntos y dinero en “${circuito.nombre}”.`
        );
      }
    }
  }
  return problemas;
}
