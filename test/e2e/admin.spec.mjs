import { test, expect } from "@playwright/test";

/** Solo lectura: abre la consola y revisa que cargue; no agrega, borra ni publica nada. */
test.describe("consola local", () => {
  test("el admin carga sus módulos y el estado del repo", async ({ page }) => {
    const errores = [];
    page.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errores.push(`console: ${m.text()}`);
    });

    await page.goto("/admin.html");
    await expect(page.locator("#circuitosTree li").first()).toBeVisible();
    await expect(page.locator("#aliasAsociacion option")).not.toHaveCount(1);
    expect(errores).toEqual([]);
  });

  test("sirve la plantilla Excel y el sitio público", async ({ request }) => {
    const plantilla = await request.get("/templates/evento-manual.xlsx");
    expect(plantilla.status()).toBe(200);
    expect((await request.get("/")).status()).toBe(200);
    expect((await request.get("/data/manifest.json")).status()).toBe(200);
  });

  test("no expone código ni configuración del repo", async ({ request }) => {
    for (const ruta of ["/tools/publish-server.mjs", "/package.json", "/.git/config", "/docs/operacion/runbook.md"]) {
      expect((await request.get(ruta)).status(), ruta).toBe(404);
    }
  });
});
