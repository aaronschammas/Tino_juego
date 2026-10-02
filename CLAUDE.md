# Tino Feria — "Apagá el incendio con Tino"

Copia de Tino adaptada para la feria. El plan completo está en `Tino plan/Plan_Juego_Feria_Tino.pdf`
y el avance por fases en `FERIA_PROGRESO.md`.

## Reglas de trabajo (sección 14 del plan)

- Comentarios concisos solo arriba de cada función; nada en el medio del código.
- Al cerrar cada fase: escribir tests, correrlos y ejecutar `graphify update .`.
- Para preguntas sobre el código, consultar primero el grafo (`graphify query` / `path` / `explain`).
- Mantener la funcionalidad real de Tino: lo adaptado solo pierde referencias a lo eliminado,
  sin cambiar su aspecto ni su comportamiento.
- Todo corre local, sin internet. Lo único simulado: datos de demo y el transporte de WhatsApp.

## graphify

Este proyecto tiene un grafo de conocimiento en `graphify-out/`.

- Para preguntas sobre el código, primero `graphify query "<pregunta>"`. Usar `graphify path "<A>" "<B>"`
  para relaciones, `graphify explain "<concepto>"` para conceptos y `graphify affected "<X>"` para ver
  qué se rompe al borrar X.
- Leer `graphify-out/GRAPH_REPORT.md` solo para revisiones amplias de arquitectura.
- Después de modificar código, correr `graphify update .` (solo AST, sin costo de API). Tras borrar
  código, usar `graphify update . --force`.
