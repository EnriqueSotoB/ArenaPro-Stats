import { defineConfig, devices } from "@playwright/test";

const PORT_SITIO = 4173;
const PORT_CONSOLA = 18787;

export default defineConfig({
  testDir: "test/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { locale: "es-MX" },
  projects: [
    {
      name: "escritorio",
      testMatch: "sitio.spec.mjs",
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT_SITIO}/` },
    },
    {
      name: "celular",
      testMatch: "sitio.spec.mjs",
      use: { ...devices["Pixel 7"], baseURL: `http://127.0.0.1:${PORT_SITIO}/` },
    },
    {
      name: "consola",
      testMatch: "admin.spec.mjs",
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT_CONSOLA}/` },
    },
  ],
  webServer: [
    {
      command: `node tools/build-site.mjs && node tools/serve-site.mjs ${PORT_SITIO}`,
      url: `http://127.0.0.1:${PORT_SITIO}/`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "node tools/publish-server.mjs",
      env: { STATS_PUBLISH_PORT: String(PORT_CONSOLA) },
      url: `http://127.0.0.1:${PORT_CONSOLA}/api/status`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
