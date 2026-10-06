# Manual del admin — ArenaPro Estadísticas

Para entrenar a quien publica resultados. Tiempo estimado: **45 minutos** con alguien que ya sepa operar.
Para problemas y alertas, ver el [runbook](./runbook.md).

---

## 0. Antes de empezar

- La computadora debe estar preparada (sección 1 del [runbook](./runbook.md)).
- El admin **solo funciona en tu computadora**: se abre con `publicar.bat` y vive en `http://127.0.0.1:8787/admin.html`.
- Nada de lo que hagas se ve en el sitio público hasta que presiones **Publicar en GitHub Pages**. Puedes practicar con calma y descartar cambios.

## 1. Abrir la consola

1. Doble clic en **`publicar.bat`** (en la carpeta del proyecto).
2. Se abre una ventana negra y el navegador con el admin. **No cierres la ventana negra** mientras trabajas.
3. Arriba debe decir cuántos eventos hay en el repo. Si dice "No hay API", la ventana negra se cerró: vuelve a abrir `publicar.bat`.

## 2. Conseguir los resultados

**Si el rodeo usó Time:** en Time, **Exportar para Stats…** y guarda el archivo `.json`.

**Si no usó Time:** en el admin, **Descargar plantilla Excel** y llénala:

| Hoja | Qué va |
|---|---|
| **Evento** | Nombre, fecha (AAAA-MM-DD), sede y temporada (ej. 2027) |
| Una hoja por disciplina | Una fila por competidor. Si la disciplina no se corrió, déjala vacía. No renombres las hojas |

Reglas de la plantilla (también vienen en la hoja **Cómo llenar**):

- **Lugar** = puesto final (1, 2, 3…). Si no clasificó, deja Lugar vacío y pon NT o NP en el tiempo.
- **Tiempos:** Ronda 1–3 y Total. **Jineteos, Cowboy Protection, Montura, Pretal:** solo Calificación.
- **Lazo por Parejas:** una fila = Cabecero + Pialador. El dinero se reparte 50/50 solo.
- **Nombres:** escríbelos como quieras; se publican en MAYÚSCULAS.
- **Notas internas:** para uso de los jueces; **no se publican**.

## 3. Agregar el evento (pasos 1–3 del admin)

1. **Paso 1 — Cargar:** arrastra el `.json` o el `.xlsx` a la zona punteada (o **Elegir archivo**).
2. **Paso 2 — Revisar:**
   - En **Cuenta para**, marca cada circuito (asociación + temporada) donde cuenta el rodeo. Puede ser más de uno.
   - En **Categorías a incluir**, deja marcadas solo las que se publican.
   - En la tabla de edición puedes corregir nombres, puntos o dinero de la categoría activa. Usa **Buscar** para encontrar a alguien.
   - Revisa la **Vista previa**: pódium y tabla deben verse como el acta del rodeo.
   - Si aparece un recuadro amarillo de avisos, léelo: suele ser dinero faltante o un nombre raro.
3. **Paso 3 — Agregar a Estadísticas.**
   - Si el admin avisa que **parece el mismo rodeo** que uno ya cargado, cancela salvo que estés seguro de que es otro rodeo.

## 4. Publicar (paso 4)

1. **Publicar en GitHub Pages.**
2. Antes de subir, la consola revisa los datos y corre las pruebas. Si algo está mal, **no publica** y te dice por qué (ver tabla en la sección 3 del [runbook](./runbook.md)).
3. El sitio se actualiza en **2–4 minutos**. Abre **Ver sitio público** y confirma que el rodeo aparece en **Eventos**.

## 5. Corregir o quitar un evento

En **Eventos en el repo**:

- **Editar** reabre el evento en los pasos 2–3 para corregir nombres, puntos o dinero. Luego **Agregar a Estadísticas** y **Publicar**.
- **Eliminar** quita el evento. Confirma y luego **Publicar**.

## 6. Unificar competidores

Cuando la misma persona aparece con dos nombres (apodo, falta de acento, segundo apellido):

1. En **Unificar competidores**, **Aparece como**: el nombre "incorrecto". **Unificar con**: el nombre correcto.
2. **Aplica a**: "Todas las asociaciones", o solo una si en otra asociación son personas distintas.
3. **Unificar** y después **Publicar**.

No cambia lo escrito en el evento; solo suma sus puntos y dinero en la temporada. Para deshacerlo: **Quitar** en **Aliases actuales**.

## 7. Asociaciones, temporadas y portal

En **Asociaciones y circuitos**:

- **+ Nueva asociación**: siglas, nombre, tipo, estado, hashtags para redes y logo (PNG/JPG/WEBP, máx. 2 MB).
- **+ Nuevo circuito**: una temporada de una asociación (ej. "AERCH Circuito 2028", temporada "2028"). Marca **Circuito principal** solo si debe abrir el sitio público.
- **Dar acceso** (portal): genera la contraseña de la asociación y un mensaje listo para mandar. **Cópialo en ese momento**: la contraseña no se vuelve a mostrar. **Nueva contraseña** invalida la anterior.
- Todo cambio aquí también requiere **Publicar**.

El portal de la asociación muestra su tablero e imágenes para redes con su marca. **No es información privada**: son los mismos datos del sitio público.

## 8. Práctica guiada (para el entrenamiento)

Hacer con el entrenador al lado, **sin publicar** hasta el último punto:

1. Abrir `publicar.bat` y ubicar los 4 pasos.
2. Descargar la plantilla, llenar 3 competidores de Barriles en minúsculas y cargarla: confirmar que la vista previa muestra MAYÚSCULAS.
3. Desmarcar un circuito y volverlo a marcar; revisar la vista previa.
4. Corregir el dinero de una fila en la tabla de edición.
5. Cancelar la edición sin agregar.
6. Buscar un competidor real con dos nombres y explicar cómo se unificaría (sin guardarlo).
7. Con un evento real de la semana: agregar y **publicar**, y confirmar en el sitio.

## 9. Lista para operar sola

- [ ] Abre la consola y sabe qué hacer si dice "No hay API"
- [ ] Carga un JSON de Time y un Excel
- [ ] Marca circuitos y categorías correctos
- [ ] Corrige un dato en la tabla de edición
- [ ] Sabe qué hacer cuando Publicar se niega
- [ ] Publica y verifica en el sitio
- [ ] Sabe editar o eliminar un evento publicado
- [ ] Sabe unificar un competidor y elegir el alcance
- [ ] Sabe a quién avisar y cómo responder a soporte@arenapro.mx

Entrenada por: ____________ · Fecha: ____________
