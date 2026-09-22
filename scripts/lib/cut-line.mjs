/**
 * Cut line público: solo si FMR lo activó explícitamente.
 * @param {{ cutLineVisible?: boolean, cutLine?: number|null, cutLinePorDisciplina?: Record<string, number> }} manifest
 * @param {string} [disciplinaId]
 * @returns {number|null}
 */
export function getCutLine(manifest, disciplinaId) {
  if (!manifest || manifest.cutLineVisible !== true) return null;
  const por =
    disciplinaId && manifest.cutLinePorDisciplina
      ? Number(manifest.cutLinePorDisciplina[disciplinaId])
      : NaN;
  if (Number.isFinite(por) && por > 0) return por;
  const global = Number(manifest.cutLine);
  return Number.isFinite(global) && global > 0 ? global : null;
}
