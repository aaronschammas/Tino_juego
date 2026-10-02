# QA: conexión de proyectos con Trello (Fases 1 a 3 y 5, versión temprana)

Versión para probar la conexión de un proyecto de Tino con un tablero de Trello:

- **Fase 1:** importación completa inicial y conexión guardada.
- **Fase 2:** actualización automática. Los cambios hechos en Trello aparecen solos en Tino, incluidos los comentarios.
- **Fase 3:** revisión diaria de respaldo. Una vez por día Cloud Scheduler llama a `POST /integrations/reconcile`, que compara cada tablero con Tino y recupera los avisos que se perdieron. El owner también puede correrla con **Sincronizar ahora**. No se usa `@Cron` porque Cloud Run corre con `min-instances 0` y no siempre hay una instancia viva que lo ejecute.
- **Fase 5:** avisos de novedades, con dos canales para dos públicos distintos:
  - **Cartel en la app** (dashboard web e inicio de Tino Mobile): "Novedades de Trello" con los números (tareas nuevas, cambios de estado, archivadas) y quién trabajó cuánto y en qué tareas. El owner ve toda la organización; el resto, solo sus tareas asignadas. Se cierra con la cruz y vuelve a aparecer cuando hay novedades nuevas.
  - **Resumen diario por WhatsApp** para el owner, en lenguaje natural, pensado para quien no quiere entrar al sistema. Lo dispara Cloud Scheduler con `POST /integrations/digest`. Si no hubo novedades no se manda nada.

Las novedades se registran en `IntegrationActivity` cada vez que un cambio de Trello crea una tarea, le cambia el estado o la archiva (por webhook o por la revisión diaria). La importación inicial no genera novedades. El tiempo trabajado sale de los timers de Tino ya cerrados sobre tareas de proyectos conectados.

**Regla de convivencia:** las tareas se pueden editar en Tino y en Trello. Cada cambio en Trello **solo actualiza el dato que cambió**. Si en Tino se cambió el título y en Trello se mueve la tarjeta, en Tino cambia el estado y el título se mantiene. Si en Trello se cambia el título, gana el cambio más reciente.

## Por qué es seguro desplegarla

La función tiene tres candados. Si falla cualquiera, el botón no aparece y los endpoints responden 403:

1. **Variable de entorno** `INTEGRATIONS_ENABLED=true`. Solo está en el pipeline de testing; en producción no existe, así que queda apagada aunque el código y las migraciones estén desplegados. Con el interruptor apagado, el webhook ignora los avisos.
2. **Plan Max**: la organización activa tiene que tener `hasIntegrations` (la migración lo activa en el plan `max`).
3. **Owner**: solo el owner de la organización conecta, desconecta y cambia equivalencias.

Las migraciones `20260924120000_add_integration_connections`, `20260925120000_add_integration_events`, `20260926120000_add_task_external_snapshot` y `20260929120000_add_integration_activity` **solo agregan** tablas y columnas. No modifican ni borran datos.

El cartel y el resumen diario usan los mismos candados: con `INTEGRATIONS_ENABLED` apagado el cartel no aparece y `POST /integrations/digest` responde `disabled: true` sin mandar nada.

La revisión diaria respeta la regla de convivencia: guarda en cada tarea el **último estado visto en Trello** (`Task.externalSnapshot`) y compara Trello contra ese estado, no contra Tino. Así solo aplica lo que cambió en Trello. Las tareas importadas antes de esta fase no tienen ese dato: en su primera revisión solo se guarda la línea base, sin tocar nada de Tino.

La importación manual de SUPERADMIN (`/trello-import`) ya no pide pegar API key ni token: usa el mismo botón **Autorizar Trello** (ventana de Trello, donde se puede entrar con Google u otra cuenta) y la API key de la app de Tino (`TRELLO_API_KEY`). El token de esa importación vence en una hora y no se guarda. No depende de `INTEGRATIONS_ENABLED`, pero sí de `TRELLO_API_KEY`: sin esa variable el botón responde "La autorización con Trello no está configurada", y el dominio del frontend tiene que estar en **Allowed origins** de la app de Trello.

## Configuración del entorno de testing (una sola vez)

1. **App de Trello**: en <https://trello.com/power-ups/admin>, en la app de Tino:
   - copiar la **API key** y el **Secret** (el secret es con el que Trello firma los avisos);
   - agregar el dominio del frontend de testing en **Allowed origins** (por ejemplo `https://tino-testing.vercel.app`). Si el origen no está permitido, Trello no vuelve a Tino después de autorizar.
2. **Clave de cifrado** (32 bytes en base64):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
3. **Secrets de GitHub** del environment `testing`:
   - `TRELLO_API_KEY`: la API key del paso 1.
   - `TRELLO_API_SECRET`: el secret del paso 1.
   - `INTEGRATIONS_ENCRYPTION_KEY`: la clave del paso 2. No cambiarla después: los tokens ya guardados dejarían de poder leerse.
   - `INTEGRATIONS_WEBHOOK_BASE_URL`: la URL pública del backend de testing (la de Cloud Run de `tino-backend-testing`, sin barra final). Trello envía los avisos a `<esa URL>/integrations/trello/webhook/<id de conexión>`.

   - `INTEGRATIONS_RECONCILE_TOKEN`: un secreto largo al azar (se genera igual que la clave del paso 2). Es lo que Cloud Scheduler manda para poder correr la revisión diaria.
4. **Cloud Scheduler** (una sola vez, con los mismos permisos que se usan para Cloud Run). Reemplazar `<URL_BACKEND>` por la URL de `tino-backend-testing` y `<TOKEN>` por `INTEGRATIONS_RECONCILE_TOKEN`:
   ```bash
   gcloud scheduler jobs create http tino-integrations-reconcile-testing --location=us-central1 --schedule="0 4 * * *" --time-zone="America/Argentina/Buenos_Aires" --uri="<URL_BACKEND>/integrations/reconcile" --http-method=POST --headers="X-Reconcile-Token=<TOKEN>" --attempt-deadline=300s --max-retry-attempts=2
   ```
   Para probarla sin esperar al día siguiente:
   ```bash
   gcloud scheduler jobs run tino-integrations-reconcile-testing --location=us-central1
   ```
5. **WhatsApp (Fase 5)**. El pipeline de testing despliega con `--env-vars-file`, que reemplaza todas las variables de Cloud Run, así que las de WhatsApp tienen que estar como secretos del environment `testing`: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` y `WHATSAPP_BUSINESS_NUMBER`. Sin ellas WhatsApp queda "no configurado" y el resumen no sale (el cartel de la app funciona igual).
6. **Plantilla de Meta para el resumen** (opcional, pero sin ella el resumen solo llega si el owner le escribió a Tino en las últimas 24 horas). En WhatsApp Manager crear una plantilla de categoría **Utilidad**, idioma **Español (ARG)** (`es_AR`), con dos variables de cuerpo, por ejemplo:
   > Resumen del día en {{1}}: {{2}}. Respondé NOVEDADES para ver el detalle.

   `{{1}}` es el nombre de la organización y `{{2}}` una línea con los números ("3 tareas nuevas, 2 completadas y 5 h registradas"). Cuando Meta la apruebe, guardar su nombre en el secreto `WHATSAPP_DIGEST_TEMPLATE`. Si el idioma no es `es_AR`, agregar también `WHATSAPP_DIGEST_TEMPLATE_LANGUAGE`. Cada plantilla enviada tiene costo por mensaje en Meta.
7. **Cloud Scheduler del resumen diario** (una sola vez). Mismo token que la revisión diaria, en un horario razonable para recibir un WhatsApp:
   ```bash
   gcloud scheduler jobs create http tino-integrations-digest-testing --location=us-central1 --schedule="0 9 * * *" --time-zone="America/Argentina/Buenos_Aires" --uri="<URL_BACKEND>/integrations/digest" --http-method=POST --headers="X-Reconcile-Token=<TOKEN>" --attempt-deadline=300s --max-retry-attempts=2
   ```
   Para probarlo en el momento:
   ```bash
   gcloud scheduler jobs run tino-integrations-digest-testing --location=us-central1
   ```

Sin `TRELLO_API_SECRET` o `INTEGRATIONS_WEBHOOK_BASE_URL` la conexión y la importación inicial funcionan igual, pero la actualización automática queda **inactiva**. El panel del proyecto lo muestra y tiene un botón **Reintentar**.

Para probar en local, agregar las mismas variables al `.env` del backend (`INTEGRATIONS_ENABLED=true`). Para recibir avisos en local, Trello necesita una URL pública (por ejemplo un túnel) en `INTEGRATIONS_WEBHOOK_BASE_URL`.

Para apagar la función en testing: quitar `INTEGRATIONS_ENABLED` o ponerla en `false` y volver a desplegar.

## Casos a probar

**Acceso**
- [ ] Owner con Plan Max ve el botón **Conectar Trello** en Proyectos.
- [ ] Miembro (no owner) y organización sin Plan Max **no** ven el botón.
- [ ] `GET /integrations/availability` devuelve el motivo correcto (`PLAN_REQUIRED`, `OWNER_REQUIRED`, `FEATURE_DISABLED`).

**Autorización**
- [ ] **Autorizar Trello** abre una ventana de Trello; al aceptar se cierra sola y aparecen los tableros.
- [ ] Cerrar la ventana sin autorizar muestra un error y permite reintentar.
- [ ] Con el bloqueador de ventanas emergentes activo se muestra un aviso claro.

**Equivalencia de estados**
- [ ] Listas con nombre conocido ("Por hacer", "En progreso", "Hecho", "Bloqueado") vienen sugeridas.
- [ ] Listas desconocidas quedan resaltadas y **Conectar e importar** está deshabilitado hasta elegirles un estado.
- [ ] Cambiar de tablero o de destino descarta la vista previa anterior.

**Conexión e importación inicial**
- [ ] Proyecto nuevo: se crea el proyecto con todas las tarjetas (y checklists como subtareas) en el estado elegido.
- [ ] Los comentarios existentes de las tarjetas aparecen en cada tarea con el nombre del autor y la etiqueta "Trello".
- [ ] Tarjetas con vencimiento marcado como completo entran como Completada.
- [ ] Proyecto existente: se agregan las tarjetas sin duplicar las que ya estaban.
- [ ] Un tablero importado antes por SUPERADMIN: como proyecto nuevo aparece bloqueado; eligiendo ese proyecto existente se conecta sin duplicar.
- [ ] El mismo tablero no se puede conectar a un segundo proyecto.
- [ ] Un proyecto ya conectado no acepta otro tablero.
- [ ] El mensaje final indica si la actualización automática quedó activa.

**Actualización automática (Fase 2)**: con el panel del proyecto mostrando "Actualizacion automatica activa":
- [ ] Crear una tarjeta en Trello: aparece como tarea, en el estado de su lista.
- [ ] Renombrar una tarjeta: cambia solo el título.
- [ ] Mover una tarjeta de lista: cambia solo el estado según la equivalencia.
- [ ] Editar en Tino el título de una tarea y después moverla en Trello: el título de Tino se mantiene.
- [ ] Cambiar descripción o vencimiento, o marcar el vencimiento como completo (pasa a Completada; al desmarcar vuelve al estado de la lista).
- [ ] Cambiar etiquetas de prioridad (rojo/naranja/verde): cambia solo la prioridad.
- [ ] Agregar, tildar, renombrar o borrar ítems de checklist: se reflejan en las subtareas (las borradas se archivan).
- [ ] Comentar, editar y borrar un comentario en Trello.
- [ ] Archivar una tarjeta: la tarea desaparece de las listas de Tino, pero sus horas registradas se mantienen. Al restaurarla vuelve.
- [ ] Crear una lista nueva en Trello: aparece en el panel como "por definir" (o con estado sugerido si el nombre es conocido). Al definirla y **Guardar equivalencias**, sus tareas toman ese estado.
- [ ] Cambiar la equivalencia de una lista que ya tenía estado: solo afecta a los próximos movimientos.
- [ ] Desconectar: Trello deja de enviar avisos y las tareas quedan en el proyecto.
- [ ] En **Ver en Trello** del detalle de tarea se abre la tarjeta original.

**Revisión diaria y "Sincronizar ahora" (Fase 3)**
- [ ] Con la actualización automática **inactiva**, hacer cambios en Trello (crear, mover, renombrar, archivar, comentar) y tocar **Sincronizar ahora**: todo aparece en Tino y el panel muestra un resumen ("Sincronizado: 2 nuevas, 1 actualizadas…").
- [ ] Editar en Tino el título de una tarea sin cambiarlo en Trello y sincronizar: el título de Tino se mantiene.
- [ ] Sincronizar dos veces seguidas: la segunda dice "no había cambios pendientes".
- [ ] Una tarea importada antes de la Fase 3 no cambia en su primera sincronización (solo se guarda la línea base); los cambios de Trello posteriores sí se aplican.
- [ ] Una lista nueva en Trello aparece en el panel después de sincronizar.
- [ ] Si el webhook no estaba activo y ya está la configuración, la sincronización lo vuelve a activar.
- [ ] El panel muestra la fecha de la última revisión completa. Los miembros la ven, pero no ven el botón.
- [ ] `gcloud scheduler jobs run …` ejecuta la revisión de todas las conexiones; la respuesta del endpoint trae cuántas procesó, cuántas salieron bien y cuáles fallaron.
- [ ] Un POST a `/integrations/reconcile` sin `X-Reconcile-Token` o con uno incorrecto responde 401.

**Cartel de novedades (Fase 5)**
- [ ] Crear, mover y archivar tarjetas en Trello: al recargar el dashboard aparece "Novedades de Trello" con los números correctos (una tarea movida varias veces cuenta una sola vez).
- [ ] Registrar tiempo con el timer en una tarea de un proyecto conectado y detenerlo: el cartel muestra "Ana trabajó 1 h en …".
- [ ] El owner ve las novedades de toda la organización; un miembro solo las de sus tareas asignadas.
- [ ] Cerrar el cartel con la cruz: no vuelve a aparecer hasta que haya novedades nuevas (también en Tino Mobile).
- [ ] Organización sin Plan Max o con `INTEGRATIONS_ENABLED` apagado: el cartel no aparece.
- [ ] Mover una tarjeta a una lista con el mismo estado que ya tenía no genera novedad.

**Resumen diario por WhatsApp (Fase 5)**: con el WhatsApp del owner vinculado desde el perfil:
- [ ] Escribirle a Tino por WhatsApp y después correr el job: llega el resumen completo en lenguaje natural (tareas nuevas, completadas, cambios de estado con quién las movió, archivadas y horas por persona).
- [ ] Sin escribirle a Tino en más de 24 horas y con `WHATSAPP_DIGEST_TEMPLATE` configurada: llega la plantilla con la línea de números; al responder "novedades" llega el detalle.
- [ ] Sin plantilla y con la ventana cerrada: no llega nada y la respuesta del endpoint dice `NO_CHANNEL`; el próximo resumen incluye esas novedades.
- [ ] Día sin novedades: no llega nada (`NO_NEWS`).
- [ ] Correr el job dos veces seguidas: la segunda responde `ALREADY_SENT` y no se repite el mensaje.
- [ ] Escribir "novedades" (o "resumen de trello") en cualquier momento: llega el resumen de las últimas 24 horas, o "No hubo novedades…".
- [ ] Un POST a `/integrations/digest` sin `X-Reconcile-Token` o con uno incorrecto responde 401.

**Importación manual de SUPERADMIN**
- [ ] En **Importar proyectos** no aparecen campos de API key ni token; aparece **Autorizar Trello**.
- [ ] Autorizar entrando a Trello con **Continuar con Google**: la ventana se cierra sola, aparecen los tableros y queda elegido el primero.
- [ ] **Cambiar cuenta** vuelve a abrir la autorización y carga los tableros de la otra cuenta.
- [ ] Vista previa e importación funcionan igual que antes.
- [ ] Sin `TRELLO_API_KEY` en el backend, autorizar muestra un error claro.

**Seguridad**
- [ ] El token de Trello no aparece en ninguna respuesta de la API ni en la URL de la app.
- [ ] En la base, `IntegrationConnection.accessTokenEnc` empieza con `v1:` (cifrado).
- [ ] Un POST al webhook sin la firma de Trello responde 401 y no cambia nada.
- [ ] Cada aviso queda registrado una sola vez en `IntegrationEvent` (con quién hizo el cambio); los reintentos de Trello no duplican cambios.

## Limitaciones conocidas de esta versión

- Las tareas archivadas se ocultan de listas, proyectos, asistente y timer, pero **los dashboards de analytics todavía las cuentan**.
- Si Trello no pudo entregar un aviso, el cambio aparece recién con la revisión diaria (o con **Sincronizar ahora**).
- La revisión diaria no borra comentarios borrados en Trello (Trello no los informa en la lista del tablero); esos sí llegan por webhook.
- Cada corrida revisa hasta 50 conexiones, empezando por las sincronizadas hace más tiempo.
- Al editar la descripción en Trello se reemplaza por el texto de Trello (sin el pie "Lista Trello original / URL" de la importación; el enlace sigue en **Ver en Trello**).
- No se importan adjuntos ni responsables. Por eso el cartel de un miembro solo muestra las tareas que alguien le asignó en Tino.
- El resumen por WhatsApp llega solo al owner que vinculó su WhatsApp. Se envía al identificador de Meta (`user_id`) guardado al vincular, nunca a un teléfono: hay que confirmar en testing que Meta entrega los mensajes iniciados por Tino a ese identificador.
- Los cambios que trae la revisión diaria no tienen autor (Trello no lo informa ahí), así que en el resumen aparecen sin "la movió …".
- No hay timer automático (Fase 6). Quién hizo cada cambio ya queda guardado para eso.
