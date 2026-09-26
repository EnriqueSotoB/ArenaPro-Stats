/**
 * Lazo por Parejas → filas Cabecero / Pialador.
 *
 * Regla confirmada (docs/00-decisiones-producto.md):
 * - Dinero del dúo: 50/50 cabecero / pialador (splitMoneyMxn).
 * - Puntos: NO se parten; si Time manda un solo puntosCircuito del equipo,
 *   ambos roles reciben ese mismo valor hasta que exista export por rol.
 *
 * Roles internos `header`/`heeler` = cabecero / pialador (IDs Time estables).
 */
import { splitMoneyMxn, toMontoEntero } from "./money.mjs";
import { toPuntosCircuito } from "./points.mjs";

/**
 * @param {string} discId
 * @returns {boolean}
 */
export function isTeamRopingBase(discId) {
  return discId === "TeamRoping" || discId === "TeamRopingMasters";
}

/**
 * @param {string} baseDiscId TeamRoping | TeamRopingMasters
 * @param {"header"|"heeler"} role
 * @returns {string}
 */
export function teamRopingRoleDisc(baseDiscId, role) {
  const masters = baseDiscId === "TeamRopingMasters";
  if (role === "header") {
    return masters ? "TeamRopingMastersHeader" : "TeamRopingHeader";
  }
  return masters ? "TeamRopingMastersHeeler" : "TeamRopingHeeler";
}

/**
 * @param {unknown} nombre
 * @returns {{ header: string, heeler: string } | null}
 */
export function parseTeamRopingPair(nombre) {
  const s = String(nombre || "").trim();
  if (!s.includes("/")) return null;
  const parts = s
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  return { header: parts[0], heeler: parts[1] };
}

/**
 * Expande una fila de clasificación/resultado de TR a 1–2 personas por rol.
 * Si ya viene con `rol` header|heeler, no vuelve a partir el dúo.
 *
 * @param {object} row
 * @param {string} baseDiscId
 * @returns {object[]}
 */
export function expandTeamRopingRow(row, baseDiscId) {
  if (!isTeamRopingBase(baseDiscId)) {
    return [{ ...row, disciplinaId: baseDiscId }];
  }

  const rol = String(row.rol || "").toLowerCase();
  if (rol === "header" || rol === "heeler") {
    return [
      {
        ...row,
        nombre: row.nombre || row.competidorId || "—",
        rol,
        puntosCircuito: toPuntosCircuito(row.puntosCircuito),
        montoGanado: toMontoEntero(row.montoGanado),
        disciplinaId: teamRopingRoleDisc(baseDiscId, rol),
      },
    ];
  }

  if (row.headerNombre && row.heelerNombre) {
    return expandNamedPair(
      row,
      baseDiscId,
      String(row.headerNombre).trim(),
      String(row.heelerNombre).trim()
    );
  }

  const pair = parseTeamRopingPair(row.nombre);
  if (!pair) {
    // Sin dúo parseable: se deja en disciplina base (no inventar roles).
    return [
      {
        ...row,
        disciplinaId: baseDiscId,
        montoGanado: toMontoEntero(row.montoGanado),
      },
    ];
  }

  return expandNamedPair(row, baseDiscId, pair.header, pair.heeler);
}

/**
 * @param {object} row
 * @param {string} baseDiscId
 * @param {string} headerName
 * @param {string} heelerName
 */
function expandNamedPair(row, baseDiscId, headerName, heelerName) {
  const ptsSafe = toPuntosCircuito(row.puntosCircuito);
  const headerPts =
    row.puntosCircuitoHeader != null
      ? toPuntosCircuito(row.puntosCircuitoHeader)
      : ptsSafe;
  const heelerPts =
    row.puntosCircuitoHeeler != null
      ? toPuntosCircuito(row.puntosCircuitoHeeler)
      : ptsSafe;

  const equipoMonto = toMontoEntero(
    row.montoEquipo != null ? row.montoEquipo : row.montoGanado
  );
  const split = splitMoneyMxn(equipoMonto);
  const headerMoney =
    row.montoHeader != null ? toMontoEntero(row.montoHeader) : split.header;
  const heelerMoney =
    row.montoHeeler != null ? toMontoEntero(row.montoHeeler) : split.heeler;

  return [
    {
      ...row,
      nombre: headerName,
      rol: "header",
      // Evitar que el id del dúo fusione a ambos riders.
      competidorId: row.headerCompetidorId || null,
      puntosCircuito: headerPts,
      montoGanado: headerMoney,
      disciplinaId: teamRopingRoleDisc(baseDiscId, "header"),
    },
    {
      ...row,
      nombre: heelerName,
      rol: "heeler",
      competidorId: row.heelerCompetidorId || null,
      puntosCircuito: heelerPts,
      montoGanado: heelerMoney,
      disciplinaId: teamRopingRoleDisc(baseDiscId, "heeler"),
    },
  ];
}
