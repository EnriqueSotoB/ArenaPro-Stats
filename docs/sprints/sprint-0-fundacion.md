# Sprint 0 — Fundación

**Branch:** `sprint/0-fundacion`  
**Base:** `develop` (crear `develop` en este sprint si no existe)  
**Duración sugerida:** 2–4 días  
**Objetivo:** Poder desarrollar con disciplina de equipo: ramas, tests, tooling, branding base listo, sin features de dinero aún.

---

## Por qué este sprint primero

Hoy el repo no tiene `package.json`, ni tests, ni rama de integración. Sin eso, cada feature siguiente se vuelve frágil. Las empresas serias **invierten en el andamiaje antes del feature glamuroso**.

---

## Criterios de aceptación (Definition of Done del sprint)

- [ ] Existe rama `develop` en remoto; `main` no recibe commits directos de feature.
- [ ] Existe `package.json` con script `test`.
- [ ] Suite mínima verde en local (y CI si se agrega workflow).
- [ ] Tests cubren `disciplinaKey` y `competitorKey` (extraídos/importables).
- [ ] `manifest.titulo` preparado para FMR Tour 2027 (o flag; sin dejar “demo” en copy visible si se publica).
- [ ] Docs del plan referenciados desde README raíz.
- [ ] PR `sprint/0-fundacion` → `develop` mergeado.

---

## Tareas (orden sugerido)

### 0.1 Crear `develop` y branch del sprint

```bash
git checkout main
git pull
git checkout -b develop
git push -u origin develop
git checkout -b sprint/0-fundacion
git push -u origin HEAD
```

**Commit:** `chore: crear rama develop para integración`

---

### 0.2 Tooling de tests

- Agregar `package.json` (Node nativo `node --test` está bien; no hace falta Jest al inicio).
- Scripts:
  - `"test": "node --test test/**/*.test.mjs"`
  - `"rebuild": "node scripts/rebuild-temporada.mjs"`
- Crear carpetas: `test/unit/`, `test/fixtures/`, `test/integration/`.

**Commit:** `chore: agregar package.json y script de tests`

---

### 0.3 Hacer testeable el rebuild

- Asegurar que `disciplinaKey`, `competitorKey`, `disciplinaLabel` se exportan (ya lo hacen).
- Si hace falta, extraer helpers a `scripts/lib/` **solo** si simplifica imports desde test (opcional en Sprint 0).

**Commit:** `refactor: preparar módulos de temporada para tests` (solo si hubo cambio)

---

### 0.4 Tests unitarios base

Crear al menos:

| Archivo | Casos |
|---------|-------|
| `test/unit/disciplina-key.test.mjs` | Barriles / Abierta → Barriles; Master → BarrilesMasters; TeamRoping + Masters |
| `test/unit/competitor-key.test.mjs` | id web estable; `local:` → `name:…`; normalización de acentos |

Correr: `npm test` → verde.

**Commits sugeridos (pequeños):**

1. `test: cubrir disciplinaKey para Barriles y Masters`
2. `test: cubrir competitorKey con ids local`

---

### 0.5 Test de integración smoke del rebuild

- Fixture mínimo: 1 evento fake en `test/fixtures/mini-evento.json` + `manifest` temporal.
- Test que escribe en `os.tmpdir()`, corre `rebuildTemporada(tmpRoot)`, assert puntos sumados.

**Commit:** `test: smoke de rebuildTemporada con fixture mínimo`

---

### 0.6 CI (recomendado)

- Workflow `.github/workflows/test.yml`: on PR a `develop`/`main` → `npm test`.
- Opcional: exigir check verde antes de merge.

**Commit:** `chore: agregar workflow de CI para tests`

---

### 0.7 Branding / datos prep (sin UI grande)

- Actualizar `data/manifest.json`:
  - `titulo`: `"FMR Tour 2027"`
  - `temporadaActiva`: `"2027"`
  - `cutLineVisible`: `false` (campo nuevo; UI lo ignora hasta Sprint 4)
  - Dejar `cutLine` como esté o `null`
- Actualizar README raíz con enlace a `docs/`.

**Commits:**

1. `chore: titular temporada como FMR Tour 2027`
2. `docs: enlazar plan FMR desde README`

---

### 0.8 Cerrar sprint

```bash
# Abrir PR en GitHub: sprint/0-fundacion → develop
# Título: Sprint 0 — Fundación (tests, develop, FMR titulo)
```

Tras merge: borrar branch remota.

---

## Tests esperados al cerrar (~8–12)

- disciplinaKey: ≥ 4 casos  
- competitorKey: ≥ 3 casos  
- rebuild smoke: ≥ 1 caso  

---

## Fuera de alcance

- Dinero, All-Around, admin editable, Headers/Heelers, cut line visible.

---

## Checklist de PR

- [ ] `npm test` verde  
- [ ] Sin commits en `main`  
- [ ] Mensajes de commit en español  
- [ ] README apunta a `docs/`
