# ArenaPro Stats

Página estática de **estadísticas** (evento + temporada) con la marca ArenaPro.
Publicada en GitHub Pages; se alimenta con JSON de Time (**Exportar para Stats…**) o con la plantilla Excel manual.

Soporta varias **asociaciones** (AERCH, FMR…) y un **circuito por temporada** de cada una; un evento puede contar para varios circuitos (p. ej. FMR Tour-AERCH).

La documentación interna (`docs/`: manual del admin, runbook, contratos) vive solo en local y no se versiona.

Diseño alineado a `ArenaPro-TimeManagement/docs/design/DESIGN_TOKENS.md`
(paleta forest / ochre / sand / cream / dark + derivados; tipografía app Arial; barra `forest`).

## Publicar un evento (recomendado)

1. En Time: **Exportar para Stats…** (o llena la [plantilla Excel](./templates/evento-manual.xlsx) si el rodeo no usó Time)
2. En esta carpeta, doble clic en **`publicar.bat`** (cierra sola la instancia anterior del puerto 8787)
3. En el navegador (`admin.html`):
   - suelta el JSON o el Excel
   - marca los **circuitos** para los que cuenta (asociación + temporada) y revisa el **preview** (pódium / categorías)
   - **Agregar a Estadísticas**
   - **Publicar en GitHub Pages** (valida los datos, regenera `data/circuitos/*.json` y corre las pruebas antes de subir)
4. Espera 2–4 min y abre https://estadisticas.arenapro.mx/

Asociaciones y temporadas nuevas (p. ej. **AERCH Circuito 2028**) se crean en el panel **Asociaciones y circuitos** del admin. El circuito **principal** es el que abre el sitio público.

La temporada une categorías por **disciplina de circuito** (p. ej. Abierta / Barriles Abierto → Barriles; Master → Barriles Masters). No uses ids `local:` del export.

Para **quitar** un evento: en la lista “Eventos en el repo” → **Eliminar** → confirma → **Publicar**.

La consola solo funciona en **localhost**. El sitio público en Pages es solo lectura (sin “probar export”).

## Ver el sitio en local

Con la consola ya corriendo: http://127.0.0.1:8787/

O exactamente lo que se publica:

```bash
npm run build:site
node tools/serve-site.mjs 4173
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

## Tres niveles de acceso

| Nivel | Dónde | Qué puede hacer |
|-------|-------|-----------------|
| **Público** (competidores) | `index.html` | Ver temporada, eventos y fichas |
| **Asociación** | Liga corta `estadisticas.arenapro.mx/{asociacionId}` (p. ej. `/aerch`; redirige a `portal.html#{asociacionId}`; el build la crea para cada asociación con acceso) + contraseña | Tablero de su circuito (KPIs, movimientos del último rodeo, récords de la temporada, disciplinas, líderes, más activos) e **imágenes para redes** (clasificación, resultados de evento, movimientos, récords de la temporada y récords nuevos por evento). No publica nada |
| **Super admin** | `admin.html` vía `publicar.bat` | Todo: eventos, circuitos, asociaciones, accesos al portal y publicar |

**Acceso al portal:** en el admin, **Dar acceso** genera la contraseña (o usa la que escribas, mín. 14 caracteres) y te arma el mensaje con liga + contraseña para mandarlo. Solo se guarda una huella en `data/manifest.json` (nunca la contraseña); se activa al publicar. **Nueva contraseña** invalida la anterior. Desde tu compu (`127.0.0.1`) puedes entrar a cualquier portal sin contraseña.

El sitio es estático: el portal no oculta datos (todo lo que muestra ya es público en el sitio); la contraseña evita que cualquiera use las herramientas con la marca de la asociación. No guardes en `data/` nada que no deba ser público.

**Imágenes para redes (portal):** clasificación de temporada (puntos, dinero o Vaquero Completo) o resultados de un evento; formato post 4:5, cuadrado o historia 9:16; **Top 3**, **Top 10** o **Todos**. Todos usa doble columna (~30 por imagen) y, si no caben, arma un carrusel con el mismo número de lugares por imagen. En el celular, **Compartir** manda todas las imágenes juntas a Instagram / Facebook / WhatsApp.

## Estructura

```
web/            ← sitio público (se publica)
  index.html, portal.html, páginas legales, 404
  css/  js/  assets/  (fuente e íconos)
  lib/          ← reglas de negocio puras (navegador + Node)
data/           ← manifest, eventos/, circuitos/ (generado), logos/  (se publica)
admin/          ← consola local de publicación (no se publica)
tools/          ← servidor local, build, rebuild, monitor (no se publica)
  lib/          ← módulos solo de Node: Excel, git, validación, rutas
templates/      ← plantilla Excel
test/           ← unit/, integration/, e2e/, fixtures/
docs/           ← documentación interna (solo local, en .gitignore)
publicar.bat    ← abre la consola
```

Las URLs no cambian: el build (`tools/build-site.mjs`) arma `_site/` con `web/` en la raíz y `data/` en `/data/`; la consola local monta lo mismo y además `/admin.html`. Nada de `tools/`, `admin/`, `docs/` ni la configuración del repo llega al sitio.

## Desarrollo

```bash
npm ci
npm run lint
npm test            # unit + integración
npm run test:e2e    # Playwright: sitio (escritorio y celular) + consola
```

Cada push a `main` corre lint, tests y E2E antes de desplegar; si algo falla, el sitio no cambia. Reglas de ramas y PRs: `docs/ingenieria/practicas.md` (local).

## Pages

https://estadisticas.arenapro.mx/

(DNS + custom domain: ver `docs/ingenieria/dominio-pages.md`, local)
