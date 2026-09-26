# Decisiones de producto — FMR Tour 2027

**Producto:** ArenaPro Estadísticas (sitio público) alimentado por ArenaPro Time **o** plantilla Excel manual  
**Temporada objetivo:** FMR Tour 2027
**Última actualización:** 2026-09-25

Cualquier cambio de negocio se actualiza **aquí primero**, luego en código y tests.

---

## 1. Marca y alcance v1

| Tema | Decisión |
|------|----------|
| Nombre público | **FMR Tour 2027** (marca oficial FMR) |
| Dimensiones | (1) Puntos de circuito (2) Dinero ganado MXN (3) **Vaquero Completo** de temporada |
| Línea de corte | **Se define más tarde** — preparar en `manifest`, no mostrar badges hasta tener número oficial |
| Multi-temporada / archivo | Fuera de v1 → backlog |
| Vaquero Completo **por evento** | Fuera de v1 → backlog (prioridad es temporada) |

---

## 2. Puntos

| Tema | Decisión |
|------|----------|
| Fuente de verdad | **ArenaPro Time** (`puntosCircuito`) o plantilla Excel manual (misma semántica) |
| Estadísticas | **No recalcula** reglas de puntuación; solo agrega por temporada |
| Precisión | Como **AERCH**: enteros o **medios puntos** (`.5`) por empate. Si Time manda float basura (`22.666…`), Stats redondea al **múltiplo de 0.5** más cercano al ingest/rebuild y al mostrar. Evidencia: tablas AERCH Circuito 2026 (Barriles `7.5` / `37.5`) |
| Lazo por Parejas | Los puntos **NO** se dividen 50/50. Se usan los puntos que vengan de Time por rol (cabecero/pialador) |

---

## 3. Dinero

| Tema | Decisión |
|------|----------|
| Fuente | Time exporta montos; sin Time, la plantilla Excel los captura a mano. Stats suma y muestra |
| Moneda | **MXN**, enteros (sin decimales). Formato `es-MX` |
| Lazo por Parejas | Dinero **50/50** cabecero / pialador — **confirmado** con organizadores |
| Redondeo 50/50 | Si el monto es impar: piso al cabecero, resto al pialador (ej. 10001 → 5000 / 5001). Determinista y testeado |

Implementación: constante `TEAM_ROPING_MONEY_SPLIT = 0.5` en `scripts/lib/money.mjs`.

---

## 4. Lazo por Parejas — tablas separadas

Nombre oficial FMR: **Lazo por Parejas** (no “Team Roping”). Roles: **cabecero** y **pialador** (no header/heeler). Categoría **Master** (FMR; no “Masters”).

Fuente: [Disciplinas del Rodeo — FMR](https://federacionmexicanaderodeo.org/las-disciplinas-del-rodeo/), Reglamento Deportivo FMR, posición [Lazo por Parejas – Cabeceros](https://federacionmexicanaderodeo.org/position/lazo-por-parejas-cabeceros/).

| Vista | `disciplinaId` (interno, estable) | Etiqueta UI |
|-------|-----------------------------------|-------------|
| Cabeceros Abierta | `TeamRopingHeader` | Lazo por Parejas — Cabeceros |
| Pialadores Abierta | `TeamRopingHeeler` | Lazo por Parejas — Pialadores |
| Cabeceros Master | `TeamRopingMastersHeader` | Lazo por Parejas Master — Cabeceros |
| Pialadores Master | `TeamRopingMastersHeeler` | Lazo por Parejas Master — Pialadores |

- En UI: clasificaciones **Cabeceros** y **Pialadores** (no un solo ranking de dúos `"A / B"`).
- Identidad: persona por rol, no el string del equipo.
- Los IDs internos (`TeamRoping*`, campos `headerNombre` / `heelerNombre` del contrato Time) se mantienen por compatibilidad; solo cambian etiquetas públicas.

---

## 5. Identidad de competidores (`local:*`)

| Tema | Decisión |
|------|----------|
| IDs web estables | **Aún no** — seguiremos con `local:*` |
| Merge entre eventos | Clave por nombre normalizado (`name:…`) cuando el id es `local:` |
| Corrección manual | Archivo `data/competidor-aliases.json` + UI básica en admin (Sprint 1–3) |
| Riesgo aceptado | Homónimos pueden fusionarse; se corrige con alias |

---

## 6. Vaquero Completo (temporada)

Nombre oficial FMR: **Vaquero Completo** / **Vaquera Completa** (Reglamento Deportivo FMR §1.13.12; Campeones Nacionales). No usar “All-Around Cowboy” en UI.

En este producto el ranking de temporada se mide en **dinero ganado en ≥2 disciplinas** (regla de circuito / versatilidad; distinta del cómputo por puntos del CNR).

| Regla | Decisión |
|-------|----------|
| Alcance | **Temporada** (no por evento en v1) |
| Mínimo disciplinas | **2+** |
| ¿Hay que cobrar en las 2? | **Sí.** Participar en 2 y cobrar solo en 1 **no** califica |
| Puntaje | Suma de `dineroTotal` de todas las disciplinas donde `dineroTotal > 0` |
| Lazo por Parejas | Cabecero y Pialador son disciplinas **distintas** |
| Empates | Más disciplinas con dinero → mayor premio en una disciplina → desempate manual en admin si hace falta |

### Ejemplos

| Caso | ¿Entra? | Total Vaquero Completo |
|------|---------|------------------------|
| $ en Barriles + $ en Lazo de Becerro | Sí | Suma de ambos |
| Inscrito en 2, cobra solo en Barriles | **No** | — |
| $ en Cabecero + $ en Pialador | Sí | Suma de ambos roles |
| $ en 3 disciplinas | Sí | Suma de las 3 |

---

## 7. Admin — publicación semi-automatizada

Al agregar un evento:

1. **Preview** fiel a lo que verá el público.
2. **Elegir** categorías (incluir / excluir).
3. **Ediciones manuales** puntuales (nombre, puntos, monto, excluir fila).
4. Guardar capa `statsEdits` sobre el export de Time.
5. Ingest + rebuild → publicar.

Flujo: automático por defecto, humano en el loop cuando haga falta.

---

## 8. Preguntas abiertas (no bloquean Sprint 0–1)

1. Línea de corte: ¿global o por disciplina? ¿número exacto?
2. ~~Confirmación organizadores: ¿dinero LP 50/50?~~ → **Confirmado 50/50 cabecero/pialador** (2026-09-25)
3. ¿Nombre exacto en UI: “FMR Tour 2027” vs variante con sponsor?
4. ¿Master de LP también Cabeceros/Pialadores separados? (asumimos **sí**)

### Estado coordinación Time (Sprint 1)

| Ítem | Estado |
|------|--------|
| Checklist export enviado/revisado (`02-contratos-datos.md` §9) | **Pendiente** — compartir con equipo Time |
| `montoGanado` en export | Pendiente confirmación |
| LP cabecero/pialador o dúo `"A / B"` | Pendiente confirmación Time (Stats ya soporta ambos) |
| Split dinero LP 50/50 | **Confirmado** |

Cuando haya respuesta de Time sobre el shape del export, actualizar esta sección y abrir commit:  
`docs: registrar respuesta Time sobre dinero y lazo por parejas`.

Cuando se cierren otras preguntas, actualizar este archivo y abrir un commit:  
`docs: actualizar decisión X en FMR Tour 2027`.
