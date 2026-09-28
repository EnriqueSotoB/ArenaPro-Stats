# Runbook de operación — ArenaPro Estadísticas

Guía de una página para publicar resultados y resolver problemas. Cualquier persona de respaldo debe poder seguirla sin ayuda.

---

## 1. Preparar una computadora (una sola vez, ~20 min)

1. Instalar [Node.js 20 o más nuevo](https://nodejs.org/) y [Git](https://git-scm.com/).
2. Tener una cuenta de GitHub con permiso de escritura en `EnriqueSotoB/ArenaPro-Stats`.
3. Clonar: `git clone https://github.com/EnriqueSotoB/ArenaPro-Stats.git`
4. En la carpeta: `npm ci`
5. Probar: doble clic en `publicar.bat` → se abre `http://127.0.0.1:8787/admin.html`.

La segunda computadora debe probarse publicando un cambio real al menos una vez al mes.

## 2. Publicar un rodeo (cada fin de semana)

1. Doble clic en `publicar.bat` (no cerrar la ventana negra mientras trabajas).
2. En el admin: **Agregar evento** con el export de Time o la plantilla Excel (`templates/evento-manual.xlsx`).
3. Revisar circuitos del evento, nombres y dinero. Los nombres se pasan solos a MAYÚSCULAS.
4. **Publicar**. El sitio se actualiza en 2–4 minutos: GitHub corre lint, tests y pruebas del sitio antes de desplegar.

Compromiso con las asociaciones: resultados publicados a más tardar 24 horas después de recibirlos.

## 3. Cuando Publicar se niega

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| "Parece el mismo rodeo que…" | Ya hay un rodeo con la misma fecha y competidores | Si de verdad es otro rodeo, confirma; si no, cancela |
| "El circuito principal no tiene eventos" | La portada abriría vacía | Asigna eventos al circuito o cambia el principal |
| "Fallaron los tests" | Los datos rompen una regla | Lee la línea del error; si no es claro, no publiques y avisa a desarrollo |
| "GitHub tiene cambios que chocan con los tuyos" | Alguien más publicó el mismo archivo | Tus cambios siguen guardados; avisa a desarrollo para unirlos |

## 4. Alertas del monitor

Cada hora, el workflow **Monitor** revisa el sitio en vivo. Si algo falla, GitHub manda correo y abre el issue **"Sitio con problemas"** con el detalle.

- **Portada o datos no responden**: revisar [estado de GitHub](https://www.githubstatus.com/). Si GitHub está bien, revisar el último run de "Deploy Pages".
- **Versión atrasada**: el último "Deploy Pages" falló. Abrir el run en Actions, leer qué paso falló y corregir; después re-ejecutarlo.
- Cerrar el issue cuando el siguiente Monitor pase en verde.

## 5. Deshacer una publicación equivocada

`main` no permite reescribir historia (sin force push). Para deshacer:

```bash
git pull
git revert <commit-equivocado>
git push
```

El deploy se dispara solo con el revert.

## 6. Correcciones y solicitudes de competidores

Llegan a **soporte@arenapro.mx**.

1. Responder el mismo día que se recibió.
2. Si cambia un resultado oficial, confirmarlo con la asociación antes de publicar.
3. Unificar nombres escritos distinto: admin → **Unificar competidores** (elige si aplica a todas las asociaciones o solo a una).
4. Solicitudes de retiro de datos (derechos ARCO) o de menores de edad: resolver en máximo 20 días hábiles y registrar la fecha de respuesta.

## 7. Contactos

| Rol | Persona | Contacto |
|---|---|---|
| Responsable técnico | Enrique Soto | |
| Respaldo | *(pendiente de asignar)* | |
| Soporte público | — | soporte@arenapro.mx |
