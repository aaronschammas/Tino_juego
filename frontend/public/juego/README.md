# Tino 2.5D — base de juego isométrico pixel art

Vanilla JavaScript + `<canvas>`, sin dependencias ni build. Todo el arte se genera por código.

## Ejecutar

Lo sirve el Next.js de Tino como archivo estático: con `.\feria.ps1` levantado, abrir
http://localhost:3000/juego/index.html (o "Empezar a jugar" en la página de inicio, que lo muestra
al lado de Tino en /feria). **WASD / Flechas** mover · **Shift** correr · **Espacio** saltar.

Es el prototipo previo a la fase 2 del plan, donde el juego pasa a Phaser.

## Estructura

| Archivo | Responsabilidad |
|---|---|
| `js/main.js` | Inicialización y **game loop** (update a paso fijo 60 Hz + render interpolado) |
| `js/config.js` | Resolución interna, tamaño de tiles, física, teclas |
| `js/iso.js` | Proyección mundo ⇄ pantalla (`worldToScreen`, `screenToWorld`) |
| `js/map.js` | Mapa en texto (`LEVEL_1`), leyenda, colisiones y orden de dibujado |
| `js/player.js` | Movimiento X/Y, salto y gravedad en Z, animación |
| `js/renderer.js` | Escalado entero, painter's algorithm, culling |
| `js/camera.js` | Seguimiento suave con posición entera (sin temblor) |
| `js/sprites.js` / `js/pixel.js` | Generación procedural de bloques, árboles, sombras y personaje |
| `js/prop.js` | Objetos estáticos (árboles) |

## Ejes del mundo

- **X**: diagonal abajo-derecha en pantalla · **Y**: diagonal abajo-izquierda · **Z**: altura (niveles).
- El input es relativo a la pantalla y se rota 45° al espacio isométrico (`player.js`).

## Editar el mapa

Cambiá las filas de `LEVEL_1` en `js/map.js` (todas del mismo largo):
`.` pasto · `,` flores · `:` camino · `~` agua · `1` `2` bloques de pasto · `3` piedra · `T` árbol · `@` inicio.
