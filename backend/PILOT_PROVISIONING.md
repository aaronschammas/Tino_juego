# Provisionamiento seguro de usuarios piloto

Este flujo crea o reutiliza una organizacion, un proyecto, usuarios `USER`,
`OrganizationMembership` y `ProjectMember`. Es idempotente y no expone un endpoint nuevo.
Por defecto solo valida la configuracion (dry-run).

## Preparacion

1. Verificar que la base objetivo tiene los roles y planes base (`npm run prisma:seed`).
2. Copiar `pilot-users.example.json` a `pilot-users.local.json`. El archivo local esta
   ignorado por Git.
3. Reemplazar todos los nombres y apellidos placeholder. Confirmar los cinco emails.
4. Opcionalmente agregar `"passwordEnv": "PILOT_PASSWORD_1"` a un usuario y definir
   esa variable en la terminal. Si se omite, se genera una password aleatoria al aplicar.
   Nunca agregar `password` al JSON.

## Dry-run y aplicacion

Desde `backend`, en PowerShell:

```powershell
$env:PILOT_CONFIG_PATH = ".\pilot-users.local.json"
npm run provision:pilot-users
```

El dry-run valida dominio, placeholders, roles y fuentes de password sin escribir en la base.
Para aplicar sobre la base configurada en `DATABASE_URL`/`DIRECT_URL`:

```powershell
$env:PILOT_PROVISION_CONFIRM = "Grido / Helacor - Piloto"
npm run provision:pilot-users -- --apply
```

La salida informa IDs, elementos creados/reutilizados y solo muestra las passwords generadas
cuando se crea una credencial. Las passwords leidas desde variables no se vuelven a imprimir.
Entregar las credenciales por un canal seguro y
limpiar las variables y el historial de terminal. Una segunda ejecucion no cambia passwords
existentes ni duplica usuarios o memberships.

## Reglas de seguridad

- Los usuarios nuevos siempre usan rol global `USER`, `googleId: null` y bcrypt con costo 12.
- Un usuario existente `ADMIN`/`SUPERADMIN`, inactivo o vinculado a Google hace abortar toda
  la transaccion; el script no lo degrada, reactiva ni desvincula.
- Si un usuario existente tiene otro `organizationId`, ese default legacy se preserva y solo
  se agrega la membership de Grido. Si no tiene default, se asigna Grido.
- El primer `ORG_OWNER` es owner de un proyecto nuevo. En un proyecto reutilizado se preserva
  el owner actual y todos los pilotos quedan agregados como miembros.
- Si hay organizaciones o proyectos duplicados por nombre, el script aborta para no elegir uno
  de forma ambigua.

## Limitacion multi-organizacion

Las autorizaciones verifican `OrganizationMembership` y `ProjectMember`, pero el login y varias
consultas aun toman `User.organizationId` como contexto activo. Un usuario cuyo default se
preserva en otra organizacion conserva ambas memberships, aunque necesita un selector de
organizacion para alternar de forma completa entre dashboards. No se debe pisar su default como
solucion temporal.
