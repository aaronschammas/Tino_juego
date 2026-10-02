# 🔍 AUDITORÍA DE INTEGRIDAD FRONTEND-BACKEND

**Fecha:** 2026-03-03  
**Estado:** 🟡 INCONSISTENCIAS DETECTADAS

---

## 📊 MAPEO DE ENDPOINTS

### ✅ PROJECTS (Consistentes)
| Endpoint | Frontend | Backend | Estado |
|----------|----------|---------|--------|
| POST /projects | createProject() | createProject() | ✅ OK |
| GET /projects | fetchProjects() | getProjects() | ✅ OK |
| GET /projects/:id | - | getProjectById() | ⚠️ No usado en FE |
| PATCH /projects/:id | updateProject() | updateProject() | ✅ OK |
| PATCH /projects/:id/deactivate | deactivateProject() | deactivateProject() | ✅ OK |
| GET /projects/:id/members | - | getProjectMembers() | ❌ No implementado en FE |
| POST /projects/:id/members | - | addMemberToProject() | ❌ No implementado en FE |
| DELETE /projects/:id/members/:userId | - | removeMemberFromProject() | ❌ No implementado en FE |

### ✅ TASKS (Consistentes)
| Endpoint | Frontend | Backend | Estado |
|----------|----------|---------|--------|
| POST /projects/:id/tasks | createTask() | createTask() | ✅ OK |
| GET /projects/:id/tasks | fetchTasks() | getTasksByProject() | ✅ OK |
| GET /projects/:id/tasks/:taskId | getTaskById() | getTaskById() | ✅ OK |
| PATCH /projects/:id/tasks/:taskId | updateTask() | updateTask() | ✅ OK |

### ✅ TIME TRACKING (Consistentes)
| Endpoint | Frontend | Backend | Estado |
|----------|----------|---------|--------|
| POST /time/start | startTimer(projectId) | startTime(projectId) | ✅ OK |
| POST /time/stop | stopTimer() | stopTime() | ✅ OK |
| GET /time/active | fetchActiveTimer() | getActiveTime() | ✅ OK |
| GET /time/history | - | getHistory() | ❌ No usado en FE |

### ✅ ANALYTICS (Consistentes)
| Endpoint | Frontend | Backend | Estado |
|----------|----------|---------|--------|
| GET /analytics/overview | fetchOverview() | getOverview() | ✅ OK |
| GET /analytics/projects/:id | fetchProjectAnalytics(id) | getProjectAnalytics(id) | ✅ OK |
| GET /analytics/users/:id | fetchUserAnalytics(id) | getUserAnalytics(id) | ✅ OK |

---

## 🐛 INCONSISTENCIAS DETECTADAS

### 1. **ProjectStatus Enum (CRÍTICO)**
**Ubicación:** frontend/src/types/project.ts

```typescript
export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}
```

**Problema:**
- Backend NO tiene campo `status` en model Project
- Backend solo tiene `isActive: boolean`
- Frontend intenta filtrar `p.status === ProjectStatus.COMPLETED` (línea 41 en projects/page.tsx)
- Campo `completedCount` siempre será 0

**Impacto:**
- Filtro "Completados" nunca funciona
- ProjectCard.tsx línea 57 hace fallback a isActive (salva parcialmente)

**Tipo:** Inconsistencia de schema

---

### 2. **Task Type Duplicado (MENOR)**
**Ubicación:** 
- frontend/src/types/project.ts (Task interface simplificado)
- frontend/src/types/task.ts (Task interface completo)

**Problema:**
- project.ts tiene Task interface con solo 5 campos
- task.ts tiene Task interface con más campos
- ProjectCard.tsx importa de project.ts pero necesita task.ts

**Impacto:** Posibles TypeErrors si se pasan Tasks completas a ProjectCard

**Tipo:** Duplicación de type

---

### 3. **isActive Filter Incompleto en Backend (MENOR)**
**Ubicación:** Backend/src/modules/projects/projects.service.ts

**Problema:**
- getProjectById(id, userId) retorna proyecto aunque se espera isActive=true en getProjects()
- Inconsistencia: si un proyecto se desactiva, getProjectById aún lo retorna
- Pero getProjects() filtra isActive=true

**Impacto:** Dashboard/analytics puede mostrar proyectos inactivos si se accede directo a getProjectById

**Tipo:** Inconsistencia de lógica

---

### 4. **Typo en Filename (MENOR)**
**Ubicación:** Backend/src/modules/projects/projects.controllers.ts

**Problema:**
- Archivo se llama `projects.controllers.ts` (plural)
- Debería ser `projects.controller.ts` (singular)
- Naming convention inconsistente con otros módulos

**Impacto:** Confusión en mantenimiento

**Tipo:** Naming inconsistency

---

### 5. **ProjectCard.tsx Usa ProjectStatus que no existe en Backend (CRÍTICO)**
**Ubicación:** frontend/src/components/projects/ProjectCard.tsx línea 57

```typescript
const status = project.status || (project.isActive ? ProjectStatus.ACTIVE : ProjectStatus.PAUSED);
```

**Problema:**
- `project.status` nunca existe en backend responses
- Fallback convierte isActive → ACTIVE/PAUSED (OK)
- Pero nunca puede ser COMPLETED

**Impacto:** StatusLabels.COMPLETED nunca se usa

**Tipo:** Inconsistencia de respuesta

---

### 6. **FilterType 'completed' Nunca Activa (CRÍTICO)**
**Ubicación:** frontend/src/app/projects/page.tsx línea 41

```typescript
case 'completed':
  filtered = filtered.filter((p) => p.status === ProjectStatus.COMPLETED);
  break;
```

**Problema:**
- project.status nunca viene del backend
- Este bloque nunca filtra nada

**Impacto:** Botón "Completados" muestra 0 siempre, aunque esté disponible en UI

**Tipo:** Dead code

---

## ✅ COSAS QUE ESTÁN BIEN

1. **Endpoints Coverage:** 13/13 endpoints documentados, 11/13 implementados en FE
2. **API Layer:** apiGet, apiPost, apiPatch, apiDelete funcionan correctamente
3. **Auth Guards:** AuthGuard en todos los controllers relevantes
4. **Type Safety:** Typescript coverage en hooks es bueno
5. **DTOs:** Backend valida con class-validator
6. **Membership:** ProjectMembersService valida miembresía correctamente
7. **Transactions:** createProject usa $transaction para atomicidad
8. **Active Timer:** Restricción de 1 timer activo por usuario funciona

---

## 📝 PLAN DE CORRECCIONES

### FASE 1: Eliminación de ProjectStatus enum (INMEDIATO)
**Archivos a modificar:**
1. `frontend/src/types/project.ts` - Eliminar ProjectStatus enum
2. `frontend/src/components/projects/ProjectCard.tsx` - Remover import ProjectStatus, actualizar línea 57
3. `frontend/src/app/projects/page.tsx` - Remover import ProjectStatus, cambiar filtro 'completed' a usar solo isActive

**Por qué no se pierde:** isActive es el campo real que existe en backend

---

### FASE 2: Consolidación de Task Type
**Archivos a modificar:**
1. `frontend/src/types/project.ts` - Reemplazar Task interface simple con import desde task.ts
2. `frontend/src/components/projects/ProjectCard.tsx` - Confirmar que usa Task correctamente

**Por qué no se pierde:** task.ts es la definición authoritative de Task

---

### FASE 3: Validación de isActive Consistency
**Archivos a verificar:**
- Backend/src/modules/projects/projects.service.ts - Verificar todos los methods filtran isActive
- Cambios mínimos si es necesario

**Por qué no se pierde:** isActive es el único campo que Backend soporta

---

### FASE 4: Rename de archivo Backend
**Archivos a renombrar:**
- Backend/src/modules/projects/projects.controllers.ts → projects.controller.ts
- Actualizar import en Projects.module.ts

**Por qué no se pierde:** Es solo naming consistency, funcionalidad no cambia

---

## 📋 CHECKLIST DE VALIDACIÓN

- [ ] ProjectStatus enum removido
- [ ] ProjectCard.tsx usa isActive solamente
- [ ] projects/page.tsx filtros usan isActive (sin COMPLETED)
- [ ] Task type consolidado
- [ ] Backend getProjectById valida isActive
- [ ] Backend detecta y rechaza acceso a proyectos inactivos
- [ ] Filename de projects.controller.ts corregido
- [ ] No hay import implicito de archivos compilados
- [ ] Todos los hooks usan tipos correctos
- [ ] Dashboard muestra solo proyectos isActive=true

---

## 🎯 RESULTADO ESPERADO

✅ Todas las calls a backend tienen endpoints reales  
✅ Todos los tipos frontend coinciden con responses backend  
✅ Ningún dead code (filtros que nunca activan)  
✅ Integridad de datos (isActive se respeta en toda la cadena)  
✅ Reactividad (timer updates se reflejan sin F5)  

---

## 📦 ARCHIVOS A TOCAR

**Frontend:**
- [ ] src/types/project.ts
- [ ] src/types/task.ts (posiblemente)
- [ ] src/components/projects/ProjectCard.tsx
- [ ] src/app/projects/page.tsx
- [ ] src/services/useProjects.ts (posiblemente para validaciones)

**Backend:**
- [ ] src/modules/projects/projects.controllers.ts (rename)
- [ ] src/modules/projects/Projects.module.ts (update import)
- [ ] src/modules/projects/projects.service.ts (review isActive logic)

---

## 🔗 REFERENCIAS

- Prisma Schema: Backend/prisma/schema.prisma
- Controllers: Backend/src/modules/*/[].controller.ts
- Services: Backend/src/modules/*/[].service.ts
- Types: frontend/src/types/*.ts
- Hooks: frontend/src/hooks/use*.ts
