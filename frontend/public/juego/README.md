# Juego "Apagá el incendio con Tino"

Vanilla JavaScript + `<canvas>`, sin dependencias ni build. Todo el arte se genera por código.
Lo sirve el Next.js de Tino como archivo estático y se juega dentro de `/feria`, al lado de Tino real.

## Cómo funciona

El juego **no se controla con el teclado**: lee a Tino. Cada segundo hace `POST /api/demo/tick` y:

- La tarea con **timer activo** → el personaje camina solo hasta su objeto y trabaja (matafuegos, regadera, escoba...).
- Con cada segundo de timer el problema se achica; al llegar a los segundos de la tarea queda **resuelto** y
  el backend **apaga el timer solo**. Falta marcarla **Hecha** en Tino (si se marca antes, se resuelve al instante).
- **Consecuencias**: cada problema desatendido acumula peligro (el doble si se trabaja en algo menos urgente).
  Al llegar a cada etapa **se extiende**, **explota** o **empeora**, y aparece una tarea nueva en Tino (por ejemplo
  la subtarea "Fuego en el archivo"). El panel muestra la cuenta regresiva y el objeto titila en rojo antes.
- **Subtareas**: los problemas agrupados (por ejemplo "Apagar el incendio") se trabajan en cada subtarea, como en Tino.
- Si se elige una tarea menos urgente que otra pendiente, el personaje avisa.
- Cuando cambia algo en Tino (timer apagado, tareas nuevas), el juego avisa a /feria para que refresque el panel de Tino.

## Escenarios

| Escenario | Acciones (tareas de Tino) |
|---|---|
| `oficina` — La oficina en llamas | incendio con subtareas servidor e impresora (→ archivo, escombros, tóner), teléfono (→ reclamo por mail), planta |
| `casa` — La casa patas arriba | sartén (→ cortinas, hollín), basura (→ cucarachas), ordenar la casa con subtareas platos, polvo y cama |
| `jardin` — El jardín abandonado | canilla (→ sótano inundado, caño reventado), parrilla (→ pasto seco en llamas), arreglar el jardín con subtareas huerta (→ replantar), pasto y cerca |

Las tareas, prioridades y segundos de trabajo se definen en el backend
(`backend/src/modules/demo/demo-scenarios.ts`); acá vive cómo se ven (`js/scenarios.js` y `js/art.js`).

## Estructura

| Archivo | Responsabilidad |
|---|---|
| `js/main.js` | Arma el escenario y el game loop (paso fijo 60 Hz + render interpolado) |
| `js/rules.js` | Reglas sin DOM: progreso de cada tarea y qué hace el personaje (testeadas en `src/game/juego.spec.ts`) |
| `js/tino.js` | Consulta el estado de Tino |
| `js/scenarios.js` | Mapas de cada escenario y qué hace cada acción |
| `js/art.js` / `js/sprites.js` / `js/pixel.js` | Pixel art procedural: objetos, bloques, personaje |
| `js/effects.js` | Partículas: fuego, humo, espuma, agua, polvo, moscas, brillitos |
| `js/player.js` | El personaje: camino, dirección y animaciones |
| `js/map.js` | Mapa, orden de dibujado y búsqueda de camino |
| `js/renderer.js` / `js/camera.js` / `js/iso.js` | Dibujo isométrico con escala entera sin suavizado |
| `js/hud.js` | Panel de tareas y globo de diálogo en HTML |

Para probarlo suelto: http://localhost:3000/juego/index.html?escenario=casa (con `.\feria.ps1` levantado).
