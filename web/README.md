# Un día en la oficina · Tino

Juego estático (HTML + CSS + JavaScript, sin dependencias, sin build y sin base de datos) para jugar desde el celular.
Se organiza el día con **Tino**: se inicia el timer de una tarea, el personaje va a resolverla, se juega un minijuego
estilo Among Us y se completa la tarea en Tino. Una partida dura entre 1 y 3 minutos y termina con estadísticas.

## Cómo se juega

1. Tocá **▶ Iniciar** en una tarea de Tino (el botón que late es el más urgente).
2. El personaje camina hasta el problema y se abre el minijuego.
3. Al resolverlo, el timer se apaga solo: tocá **✓ Completar**.
4. Cada tarea vence: si se completa tarde queda como **completada vencida** (suma menos puntos).
5. Elegir algo menos urgente que otra tarea pendiente es un error de prioridad (la tarjeta correcta tiembla).

| Tarea | Prioridad | Llega / vence | Minijuego |
|---|---|---|---|
| Se cayó internet | Crítica | 0 s / 45 s | Conectar los 4 cables a su color |
| Responder el reclamo por mail | Alta | 0 s / 75 s | Desbloquear la PC tocando del 1 al 10 |
| Llevarle un café al jefe | Media | 0 s / 100 s | Preparar el café pedido (tipo, azúcar y taza) |
| Recibir al cliente | Alta | 20 s / 60 s | Pasar la tarjeta a la velocidad justa |

**Puntos**: 100 por tarea a tiempo, 40 por vencida, hasta 30 extra según cómo salió el minijuego y −25 por cada
error de prioridad. El mejor puntaje se guarda en el celular.

Las tareas, prioridades y plazos están en `js/scenario.js`; el link del botón "Conocé Tino" en `js/config.js` (`TINO_URL`).

## Probarlo en la PC y en el celular

```bash
node serve.mjs
```

Abre `http://localhost:8080` y muestra la dirección para el celular (tiene que estar en la misma red Wi-Fi).
Tests de la lógica: `node --test tests/*.test.js` (Node 18 o más nuevo).

## Subirlo a GitHub Pages (gratis)

1. Crear un repositorio **público** nuevo en GitHub, por ejemplo `tino-oficina`.
2. Subir el **contenido** de esta carpeta (`index.html` tiene que quedar en la raíz del repositorio):
   ```bash
   git init
   git add .
   git commit -m "Un día en la oficina"
   git branch -M main
   git remote add origin https://github.com/USUARIO/tino-oficina.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.
4. En 1 o 2 minutos queda en `https://USUARIO.github.io/tino-oficina/`. Con ese link se arma el QR del stand.

Para bajarlo después del evento: **Settings → Pages → Unpublish site** (o borrar el repositorio).

## Estructura

| Archivo | Qué hace |
|---|---|
| `js/main.js` | Arma la oficina y el game loop (paso fijo 60 Hz); abre el minijuego cuando el personaje llega |
| `js/sim.js` | La partida sin DOM: tareas, timer, vencimientos, errores de prioridad, puntos y estadísticas |
| `js/scenario.js` | Tareas, cómo se ve cada una y el mapa de la oficina |
| `js/tino.js` | Panel que imita a Tino: tarjetas con prioridad, estado, vencimiento, timer y completar |
| `js/hud.js` | Puntos, globo del personaje, avisos y estadísticas finales |
| `js/minigames/` | Los 4 minijuegos (`cables`, `cafe`, `tarjeta`, `pc`) y la ventana que los abre |
| `js/art.js` / `js/sprites.js` / `js/pixel.js` | Pixel art generado por código |
| `js/effects.js` | Partículas: chispas, vapor, brillitos |
| `js/player.js` / `js/map.js` | Personaje, caminos y orden de dibujado |
| `js/renderer.js` / `js/camera.js` / `js/iso.js` | Dibujo isométrico escalado sin suavizado |
