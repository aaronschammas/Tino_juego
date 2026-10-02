# 🔧 DEBUG - Problemas de Redirección

## Estado Actual
Hay loops de redirección entre /login, /dashboard y /projects.

## Cambios Aplicados

### 1. ProtectedLayout
- ❌ REMOVIDO: `useEffect` con redirect
- ✅ AHORA: Redirect directo en render si no hay usuario
- Muestra loading mientras `isLoading === true`
- Redirige a `/login` si no hay usuario después de cargar

### 2. LoginPage  
- ✅ `useEffect`: Redirige a `/dashboard` si ya hay `user`
- ✅ Early return con `null` si ya está logueado
- ✅ Muestra loading durante `authLoading`

### 3. AuthContext - login()
- ❌ REMOVIDO: `router.replace('/dashboard')` después del login
- ✅ AHORA: Solo setea el user, el redirect lo maneja LoginPage useEffect

### 4. Todos los redirects
- Cambiados de `router.push()` a `router.replace()` para evitar historial

## Pasos para Probar

1. **Limpiar todo:**
   ```bash
   # En navegador
   Ctrl+Shift+Delete → Limpiar caché y cookies de localhost
   
   # O en DevTools Console
   localStorage.clear()
   ```

2. **Reiniciar dev server:**
   ```bash
   # Ctrl+C para detener
   npm run dev
   ```

3. **Flujo de prueba:**
   - Ir a `http://localhost:3001`
   - Debería redirigir a `/login` (porque no hay usuario)
   - Login con `leonardo@tino.com` / `leobruno1829`
   - Debería ir a `/dashboard`
   - Click en "Proyectos" en navbar
   - Debería ir a `/projects` SIN redirigir a login
   - Refresh (F5) en `/projects`
   - Debería quedarse en `/projects`

## Si Persiste el Problema

Hay que verificar:
1. ¿El `user` se está cargando correctamente del localStorage?
2. ¿El `isLoading` se está poniendo en `false` correctamente?
3. ¿Hay múltiples renders causando loops?

### Debug Manual

Agregar console.logs temporales:

**En AuthContext.tsx** (línea 33-40):
```tsx
useEffect(() => {
  console.log('🔐 AuthContext init');
  const token = getToken();
  const storedUser = getStoredUser();
  console.log('🔐 Token:', token ? 'EXISTS' : 'NO');
  console.log('🔐 User:', storedUser);
  
  if (token && storedUser) {
    setUser(storedUser);
  }
  setIsLoading(false);
  console.log('🔐 Auth loaded, isLoading=false');
}, []);
```

**En ProtectedLayout.tsx** (inicio del component):
```tsx
const { user, isLoading } = useAuth();
const router = useRouter();

console.log('🛡️ ProtectedLayout render:', { user: user?.email, isLoading });
```

**En LoginPage.tsx** (inicio del component):
```tsx
const { login, user, isLoading: authLoading } = useAuth();

console.log('🔑 LoginPage render:', { user: user?.email, authLoading });
```

Luego en DevTools Console deberías ver el flujo:
1. `🔐 AuthContext init`
2. `🔐 Auth loaded, isLoading=false`
3. Si hay usuario: `🛡️ ProtectedLayout render: { user: 'email', isLoading: false }`
4. Si NO hay usuario: `🔑 LoginPage render: { user: undefined, authLoading: false }`

## Solución Alternativa

Si nada de esto funciona, podemos:
1. Usar un middleware de Next.js para manejar auth
2. Usar un hook diferente para routing
3. Simplificar más quitando todos los useEffect

Esperando feedback...
