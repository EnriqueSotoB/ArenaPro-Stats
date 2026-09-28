import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { esArchivoGenerado, sincronizarConRemoto } from "../../scripts/lib/git-sync.mjs";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function escribir(repo, ruta, contenido) {
  const full = join(repo, ...ruta.split("/"));
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, contenido, "utf8");
}

function commit(repo, mensaje) {
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", mensaje);
}

function clonar(remoto, destino) {
  git(join(destino, ".."), "clone", "-q", remoto, destino);
  git(destino, "config", "user.name", "Test");
  git(destino, "config", "user.email", "test@example.com");
  git(destino, "config", "core.autocrlf", "false");
}

describe("esArchivoGenerado", () => {
  it("solo acepta JSON de data/circuitos", () => {
    assert.equal(esArchivoGenerado("data/circuitos/aerch.json"), true);
    assert.equal(esArchivoGenerado("data\\circuitos\\aerch.json"), true);
    assert.equal(esArchivoGenerado("data/manifest.json"), false);
    assert.equal(esArchivoGenerado("data/eventos/x.json"), false);
  });
});

describe("sincronizarConRemoto", () => {
  /** @type {string} */ let base;
  /** @type {string} */ let otro;
  /** @type {string} */ let local;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), "arenapro-sync-"));
    const remoto = join(base, "remoto.git");
    git(base, "init", "-q", "--bare", "-b", "main", remoto);
    otro = join(base, "otro");
    local = join(base, "local");
    clonar(remoto, otro);
    git(otro, "checkout", "-q", "-b", "main");
    escribir(otro, "data/circuitos/c.json", "inicial\n");
    escribir(otro, "data/eventos/e.json", "inicial\n");
    commit(otro, "inicial");
    git(otro, "push", "-q", "origin", "main");
    clonar(remoto, local);
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  it("sin cambios remotos no hace nada", () => {
    escribir(local, "data/eventos/nuevo.json", "x\n");
    commit(local, "local");
    const r = sincronizarConRemoto({ root: local, regenerar: () => assert.fail("no debía regenerar") });
    assert.deepEqual(r.conflictosResueltos, []);
  });

  it("regenera cuando el choque es solo en data/circuitos", () => {
    escribir(otro, "data/circuitos/c.json", "remoto\n");
    escribir(otro, "data/eventos/remoto.json", "r\n");
    commit(otro, "remoto");
    git(otro, "push", "-q", "origin", "main");

    escribir(local, "data/circuitos/c.json", "local\n");
    escribir(local, "data/eventos/local.json", "l\n");
    commit(local, "local");

    const r = sincronizarConRemoto({
      root: local,
      regenerar: () => escribir(local, "data/circuitos/c.json", "regenerado\n"),
    });

    assert.deepEqual(r.conflictosResueltos, ["data/circuitos/c.json"]);
    assert.equal(readFileSync(join(local, "data", "circuitos", "c.json"), "utf8"), "regenerado\n");
    assert.equal(readFileSync(join(local, "data", "eventos", "remoto.json"), "utf8"), "r\n");
    assert.equal(git(local, "log", "-1", "--format=%s"), "local");
    assert.equal(git(local, "merge-base", "--is-ancestor", "origin/main", "HEAD"), "");
  });

  it("aborta sin perder el commit local si el choque es en un evento", () => {
    escribir(otro, "data/eventos/e.json", "remoto\n");
    commit(otro, "remoto");
    git(otro, "push", "-q", "origin", "main");

    escribir(local, "data/eventos/e.json", "local\n");
    commit(local, "local");
    const antes = git(local, "rev-parse", "HEAD");

    assert.throws(
      () => sincronizarConRemoto({ root: local, regenerar: () => {} }),
      (err) => err.statusCode === 409 && /data\/eventos\/e\.json/.test(err.message)
    );
    assert.equal(git(local, "rev-parse", "HEAD"), antes);
    assert.equal(git(local, "status", "--porcelain"), "");
  });

  it("aborta si regenerar falla durante el conflicto", () => {
    escribir(otro, "data/circuitos/c.json", "remoto\n");
    commit(otro, "remoto");
    git(otro, "push", "-q", "origin", "main");
    escribir(local, "data/circuitos/c.json", "local\n");
    commit(local, "local");
    const antes = git(local, "rev-parse", "HEAD");

    assert.throws(
      () =>
        sincronizarConRemoto({
          root: local,
          regenerar: () => {
            throw new Error("boom");
          },
        }),
      /boom/
    );
    assert.equal(git(local, "rev-parse", "HEAD"), antes);
  });
});
