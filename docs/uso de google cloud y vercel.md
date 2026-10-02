# Guía de Uso: Google Cloud Platform y Vercel

Este documento detalla el uso, configuración y arquitectura de despliegue para los servicios de infraestructura del proyecto, utilizando **Google Cloud Run** para el backend y **Vercel** para el frontend.

---

## 1. Google Cloud Run (Backend)

Google Cloud Run es un servicio serverless de cómputo basado en contenedores bajo un esquema de **pago por uso**. El backend se escala automáticamente a cero cuando no recibe tráfico para optimizar costes.

### Flujo de Uso e Integración
- **Autenticación Segura (WIF)**: En lugar de usar claves JSON estáticas de cuentas de servicio, los pipelines de CI/CD utilizan **Workload Identity Federation (WIF)** para obtener tokens de corta duración de manera segura.
- **Variables de Entorno**: Las variables y secretos de producción y testing (como `DATABASE_URL`, `JWT_SECRET`, etc.) se inyectan en tiempo de despliegue mediante un archivo temporal `/tmp/env-vars.yaml` administrado por GitHub Secrets.
- **Comando de Despliegue Clave**:
  ```bash
  gcloud run deploy tino-backend-[entorno] \
    --image docker.io/[user]/[imagen]:[tag] \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --port 8080 \
    --memory [512Mi | 2Gi] \
    --cpu 1 \
    --env-vars-file /tmp/env-vars.yaml
  ```

---

## 2. Vercel (Frontend)

Vercel hospeda la aplicación Next.js, proveyendo despliegues automáticos rápidos y enrutamiento optimizado a nivel global.

### Flujo de Uso e Integración
- **Enlace de Entorno**: Los pipelines se enlazan al proyecto en Vercel mediante `vercel pull --yes --environment=[preview|production]`.
- **Inyección de API URL**: La URL dinámica generada por Cloud Run se le pasa a Vercel en tiempo de compilación y ejecución (`NEXT_PUBLIC_API_URL`).
- **Comandos Clave**:
  - **Testing (Alias Fijo)**:
    ```bash
    vercel deploy --yes --build-env NEXT_PUBLIC_API_URL="..."
    vercel alias set [URL_GENERADA] tino-tasks-testing.vercel.app
    ```
  - **Producción (Despliegue Directo)**:
    ```bash
    vercel deploy --yes --prod --build-env NEXT_PUBLIC_API_URL="..."
    ```

---

## 3. Facturación e Impacto de Costos

- **Cloud Run**: Costo basado estrictamente en el tiempo de procesamiento activo (cuando procesa peticiones HTTP), configurando `--min-instances 0` para evitar costos fijos cuando la plataforma está inactiva.
- **Vercel**: Plan Hobby/Pro con despliegues y ancho de banda optimizados. 

---

## 4. Evolución de la Infraestructura (A Futuro)

Para mitigar riesgos operativos y unificar la nube, se contempla la posibilidad de migrar el frontend desde Vercel hacia proveedores alternativos:
- **Cloudflare Pages** o **Google Firebase App Hosting**:
  - **Razón**: Mayor confiabilidad al consolidar la infraestructura en proveedores globales robustos. Evita depender de plataformas externas como Vercel y centraliza la resiliencia en redes de la misma escala que Google Cloud / Cloudflare.