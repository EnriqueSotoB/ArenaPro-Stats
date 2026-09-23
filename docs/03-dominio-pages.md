# Dominio personalizado — GitHub Pages

**Dominio base:** `arenapro.mx` (ya disponible)  
**URL oficial de Stats:** `https://estadisticas.arenapro.mx`

Otras opciones (no usadas):

| Subdominio | Uso |
|------------|-----|
| `estadisticas.arenapro.mx` | **Oficial** — en español |
| `stats.arenapro.mx` | Alternativa corta (descartada) |
| `clasificacion.arenapro.mx` | Énfasis en rankings |
| `fmr.arenapro.mx` | Si Stats es solo del tour FMR |

Evitar publicar Stats en la raíz `arenapro.mx` si esa raíz ya es (o será) el sitio marketing / Time / otra app.

---

## 1. DNS (donde administras arenapro.mx)

Crea un registro:

| Tipo | Nombre / Host | Valor / Destino | TTL |
|------|---------------|-----------------|-----|
| `CNAME` | `estadisticas` | `enriquesotob.github.io` | 300 o Auto |

Notas:

- El valor es **`enriquesotob.github.io`** (sin `https://`, sin path `/ArenaPro-Stats`).
- Algunos paneles piden el nombre como `estadisticas` y otros como `estadisticas.arenapro.mx`; usa el formato que muestre tu proveedor.
- Propágación: minutos a unas horas.

### ¿Apex (`arenapro.mx` sin subdominio)?

Si en el futuro quisieras la raíz en Pages, GitHub pide registros `A`/`AAAA` (IPs de GitHub), no solo CNAME. Para Stats **no hace falta**: usa el subdominio.

---

## 2. GitHub Pages (repo ArenaPro-Stats)

1. Repo → **Settings** → **Pages**.
2. Source: branch `main` (o la que publique el sitio), carpeta `/` (root).
3. **Custom domain:** escribe `estadisticas.arenapro.mx` → Save.
4. Espera a que GitHub verifique el DNS (puede tardar).
5. Activa **Enforce HTTPS** cuando aparezca disponible (a veces tarda tras la verificación).

El repo incluye un archivo `CNAME` en la raíz con:

```
estadisticas.arenapro.mx
```

**No borres** ese archivo en commits posteriores; debe versionarse en `main`.

---

## 3. Rutas del proyecto (importante)

Antes:

`https://enriquesotob.github.io/ArenaPro-Stats/`

Con dominio custom, GitHub Pages sirve el **mismo repo** en la **raíz del host**:

`https://estadisticas.arenapro.mx/`  
(no `…/ArenaPro-Stats/`)

Revisar en código/links:

- [x] `pagesUrl` / admin → `https://estadisticas.arenapro.mx/`
- [x] README y docs → URL nueva
- [x] Archivo `CNAME` en el repo

---

## 4. Checklist de corte

- [x] CNAME DNS `estadisticas` → `enriquesotob.github.io`
- [ ] Custom domain en Pages + HTTPS *(confirmar Enforce HTTPS en Settings → Pages tras merge a `main`)*
- [x] Archivo `CNAME` en el repo
- [x] Links internos/ops actualizados
- [ ] Probar: home, `#temporada`, un evento, admin sigue en localhost
- [ ] Aviso al equipo: URL oficial nueva

---

## 5. Cuándo hacerlo en el plan

| Momento | Acción |
|---------|--------|
| **Release / post Sprint 4** | DNS + Pages + merge a `main` |
| Código | Links y `CNAME` en esta branch |

Si el DNS lo maneja otra persona, envíale solo la tabla del §1 y pide confirmación cuando el panel muestre el CNAME correcto.

---

## 6. Seguridad / ops

- Admin de publicación **sigue en localhost** (`127.0.0.1:8787`); no lo expongas en `estadisticas.arenapro.mx`.
- El dominio público es **solo lectura** (JSON + HTML estáticos).
