/**
 * Números del tablero del portal a partir del acumulado de un circuito
 * (data/circuitos/{id}.json) y de los archivos de evento. Sin DOM.
 */

import { disciplinaKey, disciplinaLabel } from "../scripts/lib/disciplinas.mjs";

/**
 * @param {any} temporada acumulado del circuito
 * @param {Array<{ id: string, nombre?: string, fecha?: string, sede?: string }>} eventos del manifest para el circuito
 */
export function calcularTablero(temporada, eventos = []) {
  const competidores = temporada?.competidores || [];
  const standings = temporada?.standings || [];

  const porEventoMap = new Map(
    eventos.map((e) => [
      e.id,
      { id: e.id, nombre: e.nombre || e.id, fecha: e.fecha || "", sede: e.sede || "", participaciones: 0, competidores: new Set(), dinero: 0 },
    ])
  );
  let participaciones = 0;
  for (const c of competidores) {
    for (const h of c.historial || []) {
      participaciones += 1;
      let ev = porEventoMap.get(h.eventoId);
      if (!ev) {
        ev = { id: h.eventoId, nombre: h.eventoNombre || h.eventoId, fecha: h.fecha || "", sede: h.sede || "", participaciones: 0, competidores: new Set(), dinero: 0 };
        porEventoMap.set(h.eventoId, ev);
      }
      ev.participaciones += 1;
      ev.competidores.add(c.competidorKey);
      ev.dinero += Number(h.dinero) || 0;
    }
  }
  const porEvento = [...porEventoMap.values()]
    .map((e) => ({ ...e, competidores: e.competidores.size }))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

  const discMap = new Map();
  for (const s of standings) {
    const id = s.disciplinaId || s.categoriaId || "_";
    const d = discMap.get(id) || { id, nombre: s.disciplinaNombre || s.categoriaNombre || id, rows: [], dinero: 0 };
    d.rows.push(s);
    d.dinero += Number(s.dineroTotal) || 0;
    discMap.set(id, d);
  }
  const porDisciplina = [...discMap.values()]
    .map((d) => {
      const rows = [...d.rows].sort((a, b) => (Number(b.puntosTotales) || 0) - (Number(a.puntosTotales) || 0));
      const lider = rows[0];
      const segundo = rows[1];
      return {
        id: d.id,
        nombre: d.nombre,
        competidores: rows.length,
        dinero: d.dinero,
        lider: lider ? { nombre: lider.nombre || "—", puntos: Number(lider.puntosTotales) || 0 } : null,
        ventaja: lider && segundo ? (Number(lider.puntosTotales) || 0) - (Number(segundo.puntosTotales) || 0) : null,
      };
    })
    .sort((a, b) => b.competidores - a.competidores || a.nombre.localeCompare(b.nombre, "es"));

  const recurrentes = competidores.filter((c) => (Number(c.eventos) || 0) >= 2).length;
  const masActivos = [...competidores]
    .sort(
      (a, b) =>
        (Number(b.eventos) || 0) - (Number(a.eventos) || 0) ||
        (b.disciplinas?.length || 0) - (a.disciplinas?.length || 0) ||
        (Number(b.puntosTotales) || 0) - (Number(a.puntosTotales) || 0)
    )
    .slice(0, 10)
    .map((c) => ({
      nombre: c.nombre || "—",
      eventos: Number(c.eventos) || 0,
      disciplinas: c.disciplinas?.length || 0,
      puntos: Number(c.puntosTotales) || 0,
      dinero: Number(c.dineroTotal) || 0,
    }));

  return {
    kpis: {
      eventos: Number(temporada?.eventosContados) || porEvento.length,
      competidores: competidores.length,
      participaciones,
      dinero: competidores.reduce((s, c) => s + (Number(c.dineroTotal) || 0), 0),
      disciplinas: porDisciplina.length,
      recurrentes,
      pctRecurrentes: competidores.length ? Math.round((recurrentes / competidores.length) * 100) : 0,
    },
    porEvento,
    porDisciplina,
    masActivos,
  };
}

/** Lugar con empates (1, 2, 2, 4): 1 + cuántos tienen estrictamente más puntos. */
function lugarCon(puntos, todos) {
  let n = 1;
  for (const p of todos) if (p > puntos) n += 1;
  return n;
}

/**
 * Clasificación de cada disciplina después del último rodeo del circuito, con cuántos
 * lugares se movió cada quien contra cómo iba antes de ese rodeo. Quien debuta en la
 * disciplina en ese rodeo sale como `nuevo` (sin lugar anterior).
 * @param {any} temporada acumulado del circuito
 */
export function calcularMovimientos(temporada) {
  const competidores = temporada?.competidores || [];
  const eventos = new Map();
  for (const c of competidores) {
    for (const h of c.historial || []) {
      if (!eventos.has(h.eventoId)) {
        eventos.set(h.eventoId, { id: h.eventoId, nombre: h.eventoNombre || h.eventoId, fecha: h.fecha || "" });
      }
    }
  }
  const orden = [...eventos.values()].sort(
    (a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.id).localeCompare(String(b.id))
  );
  const ultimo = orden.at(-1) || null;
  if (orden.length < 2) return { evento: ultimo, tablas: [], cambiosLider: [] };

  /** @type {Map<string, { nombre: string, filas: Map<string, any> }>} */
  const porDisc = new Map();
  for (const c of competidores) {
    for (const h of c.historial || []) {
      const id = h.disciplinaId || "_";
      const d = porDisc.get(id) || { nombre: h.disciplinaNombre || disciplinaLabel(id), filas: new Map() };
      porDisc.set(id, d);
      const f = d.filas.get(c.competidorKey) || {
        competidorKey: c.competidorKey,
        nombre: c.nombre || "—",
        antes: 0,
        despues: 0,
        puntosEvento: 0,
        previo: false,
        corrio: false,
      };
      d.filas.set(c.competidorKey, f);
      const pts = Number(h.puntos) || 0;
      f.despues += pts;
      if (h.eventoId === ultimo.id) {
        f.corrio = true;
        f.puntosEvento += pts;
      } else {
        f.previo = true;
        f.antes += pts;
      }
    }
  }

  const tablas = [];
  const cambiosLider = [];
  for (const [id, d] of porDisc) {
    const filas = [...d.filas.values()];
    const previos = filas.filter((f) => f.previo);
    const ptsAntes = previos.map((f) => f.antes);
    const ptsDespues = filas.map((f) => f.despues);
    const corrieron = filas.filter((f) => f.corrio).length;
    tablas.push({
      disciplinaId: id,
      disciplinaNombre: d.nombre,
      corrieron,
      filas: filas
        .map((f) => {
          const lugar = lugarCon(f.despues, ptsDespues);
          const lugarAntes = f.previo ? lugarCon(f.antes, ptsAntes) : null;
          return {
            competidorKey: f.competidorKey,
            nombre: f.nombre,
            lugar,
            lugarAntes,
            cambio: lugarAntes == null ? null : lugarAntes - lugar,
            nuevo: !f.previo,
            puntos: f.despues,
            puntosEvento: f.puntosEvento,
            corrio: f.corrio,
          };
        })
        .sort((a, b) => a.lugar - b.lugar || a.nombre.localeCompare(b.nombre, "es")),
    });
    if (!corrieron) continue;

    const maxAntes = Math.max(0, ...ptsAntes);
    const maxDespues = Math.max(0, ...ptsDespues);
    const lideresAntes = previos.filter((f) => maxAntes > 0 && f.antes === maxAntes).map((f) => f.nombre);
    const lideresDespues = filas.filter((f) => maxDespues > 0 && f.despues === maxDespues).map((f) => f.nombre);
    const mismo =
      lideresAntes.length === lideresDespues.length && lideresAntes.every((n) => lideresDespues.includes(n));
    if (lideresDespues.length && !mismo) {
      cambiosLider.push({ disciplinaId: id, disciplinaNombre: d.nombre, antes: lideresAntes, ahora: lideresDespues, puntos: maxDespues });
    }
  }

  const porNombre = (a, b) => a.disciplinaNombre.localeCompare(b.disciplinaNombre, "es");
  return {
    evento: ultimo,
    tablas: tablas.sort(porNombre),
    cambiosLider: cambiosLider.sort(porNombre),
  };
}

const ES_PUNTOS = /Jineteos|Montura|Pretal/i;

/** Recorridos individuales de una entrada de clasificación: `[{ ronda, valor }]`. */
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

/** Eventos en orden de fecha (y id para desempatar el mismo día). */
function ordenarEventos(eventos) {
  return [...eventos].sort(
    (a, b) =>
      String(a.fecha || a.evento?.fecha || "").localeCompare(String(b.fecha || b.evento?.fecha || "")) ||
      String(a.id).localeCompare(String(b.id))
  );
}

/**
 * Todos los recorridos por disciplina, cada uno con el orden de su evento en la temporada.
 * @returns {Map<string, any[]>}
 */
function marcasPorDisciplina(eventos) {
  /** @type {Map<string, any[]>} */
  const marcas = new Map();
  ordenarEventos(eventos).forEach((ev, orden) => {
    const evento = ev.evento || {};
    const cats = Object.fromEntries((evento.categorias || []).map((c) => [c.id || "_", c]));
    for (const block of evento.clasificacion || []) {
      const cat = cats[block.categoriaId || "_"] || {};
      const tipo = cat.tipo || block.tipo || "";
      const id = disciplinaKey({ tipo, nombre: cat.nombre || block.nombre || "" });
      if (id === "_") continue;
      const esPuntos = ES_PUNTOS.test(tipo) || ES_PUNTOS.test(id);
      const lista = marcas.get(id) || [];
      marcas.set(id, lista);
      for (const e of block.entradas || []) {
        for (const r of recorridosDeEntrada(e, esPuntos)) {
          lista.push({
            nombre: e.nombre || "—",
            valor: r.valor,
            ronda: r.ronda,
            esPuntos,
            eventoId: ev.id,
            eventoNombre: ev.nombre || evento.nombreEvento || ev.id,
            fecha: ev.fecha || evento.fecha || "",
            orden,
          });
        }
      }
    }
  });
  return marcas;
}

const claveNombre = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Mejor marca de una lista y quiénes la tienen (misma persona y marca en dos eventos: queda la primera). */
function mejorMarca(lista, esPuntos) {
  const valor = esPuntos ? Math.max(...lista.map((m) => m.valor)) : Math.min(...lista.map((m) => m.valor));
  const vistos = new Set();
  const titulares = lista
    .filter((m) => Math.abs(m.valor - valor) < 1e-9)
    .sort((a, b) => a.orden - b.orden)
    .filter((m) => {
      const k = claveNombre(m.nombre);
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  return { valor, titulares };
}

/**
 * Disciplinas donde un evento superó el récord que había antes de él en la temporada.
 * La primera vez que se corre una disciplina no cuenta como récord nuevo.
 * @param {Array<{ id: string, nombre?: string, fecha?: string, evento: any }>} eventos del circuito, ya normalizados
 */
export function calcularRecordsNuevos(eventos = [], eventoId) {
  const orden = ordenarEventos(eventos).findIndex((e) => e.id === eventoId);
  if (orden < 0) return [];
  const out = [];
  for (const [id, lista] of marcasPorDisciplina(eventos)) {
    const enEvento = lista.filter((m) => m.orden === orden);
    const antes = lista.filter((m) => m.orden < orden);
    if (!enEvento.length || !antes.length) continue;
    const esPuntos = lista[0].esPuntos;
    const nuevo = mejorMarca(enEvento, esPuntos);
    const anterior = mejorMarca(antes, esPuntos);
    if (esPuntos ? nuevo.valor <= anterior.valor : nuevo.valor >= anterior.valor) continue;
    out.push({
      disciplinaId: id,
      disciplinaNombre: disciplinaLabel(id),
      esPuntos,
      valor: nuevo.valor,
      titulares: nuevo.titulares,
      anterior,
      mejora: Math.abs(nuevo.valor - anterior.valor),
    });
  }
  return out.sort((a, b) => a.disciplinaNombre.localeCompare(b.disciplinaNombre, "es"));
}

/**
 * Récord de la temporada por disciplina: el recorrido más rápido (tiempo) o la
 * calificación más alta (jineteos, montura, pretal) en cualquier rodeo del circuito.
 * `nuevo`: lo impuso el rodeo más reciente, superando el récord anterior.
 * @param {Array<{ id: string, nombre?: string, fecha?: string, evento: any }>} eventos con su archivo ya normalizado
 */
export function calcularRecords(eventos = []) {
  const ultimo = ordenarEventos(eventos).at(-1);
  const nuevos = new Set(ultimo ? calcularRecordsNuevos(eventos, ultimo.id).map((r) => r.disciplinaId) : []);
  const records = [];
  for (const [id, lista] of marcasPorDisciplina(eventos)) {
    if (!lista.length) continue;
    const esPuntos = lista[0].esPuntos;
    const { valor, titulares } = mejorMarca(lista, esPuntos);
    records.push({
      disciplinaId: id,
      disciplinaNombre: disciplinaLabel(id),
      esPuntos,
      valor,
      titulares,
      recorridos: lista.length,
      nuevo: nuevos.has(id),
    });
  }
  return records.sort((a, b) => a.disciplinaNombre.localeCompare(b.disciplinaNombre, "es"));
}
