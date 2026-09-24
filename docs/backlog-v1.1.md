# Backlog v1.1+ (post-lanzamiento)

Priorizado después de FMR Tour 2027 v1 estable. No mezclar en sprints 0–4 salvo acuerdo explícito.

---

## Alta prioridad

| Item | Notas |
|------|-------|
| Activar cut line oficial | Set `cutLine` + `cutLineVisible: true`; tests de badges |
| Confirmar split dinero TR | Actualizar constante + `00-decisiones-producto.md` |
| IDs web estables desde Time | Dejar de depender de `name:` cuando existan |
| All-Around **por evento** | Misma regla 2+ con dinero, scope = un rodeo |

---

## Media

| Item | Notas |
|------|-------|
| Multi-temporada / archivo | Switcher de año |
| Export CSV público | Standings / All-Around |
| Gráficas simples | Evolución de puntos (opcional) |
| Alias UI completa | Merge de duplicados con preview de impacto |
| Mejoras SEO | Meta por disciplina |

---

## Baja / más adelante

| Item | Notas |
|------|-------|
| PWA / offline | |
| Auth admin remoto | Hoy localhost es correcto |
| App móvil nativa | |
| Migración a framework (React, etc.) | Solo si el costo de vanilla duele de verdad |

---

## Hecho recientemente

| Item | Notas |
|------|--------|
| Evento manual (Excel) | Plantilla por disciplina → `source: manual` + ingest |
| Búsqueda + ficha competidor | `#competidor/…`, historial en `temporada.competidores`, ⌘/Ctrl+K |
| UX craft v1.1 | Archivo display, motion, empty states All-Around, nombres clicables |

---

## Deuda técnica

- Extraer más lógica de `app.js` / `admin.js` a módulos puros.
- Reducir fixtures gigantes; preferir JSON mínimos.
- Tipado gradual (JSDoc → TypeScript) si el equipo crece.
- Snapshot tests de `temporada.json` con fixtures fijos.
