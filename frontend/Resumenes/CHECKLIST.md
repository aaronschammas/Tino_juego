# ✅ CHECKLIST DE VERIFICACIÓN MVP

## Pre-requisitos
- [ ] Node.js instalado (v18 o superior)
- [ ] npm instalado
- [ ] Backend de NestJS corriendo en http://localhost:3000
- [ ] Usuario mock creado: `leonardo@tino.com` / `leobruno1829`

## Setup
- [ ] Dependencias instaladas: `npm install` ✅
- [ ] Archivo `.env.local` existe con `NEXT_PUBLIC_API_URL=http://localhost:3000` ✅
- [ ] TypeScript configurado correctamente (`tsconfig.json`) ✅
- [ ] No hay errores de TypeScript: `npx tsc --noEmit` ✅

## Archivos Creados (30 archivos + 4 documentación)

### Core Functionality
- [ ] `src/lib/api.ts` - Cliente HTTP con interceptores ✅
- [ ] `src/lib/auth.ts` - Helpers de localStorage ✅
- [ ] `src/context/AuthContext.tsx` - Provider de autenticación ✅
- [ ] `src/hooks/useAuth.ts` - Hook de autenticación ✅
- [ ] `src/types/user.ts` - Types de usuario ✅

### Components
- [ ] `src/components/layout/ProtectedLayout.tsx` - Guard de rutas ✅
- [ ] `src/components/layout/Navbar.tsx` - (stub) ✅
- [ ] `src/components/layout/Sidebar.tsx` - (stub) ✅
- [ ] `src/components/projects/*` - (2 stubs) ✅
- [ ] `src/components/tasks/*` - (3 stubs) ✅
- [ ] `src/components/timer/*` - (1 stub) ✅
- [ ] `src/components/analytics/*` - (1 stub) ✅

### Pages
- [ ] `src/app/layout.tsx` - Root layout con AuthProvider ✅
- [ ] `src/app/page.tsx` - Redirect a login ✅
- [ ] `src/app/globals.css` - Estilos globales ✅
- [ ] `src/app/login/page.tsx` - Página de login ✅
- [ ] `src/app/dashboard/page.tsx` - Dashboard protegido ✅
- [ ] `src/app/projects/page.tsx` - (stub) ✅
- [ ] `src/app/projects/[id]/page.tsx` - (stub) ✅
- [ ] `src/app/users/page.tsx` - (stub) ✅

### Hooks & Types (stubs)
- [ ] `src/hooks/useProjects.ts` - (stub) ✅
- [ ] `src/hooks/useTasks.ts` - (stub) ✅
- [ ] `src/hooks/useTimer.ts` - (stub) ✅
- [ ] `src/hooks/useAnalytics.ts` - (stub) ✅
- [ ] `src/types/project.ts` - (stub) ✅
- [ ] `src/types/task.ts` - (stub) ✅
- [ ] `src/types/time.ts` - (stub) ✅

### Documentación
- [ ] `MVP_README.md` - Documentación completa ✅
- [ ] `COMANDOS.md` - Comandos y troubleshooting ✅
- [ ] `RESUMEN_IMPLEMENTACION.md` - Resumen técnico ✅
- [ ] `QUICK_START.md` - Guía rápida ✅

## Testing Paso a Paso

### 1. Servidor de Desarrollo
- [ ] Ejecutar `npm run dev`
- [ ] Sin errores en consola
- [ ] Servidor corriendo (verificar puerto en output)

### 2. Flujo de Login
- [ ] Abrir navegador en `http://localhost:3001` (o puerto asignado)
- [ ] URL redirige automáticamente a `/login`
- [ ] Formulario de login visible
- [ ] Campos pre-llenados con `leonardo@tino.com`
- [ ] Ingresar password: `leobruno1829`
- [ ] Click en "Ingresar"
- [ ] Loading state visible durante request
- [ ] Sin errores en consola del navegador
- [ ] Redirect automático a `/dashboard`

### 3. Dashboard
- [ ] URL es `/dashboard`
- [ ] Título muestra "Hola, Leonardo Bruno" (o nombre del usuario)
- [ ] Email del usuario visible
- [ ] Rol del usuario visible
- [ ] Botón "Cerrar sesión" presente
- [ ] Cards informativas visibles
- [ ] UI responsive (probar redimensionar ventana)

### 4. LocalStorage
- [ ] F12 → Application → Local Storage
- [ ] Existe `auth_token` con valor JWT
- [ ] Existe `auth_user` con objeto JSON
- [ ] `auth_user` contiene: id, email, name, lastname, role, isActive

### 5. Headers HTTP
- [ ] F12 → Network
- [ ] Filtrar por XHR
- [ ] Click en cualquier request al backend
- [ ] Headers → Request Headers
- [ ] Existe `Authorization: Bearer <token>`

### 6. Logout
- [ ] Click en "Cerrar sesión"
- [ ] Redirect automático a `/login`
- [ ] localStorage vacío (auth_token y auth_user eliminados)
- [ ] No hay usuario en consola

### 7. Protección de Rutas
- [ ] Sin estar logueado, intentar acceder a `/dashboard` directamente
- [ ] Debe redirigir a `/login`
- [ ] Hacer login nuevamente
- [ ] Acceder a `/projects` → debe mostrar página stub
- [ ] Acceder a `/users` → debe mostrar página stub
- [ ] Cerrar sesión
- [ ] Intentar `/projects` sin login → debe redirigir a `/login`

### 8. Manejo de Errores
- [ ] Intentar login con password incorrecta
- [ ] Debe mostrar mensaje de error en UI
- [ ] No debe redirigir
- [ ] Debe mostrar error sin crash
- [ ] Corregir password y login exitoso

### 9. 401 Handling (Opcional - requiere backend)
- [ ] Loguearse exitosamente
- [ ] En backend, invalidar el token (o cambiar secret)
- [ ] Hacer alguna acción que requiera API
- [ ] Debe detectar 401
- [ ] Debe limpiar localStorage
- [ ] Debe redirigir a `/login`

### 10. Responsive Design
- [ ] Probar en desktop (>1024px)
- [ ] Probar tablet (768px - 1024px)
- [ ] Probar móvil (<768px)
- [ ] Login responsive
- [ ] Dashboard responsive
- [ ] Formularios legibles en móvil

## Criterios de Aceptación Final

### Funcionalidad
- [ ] Login end-to-end funciona ✅
- [ ] Dashboard muestra datos del usuario ✅
- [ ] Logout funciona ✅
- [ ] Rutas protegidas funcionan ✅
- [ ] Redirects automáticos funcionan ✅

### Código
- [ ] Sin errores de TypeScript ✅
- [ ] Sin errores en consola del navegador ✅
- [ ] Código organizado según estructura definida ✅
- [ ] Componentes client/server correctos ✅

### UX
- [ ] UI profesional y limpia ✅
- [ ] Loading states visibles ✅
- [ ] Errores manejados gracefully ✅
- [ ] Responsive en todos los tamaños ✅

### Seguridad
- [ ] Token en Authorization header ✅
- [ ] Token NO en URL ✅
- [ ] Logout en 401 ✅
- [ ] Rutas protegidas con guard ✅

### Documentación
- [ ] README completo ✅
- [ ] Comandos documentados ✅
- [ ] Credenciales de prueba visibles ✅

## Problemas Comunes

### ❌ Network Error
**Causa**: Backend no está corriendo  
**Solución**: `cd Backend && npm run start:dev`

### ❌ Cannot find module '@/...'
**Causa**: Path alias mal configurado  
**Solución**: Verificar `tsconfig.json` paths, reiniciar dev server

### ❌ 401 Unauthorized
**Causa**: Credenciales incorrectas o token inválido  
**Solución**: Verificar password, limpiar localStorage

### ❌ Redirect loop
**Causa**: Estado inconsistente en AuthContext  
**Solución**: `localStorage.clear()` y recargar

### ❌ Página en blanco
**Causa**: Error de JavaScript  
**Solución**: F12 → Console, ver error específico

## Si TODO está ✅

**🎉 ¡FELICITACIONES!**

El MVP está completamente funcional y listo para:
- ✅ Demo al cliente
- ✅ Presentación al equipo
- ✅ Base para Sprint 2

## Siguiente Sprint

Una vez verificado todo, estás listo para:
1. Implementar CRUD de proyectos
2. Sistema de tareas
3. Time tracking
4. Analytics dashboard
5. Mejorar UI/UX
6. Migrar a httpOnly cookies

---

**Tiempo estimado de verificación**: 10-15 minutos  
**Si encuentras algún ❌**: Ver `COMANDOS.md` troubleshooting section
