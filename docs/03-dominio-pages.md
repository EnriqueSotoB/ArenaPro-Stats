# Dominio personalizado — GitHub Pages

**Dominio base:** `arenapro.mx` (ya disponible)  
**URL recomendada para Stats:** `https://stats.arenapro.mx`

Otras opciones válidas si marketing prefiere otro nombre:

| Subdominio | Uso |
|------------|-----|
| `stats.arenapro.mx` | **Recomendado** — claro y corto |
| `clasificacion.arenapro.mx` | Énfasis en rankings |
| `fmr.arenapro.mx` | Si Stats es solo del tour FMR |

Evitar publicar Stats en la raíz `arenapro.mx` si esa raíz ya es (o será) el sitio marketing / Time / otra app.

---

## 1. DNS (donde administras arenapro.mx)

Crea un registro:

| Tipo | Nombre / Host | Valor / Destino | TTL |
|------|---------------|-----------------|-----|
| `CNAME` | `stats` | `enriquesotob.github.io` | 300 o Auto |

Notas:

- El valor es **`enriquesotob.github.io`** (sin `https://`, sin path `/ArenaPro-Stats`).
- Algunos paneles piden el nombre como `stats` y otros como `stats.arenapro.mx`; usa el formato que muestre tu proveedor.
- Propágación: minutos a unas horas.

### ¿Apex (`arenapro.mx` sin subdominio)?

Si en el futuro quisieras la raíz en Pages, GitHub pide registros `A`/`AAAA` (IPs de GitHub), no solo CNAME. Para Stats **no hace falta**: usa el subdominio.

---

## 2. GitHub Pages (repo ArenaPro-Stats)

1. Repo → **Settings** → **Pages**.
2. Source: branch `main` (o la que publique el sitio), carpeta `/` (root).
3. **Custom domain:** escribe `stats.arenapro.mx` → Save.
4. Espera a que GitHub verifique el DNS (puede tardar).
5. Activa **Enforce HTTPS** cuando aparezca disponible (a veces tarda tras la verificación).

GitHub creará/actualizará un archivo `CNAME` en la raíz del repo con:

```
stats.arenapro.mx
```

**No borres** ese archivo en commits posteriores; debe versionarse en `main`.

---

## 3. Rutas del proyecto (importante)

Hoy el sitio vive en:

`https://enriquesotob.github.io/ArenaPro-Stats/`

Con dominio custom, GitHub Pages sirve el **mismo repo** en la **raíz del host**:

`https://stats.arenapro.mx/`  
(no `…/ArenaPro-Stats/`)

Revisar en código/links:

- [ ] Enlaces absolutos que incluyan `/ArenaPro-Stats/` → quitar el path del repo.
- [ ] `pagesUrl` en `scripts/publish-server.mjs` / admin → apuntar a `https://stats.arenapro.mx/`.
- [ ] README y docs → URL nueva.
- [ ] Si usas `base` o paths hardcodeados, dejarlos en `/`.

---

## 4. Checklist de corte

- [ ] CNAME DNS `stats` → `enriquesotob.github.io`
- [ ] Custom domain en Pages + HTTPS
- [ ] Archivo `CNAME` en `main`
- [ ] Links internos/ops actualizados
- [ ] Probar: home, `#temporada`, un evento, admin sigue en localhost
- [ ] Aviso al equipo: URL oficial nueva; la de `github.io` puede redirigir o seguir existiendo según config

---

## 5. Cuándo hacerlo en el plan

| Momento | Acción |
|---------|--------|
| **Sprint 0** (opcional) | Configurar DNS + Pages en paralelo; no bloquea tests |
| **Sprint 4 / release** | Obligatorio: URL oficial en README, admin y comunicación FMR |

Si el DNS lo maneja otra persona, envíale solo la tabla del §1 y pide confirmación cuando `dig stats.arenapro.mx` (o el panel) muestre el CNAME correcto.

---

## 6. Seguridad / ops

- Admin de publicación **sigue en localhost** (`127.0.0.1:8787`); no lo expongas en `stats.arenapro.mx`.
- El dominio público es **solo lectura** (JSON + HTML estáticos).
