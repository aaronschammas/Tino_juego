# Guía de Desarrollo Local con Docker

Esta guía detalla los pasos para levantar e interactuar con el entorno de desarrollo local para el proyecto Tino Tasks utilizando **Docker** y **Docker Compose**.

---

## 1. Requisitos Previos

Asegúrate de tener instalados los siguientes componentes en tu máquina:
- **Docker Desktop** (con soporte para Docker Compose).
- **Node.js** (opcional, útil para herramientas de linter locales).

---

## 2. Configuración Inicial (Variables de Entorno)

Antes de levantar el entorno, debes configurar las variables de desarrollo en la raíz del proyecto:
1. Copia el archivo `.env.example` y renómbralo a `.env`:
   ```bash
   cp .env.example .env
   ```
2. Asegúrate de configurar los puertos y credenciales locales necesarios en el archivo `.env`.

---

## 3. Comandos Básicos de Docker Compose

Toda la infraestructura local (Backend NestJS, Frontend Next.js y base de datos local si aplica) se gestiona de forma centralizada desde el directorio raíz del repositorio.

### A. Levantar el Entorno Local (Construcción e Inicio)
Para compilar y levantar los contenedores en segundo plano (modo *detached*), ejecuta:
```bash
docker compose up --build -d
```
* **Backend (`tino-backend`)**: Realizará un `npx prisma migrate deploy` y `npx prisma generate` de forma automática antes de iniciar en modo desarrollo (`npm run start:dev`).
* **Frontend (`tino-frontend`)**: Levantará el servidor de Next.js en el puerto mapeado y con **Hot Reload** activo.

### B. Ver Logs de la Aplicación
Para auditar la actividad o depurar errores en tiempo real:
```bash
docker compose logs -f
```
*(Puedes especificar un servicio, por ejemplo: `docker compose logs -f backend`)*

### C. Apagar el Entorno Local
Para detener y remover los contenedores y redes virtuales locales creadas:
```bash
docker compose down
```

---

## 4. Características del Entorno de Desarrollo

### Frontend con Hot Reload
El contenedor de Next.js (`frontend`) está configurado con **volúmenes compartidos** hacia tu sistema de archivos local (`./frontend:/app`), permitiendo que cualquier cambio que realices en el código se refleje inmediatamente en el navegador gracias al **Hot Reload** activo.

### Sincronización Automática de Base de Datos
El comando de inicialización del Backend ejecuta automáticamente `npx prisma migrate deploy`, que aplica las migraciones pendientes de `backend/prisma/migrations` sobre la base configurada en `DATABASE_URL` al levantar el contenedor. Los cambios en `schema.prisma` necesitan su propia migración; editar el schema no alcanza.

> Si `DATABASE_URL` apunta a una base compartida (por ejemplo la de testing), las migraciones se aplican ahí apenas se levanta el contenedor.

### Integraciones (Trello)
Para probar la conexión con Trello en local hay que completar en `.env` las variables `INTEGRATIONS_*` y `TRELLO_*` (ver `.env.example`) y recrear el backend con `docker compose up -d --force-recreate backend`. Los pasos completos están en `docs/qa-integraciones-trello.md`.
