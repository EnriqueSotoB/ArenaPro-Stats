# ArenaPro Stats

Página estática de **estadísticas** (evento + temporada) con la marca ArenaPro.
Publicada en GitHub Pages; se alimenta con JSON de Time (**Exportar para Stats…**) o con la plantilla Excel manual.

**Plan FMR Tour 2027:** ver [`docs/README.md`](./docs/README.md) (sprints, tests, dominio `estadisticas.arenapro.mx`).

Diseño alineado a `ArenaPro-TimeManagement/docs/design/DESIGN_TOKENS.md`
(paleta forest / ochre / sand / cream / dark + derivados; tipografía app Arial; barra `forest`).

## Publicar un evento (recomendado)

1. En Time: **Exportar para Stats…** (o llena la [plantilla Excel](./templates/evento-manual.xlsx) si el rodeo no usó Time)
2. En esta carpeta, doble clic en **`publicar.bat`** (cierra sola la instancia anterior del puerto 8787)
3. En el navegador (`admin.html`):
   - suelta el JSON o el Excel
   - confirma la **temporada** y revisa el **preview** (pódium / categorías)
   - **Agregar a Stats**
   - **Publicar en GitHub Pages** (siempre regenera `temporada.json` en un proceso Node nuevo)
4. Espera 1–2 min y abre https://estadisticas.arenapro.mx/

La temporada une categorías por **disciplina de circuito** (p. ej. Abierta / Barriles Abierto → Barriles; Master → Barriles Masters). No uses ids `local:` del export.

Para **quitar** un evento: en la lista “Eventos en el repo” → **Eliminar** → confirma → **Publicar**.

La consola solo funciona en **localhost**. El sitio público en Pages es solo lectura (sin “probar export”).

## Ver el sitio en local

Con la consola ya corriendo: http://127.0.0.1:8787/

O solo estático:

```bash
npx --yes serve .
```

## Navegación pública

| Vista | Qué muestra |
|--------|-------------|
| **Temporada** | Hub con cards por categoría (top 5) |
| **Ranking** | Tabla completa, pódium, cut line, Δ al líder |
| **Eventos** | Índice de rodeos |
| **Detalle evento** | Pódium + tabs por categoría + filas expandibles |

## Estructura

```
admin.html                 ← consola local de publicación
publicar.bat
index.html
css/ styles + admin
js/ app.js + admin.js
data/ manifest + temporada + eventos/
templates/evento-manual.xlsx
scripts/publish-server.mjs
scripts/rebuild-temporada.mjs
```

## Pages

https://estadisticas.arenapro.mx/

(DNS + custom domain: ver [`docs/03-dominio-pages.md`](./docs/03-dominio-pages.md))
