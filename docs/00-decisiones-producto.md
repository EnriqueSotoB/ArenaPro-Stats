# Decisiones de producto — FMR Tour 2027

**Última actualización:** 2026-09-21  
**Producto:** ArenaPro Stats (sitio público) alimentado por ArenaPro Time  
**Temporada objetivo:** FMR Tour 2027

Cualquier cambio de negocio se actualiza **aquí primero**, luego en código y tests.

---

## 1. Marca y alcance v1

| Tema | Decisión |
|------|----------|
| Nombre público | **FMR Tour 2027** |
| Dimensiones | (1) Puntos de circuito (2) Dinero ganado MXN (3) All-Around Cowboy **temporada** |
| Cut line | **Se define más tarde** — preparar en `manifest`, no mostrar badges hasta tener número oficial |
| Multi-temporada / archivo | Fuera de v1 → backlog |
| All-Around **por evento** | Fuera de v1 → backlog (prioridad es temporada) |

---

## 2. Puntos

| Tema | Decisión |
|------|----------|
| Fuente de verdad | **ArenaPro Time** (`puntosCircuito`) |
| Stats | **No recalcula** reglas de puntuación; solo agrega por temporada |
| Team Roping | Los puntos **NO** se dividen 50/50. Se usan los puntos que vengan de Time por rol (header/heeler) |

---

## 3. Dinero

| Tema | Decisión |
|------|----------|
| Fuente | Time debe exportar montos; Stats suma y muestra |
| Moneda | **MXN**, enteros (sin decimales). Formato `es-MX` |
| Team Roping | Dinero **50/50** header / heeler — **provisional**, confirmar con organizadores |
| Redondeo 50/50 | Si el monto es impar: un peso al header, resto al heeler (o documentar la regla inversa; debe ser determinista y testeada) |

**Pendiente organizadores:** confirmar split 50/50 de dinero en Team Roping. Hasta confirmación, implementar 50/50 detrás de una constante `TEAM_ROPING_MONEY_SPLIT = 0.5` fácil de cambiar.

---

## 4. Team Roping — tablas separadas

| Vista | `disciplinaId` sugerido |
|-------|-------------------------|
| Headers Abierta | `TeamRopingHeader` |
| Heelers Abierta | `TeamRopingHeeler` |
| Headers Masters | `TeamRopingMastersHeader` |
| Heelers Masters | `TeamRopingMastersHeeler` |

- En UI: tabs o cards **Headers** y **Heelers** (no un solo ranking de dúos `"A / B"`).
- Identidad: persona por rol, no el string del equipo.

---

## 5. Identidad de competidores (`local:*`)

| Tema | Decisión |
|------|----------|
| IDs web estables | **Aún no** — seguiremos con `local:*` |
| Merge entre eventos | Clave por nombre normalizado (`name:…`) cuando el id es `local:` |
| Corrección manual | Archivo `data/competidor-aliases.json` + UI básica en admin (Sprint 1–3) |
| Riesgo aceptado | Homónimos pueden fusionarse; se corrige con alias |

---

## 6. All-Around Cowboy (temporada)

Basado en práctica PRCA / circuitos: versatilidad medida en **dinero ganado en ≥2 disciplinas**.

| Regla | Decisión |
|-------|----------|
| Alcance | **Temporada** (no por evento en v1) |
| Mínimo disciplinas | **2+** |
| ¿Hay que cobrar en las 2? | **Sí.** Participar en 2 y cobrar solo en 1 **no** califica |
| Puntaje | Suma de `dineroTotal` de todas las disciplinas donde `dineroTotal > 0` |
| Team Roping | Header y Heeler son disciplinas **distintas** |
| Empates | Más disciplinas con dinero → mayor premio en una disciplina → desempate manual en admin si hace falta |

### Ejemplos

| Caso | ¿Entra? | Total All-Around |
|------|---------|------------------|
| $ en Barriles + $ en Lazo de Becerro | Sí | Suma de ambos |
| Inscrito en 2, cobra solo en Barriles | **No** | — |
| $ en Header + $ en Heeler | Sí | Suma de ambos roles |
| $ en 3 disciplinas | Sí | Suma de las 3 |

---

## 7. Admin — publicación semi-automatizada

Al agregar un evento:

1. **Preview** fiel a lo que verá el público.
2. **Cherry-pick** de categorías (incluir / excluir).
3. **Ediciones manuales** puntuales (nombre, puntos, monto, excluir fila).
4. Guardar capa `statsEdits` sobre el export de Time.
5. Ingest + rebuild → publicar.

Flujo: automático por defecto, humano en el loop cuando haga falta.

---

## 8. Preguntas abiertas (no bloquean Sprint 0–1)

1. Cut line: ¿global o por disciplina? ¿número exacto?
2. Confirmación organizadores: ¿dinero TR 50/50?
3. ¿Nombre exacto en UI: “FMR Tour 2027” vs variante con sponsor?
4. ¿Masters de TR también Headers/Heelers separados? (asumimos **sí**)

### Estado coordinación Time (Sprint 1)

| Ítem | Estado |
|------|--------|
| Checklist export enviado/revisado (`02-contratos-datos.md` §9) | **Pendiente** — compartir con equipo Time |
| `montoGanado` en export | Pendiente confirmación |
| TR header/heeler o dúo `"A / B"` | Pendiente confirmación |
| Split dinero TR 50/50 | Provisional en Stats; **confirmar con organizadores** |

Cuando haya respuesta, actualizar esta sección y abrir commit:  
`docs: registrar respuesta Time sobre dinero y team roping`.

Cuando se cierren, actualizar este archivo y abrir un commit:  
`docs: actualizar decisión X en FMR Tour 2027`.
