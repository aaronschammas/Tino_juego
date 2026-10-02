# Progreso — Apagá el incendio con Tino

Plan: `Tino plan/Plan_Juego_Feria_Tino.pdf`. Cada fase se parte en pasos chicos que se prueban solos
y se cierran con un commit.

## Fase 0 — Copia y limpieza

| Parte | Qué | Estado | Cómo se probó |
|---|---|---|---|
| 0.1 | git, limpieza de raíz (.github, docs, Resumenes, test-results), CLAUDE.md, grafo local | ✅ | grafo responde desde esta carpeta |
| 0.2 | Backend: sin admin, plans, trello-import, integrations, digest de WhatsApp ni piloto | ✅ | `tsc --noEmit` + jest: 93 suites, 1443 tests |
| 0.3 | Frontend: sin admin, registro, invitaciones, Google, perfil, workspace, Trello, PWA, legales | ✅ | `tsc --noEmit` + jest: 93 suites, 985 tests; lint sin warnings nuevos |
| 0.4 | `docker-compose.feria.yml` + `.env.feria.example` (reemplazan docker-compose.yml y .env.example) | ⏳ compose válido; falta levantarlo | `docker compose -f docker-compose.feria.yml up -d --build` y probar login, proyectos, timer, dashboard, mobile y asistente |

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

## Próximas fases

- **Fase 1 — Modo demo (backend)**: partes previstas
  1.1 DemoModule con `DEMO_MODE` + `POST /demo/session`
  1.2 DemoSeedService (empresa, usuarios, historial) + `POST /demo/reset { scenario }`
  1.3 `GET /demo/state`
  1.4 CapturingWhatsAppClient + `POST /demo/whatsapp/inbound` + `GET /demo/whatsapp/messages`
- **Fase 2 — Esqueleto de /feria** (escenario Web de punta a punta).
- Fases 3 a 7 según el plan.
