# ArenaPro Stats — Plan FMR Tour 2027

Documentación operativa para construir la página oficial de estadísticas del **FMR Tour 2027**: puntos de circuito, dinero ganado (MXN) y **All-Around Cowboy** de temporada.

Este plan asume **~4 semanas** de trabajo profesional, con sprints cortos, branches por sprint, commits pequeños en español y una suite de tests que crece en cada entrega.

---

## Cómo usar estos docs

1. Lee **[Decisiones de producto](./00-decisiones-producto.md)** (fuente de verdad de negocio).
2. Lee **[Prácticas de ingeniería](./01-practicas-ingenieria.md)** antes de tocar código.
3. Revisa **[Contratos de datos](./02-contratos-datos.md)** (Time ↔ Stats).
4. Configura la URL pública: **[Dominio GitHub Pages](./03-dominio-pages.md)** (`stats.arenapro.mx`).
5. Trabaja **un sprint a la vez** siguiendo la carpeta [`sprints/`](./sprints/).
6. Al cerrar un sprint: PR → review → merge a `develop` (nunca commits directos en `main`).
7. Antes de lanzar: **[Checklist de lanzamiento](./checklist-lanzamiento.md)**.
8. Lo que no entre en v1: **[Backlog v1.1](./backlog-v1.1.md)**.

---

## Mapa de sprints

| Sprint | Branch sugerida | Objetivo | Docs |
|--------|-----------------|----------|------|
| **0** Fundación | `sprint/0-fundacion` | Tooling, tests base, ramas, branding prep, quitar “demo” | [sprint-0](./sprints/sprint-0-fundacion.md) |
| **1** Contratos e identidad | `sprint/1-contratos-identidad` | Schema dinero, aliases `local:*`, cut line preparado (oculto) | [sprint-1](./sprints/sprint-1-contratos-identidad.md) |
| **2** Dinero + Team Roping | `sprint/2-dinero-team-roping` | Rebuild con `$`, Headers/Heelers, puntos sin split | [sprint-2](./sprints/sprint-2-dinero-team-roping.md) |
| **3** Admin semi-auto | `sprint/3-admin-semi-auto` | Preview + cherry-pick + ediciones (`statsEdits`) | [sprint-3](./sprints/sprint-3-admin-semi-auto.md) |
| **4** UI + All-Around + QA | `sprint/4-ui-all-around-qa` | Público FMR, All-Around temporada, release | [sprint-4](./sprints/sprint-4-ui-all-around-qa.md) |

**Orden obligatorio:** 0 → 1 → 2 → 3 → 4. No adelantar UI de dinero sin rebuild + fixtures de test.

---

## Estado del repo (punto de partida)

| Capacidad | Estado |
|-----------|--------|
| Ranking puntos temporada | Funciona (demo) |
| Detalle por evento | Funciona |
| Admin local + publish GitHub Pages | Funciona |
| Dinero / premios | **No existe** |
| Headers / Heelers | **No existe** (TR como dúo) |
| All-Around | **No existe** |
| Suite de tests | **No existe** (Sprint 0 la crea) |
| Branding FMR Tour 2027 | Pendiente (hoy “Circuito demo”) |

Sitio actual: https://enriquesotob.github.io/ArenaPro-Stats/

---

## Regla de oro

> **Ningún feature nuevo sin tests que fallen primero (o al menos tests que fijen el comportamiento esperado).**  
> Si no puedes explicar en una frase qué se rompe si alguien cambia X, falta un test.
