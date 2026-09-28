/**
 * Levanta la consola real y verifica que rechaza CSRF y DNS rebinding.
 * Solo usa rutas sin efectos (status, admin.html y una ruta inexistente).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = 18000 + Math.floor(Math.random() * 1000);
const HOST = `127.0.0.1:${PORT}`;
const ORIGIN = `http://${HOST}`;

function pedir({ method = "GET", path = "/", headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: "127.0.0.1", port: PORT, method, path, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, data }));
    });
    r.on("error", reject);
    if (body) r.write(body);
    r.end();
  });
}

describe("consola local: guardia contra CSRF y DNS rebinding", () => {
  /** @type {import("node:child_process").ChildProcess} */
  let server;
  let token = "";

  before(async () => {
    server = spawn(process.execPath, [join(root, "scripts", "publish-server.mjs")], {
      cwd: root,
      env: { ...process.env, STATS_PUBLISH_PORT: String(PORT) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("La consola no arrancó")), 10000);
      server.stdout.on("data", (c) => {
        if (String(c).includes("Abre:")) {
          clearTimeout(timer);
          resolve();
        }
      });
      server.on("exit", (code) => reject(new Error(`La consola terminó (${code})`)));
    });
    const admin = await pedir({ path: "/admin.html", headers: { host: HOST } });
    token = /name="arenapro-token" content="([0-9a-f]+)"/.exec(admin.data)?.[1] || "";
  });

  after(() => server?.kill());

  it("inyecta un token de sesión en admin.html", () => {
    assert.equal(token.length, 48);
  });

  it("responde a la consola legítima", async () => {
    const r = await pedir({ path: "/api/status", headers: { host: HOST } });
    assert.equal(r.status, 200);
  });

  it("rechaza DNS rebinding (Host ajeno)", async () => {
    const r = await pedir({ path: "/api/status", headers: { host: `evil.example:${PORT}` } });
    assert.equal(r.status, 403);
  });

  it("rechaza POST de otra página aunque sea text/plain", async () => {
    const r = await pedir({
      method: "POST",
      path: "/api/publish",
      headers: { host: HOST, origin: "https://evil.example", "content-type": "text/plain" },
      body: "{}",
    });
    assert.equal(r.status, 403);
  });

  it("rechaza POST local sin token", async () => {
    const r = await pedir({ method: "POST", path: "/api/publish", headers: { host: HOST, origin: ORIGIN } });
    assert.equal(r.status, 403);
  });

  it("deja pasar POST con token (ruta inexistente → 405, sin efectos)", async () => {
    const r = await pedir({
      method: "POST",
      path: "/api/no-existe",
      headers: { host: HOST, origin: ORIGIN, "x-arenapro-token": token },
    });
    assert.equal(r.status, 405);
  });
});
