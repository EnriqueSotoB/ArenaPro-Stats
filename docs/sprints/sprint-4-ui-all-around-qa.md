# Sprint 4 — UI pública, All-Around temporada, QA y release

**Branch:** `sprint/4-ui-all-around-qa`  
**Base:** `develop`  
**Duración sugerida:** 5–7 días  
**Objetivo:** Sitio FMR Tour 2027 usable: puntos, dinero, Headers/Heelers, All-Around temporada; QA; merge a `main` y publicación.

---

## Criterios de aceptación

- [ ] Branding visible: **FMR Tour 2027** (sin “demo”).
- [ ] Hub temporada: disciplinas incluyen Headers/Heelers; toggle o tabs **Puntos | Dinero**.
- [ ] Ranking: columnas / modo dinero; cut line **oculto** hasta `cutLineVisible`.
- [ ] Evento: muestra montos si existen.
- [ ] Vista **All-Around Cowboy** (temporada): solo quienes cobraron en **≥2** disciplinas; orden por dinero.
- [ ] Texto corto “Cómo se calcula” (puntos de Time, dinero MXN, All-Around 2+).
- [ ] Mobile usable (tablas con scroll).
- [ ] `npm test` verde; meta acumulada ≥ 40 tests (aprox.).
- [ ] Checklist de lanzamiento completado.
- [ ] PR sprint → `develop`, luego `develop` → `main`.

---

## All-Around — reglas a implementar

Fuente: `docs/00-decisiones-producto.md` §6.

1. Agrupar standings por `competidorKey`.
2. Filtrar disciplinas con `dineroTotal > 0`.
3. Si `disciplinasConDinero.length >= 2` → candidato.
4. `dineroTotal` All-Around = suma de esos dineros.
5. Ordenar desc; empates: más disciplinas → mayor max disciplina → estable por nombre.

**TDD:**

1. `test: all-around excluye quien solo cobró en una disciplina`
2. `test: all-around suma dinero de dos o más disciplinas`
3. `feat: generar arreglo allAround en rebuild`
4. `feat: vista All-Around en temporada`

---

## Tareas

### 4.0 Branch

```bash
git checkout develop && git pull
git checkout -b sprint/4-ui-all-around-qa
```

---

### 4.1 Rebuild All-Around

- Extender payload `temporada.json` con `allAround[]`.
- Tests con fixture de 1 persona en 2 disciplinas con dinero + 1 persona en 1 sola.

**Commits:** separar test / feat como arriba.

---

### 4.2 UI temporada

Archivos: `index.html`, `js/app.js`, `css/styles.css`.

- Card o sección **All-Around Cowboy**.
- Toggle Puntos/Dinero en hub y ranking.
- Formato dinero: helper `fmtMxn(n)` → `$12,500` sin decimales; **test** del formateo.

**Commits:**

1. `feat: formatear montos MXN sin decimales`
2. `test: formateo MXN`
3. `feat: toggle puntos y dinero en ranking de temporada`
4. `feat: página o sección All-Around Cowboy`

---

### 4.3 UI evento

- Mostrar columna `$` en tablas si hay datos.
- No inventar All-Around por evento (backlog).

**Commit:** `feat: mostrar dinero ganado en detalle de evento`

---

### 4.4 Copy / metodología

- Bloque breve: puntos vienen de Time; dinero MXN; All-Around requiere cobro en 2+ categorías; cut line pendiente.

**Commit:** `docs: agregar metodología visible en el sitio`  
(o `feat:` si es UI)

---

### 4.5 QA manual (lista)

- [ ] Desktop Chrome + móvil (o DevTools).
- [ ] TR: aparecen Headers y Heelers.
- [ ] Persona con $ en 1 sola disciplina: **no** en All-Around.
- [ ] Persona con $ en 2: sí, suma correcta.
- [ ] Admin: cherry-pick + edit + publish (ensayo completo).
- [ ] Tras publish: URL Pages refleja datos (1–2 min).

---

### 4.6 Release

1. PR `sprint/4-…` → `develop`.
2. Completar `docs/checklist-lanzamiento.md`.
3. PR `develop` → `main`.
4. Verificar https://estadisticas.arenapro.mx/
5. Tag opcional: `v1.0.0-fmr-2027`

```bash
git checkout main && git pull
git tag -a v1.0.0-fmr-2027 -m "Release FMR Tour 2027 stats v1"
git push origin v1.0.0-fmr-2027
```

---

## Tests esperados al cerrar (+10–15)

- All-Around: elegibilidad, suma, empates básicos  
- fmtMxn  
- cutLineVisible false → helper null  
- Regresión TR + dinero  

---

## Fuera de alcance (explícito)

- Cut line numérico oficial (solo cuando FMR lo defina → hotfix/chore pequeño).
- All-Around por evento.
- Confirmación final split TR dinero (ajustar constante si cambia).
- Perfil competidor / búsqueda avanzada (backlog).
