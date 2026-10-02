# Flujo de trabajo con Prisma

## 1. Modificar el schema

Haz los cambios necesarios en:

```bash
prisma/schema.prisma
```

Ejemplos:
- agregar modelos
- eliminar columnas
- modificar relaciones
- cambiar restricciones

En este punto, solo cambió el archivo local.  
La base de datos todavía no se actualizó.

---

## 2. Configurar la base de datos de testing

En `backend/.env`:

- descomenta la línea correspondiente a Neon de testing

---

## 3. Crear y aplicar la migración

Dentro del directorio /backend, ejecuta:

```bash
npx prisma migrate dev --name descripcion_del_cambio
```

Ejemplo:

```bash
npx prisma migrate dev --name agregar_tabla_pagos
```

Esto:
- genera el archivo SQL de migración
- actualiza la base de datos
- guarda el historial en `prisma/migrations`

---

## 4. Regenerar Prisma Client

Si los tipos no se actualizan correctamente, ejecuta:

```bash
npx prisma generate
```

También dentro del directorio /backend ejecuta`.

---

## 5. Programar la lógica

Con la migración aplicada, ya puedes actualizar:
- servicios
- controladores
- módulos
- frontend

---

# Pasar cambios a producción

## 1. Configurar variables de entorno

### En `/backend.env.`
- descomenta la línea correspondiente a Neon para producción

---

## 2. Ejecutar nuevamente la migración

Dentro del directorio /backend, ejecuta:

```bash
npx prisma migrate dev --name descripcion_del_cambio
```

## 3. Regenerar Prisma Client

```bash
npx prisma generate
```