import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseTeamRopingPair,
  expandTeamRopingRow,
  teamRopingRoleDisc,
  isTeamRopingBase,
} from "../../scripts/lib/team-roping.mjs";

describe("parseTeamRopingPair", () => {
  it("parsea dúos con slash y espacios", () => {
    assert.deepEqual(parseTeamRopingPair("Header Alpha / Heeler Beta"), {
      header: "Header Alpha",
      heeler: "Heeler Beta",
    });
    assert.deepEqual(parseTeamRopingPair("Carlos Ruiz/Ana Lopez"), {
      header: "Carlos Ruiz",
      heeler: "Ana Lopez",
    });
  });

  it("retorna null sin slash válido", () => {
    assert.equal(parseTeamRopingPair("Solo Uno"), null);
    assert.equal(parseTeamRopingPair(""), null);
    assert.equal(parseTeamRopingPair("A /"), null);
  });
});

describe("teamRopingRoleDisc", () => {
  it("mapea abierta y masters a Cabecero/Pialador", () => {
    assert.equal(teamRopingRoleDisc("TeamRoping", "header"), "TeamRopingHeader");
    assert.equal(teamRopingRoleDisc("TeamRoping", "heeler"), "TeamRopingHeeler");
    assert.equal(
      teamRopingRoleDisc("TeamRopingMasters", "header"),
      "TeamRopingMastersHeader"
    );
    assert.equal(
      teamRopingRoleDisc("TeamRopingMasters", "heeler"),
      "TeamRopingMastersHeeler"
    );
    assert.equal(isTeamRopingBase("TeamRoping"), true);
    assert.equal(isTeamRopingBase("Barriles"), false);
  });
});

describe("expandTeamRopingRow", () => {
  it("parte dinero 50/50 y NO parte puntos", () => {
    const rows = expandTeamRopingRow(
      {
        nombre: "A / B",
        puntosCircuito: 100,
        montoGanado: 10001,
      },
      "TeamRoping"
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].disciplinaId, "TeamRopingHeader");
    assert.equal(rows[1].disciplinaId, "TeamRopingHeeler");
    assert.equal(rows[0].nombre, "A");
    assert.equal(rows[1].nombre, "B");
    assert.equal(rows[0].puntosCircuito, 100);
    assert.equal(rows[1].puntosCircuito, 100);
    assert.equal(rows[0].montoGanado, 5000);
    assert.equal(rows[1].montoGanado, 5001);
    assert.equal(rows[0].puntosCircuito + rows[1].puntosCircuito, 200);
  });

  it("respeta filas ya tipadas por rol", () => {
    const rows = expandTeamRopingRow(
      {
        nombre: "Solo Header",
        rol: "header",
        puntosCircuito: 50,
        montoGanado: 3000,
      },
      "TeamRopingMasters"
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].disciplinaId, "TeamRopingMastersHeader");
    assert.equal(rows[0].montoGanado, 3000);
    assert.equal(rows[0].puntosCircuito, 50);
  });
});
