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
- **Pendiente para el juego**: estrés, límite de 150 s, puntaje y pantalla final (fases 2 y 4), Mobile y
  WhatsApp (fase 3), coach (fase 6), sonido. Idea: delegar una tarea a un compañero en Tino y que aparezca otro
  personaje a hacerla.

## Cómo levantarlo

```powershell
.eria.ps1              # levanta todo y abre http://localhost:3000 (no pide login)
.eria.ps1 reset-demo   # rehace la empresa demo
.eria.ps1 logs | stop | clean
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
