# Finnapp – Task Manager Backend

Backend de **Finnapp**, un gestor de tareas con **control de tiempo** y **analítica de productividad**, diseñado para equipos y empresas.

El sistema permite gestionar **usuarios, proyectos, tareas, subtareas, time-tracking y KPIs**, con **roles y permisos**, siguiendo una arquitectura modular y escalable.

---

## 🚀 Stack Tecnológico

- **Node.js**
- **NestJS**
- **Prisma ORM**
- **PostgreSQL** (Docker)
- **Auth placeholder** (x-user-id)
- **class-validator**
- **Arquitectura modular por dominio**

---

## 🎯 Objetivo del Sistema

Finnapp busca responder estas preguntas clave:
- ¿En qué se está trabajando?
- ¿Cuánto tiempo lleva cada proyecto?
- ¿Qué tareas se completan y cuáles se traban?
- ¿Qué tan productivo es el equipo?

Todo esto sin depender del frontend como fuente de verdad.

---

## 🔐 Autenticación y Autorización

### Auth (Placeholder)
- Header obligatorio:  

- `AuthGuard`:
- valida que el usuario exista
- valida que esté activo
- inyecta `request.user`

### Decorators
- `@CurrentUser()` → acceso al usuario actual
- `@Roles()` → definición de permisos

### Roles
- `ADMIN`
- `USER`

### Guards
- `AuthGuard` → autenticación
- `RolesGuard` → autorización por rol

> Toda la lógica de permisos vive **en los controllers**, nunca en los services.

---

## 👤 Users Module
- CRUD de usuarios
- Soft delete (`isActive`)
- Solo `ADMIN` puede:
- crear usuarios
- activar / desactivar usuarios

---

## 📁 Projects Module
- Proyecto pertenece a un usuario (owner)
- Campos principales:
- name
- description
- dueDate
- priority
- isActive
- Soft delete (no se borran proyectos)
- `USER` puede crear y gestionar
- `ADMIN` puede desactivar

---

## ✅ Tasks Module
- Las tareas **siempre pertenecen a un proyecto**
- Soporte para:
- subtareas (self-relation)
- estados (`TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`)
- prioridades
- asignación a usuarios
- Validación de ownership del proyecto
- Controllers delgados, lógica en el service

---

## ⏱️ Time-Tracking Module
Sistema de control horario **por sesiones**.

### Reglas clave
- Un usuario solo puede tener **un reloj activo**
- Cada `start` crea un `TimeEntry`
- Cada `stop` cierra el `TimeEntry`
- El tiempo se **calcula**, no se guarda acumulado
- Funciona aunque el navegador se cierre

### Endpoints
- `POST /time/start`
- `POST /time/stop`
- `GET /time/active`
- `GET /time/history` (retorna últimas entradas cerradas)

---

## 📊 Analytics Module
Analítica operativa en tiempo real (no persistida).

### KPIs disponibles
- Total de tareas
- Tareas completadas
- % de completion
- Tareas bloqueadas
- Tareas vencidas
- Horas trabajadas
- Promedio por tarea / proyecto

### Endpoints
- `GET /analytics/overview`
- `GET /analytics/projects/:projectId`
- `GET /analytics/users/:userId` (solo ADMIN)

> Los analytics se calculan con Prisma queries, no se almacenan en la base.

---

## 🗂️ Estructura del Proyecto

```txt
src/
├── app.module.ts
├── main.ts
│
├── database/
│   └── prisma.service.ts
│
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── roles.decorator.ts
│   ├── guards/
│   │   ├── auth.guard.ts
│   │   └── roles.guard.ts
│   └── enums/
│
├── modules/
│   ├── auth/
│   │   └── auth.module.ts
│   │
│   ├── users/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.module.ts
│   │   └── dto/
│   │
│   ├── projects/
│   │   ├── projects.controller.ts
│   │   ├── projects.service.ts
│   │   ├── projects.module.ts
│   │   └── dto/
│   │
│   ├── tasks/
│   │   ├── tasks.controller.ts
│   │   ├── tasks.service.ts
│   │   ├── tasks.module.ts
│   │   └── dto/
│   │
│   ├── time-tracking/
│   │   ├── time-tracking.controller.ts
│   │   ├── time-tracking.service.ts
│   │   ├── time-tracking.module.ts
│   │   └── dto/
│   │
│   └── analytics/
│       ├── analytics.controller.ts
│       ├── analytics.service.ts
│       └── analytics.module.ts
│
└── prisma/
  └── schema.prisma
🧬 Base de Datos (Prisma)

Relaciones principales:

User ↔ Project (owner)

Project ↔ Task

Task ↔ Task (subtareas)

User ↔ Task (assigned)

User ↔ Project ↔ TimeEntry

Soft delete aplicado en:

User

Project

✅ Estado del Proyecto

✔ Arquitectura cerrada

✔ Lógica consistente

✔ Lista para frontend (Next.js)

✔ Escalable

✔ Preparada para dashboards tipo Power BI