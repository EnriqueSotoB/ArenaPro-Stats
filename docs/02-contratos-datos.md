# Contratos de datos — Time ↔ Stats

Documento para alinear **ArenaPro Time** (export) y **ArenaPro Stats** (ingest + rebuild + UI).

**Contrato canónico en Time:**  
`ArenaPro-TimeManagement/docs/contratos/CONTRATO_EXPORT_STATS.md` (schemaVersion **2**).

Este archivo resume el consumo en Stats; si hay conflicto, manda el contrato de Time.

---

## 1. Flujo

```
Time: Exportar para Stats…
        ↓  JSON (schemaVersion 1+)
Admin Stats: preview → cherry-pick → edits → ingest
        ↓
data/eventos/{id}.json  (+ statsEdits aplicados)
data/manifest.json
        ↓
scripts/rebuild-temporada.mjs
        ↓
data/temporada.json  (standings + allAround)
        ↓
GitHub Pages (index.html)
```

---

## 2. Evento (export Time) — campos actuales

Top-level típico:

| Campo | Tipo | Notas |
|-------|------|-------|
| `schemaVersion` | number | Hoy `1`; subir a `2` cuando entre dinero oficial |
| `exportedAt` | ISO string | |
| `source` | `"time"` | |
| `eventoId` | string | Suele ser `local:N` |
| `nombreEvento`, `fecha`, `sede`, `temporada` | string | Alinear `temporada` a `"2027"` |
| `categorias[]` | array | `id`, `nombre`, `tipo`, `numeroRondas` |
| `resultados[]` | array | Vueltas / filas crudas |
| `clasificacion[]` | array | Preferido para UI de ranking |

### Entrada de clasificación (hoy)

Incluye entre otros: `lugar`, `competidorId`, `nombre`, `puntos`, **`puntosCircuito`**, tiempos, etc.

---

## 3. Extensión requerida — dinero (schema v2)

Pedir a Time (o completar en admin si Time aún no):

### Por entrada en `clasificacion[].entradas[]`

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `montoGanado` | number (entero ≥ 0) | Sí para dinero | MXN sin decimales |
| `moneda` | string | No | Default `"MXN"` |

### Team Roping — ideal (Time)

| Campo | Tipo | Notas |
|-------|------|-------|
| `rol` | `"header"` \| `"heeler"` | Si ya vienen filas separadas |
| `headerNombre` / `heelerNombre` | string | Si viene el dúo junto |
| `montoEquipo` | number | Total a partir 50/50 |
| `puntosCircuito` | number | **Por persona/rol, no split** |

Si Time manda un solo renglón `"HEADER / HEELER"` + `montoGanado` del equipo:

1. Stats parte nombres.
2. Dinero → 50/50 (constante configurable).
3. Puntos → **duplicar el valor de Time a ambos roles** *solo si* Time no manda puntos por rol; si manda por rol, respetar. **Nunca dividir puntos.**

---

## 4. Capa Stats — `statsEdits` (Sprint 3)

Guardada en el JSON del evento tras ingest:

```json
{
  "statsEdits": {
    "version": 1,
    "editadoEn": "2027-01-15T18:00:00.000Z",
    "categoriasIncluidas": ["local:257", "local:258"],
    "filas": [
      {
        "key": "clasificacion:local:257:local:1021",
        "nombre": "Juan Pérez",
        "puntosCircuito": 120,
        "montoGanado": 8000,
        "excluir": false
      }
    ]
  }
}
```

Reglas:

- Base = export Time.
- Edits sobrescriben campos puntuales.
- Categorías no incluidas no entran al rebuild de temporada ni a tablas públicas del evento (o se marcan excluidas).
- Rebuild **siempre** lee el evento ya “aplicado”, no el JSON crudo sin edits.

---

## 5. Aliases — `data/competidor-aliases.json`

```json
{
  "version": 1,
  "aliases": [
    {
      "from": "name:juan perez",
      "to": "name:juan perez garcia",
      "nota": "Mismo rider, distinto spelling"
    }
  ]
}
```

`competitorKey` resuelve `from` → `to` antes de agregar a standings / All-Around.

---

## 6. `data/manifest.json`

```json
{
  "temporadaActiva": "2027",
  "titulo": "FMR Tour 2027",
  "cutLine": null,
  "cutLineVisible": false,
  "cutLinePorDisciplina": {},
  "eventos": [
    {
      "id": "local:21",
      "nombre": "…",
      "fecha": "2026-09-06",
      "sede": "…",
      "file": "eventos/….json"
    }
  ]
}
```

- Mientras `cutLineVisible !== true`, la UI **no** muestra badges de cut.
- Cuando FMR defina el número: setear `cutLine` y `cutLineVisible: true`.

---

## 7. `data/temporada.json` (salida del rebuild)

```json
{
  "temporada": "2027",
  "titulo": "FMR Tour 2027",
  "actualizadoEn": "…",
  "eventosContados": 4,
  "standings": [
    {
      "competidorId": "local:514",
      "competidorKey": "name:juan perez",
      "nombre": "Juan Pérez",
      "equipo": "",
      "disciplinaId": "Barriles",
      "disciplinaNombre": "Barriles",
      "puntosTotales": 450,
      "dineroTotal": 12500,
      "eventos": 3
    }
  ],
  "allAround": [
    {
      "competidorKey": "name:juan perez",
      "nombre": "Juan Pérez",
      "dineroTotal": 28000,
      "disciplinasConDinero": ["Barriles", "LazoDeBecerro"],
      "detalle": [
        { "disciplinaId": "Barriles", "dinero": 12500 },
        { "disciplinaId": "LazoDeBecerro", "dinero": 15500 }
      ]
    }
  ]
}
```

---

## 8. Disciplinas de circuito (labels)

Mantener alineación con Time / FMR. Claves conocidas hoy:

- Barriles, BarrilesMasters  
- LazoDeBecerro, LazoEnFalso, AchatadaDeNovillos, AmarreDeChiva  
- TeamRoping → se **parte** en Header / Heeler (+ Masters)  
- CaballoConPretal, CaballoConMontura, JineteosDeToros, Polos  

**Importante:** no usar `categoriaId` `local:N` como clave de temporada (cambia por evento). Usar `disciplinaKey(cat)`.

---

## 8b. Evento manual (Excel)

Para rodeos que no se corren en Time: plantilla [`templates/evento-manual.xlsx`](../templates/evento-manual.xlsx).

- Una hoja por disciplina (vacías = omitidas).
- Meta en hoja `Evento`; tiempos = totales por ronda (`Ronda 1–3`).
- El admin convierte a JSON `source: "manual"` schema 2 con `clasificacion` completa (paridad Time para UI/rebuild).
- `resultados[]` se sintetiza desde las rondas.

Ver `scripts/lib/excel-evento.mjs`.

---

## 9. Checklist para el equipo Time

- [ ] Exportar `montoGanado` entero MXN en clasificación  
- [ ] Documentar si TR viene como dúo o filas por rol  
- [ ] No asumir que Stats recalcula puntos  
- [ ] Temporada `"2027"` en eventos del tour  
- [ ] Avisar breaking changes de schema con bump de `schemaVersion`
