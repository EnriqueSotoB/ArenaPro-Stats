# Checklist de lanzamiento — FMR Tour 2027 v1

Completar **antes** del PR `develop` → `main`.

---

## Producto

- [x] Título y copy: **FMR Tour 2027** (cero “demo” / “Circuito demo”)
- [x] Puntos visibles por disciplina
- [x] Dinero MXN enteros visible por disciplina
- [x] Team Roping: tablas **Headers** y **Heelers** (y Masters si aplica)
- [x] All-Around temporada: solo 2+ disciplinas **con dinero**
- [x] Metodología pública (texto corto)
- [x] Cut line: oculto (`cutLineVisible: false`) hasta número oficial FMR

## Datos

- [x] `temporadaActiva` / eventos alineados a 2027 (temporada del circuito; fechas de rodeos pueden ser 2026)
- [x] Al menos 1 evento con `montoGanado` real (p. ej. Truckmania manual + exports Time)
- [ ] Spot-check: 3 atletas — suma de $ en eventos = `dineroTotal` *(humano / circuito)*
- [ ] Spot-check TR: puntos no partidos; dinero según regla vigente *(humano / circuito)*
- [ ] Spot-check All-Around: un caso que debe entrar y uno que no *(humano / circuito)*
- [x] `temporada.json` regenerado por script (no editado a mano)

## Ingeniería

- [x] `npm test` verde en CI
- [x] Meta aproximada ≥ 40 tests
- [x] Sin secretos en el repo
- [x] Admin solo localhost verificado
- [x] Workflow de tests en PRs activo (`npm ci` + `npm test`)
- [x] Docs de decisiones al día

## Ops

- [x] Runbook: Time/Excel → `publicar.bat` → cherry-pick/edits → Agregar → Publicar
- [ ] Persona de respaldo entrenada (30 min)
- [x] Ensayo de publish / ingest Excel en local
- [ ] URL Pages verificada tras merge a `main`
- [x] Dominio custom `estadisticas.arenapro.mx` (DNS + `CNAME` en repo) — confirmar HTTPS en Pages tras merge
- [x] Links ops/README apuntan al dominio ArenaPro
- [ ] Tag release opcional `v1.0.0-fmr-2027`

## Comunicación

- [ ] Aviso interno al equipo FMR / Time con link
- [ ] Canal para reportar errores de nombres / aliases
- [x] Pendientes explícitos documentados: cut line oficial, confirmación 50/50 dinero TR → [backlog v1.1](./backlog-v1.1.md)

---

## Firma

| Rol | Nombre | Fecha |
|-----|--------|-------|
| Dev | Enrique Soto | 2026-09-23 |
| Producto / circuito | | |
