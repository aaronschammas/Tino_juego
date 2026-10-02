# Tino Frontend - MVP Sprint 1

## Descripción
MVP del frontend en Next.js 15 (App Router) con TypeScript y Tailwind, conectado al backend NestJS mediante API REST.

## Objetivo del Sprint 1
✅ Login funcionando contra endpoint real  
✅ Rutas protegidas mínimas  
✅ JWT guardado en localStorage  
✅ Interceptores HTTP configurados  

## Stack Tecnológico
- **Framework**: Next.js 15 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS v4
- **HTTP Client**: Axios
- **Forms**: React Hook Form
- **Validación**: Zod

## Estructura del Proyecto

```
src/
 ├── app/
 │    ├── login/
 │    │    └── page.tsx              # Página de login
 │    ├── dashboard/
 │    │    └── page.tsx              # Dashboard protegido
 │    ├── projects/
 │    │    ├── page.tsx              # Lista de proyectos (stub)
 │    │    └── [id]/
 │    │         └── page.tsx         # Detalle de proyecto (stub)
 │    ├── users/
 │    │    └── page.tsx              # Gestión de usuarios (stub)
 │    ├── layout.tsx                 # Layout principal con AuthProvider
 │    ├── page.tsx                   # Página de inicio (redirect a login)
 │    └── globals.css                # Estilos globales
 ├── components/
 │    ├── layout/
 │    │     ├── ProtectedLayout.tsx  # Wrapper para rutas protegidas
 │    │     ├── Navbar.tsx           # (stub)
 │    │     └── Sidebar.tsx          # (stub)
 │    ├── projects/                   # (stubs)
 │    ├── tasks/                      # (stubs)
 │    ├── timer/                      # (stubs)
 │    └── analytics/                  # (stubs)
 ├── hooks/
 │    ├── useAuth.ts                 # Hook de autenticación
 │    └── [otros].ts                 # (stubs)
 ├── lib/
 │    ├── api.ts                     # Cliente HTTP con interceptores
 │    └── auth.ts                    # Helpers de auth (localStorage)
 ├── context/
 │    └── AuthContext.tsx            # Contexto de autenticación
 └── types/
      ├── user.ts                    # Types de usuario y auth
      └── [otros].ts                 # (stubs)
```

## Configuración

### Variables de Entorno
Crear archivo `.env.local` en la raíz del frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Instalación
```bash
npm install
```

## Ejecución

### Desarrollo
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3001` (o el puerto que Next.js asigne).

### Build de Producción
```bash
npm run build
npm start
```

## Flujo de Autenticación

### 1. Login
- Endpoint: `POST /auth/login`
- Payload: `{ email: string, password: string }`
- Response: `{ token: string, user: User }`
- El token JWT se guarda en `localStorage`
- El usuario se redirige a `/dashboard`

### 2. Protección de Rutas
- Componente `ProtectedLayout` verifica existencia de token/usuario
- Si no hay autenticación, redirige a `/login`
- Todas las rutas protegidas usan este wrapper

### 3. Autorización en Requests
- Interceptor en `api.ts` agrega `Authorization: Bearer <token>` automáticamente
- Si el backend responde con 401, se limpia el storage y redirige a `/login`

### 4. Logout
- Limpia token y usuario de `localStorage`
- Redirige a `/login`

## Credenciales de Prueba

```
Email: leonardo@tino.com
Password: leobruno1829
```

## API Layer

### Cliente HTTP (`src/lib/api.ts`)
```typescript
// Funciones disponibles
apiGet<T>(url: string): Promise<T>
apiPost<T>(url: string, data?: any): Promise<T>
apiPatch<T>(url: string, data?: any): Promise<T>
apiDelete<T>(url: string): Promise<T>
```

### Uso
```typescript
import { apiPost } from '@/lib/api';

const data = await apiPost<User>('/users', { name: 'John' });
```

## Contexto de Autenticación

### AuthProvider (`src/context/AuthContext.tsx`)
```typescript
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}
```

### Hook useAuth
```typescript
import { useAuth } from '@/hooks/useAuth';

function Component() {
  const { user, login, logout, isLoading } = useAuth();
  // ...
}
```

## Páginas Implementadas

### ✅ Login (`/login`)
- Formulario de autenticación
- Manejo de errores
- Precarga de credenciales de prueba

### ✅ Dashboard (`/dashboard`)
- Página protegida
- Muestra información del usuario
- Botón de logout

### 📝 Pendientes (stubs)
- `/projects` - Lista de proyectos
- `/projects/[id]` - Detalle de proyecto
- `/users` - Gestión de usuarios

## Seguridad

### Almacenamiento del Token
- **Actual**: localStorage (rápido para MVP)
- **Futuro**: Migrar a httpOnly cookies para mayor seguridad

### Interceptores HTTP
- ✅ Agregar token automáticamente
- ✅ Manejar 401 (Unauthorized)
- ✅ Redirección automática a login en errores de auth

## Testing del MVP

### Criterios de Aceptación
1. ✅ Ejecutar `npm run dev` sin errores
2. ✅ Abrir `/login` y ver formulario
3. ✅ Iniciar sesión con credenciales de prueba
4. ✅ Redirigir automáticamente a `/dashboard`
5. ✅ Ver información del usuario en dashboard
6. ✅ Intentar acceder a `/dashboard` sin token → redirigir a `/login`
7. ✅ Botón de logout funciona correctamente

### Verificar Interceptor
1. Abrir DevTools → Network
2. Hacer login exitoso
3. Ver que requests subsiguientes incluyen header `Authorization: Bearer <token>`

## Próximos Pasos (Sprint 2)

- [ ] Implementar gestión de proyectos (CRUD)
- [ ] Implementar sistema de tareas
- [ ] Implementar time tracking widget
- [ ] Agregar analytics/dashboards
- [ ] Implementar Navbar y Sidebar funcionales
- [ ] Migrar autenticación a httpOnly cookies
- [ ] Agregar manejo avanzado de errores
- [ ] Implementar toast notifications

## Notas Técnicas

### TypeScript Paths
El alias `@/` apunta a `./src/`:
```typescript
import { User } from '@/types/user';
import { apiPost } from '@/lib/api';
```

### Componentes Client vs Server
- Componentes con hooks/estado/contexto usan `'use client'`
- Layout principal puede ser server component, provider es client

### Defensive Parsing
Si el shape de la respuesta del backend difiere, el código maneja errores gracefully.

## Soporte

Para issues o preguntas sobre la implementación, revisar:
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- Backend README en `../Backend/README.md`

---

**Estado**: ✅ MVP Sprint 1 completo y funcional
