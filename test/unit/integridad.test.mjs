import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  coincidenciaRodeo,
  buscarRodeoDuplicado,
  problemasDePublicacion,
} from "../../tools/lib/integridad.mjs";
import { normalizeManifest } from "../../web/lib/circuitos.mjs";

function evento(fecha, nombres) {
  return {
    fecha,
    clasificacion: [{ categoriaId: "c1", entradas: nombres.map((nombre) => ({ nombre })) }],
  };
}

const RIDERS = ["JULIA MERAZ", "ADRIANA OLIVAS", "SOFIA OLIVAS", "SUSY HERNANDEZ"];

describe("coincidenciaRodeo", () => {
  it("detecta el mismo rodeo capturado en Time y en Excel un día antes", () => {
    const time = evento("2026-09-20", [...RIDERS, "VALERIA HERRERA", "OTRA PERSONA"]);
    const manual = evento("2026-09-19", RIDERS.map((n) => n.toLowerCase()));
    assert.deepEqual(coincidenciaRodeo(time, manual), { comunes: 4, total: 4 });
  });

  it("no confunde rodeos separados por más de un día", () => {
    assert.equal(coincidenciaRodeo(evento("2026-09-06", RIDERS), evento("2026-09-20", RIDERS)), null);
  });

  it("no confunde rodeos del mismo fin de semana con competidores distintos", () => {
    const a = evento("2026-09-20", RIDERS);
    const b = evento("2026-09-20", ["PEDRO A", "PEDRO B", "PEDRO C", "JULIA MERAZ"]);
    assert.equal(coincidenciaRodeo(a, b), null);
  });

  it("ignora eventos muy chicos", () => {
    const a = evento("2026-09-20", ["JULIA MERAZ", "ADRIANA OLIVAS"]);
    assert.equal(coincidenciaRodeo(a, a), null);
  });
});

describe("buscarRodeoDuplicado", () => {
  it("devuelve la entrada del manifest que coincide", () => {
    const entry = { id: "local:27", nombre: "TRUCKMANIA FEST 2026", fecha: "2026-09-20" };
    const found = buscarRodeoDuplicado(evento("2026-09-19", RIDERS), [
      { entry: { id: "x", fecha: "2026-08-01" }, evento: evento("2026-08-01", RIDERS) },
      { entry, evento: evento("", RIDERS) },
    ]);
    assert.equal(found?.entry, entry);
  });
});

describe("problemasDePublicacion", () => {
  const base = {
    version: 2,
    asociaciones: [
      { id: "a", siglas: "A", nombre: "Asoc A" },
      { id: "b", siglas: "B", nombre: "Asoc B" },
    ],
    circuitos: [
      { id: "a-2027", asociacionId: "a", nombre: "A 2027", temporada: "2027" },
      { id: "b-2027", asociacionId: "b", nombre: "B 2027", temporada: "2027" },
    ],
  };
  const eventos = {
    "e1.json": evento("2026-09-19", RIDERS),
    "e2.json": evento("2026-09-20", RIDERS),
    "e3.json": evento("2026-08-01", ["X UNO", "X DOS", "X TRES"]),
  };
  const load = (entry) => eventos[entry.file];

  it("avisa si el circuito principal está vacío", () => {
    const m = normalizeManifest({
      ...base,
      circuitoDefault: "b-2027",
      eventos: [{ id: "e3", nombre: "E3", fecha: "2026-08-01", file: "e3.json", circuitos: ["a-2027"] }],
    });
    const problemas = problemasDePublicacion(m, load);
    assert.equal(problemas.length, 1);
    assert.match(problemas[0], /principal “B 2027” no tiene eventos/);
  });

  it("avisa de rodeos duplicados dentro de un circuito", () => {
    const m = normalizeManifest({
      ...base,
      circuitoDefault: "a-2027",
      eventos: [
        { id: "e1", nombre: "MANUAL", fecha: "2026-09-19", file: "e1.json", circuitos: ["a-2027"] },
        { id: "e2", nombre: "TIME", fecha: "2026-09-20", file: "e2.json", circuitos: ["a-2027"] },
      ],
    });
    const problemas = problemasDePublicacion(m, load);
    assert.equal(problemas.length, 1);
    assert.match(problemas[0], /“MANUAL”.*“TIME”.*mismo rodeo/);
  });

  it("sin problemas cuando los datos están sanos", () => {
    const m = normalizeManifest({
      ...base,
      circuitoDefault: "a-2027",
      eventos: [
        { id: "e2", nombre: "TIME", fecha: "2026-09-20", file: "e2.json", circuitos: ["a-2027"] },
        { id: "e3", nombre: "E3", fecha: "2026-08-01", file: "e3.json", circuitos: ["a-2027", "b-2027"] },
      ],
    });
    assert.deepEqual(problemasDePublicacion(m, load), []);
  });
});
