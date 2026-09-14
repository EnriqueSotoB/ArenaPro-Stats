# ArenaPro Stats

Página estática para mostrar **resultados por evento** y **tabla de temporada**.
Pensada para publicarse en **GitHub Pages** y alimentarse con JSON estilo Time (`arenapro-results.v1`), enriquecido con nombres y puntos de circuito.

## Ver en local

Con cualquier servidor estático (necesario por `fetch` de JSON):

```bash
npx --yes serve .
```

Abre la URL que imprima (suele ser `http://localhost:3000`).

También puedes usar *Probar export de Time* en la propia página para previsualizar un JSON sin subirlo al repo.

## Agregar un evento real

1. En ArenaPro Time → Resultados → exporta `arenapro-results-….json`.
2. Copia el archivo a `data/eventos/` (renómbralo con fecha, p. ej. `2026-09-14-mi-rodeo.json`).
3. Enriquece cada fila de `resultados` con (recomendado hasta que Time lo exporte solo):

   - `nombre` — nombre del competidor  
   - `equipo` — opcional  
   - `puntosCircuito` — puntos FMR/circuito del evento  

   Y a nivel raíz:

   - `nombreEvento`, `fecha`, `temporada`, `sede`

4. Regístralo en `data/manifest.json` dentro de `eventos`.
5. Regenera el acumulado:

```bash
node scripts/rebuild-temporada.mjs
```

6. Commit + push → Pages se actualiza.

## Estructura

```
index.html
css/styles.css
js/app.js
assets/logo.svg
data/
  manifest.json      ← lista de eventos publicados
  temporada.json     ← acumulado (generado)
  eventos/*.json     ← un archivo por competencia
scripts/rebuild-temporada.mjs
```

## GitHub Pages

Settings → Pages → Source: **Deploy from a branch** → branch `main` / folder `/ (root)`.

URL típica: `https://<usuario>.github.io/ArenaPro-Stats/`

> Si la página queda en blanco al abrir el HTML como archivo (`file://`), es normal: usa un servidor local o Pages.

## Relación con Time / Web

- Contrato base: `arenapro-results.v1` (Time → Web).
- Este repo es un **escaparate estático**; no reemplaza ArenaPro Web.
- Campos extra (`nombre`, `puntosCircuito`, `nombreEvento`, …) son opcionales para Stats y no rompen el schema v1.
