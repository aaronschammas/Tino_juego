    # Informe de auditoría técnica de cambios

    Fecha: 2026-07-24  
    Proyecto: Tino  
    Modalidad: auditoría de solo lectura; no se implementaron correcciones.

    ## 1. Resumen ejecutivo

    **Estado general: REQUIERE CORRECCIONES. Riesgo: alto.**

    La rama `dev` contiene dos commits locales (uno funcional y un merge) con 15 archivos afectados, 664 inserciones y 41 eliminaciones. El cambio agrega onboarding para workspaces vacíos, redirección poslogin, administración de miembros desde el detalle de proyecto y refresco de contexto al completar el registro. No modifica dependencias, Prisma, migraciones, Docker ni archivos de entorno.

    Los contratos HTTP nuevos sí existen en NestJS y usan el cliente común con cookies. Sin embargo, el conjunto no cumple gates básicos de integración: el lint falla en archivos modificados, el typecheck falla en frontend y backend, Prisma no puede validarse sin `DIRECT_URL`, no fue posible comprobar el daemon Docker por permisos, y no existen pruebas del nuevo flujo de miembros incorporado en `projects/[id]`. Los tests Jest pasan, pero no compensan esos fallos ni cubren todos los caminos funcionales solicitados.

    El principal riesgo funcional nuevo es que `workspaceState` calcula y entrega a cualquier miembro conteos de todos los proyectos/tareas/tiempos activos de la organización, aunque el usuario sólo tenga acceso a una parte. Además, login/dashboard deciden el onboarding con ese estado global y pueden omitir el onboarding para un usuario sin proyectos visibles cuando otros proyectos de la organización sí existen.

    ## 2. Alcance analizado

    - Rama actual: `dev`.
    - Base aplicada según la regla solicitada: `origin/main`.
    - `merge-base(HEAD, origin/main)`: `510ddaac327e67652d069e4e52fd4f2fad58e5c7`.
    - En el clon local, `origin/main` y `origin/dev` convergen en la misma base para este rango. No se hizo `fetch`; la conclusión depende de las referencias remotas locales.
    - Estado: `dev...origin/dev [ahead 2]`.
    - Cambio local previo y no atribuible a esta auditoría: `backend/tsconfig.build.tsbuildinfo` modificado.
    - Sin archivos no rastreados al iniciar la auditoría.

    ### Commits

    1. `743a67bbe72b8300ea87fc4f989faa20dd68ccc1` — “mejora usuario” — Nestor Schammas — 2026-07-24 17:00 -03.
    2. `61fad8aee0a39ad4754e5f798c22f76054086d43` — merge de `feature/arreglo_bug_botones` en `dev` — LeonardoMendezR — 2026-07-24 19:08 -03.

    El merge no agrega contenido distinto del commit funcional en el diff efectivo contra la base.

    ### Archivos cambiados

    | Archivo | Estado | Grupo | Riesgo |
    |---|---|---|---|
    | `backend/src/modules/organizations/organizations.service.ts` | M | estado del workspace | Alto |
    | `backend/src/modules/organizations/organizations.service.spec.ts` | M | mocks/tests | Medio |
    | `backend/tsconfig.build.tsbuildinfo` | M + cambio local | artefacto generado versionado | Bajo |
    | `frontend/src/app/dashboard/page.tsx` | M | onboarding dashboard | Alto |
    | `frontend/src/app/dashboard/page.spec.tsx` | M | tests | Medio |
    | `frontend/src/app/login/page.tsx` | M | redirección poslogin | Alto |
    | `frontend/src/app/login/page.spec.tsx` | M | tests | Medio |
    | `frontend/src/app/projects/page.tsx` | M | onboarding de proyectos | Medio |
    | `frontend/src/app/projects/page.spec.tsx` | A | tests | Bajo |
    | `frontend/src/app/projects/[id]/page.tsx` | M | miembros de proyecto | Alto |
    | `frontend/src/app/register/page.tsx` | M | refresh de contexto | Medio |
    | `frontend/src/components/users/EditMemberProjectsModal.tsx` | M | UX de asignación | Medio |
    | `frontend/src/components/users/EditMemberProjectsModal.spec.tsx` | M | tests | Bajo |
    | `frontend/src/hooks/useDashboardV2.ts` | M | carga analytics | Alto |
    | `frontend/src/types/organization.ts` | M | contrato `workspaceState` | Medio |

    No hubo archivos eliminados. No cambiaron `package.json`, lockfiles, `.env.example`, Dockerfiles, Compose, `schema.prisma`, migraciones ni tests E2E.

    ## 3. Cambios detectados por funcionalidad

    ### Onboarding y redirección

    `OrganizationsService.getWorkspaceState()` ejecuta tres conteos concurrentes y agrega `workspaceState` a las dos respuestas de organización. Login consulta `/orgs/me` después de autenticar y redirige a `/projects` si `hasProjects === false`. Dashboard fuerza otra consulta `/orgs/me` y reemplaza analytics por un CTA si no hay proyectos o tareas. Proyectos muestra una pantalla guiada si la lista visible está vacía.

    Riesgo: alto. Se introducen llamadas duplicadas a `/orgs/me`; el criterio del backend es global a la organización, mientras la lista de proyectos es permission-scoped. La semántica no es uniforme.

    ### Miembros de proyecto

    El detalle de proyecto incorpora un modal para agregar miembros vía `POST /projects/:id/members`; también se agregó un handler de eliminación vía `DELETE /projects/:id/members/:userId`, pero no está conectado a ningún control visible y el lint lo detecta como no usado.

    Riesgo: alto. Los endpoints backend ya existían y validan propiedad/rol, pero la UI nueva no tiene tests. La autorización no depende del botón: el controller/service aplican controles de proyecto, lo cual es correcto.

    ### Registro

    Tras actualizar plan o completar registro se reemplaza `updateUser` por `refreshContext()`. Esto mejora la coherencia de organización/membresía, pero depende de que la cookie de sesión ya esté emitida por `/auth/register/complete`.

    Riesgo: medio. Contrato existente y coherente; no hay prueba nueva específica de esta transición.

    ### Dashboard

    `useDashboardV2` evita solicitudes si falta organización activa y mantiene secuenciación de requests. Es consistente con aislamiento de caché: el cliente usa una clave `${organizationId}:${url}`, invalida al cambiar organización y compara la versión de limpieza de auth antes de guardar respuestas.

    Riesgo: medio/alto por interacción: Dashboard dispara `useProjects`, analytics y `/orgs/me`; el nuevo estado se actualiza asincrónicamente y puede mostrar brevemente información de la organización anterior durante un cambio.

    ## 4. Arquitectura y flujos previos

    - El frontend centraliza HTTP en Axios (`frontend/src/lib/api.ts`), con `NEXT_PUBLIC_API_URL`, `withCredentials: true`, refresh único compartido, retry para 502/503/timeout, y limpieza de cache/auth ante 401.
    - `AuthContext` obtiene `/auth/context`, guarda organización activa, configura `X-Organization-Id`, cambia organización vía `/auth/switch-organization`, detiene timer y hace logout.
    - El backend usa cookies, `ValidationPipe` con whitelist/forbid/transform, CORS con credenciales y `CORS_ALLOWED_ORIGINS`, y escucha en `0.0.0.0`.
    - Controllers delegan mayormente en services; la organización activa se resuelve y valida en backend. Proyectos, tareas, timer y analytics aplican scope de organización/proyecto en services, no sólo visibilidad de UI.
    - OAuth dispone de URLs/callbacks separados para login, registro, continuación, invitación y vinculación.
    - La caché HTTP se segmenta por organización activa y se invalida al mutar, cambiar organización o limpiar auth; esto reduce el riesgo de reutilización entre cuentas.
    - Prisma presenta relaciones y cascadas existentes; los commits auditados no las cambian. No se ejecutaron operaciones de base destructivas.

    ## 5. Validación frontend-backend

    Todas las llamadas usan `NEXT_PUBLIC_API_URL`; si falta, Axios usa URL relativa y el navegador llamará accidentalmente a `localhost:3000`. El `.env.example` declara la variable pero vacía. La configuración real fue comprobada sólo por presencia/formato, sin revelar valores.

    ### Matriz de endpoints

    | Frontend / función | Método | Ruta solicitada | Backend / DTO principal | Coincide | Observación |
    |---|---:|---|---|---|---|
    | `AuthContext.login` | POST | `/auth/login` | `AuthController.login`, `LoginDto` | Sí | Cookie, credentials incluidas |
    | `AuthContext.refreshContext` | GET | `/auth/context` | `AuthController.context` | Sí | Protegido; envelope común |
    | interceptor | POST | `/auth/refresh` | `AuthController.refresh` | Sí | Retry único; cookie |
    | `AuthContext.logout` | POST | `/auth/logout` | `AuthController.logout` | Sí | Limpia timer, cache y auth |
    | `AuthContext.switchOrganization` | POST | `/auth/switch-organization` | `SwitchOrganizationDto` | Sí | Actualiza cookie/contexto |
    | login Google | GET | `/auth/google/login-url` | `AuthController` | Sí | Callback frontend/backend configurado por env |
    | registro Google | GET | `/auth/google/register-url` | `AuthController` | Sí | Variable dedicada no documentada en ejemplo |
    | continuación Google | GET | `/auth/google/continue-url` | `AuthController` | Sí | Variable dedicada no documentada en ejemplo |
    | invitación Google | GET | `/auth/google/invite-url` | `AuthController` | Sí | Query token |
    | callbacks Next | GET | `/auth/google/*/callback` | callbacks Nest correspondientes | Sí | Base API obligatoria para evitar puerto 3000 |
    | login posauth | GET | `/orgs/me` | `OrganizationsController.getMyOrganization` | Sí | Nuevo consumo de `workspaceState` |
    | dashboard | GET | `/orgs/me` | mismo controller | Sí | Forzado; duplicable con otros hooks |
    | organizaciones | POST | `/orgs` | `CreateOrganizationDto` | Sí | Protegido |
    | miembros org | GET | `/orgs/members` | controller/service | Sí | Scope activo |
    | invites org | GET/POST | `/orgs/invites` | `InviteMembersDto` | Sí | Scope/owner en backend |
    | rol miembro | PATCH | `/orgs/members/:userId` | `UpdateMemberRoleDto` | Sí | Backend autoriza owner |
    | proyectos miembro | PUT | `/orgs/members/:userId/projects` | `UpdateMemberProjectsDto` | Sí | Valida proyectos de la org |
    | quitar proyecto | DELETE | `/orgs/members/:userId/projects/:projectId` | controller/service | Sí | Backend valida scope |
    | proyectos | GET/POST | `/projects` | `ProjectsController`, `CreateProjectDto` | Sí | Lista permission-scoped |
    | proyecto | GET/PATCH/DELETE | `/projects/:id` | controller/DTO actualización | Sí | Controles backend |
    | nuevo modal | POST | `/projects/:id/members` | `AddProjectMemberDto` | Sí | Contrato nuevo usado correctamente |
    | handler sin UI | DELETE | `/projects/:id/members/:userId` | controller/service | Sí | Código muerto en la página |
    | tareas | GET/POST | `/projects/:projectId/tasks` | `TasksController`, `CreateTaskDto` | Sí | Scope de proyecto |
    | tarea | GET/PATCH/DELETE | `/projects/:projectId/tasks/:taskId` | DTOs de update/status | Sí | Scope de proyecto/tarea |
    | timer | POST | `/time/start` | `StartTimeDto` | Sí | Backend valida tarea/proyecto |
    | timer | GET | `/time/active`, `/time/now`, `/time/history` | `TimeTrackingController` | Sí | Cookie + organización |
    | timer | PATCH | `/time/pause`, `/time/heartbeat`, `/time/:id/link` | DTO correspondiente | Sí | Scope backend |
    | timer | POST | `/time/stop`, `/time/acknowledge-expiration` | controller | Sí | Logout intenta detener primero |
    | analytics | GET | `/analytics/overview` | `AnalyticsController` | Sí | Scope activo |
    | analytics | GET | `/analytics/projects/:id`, `/analytics/users/:id` | controller/service | Sí | Revisado scope backend |
    | dashboard V2 | GET | `/analytics/dashboard/{summary,tasks,time,heatmap,projects,users}` | controller | Sí | Hook bloquea sin org activa |
    | reportes | GET | `/analytics/report/preview`, `/pdf`, `/excel` | controller | Sí | Download usa credentials |
    | Trello | GET/POST | `/trello-import/{connection,boards,preview,import}` | controller/DTOs | Sí | Backend scope; credenciales via body |
    | usuarios | GET/POST/PATCH | `/users`, `/users/:id`, `/users/me` | `UsersController` | Sí | Autorización backend existente |
    | eliminar cuenta | DELETE | `/users/me` | `UsersController.deleteMe` | Sí | Cascadas no cambiadas |
    | admin | varios | `/admin/orgs`, `/admin/users`, `/admin/plans` | `AdminController` | Sí | Guard/rol admin |
    | health | GET | `/health` | `HealthController` | Sí | No pudo probarse en vivo |

    No se encontraron llamadas hardcodeadas a `localhost:3000/auth/...`, nombres internos Docker desde navegador ni prefijos nuevos inexistentes. El riesgo de rutas relativas permanece si `NEXT_PUBLIC_API_URL` falta.

    ## 6. Configuración, Docker y Prisma

    - Compose publica `${BACKEND_PORT_HOST}:${PORT}` y `${FRONTEND_PORT_HOST}:${FRONTEND_PORT_CONTAINER}`; el backend escucha `0.0.0.0`.
    - Frontend depende de backend sólo por orden, sin `healthcheck` ni condición de salud. No garantiza disponibilidad efectiva.
    - Backend arranca con `npx prisma db push && npx prisma generate && npm run start:dev`. `db push` automático es riesgoso para una base con datos y evita el historial controlado de migraciones.
    - No hay servicio PostgreSQL en el Compose actual; `DATABASE_URL` debe apuntar a una base externa/host accesible.
    - Volúmenes aislados de `node_modules` y `.next` son apropiados para hot reload.
    - `.env.example` omite variables consumidas: `GOOGLE_REGISTER_REDIRECT_URI`, `GOOGLE_CONTINUE_REDIRECT_URI`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL` (algunas tienen fallback, las URLs no son equivalentes conceptualmente).
    - Prisma validate falló únicamente porque `DIRECT_URL` no estaba disponible en el proceso. No se revelaron secretos.
    - No hubo cambios de schema/migraciones en el rango. No se ejecutaron `db push`, migrate, seed ni generate.

    ## 7. Resultados de verificaciones

    | Comando | Resultado | Tiempo aprox. | Bloqueante |
    |---|---|---:|---|
    | `git diff --check origin/main...HEAD` | Sin errores reportados | <1 s | No |
    | `npx eslint ...` backend completo, sin `--fix` | Falla; miles de incidencias históricas | 69 s | Sí como gate global |
    | `npx eslint` archivos backend cambiados | Falla: 471 (441 errores, 30 warnings), mayormente deuda previa del archivo | 21 s | Sí |
    | `npx eslint` archivos frontend cambiados | Falla: 3 errores, 14 warnings | 20 s | Sí |
    | `npx tsc --noEmit --incremental false` backend | Falla: 28 errores en specs (firmas y tipos) | 18 s | Sí |
    | `npx tsc --noEmit --incremental false` frontend | Falla: 12 errores en specs/mocks | 23 s | Sí |
    | `npm test -- --runInBand` frontend | 81/81 suites; 946/946 tests; 0 snapshots | 129 s | No, con warnings |
    | Jest frontend focalizado | 4/4 suites; 19/19 tests | 11 s | No |
    | Jest organizations focalizado | 1/1 suite; 44/44 tests | 4 s | No |
    | `npx prisma validate` | Falla P1012: falta `DIRECT_URL` | 14 s | Entorno/bloqueante de validación |
    | `docker compose config --quiet` | Pasa; warning por acceso a config Docker del usuario | 5 s | No |
    | `docker compose ps -a` | No verificable: acceso denegado al daemon | 3 s | No concluyente |

    La salida completa de Jest frontend muestra warnings repetidos de React por actualizaciones fuera de `act`, `window.focus` no implementado, AudioContext no soportado y logs deliberados. Esto no falla suites pero reduce la señal de los tests.

    No se ejecutaron builds porque generan artefactos en el workspace y la fase impone no modificar archivos; tampoco se ejecutó `prisma generate` por la misma razón. No se ejecutaron E2E: no existe script Playwright en `frontend/package.json`. No se levantó Compose porque ejecutaría `prisma db push` y el daemon no fue accesible. Por ello no se declara validado el smoke test en vivo, Google OAuth real ni `/health` real.

    ## 8. Problemas encontrados

    ### AUD-001

    - Severidad: alta.
    - Categoría: regresión/gate de calidad.
    - Archivo y línea: `frontend/src/app/dashboard/page.tsx:106`; `frontend/src/app/projects/[id]/page.tsx:289,850`.
    - Actual: el lint de los archivos cambiados falla por `setState` sincrónico dentro de effects y `any` explícito.
    - Esperado: cero errores de lint antes de integrar.
    - Evidencia: 3 errores y 14 warnings en el comando focalizado.
    - Impacto: pipeline bloqueado y efectos con renders encadenados.
    - Causa probable: implementación sin ejecutar lint no mutante.
    - Corrección: derivar/resetear estado al abrir/cambiar clave sin effect sincrónico; tipar el error como `unknown`.
    - Tests: prueba de cambio de organización y apertura/cierre repetida del modal.

    ### AUD-002

    - Severidad: alta.
    - Categoría: regresión de contrato/typecheck.
    - Archivo y línea: múltiples specs backend de projects/tasks/controllers y specs frontend de hooks/context.
    - Actual: typecheck falla con 28 errores backend y 12 frontend.
    - Esperado: ambos proyectos deben compilar con `tsc --noEmit`.
    - Evidencia: firmas de controllers desactualizadas y mocks de `AuthContextType`/`Plan` incompletos.
    - Impacto: no existe garantía estática integral; un CI con typecheck bloqueará el merge.
    - Causa probable: tests ejecutados por ts-jest sin typecheck estricto y evolución de contratos sin actualizar mocks.
    - Corrección: actualizar llamadas y fixtures sin relajar tipos.
    - Tests: convertir el typecheck en gate explícito.

    ### AUD-003

    - Severidad: media.
    - Categoría: divulgación de información/semántica de permisos.
    - Archivo y línea: `backend/src/modules/organizations/organizations.service.ts:33-60,218,321`.
    - Actual: cualquier miembro que puede consultar `/orgs/me` recibe `projectCount`, `taskCount` y `timeEntryCount` globales de la organización; no se filtra por proyectos accesibles.
    - Esperado: exponer sólo booleanos necesarios o conteos permission-scoped, con contrato explícito.
    - Evidencia: filtros sólo por `organizationId` y proyecto activo.
    - Impacto: revela volumen de actividad ajena y conduce onboarding incorrecto para miembros con acceso parcial.
    - Causa: reutilizar estado global para una experiencia individual.
    - Corrección: definir semántica; para miembros filtrar por `projectMembers` o devolver flags mínimos globales autorizados.
    - Tests: dos usuarios de la misma org con conjuntos de proyectos distintos.

    ### AUD-004

    - Severidad: media.
    - Categoría: regresión UX/autorización percibida.
    - Archivo y línea: `frontend/src/app/login/page.tsx:129-143`; `frontend/src/app/dashboard/page.tsx:98-137`.
    - Actual: poslogin y dashboard usan estado global de organización, mientras `/projects` devuelve proyectos visibles al usuario.
    - Esperado: redirección/onboarding coherente con recursos accesibles.
    - Evidencia: `workspaceState.hasProjects` procede de todos los proyectos activos; `useProjects` es scoped.
    - Impacto: miembro sin asignaciones puede caer en dashboard sin datos ni CTA adecuado.
    - Corrección: usar estado visible para el usuario o distinguir `organizationHasProjects` de `userHasAccessibleProjects`.
    - Tests: miembro sin proyectos en una org que sí tiene proyectos/tareas.

    ### AUD-005

    - Severidad: media.
    - Categoría: cobertura insuficiente.
    - Archivo y línea: `frontend/src/app/projects/[id]/page.tsx:227-265,747-910`.
    - Actual: se agregaron ~225 líneas y dos mutaciones sin spec de la página; el handler de eliminar miembro no se usa.
    - Esperado: cobertura de éxito, 403/404, doble click, refresh y cierre del modal; eliminar código muerto o conectar la acción.
    - Evidencia: tests focalizados no incluyen `projects/[id]/page.spec.tsx`; el archivo no existe.
    - Impacto: alta superficie sin protección contra regresión.
    - Corrección: extraer modal/comandos a componente/hook testeable y conectar/remover handler.
    - Tests: los indicados arriba.

    ### AUD-006

    - Severidad: media.
    - Categoría: configuración/operación.
    - Archivo y línea: `docker-compose.yml:20-21`.
    - Actual: cada arranque ejecuta `prisma db push`; no hay healthcheck y frontend depende sólo del orden.
    - Esperado: migraciones controladas, healthcheck y dependencia por salud o manejo explícito de indisponibilidad.
    - Evidencia: comando Compose y ausencia de sección `healthcheck`.
    - Impacto: drift/destrucción accidental de esquema y arranques intermitentes.
    - Corrección: usar migrate deploy en un paso controlado; agregar healthcheck `/health`.
    - Tests: levantar desde base vacía y base migrada; simular backend demorado.

    ### AUD-007

    - Severidad: media.
    - Categoría: configuración.
    - Archivo y línea: `.env.example`; usos en `backend/src/modules/auth/auth.service.ts`.
    - Actual: variables OAuth de registro/continuación y TTLs no están documentadas.
    - Esperado: ejemplo completo sin secretos, con nombres coherentes.
    - Evidencia: búsqueda de `process.env` contra `.env.example`.
    - Impacto: callbacks erróneos o fallback accidental entre flujos.
    - Corrección: documentar todas las variables y validarlas al inicio.
    - Tests: bootstrap con matriz de variables faltantes.

    ### AUD-008

    - Severidad: baja.
    - Categoría: deuda técnica preexistente.
    - Archivo y línea: `backend/src/modules/organizations/dto/organization-response.dto.ts:64`.
    - Actual: `inviteLink` contiene una interpolación mal formada que incorpora texto de fallback dentro de la URL.
    - Esperado: `${frontendBase}/invite?token=...` con fallback resuelto antes.
    - Evidencia: inspección estática; no pertenece a los commits recientes.
    - Impacto: enlaces de invitación inválidos según configuración.
    - Corrección: normalizar base URL y cubrir ambos casos.
    - Tests: con y sin `FRONTEND_URL`.

    ### AUD-009

    - Severidad: baja.
    - Categoría: repositorio/deuda.
    - Archivo: `backend/tsconfig.build.tsbuildinfo`.
    - Actual: artefacto generado está versionado y además tenía un cambio local previo.
    - Esperado: artefactos incrementales ignorados o reproducibles sin ruido en commits.
    - Impacto: diffs innecesarios y conflictos.
    - Corrección: evaluar retirarlo del índice y agregar ignore en una fase aprobada.

    ## 9. Regresiones posibles

    - Redirección incorrecta después de login para miembros con acceso parcial.
    - Flash de estado de otra organización durante cambio activo antes de completar el effect.
    - Peticiones duplicadas a `/orgs/me` y analytics/proyectos durante bootstrap.
    - Modal de miembros con errores no cubiertos, acciones repetidas o inconsistencia si uno de los dos refresh falla.
    - Registro completado con contexto aún no disponible si la cookie no se establece como espera el frontend.
    - Dashboard sin onboarding si `/orgs/me` falla: el catch establece `null` y continúa con la UI anterior.

    ## 10. Seguridad

    No se encontró un endpoint nuevo sin autorización backend. Agregar/quitar miembros exige controles del controller/service; proyectos, tareas, timer y analytics usan organización/proyecto activo. CORS habilita credenciales y usa allowlist. Cookies se configuran según entorno; el cliente siempre incluye credenciales.

    Riesgos pendientes: conteos globales expuestos por `workspaceState`; configuración OAuth incompleta; imposibilidad de probar SameSite/Secure y callbacks reales; `NEXT_PUBLIC_API_URL` ausente degrada silenciosamente a rutas relativas; no se ejecutaron pruebas cruzadas reales entre dos organizaciones.

    No se imprimieron valores secretos. No se detectaron secretos nuevos en el diff.

    ## 11. Deuda técnica separada de bugs

    - Lint backend con cientos/miles de incidencias históricas y script oficial que aplica `--fix` automáticamente.
    - Type errors en fixtures/specs pese a Jest verde.
    - Logs y warnings numerosos en tests frontend.
    - Componente `projects/[id]/page.tsx` demasiado grande y con responsabilidades de tareas, timer, historial y miembros.
    - Artefacto `.tsbuildinfo` versionado.
    - Variables de entorno sin esquema de validación central.
    - Handler de eliminación de miembro sin uso.

    ## 12. Pruebas funcionales mínimas

    Verificado por tests/inspección: login válido/inválido, contexto, refresh/logout, guard de rutas, cambio de organización, caché segmentada, CRUD de proyectos/tareas a nivel unitario, timer, analytics, Trello, permisos principales y organizaciones. Los 946 tests frontend y tests backend focalizados pasaron.

    No verificado de extremo a extremo: Google OAuth real, cookies en navegador real, dos pestañas reales, aislamiento con dos organizaciones en PostgreSQL, cascadas reales, Docker en ejecución, `/health` vivo, smoke de puertos, importación Trello contra servicio real y Playwright. No se declara que estos flujos funcionen.

    ## 13. Cambios recomendados

    ### Bloqueantes antes de mergear

    1. Corregir los 3 errores de lint introducidos/visibles en archivos frontend cambiados.
    2. Dejar typecheck frontend y backend en verde sin relajar tipos.
    3. Definir y corregir la semántica permission-scoped de `workspaceState`.
    4. Agregar tests para `projects/[id]` y para miembro sin proyecto visible en organización no vacía.
    5. Ejecutar builds limpios y Prisma validate con entorno completo.

    ### Importantes no bloqueantes

    1. Eliminar llamadas duplicadas a `/orgs/me` y evitar flash entre organizaciones.
    2. Completar `.env.example` y validación de configuración.
    3. Sustituir `db push` automático y agregar healthchecks.
    4. Limpiar warnings de tests para recuperar señal.

    ### Mejoras futuras

    1. Extraer `ProjectMemberModal` y lógica de miembros a componente/hook.
    2. Retirar `.tsbuildinfo` del control de versiones.
    3. Separar el lint de chequeo (`eslint`) del formateo/corrección (`eslint --fix`).
    4. Incorporar E2E de autenticación, multi-org, timer y Trello.

    ## 14. Veredicto

    **REQUIERE CORRECCIONES.**

    La implementación conserva buena parte de la arquitectura y los endpoints nuevos coinciden, pero no es segura para integrar mientras lint y typecheck fallen, el onboarding mezcle estado global con acceso individual, y el flujo de miembros carezca de cobertura. Después de corregir esos puntos deben repetirse typecheck, lint, tests, builds, Prisma validate y smoke Docker en un entorno controlado.

    ## 15. Estado posterior a las correcciones

    Actualización: 2026-07-24.

    - `workspaceState` fue reemplazado por booleanos permission-scoped: `hasAccessibleProjects` y `hasAccessibleTasks`. Ya no expone conteos globales.
    - Owners y superadmins conservan acceso global; miembros se filtran por `ProjectMember`, igual que `ProjectsService`.
    - Dashboard no consulta analytics hasta confirmar tareas accesibles y descarta inmediatamente snapshots de otra organización.
    - Miembros sin proyectos reciben un estado específico sin CTA de creación reservado a owners.
    - El modal de miembros fue extraído, el handler muerto eliminado y se agregaron cuatro pruebas de interacción.
    - Typecheck frontend y backend: exitosos.
    - Frontend: 82/82 suites, 951/951 tests y build de producción exitoso.
    - Backend: 73/73 suites, 1215/1215 tests y compilación de producción exitosa.
    - Prisma validate y `docker compose config`: exitosos.
    - Compose ya no usa `prisma db push`; usa migraciones versionadas y espera el healthcheck del backend.
    - `.env.example` documenta TTLs y callbacks OAuth faltantes, sin valores secretos.

    El veredicto técnico posterior a estas correcciones pasa a **APROBADO CON OBSERVACIONES**: queda deuda histórica de lint backend fuera del alcance y no se realizó smoke Docker en vivo por falta de acceso al daemon, pero los bloqueantes atribuibles a los cambios recientes quedaron resueltos.
