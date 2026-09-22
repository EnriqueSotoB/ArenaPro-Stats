# Sprint 2 — Dinero + Team Roping (Headers / Heelers)

**Branch:** `sprint/2-dinero-team-roping`  
**Base:** `develop`  
**Duración sugerida:** 4–6 días  
**Objetivo:** El rebuild produce `dineroTotal` y rankings separados Header/Heeler; puntos de TR **no** se parten.

---

## Criterios de aceptación

- [ ] `temporada.json` incluye `dineroTotal` por standing.
- [ ] Team Roping genera disciplinas Header/Heeler (y Masters si aplica).
- [ ] Dinero TR: split 50/50 (constante); puntos TR: **no** split.
- [ ] Montos enteros MXN; test de monto impar.
- [ ] Rebuild sigue sumando puntos como hoy.
- [ ] Suite de tests del sprint verde; sin regresión Sprint 0–1.
- [ ] PR → `develop`.

---

## Decisiones a respetar

Ver `docs/00-decisiones-producto.md`:

- Dinero TR 50/50 **provisional** (`TEAM_ROPING_MONEY_SPLIT`).
- Puntos: copiar/asignar por rol según Time; **nunca** `puntos/2`.

---

## Tareas

### 2.0 Branch

```bash
git checkout develop && git pull
git checkout -b sprint/2-dinero-team-roping
```

---

### 2.1 Módulo de dinero / TR

Crear p.ej. `scripts/lib/team-roping.mjs` y `scripts/lib/money.mjs`:

- `splitMoneyMxn(total)` → `{ header, heeler }` enteros que suman `total`.
- `parseTeamRopingPair(nombre)` → `{ header, heeler }` o null.
- `expandTeamRopingRow(row, cat)` → 0–2 filas de persona+rol.

**Commits:**

1. `feat: partir montos MXN de team roping en enteros`
2. `test: cubrir split 50/50 con montos pares e impares`
3. `feat: parsear nombres header/heeler desde dúo`
4. `test: parsear dúos con slash y espacios`

---

### 2.2 Extender rebuild

En `rebuild-temporada.mjs` (o lib):

1. Preferir `clasificacion` si existe; si no, fallback `resultados` (como hoy).
2. Por cada entrada: tomar `montoGanado` (default 0).
3. Si disciplina es Team Roping (no Masters o sí): expandir a Header/Heeler.
4. Por evento: max puntos y max/suma dinero según regla (documentar: usualmente un monto por inscripción; no doble-contar vueltas).
5. Acumular temporada: `puntosTotales`, `dineroTotal`, `eventos`.

**Importante:** escribir tests **antes** o junto con el cambio:

- 2 riders, 2 eventos, verificar suma de dinero.
- TR dúo: 2 standings (header y heeler), mismo puntos (si Time manda un valor), dinero mitad.
- TR: assert `puntosHeader + puntosHeeler !== puntosOriginal` solo si… wait - if we DON'T split points, each gets the full puntosCircuito from Time. So if Time sends 100 for the team row, both get 100? Or Time sends per person?

Decision doc says: points are NOT split 50/50 - use what Time assigns per role. If Time sends one team row with one puntosCircuito, the safest provisional rule should be documented:

**Regla provisional documentada en código:**
- Si hay filas por rol → puntos y dinero por fila.
- Si hay un dúo + un `puntosCircuito` + un `montoGanado` equipo → dinero 50/50; puntos = **mismo valor a ambos** (no mitad), hasta que Time exporte por rol.

**Commits:**

1. `feat: acumular dineroTotal en rebuild de temporada`
2. `test: sumar dinero por disciplina entre eventos`
3. `feat: generar standings TeamRopingHeader y Heeler`
4. `test: no dividir puntos al expandir team roping`
5. `test: asignar mitad de dinero a header y heeler`

---

### 2.3 Labels UI-ready

Actualizar `DISCIPLINA_LABEL`:

- `TeamRopingHeader` → `"Team Roping — Headers"`
- `TeamRopingHeeler` → `"Team Roping — Heelers"`
- (Masters análogos)

**Commit:** `feat: etiquetas de headers y heelers en disciplinas`

---

### 2.4 Regenerar datos demo (opcional)

Si los eventos actuales no tienen `montoGanado`, el rebuild pondrá 0. No inventar premios en producción.

Opcional: un evento fixture-only en tests, no en `data/eventos` real.

**Commit:** solo si se tocan datos reales con montos verificados.

---

## Tests esperados al cerrar (+12–20)

| Área | Casos |
|------|-------|
| splitMoneyMxn | 0, 1, 10000, impar |
| parse dúo | formatos comunes |
| rebuild dinero | suma multi-evento |
| rebuild TR | 2 filas, puntos no half, dinero half |
| Masters TR | keys MastersHeader/Heeler |

---

## Fuera de alcance

- Admin cherry-pick / edits.  
- All-Around.  
- UI pública tabs Puntos/Dinero (puede haber smoke interno; UI es Sprint 4).

---

## Riesgo

Si organizadores cambian el split de dinero: solo tocar constante + tests + `00-decisiones-producto.md`.
