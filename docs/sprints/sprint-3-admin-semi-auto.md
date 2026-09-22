# Sprint 3 — Admin semi-automatizado (preview + cherry-pick + edits)

**Branch:** `sprint/3-admin-semi-auto`  
**Base:** `develop`  
**Duración sugerida:** 4–6 días  
**Objetivo:** Al cargar un export, el operador ve preview, elige categorías, corrige filas puntuales, y solo entonces publica a Stats.

---

## Criterios de aceptación

- [ ] Preview muestra puntos **y** dinero (si hay `montoGanado`).
- [ ] Checkboxes por categoría: incluir / excluir (cherry-pick).
- [ ] Filas editables: nombre, `puntosCircuito`, `montoGanado`, excluir fila.
- [ ] Cambios se persisten como `statsEdits` en el JSON del evento.
- [ ] Función pura `aplicarStatsEdits(evento, edits)` cubierta por tests.
- [ ] Ingest envía el evento **ya aplicado** (o aplica en servidor de forma idéntica).
- [ ] Warnings de validación visibles en admin.
- [ ] PR → `develop`.

---

## UX del flujo (paso a paso)

1. Soltar JSON (como hoy).
2. Confirmar temporada.
3. **Panel cherry-pick:** lista de categorías con ✓.
4. **Tabla editable** por categoría activa (celdas input).
5. Preview pódium/tabla se actualiza en vivo con edits.
6. Botón **Agregar a Stats** (deshabilitado si 0 categorías).
7. Publicar (sin cambios de flujo).

---

## Tareas

### 3.0 Branch

```bash
git checkout develop && git pull
git checkout -b sprint/3-admin-semi-auto
```

---

### 3.1 Lógica pura primero (TDD)

`scripts/lib/stats-edits.mjs` (o `js/` si se comparte con browser — preferir un módulo sin Node APIs para poder importarlo en admin y en tests):

```js
export function aplicarStatsEdits(evento, edits) { /* … */ }
export function buildDefaultEdits(evento) { /* todas categorías incluidas */ }
```

Casos test:

- Excluir categoría → no aparece en salida efectiva.
- Override monto / puntos.
- Excluir fila.
- Edits vacíos → identidad.

**Commits:**

1. `test: definir comportamiento de aplicarStatsEdits`
2. `feat: implementar aplicarStatsEdits`
3. `test: cherry-pick de categorías excluidas`

---

### 3.2 API ingest

- Body acepta `{ evento, temporada, statsEdits }`.
- Servidor aplica edits, valida, escribe archivo, rebuild.
- Respuesta incluye `warnings`.

**Commit:** `feat: aceptar statsEdits en API de ingest`

---

### 3.3 UI admin

Archivos: `admin.html`, `js/admin.js`, `css/admin.css`.

- Estado en memoria: `pendingEvento`, `pendingEdits`.
- Re-render preview usando evento aplicado.
- No persistir edits hasta ingest (o “guardar borrador” local opcional — fuera de alcance).

**Commits (partir UI):**

1. `feat: cherry-pick de categorías en preview de admin`
2. `feat: edición manual de puntos y dinero en preview`
3. `feat: mostrar warnings de validación en admin`

---

### 3.4 Aliases en admin (mínimo)

- Lista simple: “Unificar nombre A → B” escribe en `competidor-aliases.json` vía API nueva `POST /api/aliases` (localhost only).

Si el tiempo aprieta: **diferir API aliases a Sprint 4** y editar JSON a mano; dejar issue en backlog. Preferencia: al menos endpoint + test.

**Commit:** `feat: API local para aliases de competidores` (si entra)

---

## Tests esperados al cerrar (+10–15)

- aplicarStatsEdits: 6–8 casos  
- ingest integration (opcional): 1–2 con servidor o función compartida  
- No regresión rebuild  

---

## Fuera de alcance

- Rediseño visual completo del sitio público.  
- All-Around UI.  
- Auth remota del admin.

---

## Cómo probar manualmente

1. `publicar.bat` / `node scripts/publish-server.mjs`
2. Cargar un JSON real.
3. Desmarcar una categoría → preview ya no la muestra.
4. Cambiar un monto → preview refleja.
5. Agregar a Stats → abrir archivo en `data/eventos/` y verificar `statsEdits`.
6. `npm test`
