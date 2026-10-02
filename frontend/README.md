# Tino Frontend

Frontend de Tino construido con Next.js App Router. La aplicacion ahora separa claramente:

- landing publica en `/`
- login profesional en `/login`
- app privada autenticada en `/dashboard`, `/projects`, `/users`, `/workspace` e invitaciones

## Requisitos

- Node.js 20+
- API backend de Tino desplegada y accesible

## Variables de entorno

Crea `frontend/.env.local` tomando `frontend/.env.example` como referencia:

```env
BACKEND_API_URL=http://localhost:8080
```

`BACKEND_API_URL` es server-only. El navegador consume `/api/*` en el mismo origen y Next reenvia las requests al backend. No configures una URL publica de Cloud Run en el cliente.

## Desarrollo local

```bash
cd frontend
npm install
npm run dev
```

## Build de produccion

```bash
cd frontend
npm run build
npm run start
```

## Deploy en Vercel

Configura en Vercel:

- Root Directory: `frontend`
- Framework Preset: `Next.js`
- Environment Variable server-side: `BACKEND_API_URL`

Con eso la landing publica, el login y la app privada comparten el mismo frontend sin tocar backend adicional.
