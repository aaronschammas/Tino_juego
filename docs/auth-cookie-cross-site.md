# Autenticacion first-party

## Arquitectura

El navegador consume exclusivamente `/api/*` en el origen de Tino. El route handler de Next reenvia la solicitud a un destino fijo configurado en el servidor. El host de destino nunca se acepta desde la request del cliente.

El proxy conserva metodo, query, body en streaming, status, descargas y los headers necesarios. Filtra `Host`, `X-Forwarded-Host` y otros headers no permitidos. Tambien valida `Origin`/`Referer` para mutaciones y elimina cualquier atributo `Domain` recibido en `Set-Cookie`, por lo que las cookies quedan host-only en el dominio de Tino.

Las cookies de sesion son `HttpOnly`, `SameSite=Lax`, `Path=/` y `Secure` en produccion. Access y refresh mantienen sus TTL existentes. OAuth conserva `state` firmado con expiracion, y `returnTo` solo admite rutas internas.

## Configuracion por nombre

- `BACKEND_API_URL`: URL privada/destino del backend usada solo por el runtime de Next.
- `BACKEND_PROXY_TIMEOUT_MS`: timeout opcional del proxy; por defecto 30000 ms.
- `GOOGLE_LOGIN_REDIRECT_URI`, `GOOGLE_REGISTER_REDIRECT_URI`, `GOOGLE_CONTINUE_REDIRECT_URI`, `GOOGLE_LINK_REDIRECT_URI`: deben apuntar a rutas first-party de Tino, nunca directamente a `run.app`.
- `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`: conservan su contrato actual.

## Pasos manuales de infraestructura

No se realizaron cambios externos ni despliegues.

1. En Vercel, crear `BACKEND_API_URL` para Preview y Production con el destino actual de Cloud Run. Mantenerla como variable server-side.
2. Los pipelines de testing y produccion pasan el destino como `BACKEND_API_URL` al runtime server-side de Vercel. No debe inyectarse `NEXT_PUBLIC_API_URL`.
3. Confirmar en Google OAuth Console que los redirect URI registrados sean las rutas publicas first-party que ya atiende Next, por ejemplo `/auth/google/continue/callback`, `/auth/google/login/callback` y `/auth/google/callback` bajo el dominio canonico. No registrar callbacks `run.app` para el navegador.
4. En Cloud Run no se requiere cambio de dominio. Mantener autenticacion del servicio y conectividad compatibles con las invocaciones de Vercel. Revisar el origen saliente si el servicio deja de ser publico.
5. Mantener en `CORS_ALLOWED_ORIGINS` solo los origenes web aprobados. El proxy no necesita CORS para el navegador, pero el backend puede conservarlo para clientes permitidos durante la transicion.

## Checklist manual

Repetir en Chrome normal, Chrome incognito, Brave con Shields activos, Edge y Safari/iPhone cuando este disponible. Repetir tambien desde la PWA instalada.

- Abrir `/login` sin sesion: no debe aparecer un error rojo por el 401 de bootstrap.
- Iniciar con email/password valido; confirmar destino `next`, dashboard y onboarding segun corresponda.
- Probar credenciales invalidas y usuario inactivo; los mensajes deben seguir siendo especificos.
- Recargar y abrir una pestaña nueva; ambas deben reconocer la sesion.
- Iniciar Google, aceptar y cancelar una vez; aceptar debe crear sesion y cancelar debe mostrar un mensaje de cancelacion.
- Probar usuario multiempresa y cambiar A -> B -> C; verificar que tareas, timer, comentarios, dashboard y reportes pertenezcan siempre a la organizacion activa.
- Descargar un reporte y subir un archivo.
- Cerrar sesion; recargar y abrir otra pestaña para confirmar que no reaparece la sesion.
- Esperar o simular expiracion del access token; confirmar refresh. Expirar tambien refresh y confirmar redireccion clara a login.

En DevTools > Network:

- Todas las requests autenticadas deben ir a `https://<dominio-tino>/api/...`; no debe haber requests del navegador a `run.app`.
- La respuesta de login/callback debe incluir cookies first-party `HttpOnly`, `Secure` en produccion, `SameSite=Lax`, sin `Domain=run.app`.
- `/api/auth/context` debe devolver 200 despues del login y debe existir una sola request durante bootstrap/callback.
- En Application/Storage, las cookies deben pertenecer al dominio de Tino y no figurar bloqueadas.
- Ninguna URL, query string, log o response body debe contener access tokens o refresh tokens de Tino.
