import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCutLine } from "../../scripts/lib/cut-line.mjs";

describe("getCutLine", () => {
  it("retorna null si cutLineVisible no es true", () => {
    assert.equal(getCutLine({ cutLine: 10, cutLineVisible: false }), null);
    assert.equal(getCutLine({ cutLine: 10 }), null);
    assert.equal(getCutLine(null), null);
  });

  it("usa cutLine global cuando está visible", () => {
    assert.equal(getCutLine({ cutLine: 10, cutLineVisible: true }), 10);
  });

  it("prioriza cutLinePorDisciplina cuando existe", () => {
    assert.equal(
      getCutLine(
        {
          cutLine: 10,
          cutLineVisible: true,
          cutLinePorDisciplina: { Barriles: 8 },
        },
        "Barriles"
      ),
      8
    );
    assert.equal(
      getCutLine(
        {
          cutLine: 10,
          cutLineVisible: true,
          cutLinePorDisciplina: { Barriles: 8 },
        },
        "TeamRopingHeader"
      ),
      10
    );
  });
});
