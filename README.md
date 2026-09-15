# ArenaPro Stats

Página estática de **estadísticas** (evento + temporada) con la marca ArenaPro.
Publicada en GitHub Pages; se alimenta con JSON de Time (**Exportar para Stats…**).

Diseño alineado a `ArenaPro-TimeManagement/docs/design/DESIGN_TOKENS.md`
(paleta forest / ochre / sand / cream / dark + derivados; tipografía app Arial; barra `forest`).

## Publicar un evento (flujo demo — recomendado)

1. En Time: **Exportar para Stats…**
2. En esta carpeta, doble clic en **`publicar.bat`** (o `node scripts/publish-server.mjs`)
3. En el navegador (`admin.html`):
   - suelta el JSON
   - confirma la **temporada** del circuito
   - **Agregar a Stats**
   - **Publicar en GitHub Pages**
4. Espera 1–2 min y abre https://enriquesotob.github.io/ArenaPro-Stats/

La consola solo funciona en **localhost** (escribe el repo y hace `git push`). No uses `admin.html` desde Pages.

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
scripts/publish-server.mjs
scripts/rebuild-temporada.mjs
```

## Pages

https://enriquesotob.github.io/ArenaPro-Stats/
