# Prácticas de ingeniería — ArenaPro Stats

Objetivo: trabajar como un equipo de producto serio aunque seamos pocos: **ramas cortas, PRs, commits pequeños, tests primero**.

---

## 1. Modelo de ramas

```
main          ← producción (GitHub Pages). Cada push despliega si lint + tests + E2E pasan
feat/…        ← funcionalidad nueva, vía PR a main
fix/…         ← corrección, vía PR a main
chore/…       ← tooling, CI, orden del repo, vía PR a main
```

### Reglas

| Regla | Detalle |
|-------|---------|
| **Código siempre por PR** | Nada de código directo en `main`; el dueño revisa y mergea |
| **Datos sí van directo** | La consola (`publicar.bat`) sube solo `data/` a `main`, después de validar y correr tests |
| **`main` protegida** | Sin force push ni borrado, también para admins |
| **Ramas cortas** | Una rama = un tema; se borra sola al mergear el PR |

### Flujo

```bash
git checkout main
git pull
git checkout -b feat/nombre-corto
# … commits …
git push -u origin feat/nombre-corto
gh pr create
```

## 2. Estructura del repo

| Carpeta | Qué vive ahí | Se publica |
|---------|--------------|------------|
| `web/` | Sitio público (HTML, CSS, JS, fuentes, íconos) | Sí |
| `web/lib/` | Reglas de negocio puras; las usan navegador y Node | Sí |
| `data/` | Eventos, circuitos, temporadas, logos | Sí (sin aliases ni notas internas) |
| `admin/` | Consola local de publicación | No |
| `tools/` | Servidor local, build, rebuild, monitor | No |
| `tools/lib/` | Módulos solo de Node (Excel, git, validación, rutas) | No |
| `templates/` | Plantilla Excel descargable desde el admin | No |
| `test/` | `unit/`, `integration/`, `e2e/`, `fixtures/` | No |
| `docs/` | `operacion/`, `producto/`, `ingenieria/`, `historial/` | No |

El sitio publicado (`_site/`) lo arma `tools/build-site.mjs` copiando solo `web/` y `data/`.
En local, `tools/lib/rutas.mjs` monta las mismas URLs (`/`, `/data/`, `/admin.html`) sin exponer el resto del repo.
**Regla:** si un módulo necesita `fs`, `child_process` o `exceljs`, va en `tools/lib/`, nunca en `web/lib/`.

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
git commit -m "test: validar competitorKey con nombres local"
```

---

## 4. Estrategia de tests (crecer siempre)

### Principios

1. **Ningún cambio de lógica de negocio sin test** (rebuild, identidad, dinero, All-Around, `statsEdits`).
2. **Test primero cuando se pueda:** escribir el caso que falla → implementar → verde.
3. **Fixtures** en `test/fixtures/` (JSON mínimos, no eventos de 5000 líneas).
4. **CI:** el deploy corre lint + tests + E2E; si algo falla, el sitio no cambia.
5. **No borrar tests** “porque estorban”: arreglar el producto o actualizar el contrato documentado.

### Capas

| Capa | Qué | Dónde |
|------|-----|-------|
| Unit | `disciplinaKey`, `competitorKey`, split TR, All-Around, aliases, rutas | `test/unit/*.test.mjs` |
| Integration | `rebuildTemporada`, guardia del servidor local, sync con remoto | `test/integration/*.test.mjs` |
| E2E | Sitio construido (escritorio y celular) y consola local | `test/e2e/*.spec.mjs` |

### Comandos

```bash
npm run lint
npm test
npm run test:e2e
node tools/rebuild-temporada.mjs
```

---

## 5. Pull Requests

### Checklist del autor

- [ ] Rama desde `main` actualizada
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
- [ ] Decisiones de producto al día (si aplica)
```

### Review

- Preferir PRs &lt; 400 líneas de diff lógico.
- Pedir cambios en tests si la lógica no está cubierta.
- Merge commit para conservar el historial; la rama se borra sola.

---

## 6. Calidad de código

| Práctica | Cómo aquí |
|----------|-----------|
| Separación de concerns | Lógica pura en `web/lib/`; I/O en `tools/`; UI solo renderiza |
| Funciones puras | Fáciles de testear; I/O (fs, fetch) en bordes |
| Contratos explícitos | Schema documentado + validación al ingest |
| Feature flags / constantes | Split TR, cut line visible: constantes o `manifest` |
| Sin magia | Evitar “si el nombre tiene / entonces…” sin test y comentario |
| Observabilidad | Logs claros en admin/server; monitor horario abre un issue si el sitio falla |
| Seguridad | Admin solo en 127.0.0.1 con token; CSP en el sitio; nunca exponer publish a internet |
| Datos | No editar a mano `temporada.json`; siempre rebuild |

---

## 7. Definition of Done (DoD) por tarea

Una tarea está **Done** cuando:

1. Código en su rama con PR abierto.
2. Lint, tests y E2E verdes.
3. Commit(s) con mensaje claro en español.
4. Si toca UX: verificado en escritorio + celular.
5. Si toca datos: fixture o evento de prueba no deja el repo en estado inconsistente.

---

## 8. Qué no hacer

- Commits de código directos a `main`.
- “Subo todo en un solo commit enorme”.
- Features sin test “porque es UI” (extraer lógica y testearla).
- Cambiar reglas de All-Around / TR en código sin actualizar [decisiones de producto](../producto/decisiones.md).
- Poner código de Node en `web/lib/` (se publicaría).
