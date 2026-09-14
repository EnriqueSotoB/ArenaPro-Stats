# ArenaPro Stats

Página estática de **estadísticas** (evento + temporada) con la marca ArenaPro.
Publicada en GitHub Pages; se alimenta con JSON estilo Time (`arenapro-results.v1`) enriquecido.

Diseño alineado a `ArenaPro-TimeManagement/docs/design/DESIGN_TOKENS.md`
(paleta forest / ochre / sand / cream / dark + derivados; tipografía app Arial; barra `forest`).

## Navegación (estilo PRCA / PBR)

| Vista | Qué muestra |
|--------|-------------|
| **Temporada** | Hub con cards por categoría (top 5) |
| **Ranking** | Tabla completa, pódium, cut line, Δ al líder |
| **Eventos** | Índice de rodeos |
| **Detalle evento** | Pódium + tabs por categoría + filas expandibles (vueltas) |

Rutas hash: `#temporada`, `#temporada/<categoriaId>`, `#eventos`, `#eventos/<eventoId>`.

## Ver en local

```bash
npx --yes serve .
```

## Agregar un evento

1. Exporta `arenapro-results-….json` desde Time.
2. Cópialo a `data/eventos/` (con fecha en el nombre).
3. Enriquece con `nombre`, `equipo`, `puntosCircuito`, y meta `nombreEvento` / `fecha` / `sede` / `temporada`.
4. Regístralo en `data/manifest.json` (`cutLine` opcional = lugares que “clasifican”).
5. `node scripts/rebuild-temporada.mjs`
6. Commit + push.

## Estructura

```
index.html
css/styles.css
js/app.js
assets/logo.svg
data/manifest.json
data/temporada.json
data/eventos/*.json
scripts/rebuild-temporada.mjs
```

## Pages

https://enriquesotob.github.io/ArenaPro-Stats/
