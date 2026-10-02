# Backend - Funcionalidades Disponibles

## 🔐 Autenticación

### Login
- **POST** `/auth/login`
  - Login con email y password
  - Retorna JWT token (24h de validez)
  - Usuario mock: `leonardo@tino.com` / `leobruno1829` (ADMIN)

---

## 👥 Usuarios

**Todos los endpoints requieren autenticación (Bearer Token)**

### Crear Usuario (Solo ADMIN)
- **POST** `/users`
  - Body: `{ email, name, lastname }`
  - Solo usuarios con rol ADMIN pueden crear usuarios

### Listar Usuarios
- **GET** `/users`
  - Lista todos los usuarios activos

### Obtener Usuario por ID
- **GET** `/users/:id`

### Actualizar Usuario
- **PATCH** `/users/:id`
  - Body: `{ email?, name?, lastname? }`

### Desactivar Usuario (Solo ADMIN)
- **PATCH** `/users/:id/deactivate`

### Activar Usuario (Solo ADMIN)
- **PATCH** `/users/:id/activate`

---

## 📁 Proyectos

**Todos los endpoints requieren autenticación**

### Crear Proyecto
- **POST** `/projects`
  - Body: `{ name, description?, dueDate?, priority? }`
  - El usuario autenticado se convierte en owner del proyecto
  - Priority: `LOW | MEDIUM | HIGH | CRITICAL`

### Listar Proyectos
- **GET** `/projects`
  - Lista los proyectos del usuario autenticado

### Obtener Proyecto por ID
- **GET** `/projects/:id`
  - Solo si el usuario es owner del proyecto

### Actualizar Proyecto
- **PATCH** `/projects/:id`
  - Body: `{ name?, description?, dueDate?, priority? }`
  - Solo el owner puede actualizar

### Desactivar Proyecto (Solo ADMIN)
- **PATCH** `/projects/:id/deactivate`
  - Solo usuarios ADMIN pueden desactivar proyectos

---

## ✅ Tareas

**Todos los endpoints requieren autenticación**

### Crear Tarea
- **POST** `/projects/:projectId/tasks`
  - Body: `{ title, description?, status?, priority?, dueDate?, assignedToId?, parentTaskId? }`
  - Status: `TODO | IN_PROGRESS | BLOCKED | DONE`
  - Priority: `LOW | MEDIUM | HIGH | CRITICAL`
  - Soporta subtareas con `parentTaskId`

### Listar Tareas del Proyecto
- **GET** `/projects/:projectId/tasks`
  - Lista todas las tareas de un proyecto

### Obtener Tarea por ID
- **GET** `/projects/:projectId/tasks/:taskId`

### Actualizar Tarea
- **PATCH** `/projects/:projectId/tasks/:taskId`
  - Body: `{ title?, description?, status?, priority?, dueDate?, assignedToId? }`

---

## ⏱️ Time Tracking

**Todos los endpoints requieren autenticación**

### Iniciar Timer
- **POST** `/time/start`
  - Body: `{ projectId }`
  - Inicia el tracking de tiempo en un proyecto
  - Solo puede haber un timer activo por usuario

### Detener Timer
- **POST** `/time/stop`
  - Detiene el timer activo del usuario
  - Registra el tiempo trabajado

### Obtener Timer Activo
- **GET** `/time/active`
- **GET** `/time/history`  (últimas entradas cerradas del usuario)
  - Retorna el timer activo del usuario (si existe)

---

## 📊 Analytics

**Todos los endpoints requieren autenticación**

### Overview General
- **GET** `/analytics/overview`
  - Estadísticas generales del usuario:
    - Total de proyectos
    - Total de tareas
    - Tareas por estado
    - Tiempo total trabajado

### Analytics por Proyecto
- **GET** `/analytics/projects/:projectId`
  - Estadísticas de un proyecto específico:
    - Total de tareas
    - Tareas por estado
    - Tiempo total trabajado en el proyecto

### Analytics por Usuario (Solo ADMIN)
- **GET** `/analytics/users/:userId`
  - Estadísticas de cualquier usuario (solo ADMIN)

---

## 🔑 Sistema de Roles

### USER (Default)
- Puede crear y gestionar sus propios proyectos
- Puede crear y actualizar tareas
- Puede hacer time tracking
- Puede ver sus propias analytics

### ADMIN
- Todos los permisos de USER
- Puede crear usuarios
- Puede desactivar/activar usuarios
- Puede desactivar proyectos
- Puede ver analytics de cualquier usuario

---

## 📋 Modelos de Datos

### User
```typescript
{
  id: string (uuid)
  email: string (unique)
  name: string
  lastname: string
  password: string?
  googleId: string? (para futuro)
  role: 'USER' | 'ADMIN'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

### Project
```typescript
{
  id: string (uuid)
  name: string
  description: string?
  dueDate: Date?
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ownerId: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

### Task
```typescript
{
  id: string (uuid)
  title: string
  description: string?
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  dueDate: Date?
  projectId: string
  assignedToId: string?
  parentTaskId: string? (para subtareas)
  createdAt: Date
  updatedAt: Date
}
```

### TimeEntry
```typescript
{
  id: string (uuid)
  userId: string
  projectId: string
  startTime: Date
  endTime: Date?
  createdAt: Date
}
```

---

## ✅ Flujos End-to-End Disponibles

### 1. Flujo de Usuario Nuevo
1. Admin crea usuario → `POST /users`
2. Usuario hace login → `POST /auth/login` (obtiene token)
3. Usuario crea proyecto → `POST /projects`
4. Usuario crea tareas → `POST /projects/:id/tasks`
5. Usuario inicia timer → `POST /time/start`
6. Usuario trabaja...
7. Usuario detiene timer → `POST /time/stop`
8. Usuario ve analytics → `GET /analytics/overview`

### 2. Flujo de Gestión de Proyecto
1. Crear proyecto
2. Crear tareas del proyecto
3. Asignar tareas a usuarios
4. Actualizar estado de tareas
5. Trackear tiempo en el proyecto
6. Ver analytics del proyecto

### 3. Flujo de Time Tracking
1. Ver si hay timer activo → `GET /time/active`
2. Si no hay, iniciar timer → `POST /time/start`
3. Trabajar...
4. Detener timer → `POST /time/stop`
5. Ver tiempo total → `GET /analytics/projects/:id`

---

## 🚀 Estado del Backend

### ✅ Completo y Funcional
- Autenticación con JWT
- CRUD completo de Users, Projects, Tasks
- Time tracking básico
- Analytics básicas
- Sistema de roles (USER/ADMIN)
- Validaciones con class-validator
- Guards de autenticación y roles
- Relaciones entre entidades

### ⚠️ Posibles Mejoras para Considerar

1. **Paginación** en listados (users, projects, tasks)
2. **Filtros y búsqueda** en listados
3. **Ordenamiento** personalizado
4. **Soft delete** en lugar de `isActive: false`
5. **Histórico de cambios** en tareas
6. **Notificaciones** cuando se asigna una tarea
7. **Dashboard** con métricas en tiempo real
8. **Export** de reportes (PDF, Excel)
9. **Comentarios** en tareas
10. **Adjuntos** en tareas/proyectos

### 🎯 ¿Listo para Frontend?

**SÍ**, el backend tiene todas las funcionalidades core para empezar:
- ✅ Login y autenticación
- ✅ Gestión de usuarios
- ✅ Gestión de proyectos
- ✅ Gestión de tareas (con subtareas)
- ✅ Time tracking
- ✅ Analytics básicas

Puedes empezar con el frontend implementando estas funcionalidades y luego agregar las mejoras según necesites.
