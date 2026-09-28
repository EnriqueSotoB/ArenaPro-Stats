/**
 * Sincroniza la rama local con origin antes de publicar.
 * Resuelve por sí solo únicamente los conflictos en archivos generados (data/circuitos/),
 * regenerándolos; cualquier otro conflicto aborta sin tocar el commit local.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";

const GENERADOS = /^data\/circuitos\/[^/]+\.json$/;
const MAX_PASOS = 50;

export function esArchivoGenerado(ruta) {
  return GENERADOS.test(String(ruta).replace(/\\/g, "/"));
}

function error409(message) {
  return Object.assign(new Error(message), { statusCode: 409 });
}

/**
 * @param {{ root: string, regenerar: () => void }} opts
 * @returns {{ conflictosResueltos: string[] }}
 */
export function sincronizarConRemoto({ root, regenerar }) {
  const git = (args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_EDITOR: "true" },
    }).trim();

  const rutaGit = (p) => {
    const r = git(["rev-parse", "--git-path", p]);
    return isAbsolute(r) ? r : join(root, r);
  };
  const enRebase = () => existsSync(rutaGit("rebase-merge")) || existsSync(rutaGit("rebase-apply"));
  const abortar = () => {
    try {
      git(["rebase", "--abort"]);
    } catch {
      /* ya no había rebase */
    }
  };
  const detalle = (e) => String(e?.stderr || e?.message || e).trim();

  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  git(["fetch", "origin"]);

  try {
    git(["rebase", "--autostash", `origin/${branch}`]);
    return { conflictosResueltos: [] };
  } catch (e) {
    if (!enRebase()) throw error409(`No se pudo sincronizar con GitHub. ${detalle(e)}`);
  }

  const resueltos = [];
  for (let paso = 0; paso < MAX_PASOS && enRebase(); paso++) {
    const conflictos = git(["diff", "--name-only", "--diff-filter=U"]).split("\n").filter(Boolean);
    const ajenos = conflictos.filter((f) => !esArchivoGenerado(f));
    if (ajenos.length) {
      abortar();
      throw error409(
        `No se publicó: GitHub tiene cambios que chocan con los tuyos en ${ajenos.join(", ")}. ` +
          "Tus cambios siguen guardados en esta computadora; hay que unirlos a mano antes de publicar."
      );
    }

    if (conflictos.length) {
      git(["checkout", "--theirs", "--", ...conflictos]);
      try {
        regenerar();
      } catch (e) {
        abortar();
        throw e;
      }
      git(["add", "--", "data/circuitos"]);
      resueltos.push(...conflictos);
    }

    try {
      git(["rebase", "--continue"]);
    } catch (e) {
      if (!enRebase()) throw error409(`No se pudo sincronizar con GitHub. ${detalle(e)}`);
      const pendientes = git(["diff", "--name-only", "--diff-filter=U"]);
      if (!pendientes && !git(["diff", "--cached", "--name-only"])) git(["rebase", "--skip"]);
    }
  }

  if (enRebase()) {
    abortar();
    throw error409("No se pudo sincronizar con GitHub: demasiados conflictos seguidos.");
  }
  return { conflictosResueltos: [...new Set(resueltos)] };
}
