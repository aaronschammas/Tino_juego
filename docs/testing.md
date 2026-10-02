# Estrategia y Documentación de Testing

Este documento describe la estrategia de pruebas unitarias, de integración y el mapa de ruta (roadmap) de calidad del software para la aplicación Tino Tasks.

---

## 1. Filosofía de Pruebas

Todas las pruebas en este proyecto deben seguir el patrón estructurado **AAA (Arrange, Act, Assert)** para garantizar la legibilidad y mantenibilidad del código:

1. **Arrange (Organizar)**: Configurar el escenario, inicializar los objetos, definir mocks y preparar los datos necesarios.
2. **Act (Actuar)**: Ejecutar la función o método específico bajo prueba.
3. **Assert (Afirmar)**: Verificar que el resultado obtenido coincide exactamente con el comportamiento esperado.

---

## 2. Pruebas Unitarias

Las pruebas unitarias se ejecutan de manera aislada tanto en el backend como en el frontend utilizando **Jest** como motor principal de ejecución.

### Cobertura Objetivo
- **Meta del proyecto**: Alcanzar y mantener como mínimo un **70% de cobertura (coverage)** de código en sentencias, ramas y funciones clave.

### Comandos de Ejecución

Para simplificar la Developer Experience (DX), ambos entornos (`/backend` y `/frontend`) comparten los mismos comandos estandarizados de ejecución de pruebas:

* **Ejecutar pruebas con reporte de cobertura**:
  ```bash
  npm run test:cov
  ```
  *Este comando genera una carpeta `/coverage` con un reporte interactivo en formato HTML.*
  *Reporte backend: `/backend/coverage/lcov-report/index.html`*
  *Reporte frontend: `/frontend/coverage/lcov-report/index.html`*

* **Ejecutar pruebas en modo observador (watch mode)**:
  ```bash
  npm run test:watch
  ```
---

## 3. Infraestructura de Pruebas por Componente

### Backend (`/backend`)
- **Framework**: NestJS Testing Utilities (`@nestjs/testing`).
- **Motor**: Jest + `ts-jest` para soporte nativo de TypeScript.
- **Enfoque**: Inyección de dependencias mockeadas para aislar la lógica de negocio de la base de datos (PostgreSQL/Prisma).

### Frontend (`/frontend`)
- **Framework**: Next.js + React Testing Library.
- **Entorno**: JSDOM (`jest-environment-jsdom`) para simular la API del navegador.
- **Enfoque**: Pruebas de renderizado de componentes, eventos de usuario mediante `@testing-library/user-event` y validación de flujos reactivos.

---

## 4. Hoja de Ruta de Calidad (A Futuro)

Para robustecer la estabilidad del sistema a largo plazo, se planea implementar:

1. **Pruebas de Integración y E2E**:
   - Incorporación de **Cypress** para simular flujos de usuario reales de extremo a extremo, automatizándose dentro de los pipelines de integración continua.
2. **Pruebas de Carga e Infraestructura**:
   - Implementación de herramientas de análisis de estrés (por ejemplo, **k6**).
   - Configuración de monitoreo y observabilidad del comportamiento del sistema bajo estrés utilizando **Prometheus** y **Grafana**.
