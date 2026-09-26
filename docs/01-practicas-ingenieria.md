# Prácticas de ingeniería — ArenaPro Stats

Objetivo: trabajar como un equipo de producto serio aunque seamos pocos: **ramas cortas, PRs, commits pequeños, tests primero, nada en `main` directo**.

---

## 1. Modelo de ramas

```
main          ← producción (GitHub Pages). Solo merges desde develop o release/*
develop       ← integración continua de sprints
sprint/N-…    ← un sprint completo
feat/…        ← feature corta dentro del sprint (opcional)
fix/…         ← hotfix desde main (solo emergencias)
```

### Reglas

| Regla | Detalle |
|-------|---------|
| **Nunca commits en `main`** | Ni en `develop` con trabajo a medias sin PR si hay más de una persona |
| **Un sprint = una branch** | Nombre: `sprint/0-fundacion`, `sprint/2-dinero-team-roping`, etc. |
| **Features grandes** | Dentro del sprint: `feat/all-around-rebuild` → merge a `sprint/4-…` → PR a `develop` |
| **Hotfix** | `fix/descripcion` desde `main` → PR a `main` y cherry-pick a `develop` |
| **Borrar ramas** | Tras merge, borrar branch remota y local |

### Setup inicial (una sola vez — Sprint 0)

```bash
git checkout main
git pull
git checkout -b develop
git push -u origin develop
```

Proteger `main` en GitHub (Settings → Branches): require PR, status checks verdes.

---

## 2. Cómo empezar un sprint

```bash
git checkout develop
git pull
git checkout -b sprint/N-nombre-corto
git push -u origin sprint/N-nombre-corto
```

Abrir el doc del sprint en `docs/sprints/` y marcar tareas.

Al terminar el sprint:

```bash
git checkout develop
git pull
git merge --no-ff sprint/N-nombre-corto
# o mejor: abrir PR en GitHub: sprint/N → develop
```

Cuando `develop` esté listo para producción:

```bash
# PR: develop → main
# Tras merge, verificar Pages en 1–2 min
```

---

## 3. Commits pequeños en español

### Formato

```
tipo: descripción corta en imperativo / presente

[cuerpo opcional: por qué, no qué]
```

### Tipos permitidos

| Tipo | Uso |
|------|-----|
| `feat` | Funcionalidad nueva para el usuario |
| `fix` | Corrección de bug |
| `test` | Solo tests |
| `refactor` | Cambio interno sin cambiar comportamiento |
| `docs` | Solo documentación |
| `chore` | Tooling, deps, CI, scripts |
| `style` | Formato CSS/HTML sin lógica |

### Ejemplos buenos

```
feat: sumar dineroTotal en rebuild de temporada
test: cubrir split 50/50 de Lazo por Parejas con monto impar
fix: no dividir puntosCircuito en cabeceros y pialadores
docs: cerrar regla All-Around 2+ con dinero en ambas
chore: agregar script npm test con node --test
```

### Ejemplos malos

```
update
changes
WIP
arreglos varios
commit final del sprint
```

### Tamaño

- Ideal: **1 commit = 1 idea** (revisable en &lt; 5 min).
- Si el diff supera ~400 líneas de lógica, partir.
- No mezclar refactor grande + feature en el mismo commit.

### Cómo commitear (PowerShell)

```powershell
git add path/al/archivo
git commit -m @"
feat: descripción clara.

EOF
"@
```

O una sola línea:

```powershell
git commit -m "test: validar competitorKey con nombres local"
```

---

## 4. Estrategia de tests (crecer siempre)

### Principios

1. **Ningún cambio de lógica de negocio sin test** (rebuild, identidad, dinero, All-Around, `statsEdits`).
2. **Test primero cuando se pueda:** escribir el caso que falla → implementar → verde.
3. **Fixtures** en `test/fixtures/` (JSON mínimos, no eventos de 5000 líneas).
4. **CI:** cada PR debe correr `npm test` (o `node --test`) y fallar el merge si hay rojo.
5. **No borrar tests** “porque estorban”: arreglar el producto o actualizar el contrato documentado.

### Capas

| Capa | Qué | Dónde |
|------|-----|-------|
| Unit | `disciplinaKey`, `competitorKey`, split TR, All-Around, aliases | `test/unit/*.test.mjs` |
| Integration | `rebuildTemporada` con carpeta fixture temporal | `test/integration/*.test.mjs` |
| Smoke (opcional) | Admin/API con servidor en test | Sprint 3+ |

### Meta por sprint

| Sprint | Tests mínimos nuevos (aprox.) |
|--------|-------------------------------|
| 0 | 8–12 (disciplina + competitor + smoke rebuild) |
| 1 | + aliases + schema/validación |
| 2 | + dinero + TR header/heeler + no-split puntos |
| 3 | + aplicar `statsEdits` + cherry-pick |
| 4 | + All-Around temporada + formato MXN |

**Meta final v1:** ≥ 40–60 tests verdes en CI.

### Comandos (después de Sprint 0)

```bash
npm test
npm run test:watch   # si se configura
node scripts/rebuild-temporada.mjs
```

---

## 5. Pull Requests

### Checklist del autor

- [ ] Branch desde `develop` actualizado
- [ ] Commits en español, atómicos
- [ ] Tests nuevos o actualizados; `npm test` verde en local
- [ ] Docs de decisión actualizados si cambió negocio
- [ ] Sin secretos / `.env` / credenciales
- [ ] Descripción del PR: **qué / por qué / cómo probar**

### Plantilla de PR (copiar)

```markdown
## Resumen
- …

## Cómo probar
1. …
2. `npm test`

## Checklist
- [ ] Tests verdes
- [ ] No toca main
- [ ] Decisiones de producto al día (si aplica)
```

### Review

- Preferir PRs &lt; 400 líneas de diff lógico.
- Pedir cambios en tests si la lógica no está cubierta.
- Merge con **squash** solo si los commits del sprint son ruido; si son buenos mensajes, **merge commit** o rebase según gusto del equipo. Preferencia del proyecto: **merge commit** en `develop` para conservar historial de sprint.

---

## 6. Calidad de código (barajar “empresa grande”)

| Práctica | Cómo aquí |
|----------|-----------|
| Separación de concerns | Lógica pura en módulos exportables (`rebuild`, `money`, `all-around`); UI solo renderiza |
| Funciones puras | Fáciles de testear; I/O (fs, fetch) en bordes |
| Contratos explícitos | Schema documentado + validación al ingest |
| Feature flags / constantes | Split TR, cut line visible: constantes o `manifest` |
| Sin magia | Evitar “si el nombre tiene / entonces…” sin test y comentario |
| Observabilidad | Logs claros en admin/server; errores que digan *qué* faltó |
| Seguridad | Admin solo localhost; nunca exponer publish a internet sin auth |
| Datos | No editar a mano `temporada.json`; siempre rebuild |

---

## 7. Definition of Done (DoD) por tarea

Una tarea del sprint está **Done** cuando:

1. Código en la branch del sprint (no en `main`).
2. Tests relacionados verdes.
3. Commit(s) con mensaje claro en español.
4. Criterios de aceptación del sprint cumplidos para esa tarea.
5. Si toca UX: verificado en desktop + viewport móvil básico.
6. Si toca datos: fixture o evento de prueba no deja el repo en estado inconsistente.

---

## 8. Qué no hacer

- Commits directos a `main`.
- “Subo todo el sprint en un solo commit enorme”.
- Features sin test “porque es UI” (extraer lógica y testearla).
- Cambiar reglas de All-Around / TR en código sin actualizar `00-decisiones-producto.md`.
- Publicar a Pages desde una branch de experimento sin pasar por `develop` → `main`.
