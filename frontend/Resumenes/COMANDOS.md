# Comandos Útiles - Tino Frontend

## Desarrollo

### Iniciar servidor de desarrollo
```bash
npm run dev
```
El servidor estará en http://localhost:3000 (Next.js usará el siguiente puerto disponible si 3000 está ocupado)

### Verificar errores de TypeScript
```bash
npx tsc --noEmit
```

### Ejecutar linter
```bash
npm run lint
```

### Build de producción
```bash
npm run build
npm start
```

## Testing del Login

### 1. Asegurarse que el backend esté corriendo
```bash
cd ../Backend
npm run start:dev
```
El backend debe estar en http://localhost:3000

### 2. Iniciar frontend
```bash
npm run dev
```

### 3. Probar flujo completo
1. Abrir http://localhost:3001 (o el puerto que Next.js asigne)
2. Debería redirigir automáticamente a /login
3. Usar credenciales de prueba:
   - Email: leonardo@tino.com
   - Password: leobruno1829
4. Click en "Ingresar"
5. Debería redirigir a /dashboard
6. Verificar información del usuario
7. Click en "Cerrar sesión"
8. Debería volver a /login

### 4. Verificar protección de rutas
1. Sin estar logueado, intentar acceder a http://localhost:3001/dashboard
2. Debería redirigir automáticamente a /login
3. Hacer login
4. Intentar acceder a http://localhost:3001/projects
5. Debería mostrar página de proyectos (stub)

### 5. Verificar headers HTTP (DevTools)
1. Abrir DevTools → Network tab
2. Hacer login
3. En requests subsiguientes, verificar header:
   ```
   Authorization: Bearer <token_jwt>
   ```

## Debugging

### Ver contenido de localStorage
1. Abrir DevTools → Application → Local Storage
2. Buscar:
   - `auth_token`: JWT token
   - `auth_user`: User object (JSON)

### Limpiar localStorage manualmente
```javascript
// En DevTools Console
localStorage.removeItem('auth_token');
localStorage.removeItem('auth_user');
// o limpiar todo:
localStorage.clear();
```

### Ver errores de Axios
Los errores de API se muestran en:
1. Console del navegador
2. Alert/mensaje en el formulario de login

## Estructura de Archivos

### Archivos implementados (Sprint 1)
- ✅ src/lib/api.ts - Cliente HTTP
- ✅ src/lib/auth.ts - Auth helpers
- ✅ src/context/AuthContext.tsx - Auth provider
- ✅ src/hooks/useAuth.ts - Auth hook
- ✅ src/types/user.ts - User types
- ✅ src/components/layout/ProtectedLayout.tsx - Route guard
- ✅ src/app/login/page.tsx - Login page
- ✅ src/app/dashboard/page.tsx - Dashboard
- ✅ src/app/layout.tsx - Root layout con provider

### Archivos stub (Sprint 2+)
- 📝 src/app/projects/page.tsx
- 📝 src/app/projects/[id]/page.tsx
- 📝 src/app/users/page.tsx
- 📝 src/components/* (navbar, sidebar, etc.)
- 📝 src/hooks/* (useProjects, useTasks, etc.)

## Troubleshooting

### Error: "Cannot find module '@/...'
- Verificar que tsconfig.json tenga: `"@/*": ["./src/*"]`
- Reiniciar el dev server

### Error: 401 Unauthorized
- Verificar que el backend esté corriendo
- Verificar credenciales de login
- Verificar que NEXT_PUBLIC_API_URL en .env.local apunte al backend correcto

### Error: Network Error
- Verificar que el backend esté en http://localhost:3000
- Verificar CORS en el backend
- Verificar .env.local

### La página se queda en "Cargando..."
- Limpiar localStorage
- Verificar que el token sea válido
- Verificar console para errores

### Redirect loop entre /login y /dashboard
- Limpiar localStorage
- Verificar que AuthContext esté montado correctamente
- Verificar que ProtectedLayout esté funcionando

## Variables de Entorno

### .env.local
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Cambiar puerto del backend
Si el backend está en otro puerto:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Tips de Desarrollo

### Hot Reload
Next.js tiene hot reload automático. Los cambios se reflejan instantáneamente.

### Console Logs
Para debugging, usar console.log en componentes client:
```typescript
'use client';

export default function MyComponent() {
  console.log('Rendering component');
  // ...
}
```

### TypeScript Strict Mode
El proyecto usa TypeScript strict mode. Asegurarse de:
- Tipar todos los props
- No usar `any` (preferir `unknown` o tipos específicos)
- Manejar nulls/undefined

## Next Steps

### Sprint 2 - Proyectos
1. Implementar useProjects hook
2. Crear ProjectCard component
3. Implementar /projects page con lista
4. Implementar /projects/[id] con detalle
5. Agregar ProjectForm para crear/editar

### Sprint 3 - Tasks & Timer
1. Implementar useTasks hook
2. Crear TaskList, TaskItem, TaskForm
3. Implementar TimerWidget
4. Conectar con endpoints del backend

### Sprint 4 - Polish
1. Implementar Navbar y Sidebar reales
2. Agregar toast notifications
3. Mejorar manejo de errores
4. Migrar a httpOnly cookies
5. Agregar loading states
