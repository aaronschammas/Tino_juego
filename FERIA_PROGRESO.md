# Progreso — Apagá el incendio con Tino

Plan: `Tino plan/Plan_Juego_Feria_Tino.pdf`. Cada fase se parte en pasos chicos que se prueban solos
y se cierran con un commit.

## Fase 0 — Copia y limpieza

| Parte | Qué | Estado | Cómo se probó |
|---|---|---|---|
| 0.1 | git, limpieza de raíz (.github, docs, Resumenes, test-results), CLAUDE.md, grafo local | ✅ | grafo responde desde esta carpeta |
| 0.2 | Backend: sin admin, plans, trello-import, integrations, digest de WhatsApp ni piloto | ✅ | `tsc --noEmit` + jest: 93 suites, 1443 tests |
| 0.3 | Frontend: sin admin, registro, invitaciones, Google, perfil, workspace, Trello, PWA, legales | ✅ | `tsc --noEmit` + jest: 93 suites, 985 tests; lint sin warnings nuevos |
| 0.4 | `docker-compose.feria.yml` + `.env.feria.example` + `feria.ps1` + empresa demo base | ✅ | En Docker: login por el proxy, dashboard con 12 tareas y 181 h, heatmap, /users, /mobile, asistente |

Verificación del grafo (4.7): `graphify explain` no encuentra TrelloImportService, AdminService, PlansService,
WhatsAppDigestService ni IntegrationsController; PermissionUser, CurrentUser, PrismaService y useAuth siguen.
`graphify query "Trello"` solo devuelve una migración de Prisma (el schema no se toca).

### Decisiones tomadas en la fase 0

- **Carpeta de trabajo**: esta copia (`Tino juego`) en vez de `Tino\Tino_feria`. Es la rama dev con el
  WhatsApp endurecido (commit b1cb175), sin `.git`, `.env` ni `graphify-out`: equivale al paso 4.1.
- **Digest de WhatsApp**: `WhatsAppDigestService` estaba inyectado en `whatsapp.service.ts` (lo mostró
  `graphify affected`). Se quitó `handleDigest()`; "novedades"/"trello" ahora van al asistente como texto libre.
- **Google OAuth**: está repartido en auth.service, users y organizations; no se aísla sin tocar el núcleo.
  Queda inactivo sin credenciales (alternativa prevista en el plan). Sus rutas del frontend se borraron.
- **Links a rutas borradas**: además de la Navbar (pedida en el plan) se quitaron el ícono de perfil del
  header mobile y los botones "Ver planes" de /users, porque dentro del iframe llevarían a un 404.
- **Redirecciones a /register y /auth/setup-password** (AuthContext, ProtectedLayout, login): se dejaron.
  Solo saltan para usuarios sin contraseña, organización o plan; el usuario demo los tendrá todos.
- **Landing (`app/page.tsx`) → /feria**: se hace en la fase 2, cuando /feria exista.
- **package.json** (phaser, zustand): se agregan en la fase 2, cuando se usen.

## Acceso público (sin login)

Pedido para poder probar el juego sin credenciales:

- **Backend**: con `DEMO_MODE=true`, `AuthGuard` usa al usuario demo (`DEMO_USER_EMAIL`) cuando la request no
  trae una sesión válida. Todos los endpoints siguen recibiendo un usuario real (organización, permisos y datos),
  pero nadie tiene que loguearse. Con `DEMO_MODE` apagado el guard se comporta igual que en Tino original.
  **Nunca activar DEMO_MODE fuera de la feria.**
- **Frontend**: se borraron `/login` y `useRequireAuth`; los layouts protegidos ya no redirigen a /login
  (si no hay usuario muestran "No se pudo conectar con Tino") y se quitaron los botones de cerrar sesión.
- **Inicio**: `/` es solo el cartel "Empezar a jugar", que lleva a `/feria`.
- **/feria**: pantalla dividida, Tino real (`/dashboard`) a la izquierda y el prototipo pixel art
  (`frontend/public/juego`) a la derecha. Es la base de la fase 2: ahí entran Phaser, el store y las reglas.

## Juego conectado a Tino

- **Backend** (`src/modules/demo`, solo con `DEMO_MODE=true`): `GET /demo/scenarios`, `POST /demo/reset`
  (crea el proyecto "Feria · <escenario>" con sus tareas para el usuario demo) y `GET /demo/state` (tareas,
  segundos trabajados según los timers reales y timer activo). Escenarios en `demo-scenarios.ts`.
- **/feria** (`src/game/FeriaGame.tsx`): elige escenario (URL o rotación), lo reinicia y muestra el proyecto
  real de Tino a la izquierda y el juego a la derecha. Botones para cambiar de escenario y reiniciar.
- **Juego** (`frontend/public/juego`): consulta el estado cada segundo. La tarea con timer activo la hace el
  personaje solo; con los segundos de timer el problema se resuelve, y al marcarla Hecha también.
  Avisa si se eligió una tarea menos urgente. Tres escenarios con acciones propias: oficina en llamas,
  casa patas arriba y jardín abandonado.
- **Decisión**: se siguió con el motor vanilla del prototipo en vez de Phaser (sin dependencias nuevas y ya
  resuelve proyección, orden de dibujado y escala pixel perfect). Se puede migrar si hace falta.
- **Sin internet**: el juego ya no carga Google Fonts; si "Press Start 2P" no está instalada usa una
  monoespaciada del sistema.
- **Consecuencias, subtareas y apagado automático** (`POST /demo/tick`): cada problema desatendido acumula
  peligro (el doble si se trabaja en algo menos urgente) y al llegar a cada etapa crea la consecuencia en Tino
  (fuego que se extiende como subtarea, explosión, reclamo, cucarachas...). Cuando el personaje termina, el
  backend apaga el timer con `TimeTrackingService.stopTime`; /feria refresca el Tino del iframe disparándole
  sus eventos `task:updated`, `time:updated` y `focus`. Escenarios de 5-6 tareas iniciales y hasta 3 consecuencias.
- **Partida, puntaje y pantalla final**: la partida dura 150 s desde el primer timer y termina antes si todos
  los problemas quedan Hechos. El backend devuelve `round` (estado, motivo, segundos) y `score` (fuegos apagados,
  eficiencia de priorización, tiempo y puntos) y apaga el timer al terminar. El juego muestra reloj, barra de estrés
  y puntos; al final avisa a /feria (`feria:finished`), que muestra el dashboard real con la franja de KPIs y
  "¿Jugás el siguiente?" (20 s de estadísticas + 10 s de cuenta regresiva; si nadie toca, vuelve al inicio).
- **Correcciones del análisis**: el backend manda `dangerRate` por tarea (el timer en pausa ya no duplica el
  peligro y el cliente no recalcula la regla), las consecuencias miden su peligro desde que aparecen, los ticks del
  mismo usuario van en fila (dos pestañas no duplican consecuencias), las partículas se dibujan en su profundidad y
  se reciclan, el panel se actualiza sin reconstruirse y el personaje recalcula el camino si aparece un objeto.
- **Coach y juego más grande**: la escena escala para llenar el espacio (antes quedaba en 1× en medio monitor),
  el globo dice frases cortas sin salirse de la escena y un coach debajo enseña a usar Tino con diálogos que van
  saltando (bienvenida + pasos 1 a 3). /feria resalta dentro de Tino el control a tocar (`src/game/tinoCoach.ts`).
  En pantallas de 768 px o más, Tino muestra los botones de las tarjetas sin subtareas solo al pasar el mouse: el
  coach lo avisa.
- **Duración de las tareas y dashboard de la partida**: las tareas del juego se crean con su duración como
  estimación (`estimatedHours` = segundos de trabajo / 3600). El modal del cronómetro, cuando la estimación dura menos
  de un minuto (solo pasa con el juego: Tino no deja cargarlas a mano), muestra "Esta tarea tardará N segundos" con la
  duración fija en vez de los 30 min por defecto. La pantalla final dice "¡Gracias por jugar!" y abre
  `/dashboard?projectId=<proyecto de la partida>`, que el dashboard toma como filtro inicial.
  El dashboard redondea las horas registradas a 2 decimales (36 s), así que tareas de pocos segundos pueden verse en 0.
- **Fin de partida y vuelta a cero**: la franja final es una sola fila (gracias + KPIs) y "¿Jugás el siguiente?"
  es una barra fina; "Seguir mirando" no vuelve a preguntar. La partida terminada queda marcada en Proyectos
  ("Tu última partida", primera de la lista; se guarda en localStorage `feria:last-game-project`). Al volver al
  inicio (botón o fin de la cuenta regresiva) /feria llama a `POST /demo/reset-all`, que borra los proyectos
  "Feria · ..." con sus tareas y horas, y olvida la marca: el próximo visitante empieza de cero.
- **Temporizador y menús de Tino**: con una tarea del juego, el temporizador cuenta desde su duración (p. ej. 12 s)
  en vez de 1 min. En las tarjetas, abrir un menú de estado cierra los otros y elegir una opción lo cierra.
- **Finalizar partida y recorrido del Dashboard**: el botón "Finalizar partida" de /feria llama a
  `POST /demo/finish`: la partida termina en ese momento (motivo `ended`, guardado en memoria del backend hasta el
  próximo reset), se apaga el timer y se pasa directo a las estadísticas. "Seguir mirando" arranca un recorrido de
  12 pasos por el Dashboard real (`src/game/dashboardTour.ts`): filtros, los 4 KPIs, fricción y riesgo, estados,
  prioridades, desvío, mapa de actividad, tareas que requieren atención y Proyectos. Cada paso resalta su tarjeta
  dentro del Dashboard con el mismo aro del coach; se puede cerrar y volver a abrir con "Ver recorrido del Dashboard".
- **Velocidad**: el frontend de la feria corre en modo producción (`next build` + `next start`). En modo desarrollo
  sobre la carpeta de Windows cada pedido a la API pasaba por el proxy en ~1 s y cada página compilaba al entrar
  (hasta 8 s); ahora las páginas responden en ~30 ms, el JS baja de 1,3 MB a 290 KB y el dashboard de la pantalla
  final muestra datos en ~0,9 s. El dashboard toma `?projectId=` como filtro inicial (antes cargaba toda la empresa
  y después filtraba) y la pantalla final desmonta los iframes del juego y de Tino, que seguían consultando.
  Contra: cada arranque del contenedor compila (1-3 min) y los cambios de código necesitan
  `docker compose -f docker-compose.feria.yml restart frontend`; para programar, `.\feria.ps1 dev`.
- **Pendiente para el juego**: Mobile y WhatsApp (fase 3), modo atracción (fase 6), sonido. Idea: delegar
  una tarea a un compañero en Tino y que aparezca otro personaje a hacerla.

## Versión web para el celular (`web/`)

Pedido tras la validación: contexto de oficina, minijuegos y jugable desde el celular en un servidor, por un día y
sin base de datos. Es una carpeta estática aparte (HTML/CSS/JS sin build) que se sube tal cual a GitHub Pages;
el juego de la feria (`frontend/public/juego`) no se tocó.

- **Sin backend**: `web/js/sim.js` hace en el navegador lo que hacía `/demo/tick` (tareas, timer, vencimientos,
  errores de prioridad, puntos). El panel de Tino real se reemplaza por `web/js/tino.js`, tarjetas con el estilo de
  Tino (prioridad, estado, "Vence en", Real, ▶ Iniciar / ⏸ Pausar y ✓ Completar).
- **Oficina**: un solo escenario con 4 tareas (internet caído, reclamo por mail, café del jefe y cliente que llega
  a los 20 s). Arte nuevo: rack con cables, jefe en su escritorio, puerta con lector, cafetera.
- **Minijuegos estilo Among Us** (`web/js/minigames/`): conectar cables, desbloquear la PC (1 al 10), café del jefe
  con opciones (tipo, azúcar, taza) y pasar la tarjeta. Se abren cuando el personaje llega; resolverlos apaga el
  timer y cerrarlos con ✕ lo pausa.
- **Vencimientos**: completar después del plazo deja la tarea como "Completada vencida" (40 pts en vez de 100).
- **Sin intro ni coach**: solo señales visuales (el botón a tocar late, la tarea más urgente tiembla si se elige mal).
- **Final**: completadas a tiempo, vencidas, sin terminar, priorización, tiempo total, barras por tarea, puntos,
  mejor puntaje del celular y "Jugar otra vez".
- Probado en el navegador vertical (375x812), acostado (812x375) y PC (1280x720), con una partida completa.
  Tests: `cd web; node --test tests/*.test.js` (21 tests). Pasos de subida en `web/README.md`.
- Publicado en GitHub Pages: https://aaronschammas.github.io/Tino_juego/web/

### Más parecido a Tino (revisión tras probarlo)

El panel simple (▶ Iniciar / ✓ Completar) no se parecía a Tino. Se rehízo copiando la app real
(`Tino_tasks-dev`: `TaskItem`, `TaskList`, `StartTimerDurationModal`, `TimerWidget`, `projects/[id]/page.tsx`,
reglas de `tasks.service` y `time-tracking.service`):

- Página del proyecto con indicadores (Tareas, Estimado total, Tiempo real, Subtareas), Lista / Tablero con las
  4 columnas, tarjetas de TaskItem (tipo, avatar, prioridad, estado, 📅, Real / Est) y Seguimiento.
- Cronómetro: ⏱️ → "Configurar duración" (propone lo que falta de la estimación) → "Iniciar cronómetro"; se asigna
  sola y pasa a En progreso; "Ya tienes un timer activo. Detenlo antes de cambiar de tarea."; no hay timer en tareas
  padre ("Inicia el timer en una subtarea") y el padre sigue el estado de sus subtareas (`resolveParentStatus`).
- Temporizador flotante (pausa, Finalizar y Completar Tarea, Detener temporizador), botón "Temporizador" con
  "Iniciar seguimiento", y "¡Tiempo cumplido!" con +5/+10/+15/+30 min o "Finalizar aquí".
- Menú → de estados (Mover a En progreso / Bloqueadas / Completadas...). Completar exige el trabajo hecho.
- Reloj de oficina acelerado (1 s = 1 min, desde 09:00) para que duraciones y vencimientos se vean como en Tino.
- Tareas: "Se cayó el sistema" (padre) con "Reconectar los cables del rack" y "Reiniciar el servidor", "Llevarle un
  café al jefe" y "Recibir al cliente" (llega 09:20). Final con tiempo real vs. estimado por tarea.
- Probado con una partida completa en el navegador (vertical y PC), incluido el tiempo cumplido. 24 tests.

### Informe y sin cartel de tiempo cumplido

- Se sacó el cartel "¡Tiempo cumplido!" (se veía como una publicidad y cortaba el minijuego). Al cumplirse la duración
  el cronómetro sigue, como el TimerWidget de Tino: "TIEMPO CUMPLIDO", contador "Extra" en rojo y +5/+10/+15 min.
- "📄 Exportar informe" en el proyecto abre el ReportModal de Tino ("Informe · Resumen operativo") con los datos de la
  partida: Completadas, No completadas (vencidas), Tiempo real, Desvío, Tareas por estado, Tiempo real vs. estimado
  y Tareas con más tiempo registrado; filtros de usuario y estado; Excel (CSV con ; y BOM) y PDF (imprime solo el
  informe). Al terminar la partida se abre solo con el resultado arriba (puntos, récord, priorización) y "Jugar otra vez";
  reemplaza a la pantalla final anterior. 25 tests.

## Cómo levantarlo

```powershell
.\feria.ps1              # levanta todo y abre http://localhost:3000 (no pide login; frontend en producción)
.\feria.ps1 dev          # igual, con el frontend en modo desarrollo (recarga en vivo, más lento)
.\feria.ps1 reset-demo   # rehace la empresa demo
.\feria.ps1 logs | stop | clean
```

Al arrancar, el backend aplica migraciones, corre `prisma/seed.ts` (planes y roles) y `prisma/seed-feria.ts`
(empresa "Tino Demo", usuario demo, 5 compañeros, 3 proyectos, 12 tareas y 3 semanas de horas). El seed demo
solo se carga si la empresa no existe, así que reiniciar no borra lo que se hizo.

### Hallazgos al levantarlo

- `npm run prisma:seed` no compilaba en el Tino original: `tsconfig.json` tiene `"types": ["jest"]` y deja
  afuera los tipos de Node. Los seeds se corren con `ts-node --transpile-only` (el tipado lo cubren tsc y jest).
- El dashboard toma por defecto el rango desde la creación de la organización y cuenta tareas por `createdAt`:
  el seed fecha empresa, proyectos y tareas antes del historial para que los gráficos tengan datos.
- El proxy `app/api/[...path]` rechaza con 403 lo que no viene del mismo origen: confirma que /feria y los
  iframes tienen que vivir en el mismo Next.js (como dice el plan).
- El asistente solo reconoce "atrasadas" con frases tipo "tareas atrasadas/vencidas"; "¿qué está atrasado?"
  da `unknown`. Para el coach de Mobile y WhatsApp hay que usar frases que funcionen o ampliar los patrones.

## Próximas fases

- **Fase 1 — Modo demo (backend)**: partes previstas
  1.1 DemoModule con `DEMO_MODE` + `POST /demo/session`
  1.2 DemoSeedService + `POST /demo/reset { scenario }` (la base ya está en `src/modules/demo/demo-seed.ts`;
      falta sumar las tareas de cada escenario y el WhatsApp vinculado)
  1.3 `GET /demo/state`
  1.4 CapturingWhatsAppClient + `POST /demo/whatsapp/inbound` + `GET /demo/whatsapp/messages`
- **Fase 2 — Esqueleto de /feria** (escenario Web de punta a punta).
- Fases 3 a 7 según el plan.
