# Checklist de lanzamiento — FMR Tour 2027 v1

Completar **antes** del PR `develop` → `main`.

---

## Producto

- [ ] Título y copy: **FMR Tour 2027** (cero “demo” / “Circuito demo”)
- [ ] Puntos visibles por disciplina
- [ ] Dinero MXN enteros visible por disciplina
- [ ] Team Roping: tablas **Headers** y **Heelers** (y Masters si aplica)
- [ ] All-Around temporada: solo 2+ disciplinas **con dinero**
- [ ] Metodología pública (texto corto)
- [ ] Cut line: oculto **o** número oficial acordado (no demo `2` por error)

## Datos

- [ ] `temporadaActiva` / eventos alineados a 2027 (o regla de negocio documentada)
- [ ] Al menos 1 evento con `montoGanado` real verificado por humano del circuito
- [ ] Spot-check: 3 atletas — suma de $ en eventos = `dineroTotal`
- [ ] Spot-check TR: puntos no partidos; dinero según regla vigente
- [ ] Spot-check All-Around: un caso que debe entrar y uno que no
- [ ] `temporada.json` regenerado por script (no editado a mano)

## Ingeniería

- [ ] `npm test` verde en CI
- [ ] Meta aproximada ≥ 40 tests
- [ ] Sin secretos en el repo
- [ ] Admin solo localhost verificado
- [ ] Workflow de tests en PRs activo
- [ ] Docs de decisiones al día

## Ops

- [ ] Runbook: Time export → `publicar.bat` → cherry-pick/edits → Agregar → Publicar (&lt; 5 min)
- [ ] Persona de respaldo entrenada (30 min)
- [ ] Ensayo de publish completo en staging/`develop` o local
- [ ] URL Pages verificada tras merge a `main`
- [ ] Dominio custom `stats.arenapro.mx` (o el acordado) con HTTPS — ver [03-dominio-pages.md](./03-dominio-pages.md)
- [ ] Links ops/README apuntan al dominio ArenaPro, no solo a `github.io`
- [ ] Tag release opcional `v1.0.0-fmr-2027`

## Comunicación

- [ ] Aviso interno al equipo FMR / Time con link
- [ ] Canal para reportar errores de nombres / aliases
- [ ] Pendientes explícitos: cut line, confirmación 50/50 dinero TR

---

## Firma

| Rol | Nombre | Fecha |
|-----|--------|-------|
| Dev | | |
| Producto / circuito | | |
