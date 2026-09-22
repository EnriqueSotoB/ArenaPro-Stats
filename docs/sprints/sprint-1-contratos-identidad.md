# Sprint 1 — Contratos e identidad

**Branch:** `sprint/1-contratos-identidad`  
**Base:** `develop` (con Sprint 0 mergeado)  
**Duración sugerida:** 3–5 días  
**Objetivo:** Dejar listo el contrato de datos (dinero, aliases) y validación, sin aún UI pública de dinero.

---

## Criterios de aceptación

- [ ] Documento de contrato alineado con código (`docs/02-contratos-datos.md`).
- [ ] Existe `data/competidor-aliases.json` (puede empezar vacío) y el rebuild lo aplica.
- [ ] Validación al ingest (o módulo `validate-evento`) avisa si falta `montoGanado` cuando `schemaVersion >= 2`.
- [ ] Fixtures de prueba con `montoGanado` (aunque rebuild de dinero sea Sprint 2).
- [ ] Tests de aliases verdes.
- [ ] PR → `develop` mergeado.

---

## Tareas

### 1.0 Abrir branch

```bash
git checkout develop && git pull
git checkout -b sprint/1-contratos-identidad
```

---

### 1.1 Archivo de aliases

Crear `data/competidor-aliases.json`:

```json
{
  "version": 1,
  "aliases": []
}
```

Función `resolveCompetitorKey(row, aliases)`:

1. Calcula `competitorKey(row)`.
2. Si hay `from` → `to`, reemplaza.
3. Encadenar con cuidado (evitar loops; max 5 hops o mapa cerrado).

**Commits:**

1. `feat: agregar archivo de aliases de competidores`
2. `feat: resolver aliases en competitorKey de temporada`
3. `test: cubrir resolución de aliases sin loops`

---

### 1.2 Validación de evento

Módulo p.ej. `scripts/lib/validate-evento.mjs`:

- `schemaVersion` presente.
- Categorías con `tipo` o nombre inferible.
- Warning (no hard-fail al inicio) si no hay `montoGanado` en clasificación.
- Hard-fail si `disciplinaKey` resultaría `local:`.

Integrar en `publish-server` `/api/ingest` → devolver `warnings[]` al admin.

**Commits:**

1. `feat: validar evento al ingest con warnings`
2. `test: validar warnings cuando falta montoGanado`

---

### 1.3 Fixtures con dinero (prep Sprint 2)

- `test/fixtures/evento-con-dinero.json` — 2 categorías, 3 riders, montos enteros.
- `test/fixtures/evento-team-roping-duo.json` — un dúo `"A / B"` + monto equipo.

**Commit:** `test: agregar fixtures de evento con dinero y team roping`

---

### 1.4 Manifest cut line (invisible)

- Campos `cutLineVisible: false`, `cutLinePorDisciplina: {}`.
- Tests: helper `getCutLine(manifest, disciplinaId)` retorna null si no visible.

**Commit:** `feat: preparar cut line en manifest sin mostrarlo`

---

### 1.5 Coordinación Time (no código)

- Enviar checklist de `docs/02-contratos-datos.md` §9 al equipo Time.
- Anotar respuesta en `00-decisiones-producto.md` si confirman TR dinero.

**Commit:** `docs: registrar estado del contrato con Time` (cuando haya respuesta)

---

## Tests esperados al cerrar (+8–15)

- Aliases: match, no-match, chain, loop guard  
- Validate: ok, warning monto, fail disciplina  
- getCutLine: hidden / global / por disciplina  

---

## Fuera de alcance

- Sumar `dineroTotal` en rebuild (Sprint 2).  
- UI dinero / All-Around.  
- Admin cherry-pick (Sprint 3).

---

## DoD PR

- [ ] `npm test` verde  
- [ ] Aliases documentados  
- [ ] Warnings visibles en respuesta API (aunque admin aún no los pinte bonito)
