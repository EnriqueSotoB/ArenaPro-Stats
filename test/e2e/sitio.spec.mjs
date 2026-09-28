import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("data/manifest.json", "utf8"));
const principal = manifest.circuitos.find((c) => c.id === manifest.circuitoDefault);
const circuito = JSON.parse(readFileSync(`data/circuitos/${manifest.circuitoDefault}.json`, "utf8"));
const competidor = circuito.standings.find((s) => s.nombre && s.nombre.length > 4);

/** Falla la prueba si la página tira errores de JS o de la política de seguridad (CSP). */
function vigilarErrores(page) {
  const errores = [];
  page.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errores.push(`console: ${m.text()}`);
  });
  return errores;
}

test.describe("sitio público", () => {
  test("la portada abre en el circuito principal con disciplinas", async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto("/");
    await expect(page.locator("#tempTitle")).toContainText(principal.nombre);
    await expect(page.locator("#tempCards .cat-card").first()).toBeVisible();
    await expect(page.locator("#status")).not.toHaveClass(/is-error/);
    await expect(page.locator(".footer-links a", { hasText: "Aviso de privacidad" })).toBeVisible();
    expect(errores).toEqual([]);
  });

  test("abre la clasificación completa de una disciplina", async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto("/");
    await page.locator(".cat-card-cta").first().click();
    await expect(page.locator("#viewTemporadaRanking")).toBeVisible();
    await expect(page.locator("#rankTable tbody tr").first()).toBeVisible();
    await page.locator("#rankMetricDinero").click();
    await expect(page.locator("#rankTable")).toBeVisible();
    expect(errores).toEqual([]);
  });

  test("busca un competidor y abre su ficha con nombre en mayúsculas", async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto("/");
    await expect(page.locator("#tempCards .cat-card").first()).toBeVisible();
    await page.locator("#searchInput").fill(competidor.nombre.slice(0, 5).toLowerCase());
    const hit = page.locator(".search-hit", { hasText: competidor.nombre }).first();
    await expect(hit).toBeVisible();
    await hit.click();
    await expect(page.locator("#viewCompetidor")).toBeVisible();
    await expect(page.locator("#compTitle")).toHaveText(competidor.nombre);
    expect(competidor.nombre).toBe(competidor.nombre.toLocaleUpperCase("es-MX"));
    expect(errores).toEqual([]);
  });

  test("lista los eventos y abre el detalle de uno", async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto("/#eventos");
    const primero = page.locator("#eventosList .event-row").first();
    await expect(primero).toBeVisible();
    await primero.click();
    await expect(page.locator("#viewEventoDetail")).toBeVisible();
    await expect(page.locator("#eventoTable tr").first()).toBeVisible();
    expect(errores).toEqual([]);
  });

  test("las páginas legales cargan y se enlazan entre sí", async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto("/aviso-privacidad.html");
    await expect(page.locator("h1")).toHaveText("Aviso de privacidad");
    await expect(page.locator("main")).toContainText("soporte@arenapro.mx");
    await page.locator(".footer-links a", { hasText: "Términos de uso" }).click();
    await expect(page.locator("h1")).toHaveText("Términos de uso");
    expect(errores).toEqual([]);
  });

  test("una ruta inexistente muestra la página 404", async ({ page }) => {
    const res = await page.goto("/no-existe");
    expect(res?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText("No encontramos esta página");
  });

  test("no expone archivos internos ni notas de jueces", async ({ request }) => {
    expect((await request.get("/admin.html")).status()).toBe(404);
    expect((await request.get("/data/competidor-aliases.json")).status()).toBe(404);
    const primerEvento = manifest.eventos[0];
    const evento = await (await request.get(`/data/${primerEvento.file}`)).text();
    expect(evento).not.toContain('"notas"');
  });

  test("el portal muestra el acceso de asociaciones", async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto("/portal.html");
    await expect(page.locator("#loginForm")).toBeVisible();
    await expect(page.locator("#loginPassword")).toBeVisible();
    expect(errores).toEqual([]);
  });

  test("el portal genera la imagen para redes", async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto("/portal.html");
    await page.locator("#btnEntrarLocal").click();
    await expect(page.locator("#viewPortal")).toBeVisible();
    await expect(page.locator("#kpis")).not.toBeEmpty();
    await page.locator('[data-tab="redes"]').click();
    const lienzo = page.locator("#redesPreview canvas").first();
    await expect(lienzo).toBeVisible();
    const ancho = await lienzo.evaluate((c) => c.width);
    expect(ancho).toBeGreaterThan(500);
    expect(errores).toEqual([]);
  });
});
