# ArenaPro Stats

Página estática de **estadísticas** (evento + temporada) con la marca ArenaPro.
Publicada en GitHub Pages; se alimenta con JSON de Time (**Exportar para Stats…**) o con la plantilla Excel manual.

Soporta varias **asociaciones** (AERCH, FMR…) y un **circuito por temporada** de cada una; un evento puede contar para varios circuitos (p. ej. FMR Tour-AERCH).

Plan original y sprints: ver [`docs/README.md`](./docs/README.md) (tests, dominio `estadisticas.arenapro.mx`).

Diseño alineado a `ArenaPro-TimeManagement/docs/design/DESIGN_TOKENS.md`
(paleta forest / ochre / sand / cream / dark + derivados; tipografía app Arial; barra `forest`).

## Publicar un evento (recomendado)

1. En Time: **Exportar para Stats…** (o llena la [plantilla Excel](./templates/evento-manual.xlsx) si el rodeo no usó Time)
2. En esta carpeta, doble clic en **`publicar.bat`** (cierra sola la instancia anterior del puerto 8787)
3. En el navegador (`admin.html`):
   - suelta el JSON o el Excel
   - marca los **circuitos** para los que cuenta (asociación + temporada) y revisa el **preview** (pódium / categorías)
   - **Agregar a Stats**
   - **Publicar en GitHub Pages** (siempre regenera `data/circuitos/*.json` en un proceso Node nuevo)

Asociaciones y temporadas nuevas (p. ej. **AERCH Circuito 2028**) se crean en el panel **Asociaciones y circuitos** del admin. El circuito **principal** es el que abre el sitio público.
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
| **Competidor** | Ficha con totales, disciplinas e historial (`#competidor/…`) |
| **Eventos** | Rodeos del circuito elegido, con etiqueta de cada circuito para el que cuentan |
| **Detalle evento** | Pódium + tabs por categoría + filas expandibles |

El selector de la barra superior cambia de asociación / temporada. Las URLs llevan el circuito: `#aerch-circuito-2027/temporada/Barriles`.

Búsqueda en la barra superior (también **Ctrl/⌘+K**). Los nombres enlazan a la ficha.

**Imagen para redes:** en el ranking y en cada evento, el botón genera un PNG listo para Facebook / Instagram (post 4:5, cuadrado o historia 9:16) con el texto de la publicación y hashtags. En el celular, **Compartir** abre directo Instagram / Facebook / WhatsApp.

## Estructura

```
admin.html                 ← consola local de publicación
publicar.bat
index.html
css/ styles + admin
js/ app.js + admin.js + social-card.js
data/ manifest (asociaciones, circuitos, eventos) + circuitos/ (generado) + eventos/
templates/evento-manual.xlsx
scripts/publish-server.mjs
scripts/rebuild-temporada.mjs
```

## Pages

https://estadisticas.arenapro.mx/

(DNS + custom domain: ver [`docs/03-dominio-pages.md`](./docs/03-dominio-pages.md))
