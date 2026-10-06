# Un día en la oficina · Tino

Juego estático (HTML + CSS + JavaScript, sin dependencias, sin build y sin base de datos) para jugar desde el celular.
La mitad del juego **es Tino**: la página de un proyecto con las mismas tarjetas, botones, textos y pasos que la app
real. El personaje hace en la oficina lo que se maneja desde Tino, con minijuegos estilo Among Us.
Una partida dura unos 2 o 3 minutos y termina con estadísticas.

El tiempo de la oficina va acelerado: **1 segundo real = 1 minuto** (el día arranca 09:00). Así las estimaciones,
el cronómetro y los vencimientos se ven como en Tino (0 h 15 min, 📅 09:45...).

## Lo que se aprende de Tino

| En Tino | En el juego |
|---|---|
| Tarjeta de tarea: tipo, avatar, prioridad, estado, 📅 vencimiento, "Real / Est" (rojo si se pasa) | Igual |
| ⏱️ "Registrar tiempo" → **Configurar duración** → **Iniciar cronómetro** (propone lo que falta de la estimación) | El personaje va a la tarea y se abre el minijuego |
| La tarea se asigna sola y pasa a **En progreso** | Igual |
| "Ya tienes un timer activo. Detenlo antes de cambiar de tarea." | Igual |
| Tarea padre: "Inicia el timer en una subtarea"; su estado sigue a las subtareas | "Se cayó el sistema" con 2 subtareas |
| **Temporizador** flotante: pausa, **Finalizar y Completar Tarea**, **Detener temporizador** | Cerrar el minijuego con ✕ pausa el timer |
| **¡Tiempo cumplido!**: +5 / +10 / +15 / +30 min o "Finalizar aquí" | Agregar tiempo sigue el minijuego |
| Menú **→**: Mover a En progreso / Bloqueadas / Completadas | Completar exige el trabajo hecho |
| ✓ Tomar tarea, vista **Lista / Tablero**, indicadores del proyecto, Seguimiento | Igual |

No hay instrucciones escritas: el control que hay que tocar late (⏱, Iniciar cronómetro, Finalizar y Completar, →,
+5 min...). Elegir una tarea menos urgente que otra pendiente es un error de prioridad (la tarjeta correcta tiembla).

| Tarea | Prioridad | Estimación | Llega / vence | Minijuego |
|---|---|---|---|---|
| Se cayó el sistema → Reconectar los cables del rack | Crítica | 15 min | 09:00 / 09:40 | Conectar los 4 cables a su color |
| Se cayó el sistema → Reiniciar el servidor | Crítica | 15 min | 09:00 / 10:00 | Tocar del 1 al 10 en orden |
| Llevarle un café al jefe | Media | 12 min | 09:00 / 10:50 | Preparar el café pedido (tipo, azúcar y taza) |
| Recibir al cliente | Alta | 8 min | 09:20 / 10:05 | Pasar la tarjeta a la velocidad justa |

**Puntos** por tarea: 100 si se completa a tiempo (40 si queda vencida), +20 si el tiempo real no pasa la estimación
y hasta +30 según cómo salió el minijuego; −25 por cada error de prioridad. El mejor puntaje se guarda en el celular.

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
| `js/sim.js` | La partida sin DOM con las reglas de Tino: tareas y subtareas, estados, cronómetro con duración, tiempo cumplido, vencimientos, puntos y estadísticas |
| `js/scenario.js` | Tareas, cómo se ve cada una y el mapa de la oficina |
| `js/tino.js` | Tino dentro del juego: página del proyecto, tarjetas, Lista/Tablero, menú de estados, Configurar duración, Temporizador y ¡Tiempo cumplido! |
| `js/hud.js` | Puntos, globo del personaje, avisos y estadísticas finales |
| `js/minigames/` | Los 4 minijuegos (`cables`, `cafe`, `tarjeta`, `pc`) y la ventana que los abre |
| `js/art.js` / `js/sprites.js` / `js/pixel.js` | Pixel art generado por código |
| `js/effects.js` | Partículas: chispas, vapor, brillitos |
| `js/player.js` / `js/map.js` | Personaje, caminos y orden de dibujado |
| `js/renderer.js` / `js/camera.js` / `js/iso.js` | Dibujo isométrico escalado sin suavizado |
