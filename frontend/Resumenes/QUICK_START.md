# ⚡ Quick Start - MVP B2B Setup

## 🚀 Startup (2 minutos)

### Terminal 1: Backend

```bash
cd Backend
npm run start:dev
# Debe mostrar: [Nest] 1234 - 03/05/2026, 10:00:00 AM LOG [NestFactory] Nest application successfully started +1234ms
```

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
# Debe mostrar: ▲ Next.js 14.x.x
#  ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

### Terminal 3: Base de datos (si es necesario)

```bash
cd Backend
docker-compose up -d
# Verifica: docker ps | grep postgres
```

---

## ✅ Verificación Rápida (1 minuto)

### 1. Backend Healthy

```bash
curl http://localhost:3001
# Debe responder sin error 404 (NestJS)
```

### 2. Base de datos migrada

```bash
cd Backend
npx prisma studio
# Abre en 5555. Verifica:
# - Tabla "Organization" existe
# - Tabla "OrganizationMembership" existe
# - Tabla "OrganizationInvite" existe
```

### 3. Datos Demo creados

```bash
cd Backend
npm run prisma:seed
# Output debe mostrar:
# ✅ Created owner user: owner@demo.com
# ✅ Created Ana user (pending): ana@demo.com
# ✅ Created organization: Demo SRL
```

### 4. Frontend carga

```
Abre: http://localhost:3000
Deberías ver: Login page
```

---

## 📝 Demo Script (&lt;5 minutos)

### Minute 0:

```
Abre: http://localhost:3000/login
Ingresa:
  Email: owner@demo.com
  Password: Password123!
Click: Sign In
```

### Minute 1:

```
Url: http://localhost:3000/workspace
Deberías ver:
  - "Create Organization" form (si no existe org)
  - O lista de miembros (si ya existe)
```

### Minute 1.5:

```
En "Invite Member" form:
  Email: ana@demo.com
  Role: Member
Click: Send Invitation
```

**Copia el link que aparece en la respuesta verde**

### Minute 3:

```
Abre nueva ventana INCÓGNITA
Pega el link de invitación: http://localhost:3000/invite?token=...
```

### Minute 3.5:

```
En el formulario:
  Full Name: Ana García
  Password: Password123!
  Confirm: Password123!
Click: Accept Invitation & Create Account
```

### Minute 4:

```
Serás redirigido a login. Ingresa:
  Email: ana@demo.com
  Password: Password123!
```

### Minute 4.5:

```
Deberías estar logueado como Ana
Vuelve a la ventana del owner
Recarga: http://localhost:3000/workspace
En "Members" deberías ver a Ana con status ACTIVE
```

---

## 🔧 Troubleshooting

### Error: "Cannot find module @prisma/client"

```bash
cd Backend
npm install
npx prisma generate
```

### Error: "Database connection refused"

```bash
# Asegúrate de que PostgreSQL está corriendo
docker-compose logs postgres
# O verifica que PostgreSQL está en puerto 5432
```

### Error: "Token invalid or expired"

- Los tokens de invitación expiran en **7 días**
- Si cambias algo en seed.ts, ejecuta `npm run prisma:seed` nuevamente
- Los links viejos se invalidan

### Error: "User not found"

- El seed debe haber creado los usuarios
- Ejecuta: `npm run prisma:seed` de nuevo
- Verifica en Prisma Studio: http://localhost:5555

---

## 📊 What's Implemented

### Backend

- ✅ NestJS module: `OrganizationsModule`
- ✅ Service: `OrganizationsService` (`25+ methods`)
- ✅ Controller: `OrganizationsController` + `InvitesPublicController`
- ✅ Guards: `OrgAccessGuard`, `OrgOwnerGuard`
- ✅ DTOs: 4 files (create, invite, accept, update role)
- ✅ Prisma schema: Updated with new models
- ✅ Migration: `20260305152649_add_organizations`
- ✅ Seed: Full demo data with 3 users + 1 org

### Frontend

- ✅ Hook: `useOrganizations` (10+ methods)
- ✅ Components: 4 (CreateOrgForm, InviteMemberForm, OrgSettings, AcceptInviteForm)
- ✅ Pages: 2 (/workspace, /invite)
- ✅ Types: `organization.ts` with all interfaces
- ✅ Full demo flow ready

### Database

- ✅ New Tables: Organization, OrganizationMembership, OrganizationInvite
- ✅ New Enums: UserStatus, OrganizationRole, OrganizationInviteStatus
- ✅ Relations: Fully normalized schema
- ✅ Indexes: On token, organizationId

---

## 🎯 Next Steps (Roadmap)

### Phase 2: MVP Enhancement

- [ ] Email service integration (SendGrid)
- [ ] Notification system
- [ ] Organization branding
- [ ] Audit logs

### Phase 3: Feature Parity

- [ ] Google OAuth
- [ ] Multi-org per user
- [ ] Subscription tiers
- [ ] Analytics by org

### Phase 4: Production

- [ ] Rate limiting
- [ ] Full SSO (OIDC)
- [ ] Stripe integration
- [ ] Scaling (read replicas, caching)

---

## 📞 Support

Si hay problemas:

1. **Logs en backend:** `npm run start:dev` + terminal
2. **Logs en frontend:** F12 → Console
3. **Base de datos:** `npx prisma studio`
4. **API testing:** Use Postman con JWT token de owner

---

**¡Listo para demo! 🚀**
