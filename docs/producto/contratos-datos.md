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
tools/rebuild-temporada.mjs
        ↓
data/circuitos/{circuitoId}.json  (standings + allAround, uno por circuito)
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

### Lazo por Parejas — ideal (Time)

Nombre oficial FMR: **Lazo por Parejas** (cabecero / pialador). Campos del contrato Time siguen en inglés por compatibilidad.

| Campo | Tipo | Notas |
|-------|------|-------|
| `rol` | `"header"` \| `"heeler"` | cabecero / pialador; si ya vienen filas separadas |
| `headerNombre` / `heelerNombre` | string | cabecero / pialador; si viene el dúo junto |
| `montoEquipo` | number | Total a partir 50/50 |
| `puntosCircuito` | number | **Por persona/rol, no split** |

Si Time manda un solo renglón `"CABECERO / PIALADOR"` + `montoGanado` del equipo:

1. Stats parte nombres.
2. Dinero → 50/50 cabecero / pialador (**confirmado**).
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

`competitorKey` resuelve `from` → `to` antes de agregar a standings / Vaquero Completo.

---

## 6. `data/manifest.json` (version 2)

```json
{
  "version": 2,
  "circuitoDefault": "aerch-circuito-2027",
  "asociaciones": [
    { "id": "aerch", "siglas": "AERCH", "nombre": "Asociación Estatal de Rodeo de Chihuahua", "tipo": "estatal", "estado": "Chihuahua", "logo": "logos/aerch.jpg", "hashtags": "#AERCH #Rodeo #RodeoChihuahua #ArenaPro" },
    { "id": "fmr", "siglas": "FMR", "nombre": "Federación Mexicana de Rodeo", "tipo": "federacion", "estado": "", "logo": "", "hashtags": "#FMR #Rodeo #ArenaPro" }
  ],
  "circuitos": [
    {
      "id": "aerch-circuito-2027",
      "asociacionId": "aerch",
      "nombre": "AERCH Circuito 2027",
      "temporada": "2027",
      "cutLine": null,
      "cutLineVisible": false,
      "cutLinePorDisciplina": {}
    }
  ],
  "eventos": [
    {
      "id": "local:21",
      "nombre": "…",
      "fecha": "2026-09-06",
      "sede": "…",
      "file": "eventos/….json",
      "circuitos": ["aerch-circuito-2027", "fmr-tour-2027"]
    }
  ]
}
```

- Un **circuito** = una temporada de una asociación. Solo suma los eventos que lo listan en `circuitos[]`.
- Un evento puede contar para varios circuitos (rodeo FMR Tour-AERCH). Un evento sin circuitos no suma en ningún lado.
- `circuitoDefault` es el circuito que abre el sitio público.
- `logo` (relativo a `data/`, solo `logos/*.png|jpg|webp`) y `hashtags` (texto libre normalizado a `#Tag` separados por espacio, sin duplicados) son opcionales y editables; los usa la imagen para redes y su texto sugerido. Si `hashtags` está vacío, el texto no lleva hashtags.
- `portal` (opcional): `{ "sal": hex32, "hash": hex64, "iteraciones": 210000, "version": 2 }` — `hash` = SHA-256 de la llave PBKDF2-SHA256 de la contraseña del portal de asociaciones (`portal.html`). La sesión del navegador guarda la llave, así que copiar el `hash` público no abre el portal; registros sin `version: 2` se ignoran. Nunca se guarda la contraseña; el admin la genera con **Dar acceso** y la muestra una sola vez. `null` = sin acceso. Editar la asociación conserva el acceso; solo `/api/asociaciones/portal(/remove)` lo cambia.
- Asociaciones y circuitos se crean/editan desde el admin (`/api/asociaciones`, `/api/circuitos`); lógica en `web/lib/circuitos.mjs`.
- El campo `temporada` dentro del JSON del evento es informativo (se llena con la temporada del primer circuito); **no** decide a qué acumulado entra.
- Línea de corte por circuito: mientras `cutLineVisible !== true`, la UI **no** muestra badges de cut.
- Un manifest v1 (`temporadaActiva` + `titulo`) se sigue leyendo como un solo circuito con todos los eventos.

---

## 7. `data/circuitos/{circuitoId}.json` (salida del rebuild)

Uno por circuito. `data/temporada.json` ya no existe (el rebuild lo borra).

```json
{
  "circuitoId": "aerch-circuito-2027",
  "asociacionId": "aerch",
  "asociacionSiglas": "AERCH",
  "asociacionNombre": "Asociación Estatal de Rodeo de Chihuahua",
  "temporada": "2027",
  "titulo": "AERCH Circuito 2027",
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
- TeamRoping → se **parte** en Cabecero / Pialador (+ Master); etiquetas UI: Lazo por Parejas — Cabeceros / Pialadores  
- CaballoConPretal, CaballoConMontura, JineteosDeToros, Polos  
- CowboyProtection — categoría "Cowboy Protection"; se reconoce por el nombre aunque Time la mande con tipo `JineteosDeToros`; calificada por jueces  

**Importante:** no usar `categoriaId` `local:N` como clave de temporada (cambia por evento). Usar `disciplinaKey(cat)` (`web/lib/disciplinas.mjs`, compartido por rebuild, admin y portal).

---

## 8b. Evento manual (Excel)

Para rodeos que no se corren en Time: plantilla [`templates/evento-manual.xlsx`](../templates/evento-manual.xlsx).

- Una hoja por disciplina (vacías = omitidas).
- Meta en hoja `Evento`; tiempos = totales por ronda (`Ronda 1–3`).
- El admin convierte a JSON `source: "manual"` schema 2 con `clasificacion` completa (paridad Time para UI/rebuild).
- `resultados[]` se sintetiza desde las rondas.

Ver `tools/lib/excel-evento.mjs`.

---

## 9. Checklist para el equipo Time

- [ ] Exportar `montoGanado` entero MXN en clasificación  
- [ ] Documentar si TR viene como dúo o filas por rol  
- [ ] No asumir que Stats recalcula puntos  
- [ ] Temporada `"2027"` en eventos del tour  
- [ ] Avisar breaking changes de schema con bump de `schemaVersion`
