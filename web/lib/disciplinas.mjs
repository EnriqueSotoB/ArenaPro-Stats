/**
 * Categoría de Time → disciplina de circuito. Sin imports de Node: lo usan el rebuild,
 * el admin y el portal.
 *
 * Unificación (el nombre de categoría en Time puede variar):
 *   "Barriles" / "Abierta" / "Barriles Abierto" / "Abierta Barriles" → Barriles
 *   "Master" / "Masters" / "Master Barriles" (tipo Barriles)         → Barriles Master
 *   "TeamRoping" / "Abierta" / "Lazo por Parejas"                   → Lazo por Parejas
 *   "Masters" / "Lazo por Parejas Master" / "Team Roping Masters"   → Lazo por Parejas Master
 *   "Cowboy Protection" (aunque Time mande tipo Jineteos)           → Cowboy Protection
 */

/** Disciplinas calificadas por jueces (más es mejor); el resto es por tiempo. */
export const DISCIPLINAS_CALIFICADAS = /Jineteos|Montura|Pretal|CowboyProtection/i;

/** Etiquetas de circuito (alineadas a Time / FMR). */
const DISCIPLINA_LABEL = {
  Barriles: "Barriles",
  BarrilesMasters: "Barriles Master",
  LazoDeBecerro: "Lazo de Becerro",
  LazoEnFalso: "Lazo en Falso",
  AchatadaDeNovillos: "Achatada de Novillos",
  AmarreDeChiva: "Amarre de Chiva",
  TeamRoping: "Lazo por Parejas",
  TeamRopingMasters: "Lazo por Parejas Master",
  TeamRopingHeader: "Lazo por Parejas — Cabeceros",
  TeamRopingHeeler: "Lazo por Parejas — Pialadores",
  TeamRopingMastersHeader: "Lazo por Parejas Master — Cabeceros",
  TeamRopingMastersHeeler: "Lazo por Parejas Master — Pialadores",
  CaballoConPretal: "Caballo con Pretal",
  CaballoConMontura: "Caballo con Montura",
  JineteosDeToros: "Jineteos de Toros",
  CowboyProtection: "Cowboy Protection",
  Polos: "Polos",
};

export function normalizeText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function inferTipoFromNombre(nom) {
  if (/barril/.test(nom)) return "Barriles";
  if (/lazo por pareja|team\s*roping|teamroping/.test(nom)) return "TeamRoping";
  if (/lazo de becerro|becerro/.test(nom)) return "LazoDeBecerro";
  if (/lazo en falso/.test(nom)) return "LazoEnFalso";
  if (/achatada/.test(nom)) return "AchatadaDeNovillos";
  if (/amarre|chiva/.test(nom)) return "AmarreDeChiva";
  if (/pretal/.test(nom)) return "CaballoConPretal";
  if (/montura/.test(nom)) return "CaballoConMontura";
  if (/jineteo/.test(nom)) return "JineteosDeToros";
  return "";
}

/**
 * Clave estable de disciplina de circuito.
 * Abierta / Barriles / Barriles Abierto → misma cubeta.
 * Master* → cubeta Masters de esa disciplina.
 */
export function disciplinaKey(cat = {}) {
  let tipo = String(cat.tipo || "").trim();
  const nom = normalizeText(cat.nombre);
  const isMaster = /\bmasters?\b/.test(nom);

  if (!tipo) tipo = inferTipoFromNombre(nom);
  // Si Time la manda con tipo Jineteos, solo el nombre la distingue.
  if (/cowboy\s*protection/.test(nom)) return "CowboyProtection";

  // Enum ya viene como Masters
  if (tipo === "TeamRopingMasters") return "TeamRopingMasters";
  if (tipo === "BarrilesMasters") return "BarrilesMasters";

  if (tipo === "TeamRoping") {
    return isMaster ? "TeamRopingMasters" : "TeamRoping";
  }
  if (tipo === "Barriles") {
    return isMaster ? "BarrilesMasters" : "Barriles";
  }

  if (tipo && isMaster && !/Masters$/i.test(tipo)) {
    return `${tipo}Masters`;
  }

  return tipo || "_";
}

export function disciplinaLabel(key) {
  if (DISCIPLINA_LABEL[key]) return DISCIPLINA_LABEL[key];
  if (!key || key === "_") return "Sin disciplina";
  return String(key).replace(/([a-z])([A-Z])/g, "$1 $2");
}
