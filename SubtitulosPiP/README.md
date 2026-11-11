# Subtítulos PiP

Extensión para navegadores Chromium (Opera GX, Chrome, Edge, Brave) que abre el vídeo en una
ventana flotante «imagen en imagen» **con los subtítulos visibles y personalizables**. La
ventana queda siempre encima, también fuera del navegador (sobre juegos, Discord o el escritorio).

## Instalar (Opera GX)
1. Abre `opera://extensions` y activa **Modo desarrollador**.
2. Pulsa **Cargar descomprimida** y elige la carpeta `SubtitulosPiP`.
3. Recarga las pestañas que ya tenías abiertas con vídeos.
(En Chrome es `chrome://extensions`; en Edge, `edge://extensions`.)

## Uso
- Pasa el ratón por encima del vídeo y pulsa **⧉ CC**, usa **Alt+P** o el botón PiP del propio sitio.
- En la ventana PiP: Espacio/K reproducir · J/L ±10 s · ←/→ ±5 s · ↑/↓ volumen · C subtítulos ·
  V cambiar modo · +/− tamaño · M silenciar · Esc cerrar. Los botones aparecen al mover el ratón.

## Modos
- **Escala**: los subtítulos crecen y se encogen con el vídeo, con las mismas líneas que en el reproductor.
- **Tamaño fijo**: conservan su tamaño original (× «Tamaño relativo»); el texto se reacomoda y caben menos palabras por línea.
- **Fuera del vídeo**: una franja debajo o encima del vídeo; en «Automática» lo que estaba arriba va a la franja superior.

En todos los modos se conservan el color, la negrita, la cursiva, el subrayado, el fondo, la sombra,
la posición (arriba/abajo, izquierda/centro/derecha) y las actualizaciones rápidas (karaoke, roll-up).

## De dónde saca los subtítulos
1. Pistas nativas WebVTT del `<video>`.
2. Subtítulos en HTML de reproductores conocidos (YouTube, Netflix, Prime Video, Disney+, Vimeo, Twitch,
   Video.js, JW Player, Plyr, Shaka…) y búsqueda genérica.
3. Subtítulos dibujados en `<canvas>` (ASS/libass); estos solo se escalan con el vídeo.
Si un sitio no funciona: popup → **Elegir manualmente** → señala el subtítulo (↑ para el contenedor) y haz clic.

## Limitaciones
- Usa Document Picture-in-Picture (Chromium 116+). Si el vídeo está dentro de un iframe de otro sitio,
  ábrelo en su propia pestaña.
- El navegador exige un clic o una tecla para abrir la ventana; si la abres desde el popup, aparece un botón en la página.
- Desactiva el «Video pop-out» propio de Opera si te confunde: ese no muestra subtítulos.
- Si el sitio pausa su reproductor en segundo plano (vídeo silenciado, pestaña minimizada), los subtítulos HTML pueden retrasarse.
