// Traducción de la interfaz al inglés. La interfaz está escrita en español; cuando el idioma es «en»,
// cada texto que aparece en pantalla se cambia por su versión en inglés (también los que llegan después).
// Lo que escribe la gente (mensajes, publicaciones, nombres...) no se toca.
const EN = {
  // --- Generales y menús
  'Inicio': 'Home', 'Archivo': 'File', 'Contactos': 'Contacts', 'Foros': 'Forums', 'Herramientas': 'Tools', 'Ayuda': 'Help',
  'Chats': 'Chats', 'Info': 'Info', 'Cortos': 'Shorts', 'Mis publicaciones': 'My posts', 'Categorías': 'Categories',
  'Aceptar': 'OK', 'Cancelar': 'Cancel', 'Cerrar': 'Close', 'Guardar': 'Save', 'Guardar...': 'Save...', 'Borrar': 'Delete', 'Eliminar': 'Remove',
  'Quitar': 'Remove', 'Abrir': 'Open', 'Abrir ↗': 'Open ↗', 'Abrir chat': 'Open chat', 'Enviar': 'Send', 'Copiar': 'Copy', 'Salir': 'Exit',
  'Más tarde': 'Later', 'No': 'No', 'Error': 'Error', 'Ver': 'View', 'Cambiar': 'Change', 'Mostrar': 'Show', 'Ocultar': 'Hide',
  'Minimizar': 'Minimize', 'Maximizar': 'Maximize', 'Restaurar': 'Restore', 'Ampliar': 'Enlarge', 'Reducir': 'Shrink', 'Ventana': 'Window',
  'Responder': 'Reply', 'Descargar': 'Download', 'Descargando...': 'Downloading...', 'Recibiendo...': 'Receiving...',
  'Cargando...': 'Loading...', 'Resultado': 'Result', 'Seguridad': 'Security', 'Persona': 'Person', 'Autor': 'Author',
  'Perfil': 'Profile', 'Imagen': 'Picture', 'Apariencia': 'Appearance', 'Nombre': 'Name', 'Descripción': 'Description', 'Icono': 'Icon',
  '¡Copiado!': 'Copied!', '← Volver': '← Back', '← Volver a Inicio': '← Back to Home', 'Bienvenido': 'Welcome',
  'Acerca de': 'About', 'Acerca de mí': 'About me', 'Algo falló:': 'Something went wrong:', '. Inténtalo de nuevo.': '. Please try again.',
  'Sesión caducada: recarga la página.': 'Session expired: reload the page.', 'Puedes cerrar esta pestaña. Tu sesión sigue iniciada.': 'You can close this tab. You are still signed in.',
  // --- Estados
  'Disponible': 'Available', 'Ocupado': 'Busy', 'Ausente': 'Away', 'Desconectado': 'Offline', 'Aparecer desconectado': 'Appear offline',
  'Conectado al servidor': 'Connected to server', 'Conectando con el servidor...': 'Connecting to server...', 'Pendiente': 'Pending',
  'Contacto': 'Contact', 'Solicitud enviada': 'Request sent', 'Bot inútil': 'Useless bot',
  // --- Cabecera y perfil
  'Tu código personal': 'Your personal code', 'tu código': 'your code', 'Editar perfil': 'Edit profile', 'Cerrar sesión': 'Sign out',
  'Copiar mi código': 'Copy my code', 'Copiar código': 'Copy code', 'Escribe un mensaje personal...': 'Write a personal message...',
  'Añadir un mensaje temporal...': 'Add a temporary message...', 'Haz clic para cambiar tu nombre': 'Click to change your name',
  'Cambiar tu imagen': 'Change your picture', 'Cambiar imagen': 'Change picture', 'Tu perfil': 'Your profile',
  'Mensaje personal': 'Personal message', 'Mensaje temporal': 'Temporary message', 'Estado de ánimo': 'Mood', 'Código personal': 'Personal code',
  'Contactos desde': 'Contacts since', 'Sin descripción todavía.': 'No description yet.', 'Sin descripción.': 'No description.',
  'Ninguno.': 'None.', 'Ninguno': 'None', 'Haz clic en «Añadir un mensaje temporal» arriba.': 'Click «Add a temporary message» above.',
  'Se muestra siempre bajo tu nombre': 'Always shown under your name', 'Cuéntales algo a tus contactos...': 'Tell your contacts something...',
  'Ej.: En clase hasta las 3 (A)': 'E.g.: In class until 3 (A)', 'Tus contactos verán este mensaje junto a tu nombre hasta que caduque.': 'Your contacts will see this message next to your name until it expires.',
  'Duración:': 'Duration:', 'Publicar': 'Post', 'Eres tú.': "That's you.",
  '30 minutos': '30 minutes', '1 hora': '1 hour', '4 horas': '4 hours', '8 horas': '8 hours', '24 horas': '24 hours', '3 días': '3 days', '1 semana': '1 week',
  // Estados de ánimo
  'Feliz': 'Happy', 'Genial': 'Great', 'Con sueño': 'Sleepy', 'Triste': 'Sad', 'Enfadado': 'Angry', 'Pensativo': 'Thoughtful', 'De fiesta': 'Partying',
  'Enfermo': 'Sick', 'Enamorado': 'In love', 'Sorprendido': 'Surprised', 'Travieso': 'Naughty', 'Angelical': 'Angelic', 'Jugando': 'Gaming',
  'Estudiando': 'Studying', 'Trabajando': 'Working', 'Comiendo': 'Eating', 'Tomando café': 'Having coffee', 'Escuchando música': 'Listening to music',
  'De cumpleaños': "It's my birthday",
  // --- Editor de perfil y apariencia
  'Perfil y apariencia': 'Profile and appearance', 'Subir imagen...': 'Upload picture...', 'Elige una imagen clásica o sube una tuya.': 'Pick a classic picture or upload your own.',
  'Tu imagen': 'Your picture', 'Estilo de la app': 'App style', 'Temas del cristal': 'Glass themes', 'Temas': 'Themes', 'Personalizado': 'Custom',
  'Color del cristal': 'Glass color', 'Color de los títulos': 'Title color', 'Transparencia del cristal:': 'Glass transparency:',
  'Fondo de la ventana': 'Window background', 'Fondo de las conversaciones': 'Chat background', 'Burbujas flotando': 'Floating bubbles',
  'Reflejos en el cristal': 'Glass reflections', 'Sonidos': 'Sounds', 'Tus contactos verán tu perfil. La apariencia es solo para ti.': 'Your contacts will see your profile. Appearance is only for you.',
  'Idioma': 'Language',
  'Aero (Windows 7)': 'Aero (Windows 7)', 'Oscuro (tipo Discord)': 'Dark (Discord-like)', 'Claro (tipo Instagram)': 'Light (Instagram-like)',
  'Aero azul': 'Aero blue', 'Esmeralda': 'Emerald', 'Océano': 'Ocean', 'Chicle': 'Bubblegum', 'Atardecer': 'Sunset', 'Violeta': 'Violet', 'Grafito': 'Graphite',
  'Colinas': 'Hills', 'Nubes': 'Clouds', 'Noche': 'Night', 'Aurora': 'Aurora', 'Liso': 'Plain',
  'Blanco': 'White', 'Cielo': 'Sky', 'Cuaderno': 'Notebook', 'Burbujas': 'Bubbles', 'Crema': 'Cream',
  // Avatares
  'Patito de goma': 'Rubber duck', 'Balón de fútbol': 'Soccer ball', 'Margarita': 'Daisy', 'Perrito': 'Puppy', 'Gatito': 'Kitten', 'Ajedrez': 'Chess',
  'Guitarra': 'Guitar', 'Mariposa': 'Butterfly', 'Pececito': 'Little fish', 'Playa': 'Beach', 'Cohete': 'Rocket', 'Baloncesto': 'Basketball', 'Robot': 'Robot',
  'Tulipanes': 'Tulips', 'Coche': 'Car', 'Planeta': 'Planet', 'Marciano': 'Alien', 'Pingüino': 'Penguin', 'Arcoíris': 'Rainbow', 'Auriculares': 'Headphones',
  'Videojuegos': 'Video games', 'Magdalena': 'Cupcake', 'Luna': 'Moon', 'Cactus': 'Cactus', 'Mundo': 'World',
  ': puedes compartir tu pantalla y seguir usando la app durante la llamada.': ': you can share your screen and keep using the app during the call.',
  'Todo va cifrado de extremo a extremo; las llamadas van directas entre las dos PCs.': 'Everything is end-to-end encrypted; calls go directly between the two PCs.',
  // --- Contactos
  'Buscar contactos...': 'Search contacts...', 'Buscar en mis foros...': 'Search my forums...', '＋ Agregar': '＋ Add', 'Agregar': 'Add',
  'Agregar un contacto con su código': 'Add a contact with their code', 'Agregar un contacto': 'Add a contact', 'Agregar contacto': 'Add contact',
  '＋ Agregar a contactos': '＋ Add to contacts', 'Nadie conectado ahora mismo.': 'Nobody online right now.', 'Nadie conectado ahora.': 'Nobody online now.',
  'Agrega amigos con su código: botón ＋ Agregar.': 'Add friends with their code: ＋ Add button.', 'Esperando a que acepte...': 'Waiting for them to accept...',
  'Eliminar contacto': 'Remove contact', 'Cancelar solicitud': 'Cancel request', 'Buscando a esa persona en el servidor...': 'Looking for that person on the server...',
  'o el código personal de la persona que quieres agregar:': 'or the personal code of the person you want to add:', 'Escribe el': 'Type the',
  '. Compártelos para que también te puedan agregar.': '. Share them so others can add you too.',
  'Esa persona ya está en tu lista.': 'That person is already in your list.', 'Ya le enviaste una solicitud. Falta que la acepte.': 'You already sent a request. They still need to accept it.',
  'Esa persona ya te había enviado una solicitud. ¡Ahora son contactos!': 'That person had already sent you a request. You are now contacts!',
  'Ese es tu propio código. Agregarte a ti mismo sería... muy Nada Messenger.': "That's your own code. Adding yourself would be... very Nada Messenger.",
  'Escribe un nombre de usuario o un código WIND-XXXX-XXXX.': 'Type a username or a WIND-XXXX-XXXX code.',
  'No se encontró a nadie con ese código.': 'Nobody was found with that code.',
  'Revisa que esté bien escrito y que esa persona haya abierto Wind OS Messenger al menos una vez.': 'Check the spelling and that the person has opened Wind OS Messenger at least once.',
  'No existe ningún usuario llamado': 'There is no user called', 'Solicitud enviada a': 'Request sent to', 'Aparecerá en tu lista en cuanto la acepte.': 'They will appear in your list once they accept.',
  'acepte tu solicitud. Cuando lo haga, verás su perfil y podrán chatear.': 'accepts your request. When they do, you will see their profile and can chat.',
  'Esperando a que': 'Waiting for', 'Si no está conectado, la solicitud le llegará cuando abra Wind OS Messenger (con tu programa abierto).': "If they're offline, the request will arrive when they open Wind OS Messenger (while your app is open).",
  'Rechazaste la solicitud de': 'You declined the request from', 'acaba de iniciar sesión.': 'just signed in.', 'aceptó tu solicitud. ¡Ya pueden chatear! (Y)': 'accepted your request. You can chat now! (Y)',
  'de tus contactos?': 'from your contacts?', '¿Eliminar a': 'Remove', 'También se borrará el historial de la conversación.': 'The conversation history will also be deleted.',
  '¿Cancelar la solicitud a': 'Cancel the request to',
  // --- Chat
  'Escribe un mensaje... (puedes pegar o arrastrar imágenes)': 'Type a message... (you can paste or drag images)', 'Escribe un mensaje...': 'Type a message...',
  'Adjuntar': 'Attach', 'Nota de voz': 'Voice note', 'Zumbido': 'Nudge', 'Fuente': 'Font', 'Emoticonos': 'Emoticons', 'Emoticonos:': 'Emoticons:', 'Stickers': 'Stickers',
  'Llamar': 'Call', 'Cifrado': 'Encrypted', 'Bot local': 'Local bot', 'Has enviado un zumbido.': 'You sent a nudge.',
  'No puedes enviar zumbidos con tanta frecuencia.': "You can't send nudges that often.", '✓ enviado': '✓ sent', '✓✓ entregado': '✓✓ delivered',
  'Imagen o GIF': 'Image or GIF', 'Música o audio': 'Music or audio', 'Vídeo': 'Video', 'Cualquier archivo': 'Any file', '[vídeo]': '[video]',
  'Ese archivo todavía no se ha descargado.': "That file hasn't been downloaded yet.",
  'Por seguridad, los programas y scripts no se abren directamente. Usa «Guardar» y revísalo antes.': 'For safety, programs and scripts are not opened directly. Use «Save» and check it first.',
  'No se pudo leer esa imagen.': "Couldn't read that image.", 'El navegador solo deja usar el micrófono en páginas seguras (https).': 'Browsers only allow the microphone on secure pages (https).',
  'Abre la versión web con el enlace https (el de VS Code) en lugar de la dirección http de tu red.': 'Open the web version with the https link (the VS Code one) instead of your network http address.',
  'No se pudo usar el micrófono. Revisa que esté conectado y que hayas dado permiso.': "Couldn't use the microphone. Check it's connected and you gave permission.",
  'No se pudo usar el micrófono. Revisa que esté conectado y que el permiso no esté bloqueado.': "Couldn't use the microphone. Check it's connected and permission isn't blocked.",
  'Detenido': 'Stopped', 'En pausa': 'Paused', 'Reproduciendo': 'Playing', 'Finalizado': 'Finished', 'Audio': 'Audio',
  'Silenciar': 'Mute', 'Volumen': 'Volume', 'Reproducir': 'Play', 'Detener': 'Stop', 'Pantalla completa': 'Full screen',
  // --- Llamadas
  'Llamada': 'Call', 'Llamando...': 'Calling...', 'Te está llamando...': 'Is calling you...', 'Conectando...': 'Connecting...', 'En llamada': 'In call',
  'Contestar': 'Answer', 'Rechazar': 'Decline', 'Colgar': 'Hang up', 'Activar micro': 'Unmute', 'Compartir pantalla': 'Share screen',
  'Dejar de compartir': 'Stop sharing', 'Llamada entrante': 'Incoming call', 'Llamada perdida.': 'Missed call.', 'Llamada cancelada.': 'Call cancelled.',
  'Rechazaste la llamada.': 'You declined the call.', 'Se perdió la conexión.': 'Connection lost.', 'Ya estás en una llamada.': "You're already in a call.",
  'Llamada de voz (con pantalla compartida)': 'Voice call (with screen sharing)', 'Se colgará la llamada en curso.': 'The current call will be ended.',
  'está desconectado. Solo puedes llamar a contactos conectados.': 'is offline. You can only call online contacts.',
  'Este dispositivo no permite compartir la pantalla (los teléfonos no suelen dejar). Sí puedes ver la pantalla que comparta la otra persona.': "This device can't share its screen (phones usually can't). You can still see the other person's screen.",
  'No se pudo conectar la llamada. Suele pasar cuando una de las dos redes (de empresa, colegio o datos móviles)': "The call couldn't connect. This usually happens when one of the networks (work, school or mobile data)",
  'bloquea las conexiones directas. Solución: configura un servidor TURN en Archivo › Configurar llamadas.': 'blocks direct connections. Fix: set up a TURN server in File › Call settings.',
  'Configurar llamadas': 'Call settings', 'Guardado (sin servidor TURN).': 'Saved (no TURN server).', 'Guardado. Las próximas llamadas usarán ese servidor si hace falta.': 'Saved. Next calls will use that server if needed.',
  'Si las llamadas no conectan entre redes distintas (datos móviles, redes de empresa o colegio), hace falta un servidor': "If calls don't connect between different networks (mobile data, work or school networks), you need a",
  'Puedes conseguir uno gratis en': 'You can get one for free at', '(20 GB al mes) y copiar aquí sus datos:': '(20 GB per month) and paste its details here:',
  'Dirección (por ejemplo turn:global.relay.metered.ca:443)': 'Address (e.g. turn:global.relay.metered.ca:443)', 'Usuario': 'Username', 'Contraseña': 'Password',
  // --- Inicio
  'Conectados': 'Online', 'Tus foros': 'Your forums', 'Explora foros': 'Explore forums', 'para unirte a alguno.': 'to join one.',
  'Fotos / vídeos': 'Photos / videos', 'Categoría...': 'Category...', 'Categoría': 'Category', 'Publicar como corto': 'Post as short',
  'Me gusta': 'Like', 'Comentarios': 'Comments', 'Escribe un comentario...': 'Write a comment...', 'Cargando publicaciones...': 'Loading posts...',
  'Aún no hay publicaciones. ¡Comparte la primera!': 'No posts yet. Share the first one!', 'Todavía no has publicado nada.': "You haven't posted anything yet.",
  'No hay publicaciones aquí todavía.': 'No posts here yet.', 'Personas sugeridas': 'Suggested people', 'Foros sugeridos': 'Suggested forums',
  'Categorías populares': 'Popular categories', 'Cargando sugerencias...': 'Loading suggestions...', 'Ver sus publicaciones': 'See their posts',
  'Cuando haya más gente publicando, aparecerán aquí.': 'When more people post, they will show up here.', 'No hay foros públicos nuevos ahora mismo.': 'No new public forums right now.',
  'Ninguno de tus contactos está conectado.': 'None of your contacts is online.', 'Vídeo de YouTube': 'YouTube video',
  '¿Borrar esta publicación? Desaparecerá para todo el mundo.': 'Delete this post? It will disappear for everyone.',
  'Escribe algo o añade fotos o vídeos.': 'Write something or add photos or videos.', 'No se pudo publicar.': "Couldn't post.",
  'Puedes poner hasta 10 fotos o vídeos por publicación.': 'You can add up to 10 photos or videos per post.', 'Publicaciones de': 'Posts by',
  'Cargando cortos...': 'Loading shorts...', 'Cargando vídeo...': 'Loading video...', 'Todavía no hay cortos.': 'No shorts yet.',
  'Publica un vídeo desde Inicio y marca «Publicar como corto».': 'Post a video from Home and tick «Post as short».',
  'Sin categoría': 'No category', 'Música': 'Music', 'Juegos': 'Games', 'Arte': 'Art', 'Fotografía': 'Photography', 'Humor': 'Humor', 'Tecnología': 'Technology',
  'Deportes': 'Sports', 'Cine y series': 'Movies & TV', 'Naturaleza': 'Nature', 'Comida': 'Food', 'Viajes': 'Travel', 'Anime': 'Anime', 'Estudios': 'Studies', 'Otros': 'Other',
  'publicación nueva': 'new post', 'publicaciones nuevas': 'new posts', 'ahora mismo': 'just now', 'última': 'last',
  // --- Foros
  'Explorar foros': 'Explore forums', '＋ Crear foro': '＋ Create forum', 'Crear foro': 'Create forum', 'Crear un foro': 'Create a forum',
  'Nuevo tema': 'New topic', 'Título del tema': 'Topic title', 'Escribe tu tema. Puedes añadir imágenes, GIF, música, vídeos, stickers...': 'Write your topic. You can add images, GIFs, music, videos, stickers...',
  'Escribe una respuesta...': 'Write a reply...', 'Ponle un título al tema.': 'Give the topic a title.', 'Cargando foro...': 'Loading forum...',
  'Público': 'Public', 'Privado': 'Private', 'Públicos': 'Public', 'Privados': 'Private', 'Creador': 'Creator', 'Creador del foro': 'Forum creator',
  'Foro': 'Forum', 'Código del foro': 'Forum code', 'Creado por': 'Created by', 'Actividad': 'Activity', 'Salir del foro': 'Leave forum', 'Unirse': 'Join',
  'En este foro': 'In this forum', '← Info del foro': '← Forum info', 'Foro creado': 'Forum created', '¡Foro creado! Su código es': 'Forum created! Its code is',
  'Es privado: solo podrá entrar quien escriba su nombre exacto o este código.': "It's private: only people who type its exact name or this code can join.",
  'Es público: aparece en «Explorar foros» para todo el mundo.': "It's public: it shows in «Explore forums» for everyone.",
  'Compártelo con quien quieras invitar.': 'Share it with anyone you want to invite.', 'También sirve para encontrarlo directamente.': 'It can also be used to find it directly.',
  'Para volver tendrás que buscarlo otra vez por su nombre o código.': "To come back you'll have to search for it again by name or code.",
  '¿Borrar esta respuesta?': 'Delete this reply?', '¿Borrar este tema y sus respuestas?': 'Delete this topic and its replies?',
  'Foros públicos creados por gente que usa Wind OS Messenger.': 'Public forums created by people who use Wind OS Messenger.',
  'Buscar privado': 'Find private', 'Ningún foro público coincide. Si es privado, pulsa «Buscar privado».': 'No public forum matches. If it is private, click «Find private».',
  'Todavía no hay foros públicos. ¡Crea el primero!': 'No public forums yet. Create the first one!',
  'No se encontró ningún foro con ese código o nombre exacto.': 'No forum was found with that code or exact name.',
  'Los foros privados solo aparecen si escribes su nombre tal cual o su código FORO-XXXXX-XXXXX.': 'Private forums only show up if you type their exact name or their FORO-XXXXX-XXXXX code.',
  'No se pudo unir a ese foro. Vuelve a buscarlo.': "Couldn't join that forum. Search for it again.",
  'Todavía no estás en ningún foro. Explora los públicos o crea el tuyo.': "You're not in any forum yet. Explore public ones or create your own.",
  '¿Cómo funcionan?': 'How do they work?', 'Aparecen en Explorar y cualquiera puede unirse.': 'They show up in Explore and anyone can join.',
  'No aparecen en ninguna lista. Para entrar hay que escribir su nombre exacto o su código.': "They don't show up in any list. To join you need their exact name or code.",
  'Temas': 'Topics', 'Cada foro tiene temas (mini foros) donde se escribe, se suben imágenes, GIF, música o archivos, y se responde.': 'Each forum has topics (mini forums) where people write, upload images, GIFs, music or files, and reply.',
  'Todo va cifrado y cada publicación va firmada por su autor: nadie puede escribir en tu nombre.': 'Everything is encrypted and each post is signed by its author: nobody can post as you.',
  'Nombre del foro': 'Forum name', 'Ej.: Fans del Frutiger Aero': 'E.g.: Frutiger Aero Fans', '¿De qué se habla aquí?': 'What is this forum about?',
  'Tipo de foro': 'Forum type', 'Aparece en «Explorar foros» y cualquiera puede unirse.': 'Shows up in «Explore forums» and anyone can join.',
  'No aparece en ninguna lista: solo entra quien escriba su nombre exacto o su código.': "Doesn't show up in any list: only people who type its exact name or code can join.",
  'Ya existe un foro privado con ese nombre. Elige otro.': 'A private forum with that name already exists. Pick another one.',
  'El tema necesita un título.': 'The topic needs a title.', 'Escribe algo antes de publicar.': 'Write something before posting.', 'Ese tema ya no existe.': 'That topic no longer exists.',
  'No hay conexión con el servidor.': 'No connection to the server.', 'No hay conexión con el servidor. Inténtalo en unos segundos.': 'No connection to the server. Try again in a few seconds.',
  'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.': 'No connection to the server. Check your internet and try again.',
  // --- Cuenta
  'Iniciar sesión': 'Sign in', 'Crear cuenta': 'Create account', 'Entrar': 'Sign in', 'Repite la contraseña': 'Repeat password',
  'Por ejemplo: juan_david': 'For example: john_smith', 'Tu usuario será:': 'Your username will be:', '✓ Coinciden': '✓ They match', '✗ No coinciden': "✗ They don't match",
  '✗ Mínimo 3 letras o números': '✗ At least 3 letters or numbers',
  'Elige un usuario y una contraseña de al menos 8 caracteres (puede tener espacios, tildes o símbolos).': 'Choose a username and a password of at least 8 characters (spaces, accents and symbols are fine).',
  'Tu código, tus contactos y tus foros actuales quedarán guardados en esta cuenta.': 'Your code, contacts and forums will be saved in this account.',
  '¿Ya tienes cuenta? Entra con tu usuario y contraseña desde cualquier PC.': 'Already have an account? Sign in with your username and password from any PC.',
  'Ojo:': 'Note:', 'si entras con otra cuenta, el perfil que hay ahora en este programa (sin cuenta) se reemplazará. Si es tuyo, usa «Crear cuenta».': 'if you sign in with another account, the profile currently in this app (without an account) will be replaced. If it is yours, use «Create account».',
  'Tu contraseña nunca sale de tu PC: con ella se cifra tu cuenta antes de guardarla en el servidor.': 'Your password never leaves your PC: it encrypts your account before it is stored on the server.',
  'Si olvidas la contraseña, no se puede recuperar.': "If you forget your password, it can't be recovered.",
  'Versión web: tu cuenta funciona en el PC de quien te pasó este enlace, así que esa persona podría llegar a ver tus mensajes. Úsala solo con gente de confianza.': 'Web version: your account runs on the PC of whoever sent you this link, so that person could see your messages. Only use it with people you trust.',
  'Creando tu cuenta... (tarda unos segundos)': 'Creating your account... (takes a few seconds)', 'Comprobando...': 'Checking...', '¡Listo! Abriendo tu cuenta...': 'Done! Opening your account...',
  'Escribe un usuario de al menos 3 letras o números.': 'Type a username with at least 3 letters or numbers.', 'Escribe tu contraseña.': 'Type your password.',
  'La contraseña necesita al menos 8 caracteres.': 'The password needs at least 8 characters.', 'Las dos contraseñas no coinciden.': "The passwords don't match.",
  '¡Cuenta creada! Tu usuario es': 'Account created! Your username is', 'Tus amigos pueden agregarte escribiendo ese usuario en «＋ Agregar».': 'Your friends can add you by typing that username in «＋ Add».',
  'Contraseña actual': 'Current password', 'Nueva contraseña (mínimo 8 caracteres)': 'New password (at least 8 characters)', 'Repite la nueva': 'Repeat the new one',
  'Cambiar contraseña': 'Change password', 'La nueva contraseña necesita al menos 8 caracteres.': 'The new password needs at least 8 characters.',
  'Las contraseñas nuevas no coinciden.': "The new passwords don't match.", 'Contraseña cambiada.': 'Password changed.', 'Contraseña incorrecta.': 'Wrong password.',
  'La contraseña actual no es correcta.': 'The current password is not correct.', 'La contraseña debe tener al menos 8 caracteres.': 'The password must have at least 8 characters.',
  'El usuario debe tener al menos 3 letras o números.': 'The username must have at least 3 letters or numbers.', 'Escribe tu usuario y tu contraseña.': 'Type your username and password.',
  'No existe la cuenta': 'This account does not exist:', 'El usuario': 'The username', 'ya existe. Elige otro.': 'already exists. Pick another one.',
  'No has iniciado sesión.': "You're not signed in.", 'Primero crea una cuenta: si no, perderías tu código y tus contactos.': 'Create an account first: otherwise you would lose your code and contacts.',
  'Sin conexión no se puede asegurar que tu cuenta esté guardada. Inténtalo luego.': "Without a connection we can't make sure your account is saved. Try later.",
  '¿Cerrar sesión en esta PC?': 'Sign out on this PC?', 'Se borrarán de aquí tus chats y archivos descargados. Tu cuenta, contactos y foros siguen guardados: vuelve a entrar con tu usuario y contraseña cuando quieras.': 'Your chats and downloaded files will be removed from this PC. Your account, contacts and forums stay saved: sign in again with your username and password whenever you want.',
  'Sesión iniciada como': 'Signed in as', 'Todavía no tienes cuenta.': "You don't have an account yet.", 'Demasiados intentos. Espera un minuto.': 'Too many attempts. Wait a minute.',
  'Demasiadas sesiones abiertas en este servidor. Inténtalo más tarde.': 'Too many sessions open on this server. Try later.',
  // --- Salir, ayuda, web, actualizaciones
  '¿Salir de': 'Exit', 'Tus contactos te verán desconectado.': 'Your contacts will see you as offline.', 'Tu sesión seguirá iniciada en esta PC para la próxima vez.': 'You will stay signed in on this PC for next time.',
  'Agrega a tus amigos con su código personal (WIND-XXXX-XXXX).': 'Add your friends with their personal code (WIND-XXXX-XXXX).',
  'En los chats puedes enviar imágenes, GIF, música, vídeos, archivos, notas de voz y stickers (hasta 20 MB).': 'In chats you can send images, GIFs, music, videos, files, voice notes and stickers (up to 20 MB).',
  'Llama a un contacto conectado con el botón': 'Call an online contact with the button', 'En Foros puedes unirte a foros públicos, buscar privados por su nombre exacto o código, y crear los tuyos.': 'In Forums you can join public forums, find private ones by exact name or code, and create your own.',
  'Versión web': 'Web version', 'Ya estás en la versión web.': "You're already on the web version.", 'Ya estás usando la versión web.': "You're already using the web version.",
  'La versión web ya está funcionando en este PC (puerto': 'The web version is now running on this PC (port', '). Cada persona entra con su propio usuario.': '). Everyone signs in with their own username.',
  'En este PC:': 'On this PC:', 'Teléfonos en tu misma WiFi:': 'Phones on your WiFi:', 'Para compartirla por Internet': 'To share it over the Internet',
  '(como las URLs temporales de VS Code):': '(like VS Code temporary URLs):', '1. En VS Code abre el panel': '1. In VS Code open the panel', '(junto a Terminal).': '(next to Terminal).',
  '2. Pulsa': '2. Click', 'y escribe': 'and type', '3. Clic derecho en el puerto ›': '3. Right-click the port ›', '4. Comparte la dirección': '4. Share the address', 'que aparece.': 'that appears.',
  'Funciona mientras este programa esté abierto. Para llamadas y notas de voz desde el teléfono hace falta el enlace https.': 'It works while this app is open. Calls and voice notes from phones need the https link.',
  'Copiar dirección de la WiFi': 'Copy WiFi address', 'Actualización disponible': 'Update available', 'Reiniciar ahora': 'Restart now', 'La versión': 'Version',
  'Novedades:': "What's new:", 'Se instalará sola la próxima vez que cierres el programa, o ahora mismo si reinicias.': 'It will install itself next time you close the app, or right now if you restart.',
  'No se pudo instalar la actualización. ¿Está el programa en una carpeta protegida?': "Couldn't install the update. Is the app in a protected folder?",
  'Muévelo a Escritorio o Documentos y vuelve a intentarlo.': 'Move it to Desktop or Documents and try again.',
  'Cifrado de extremo a extremo': 'End-to-end encrypted', 'Haz clic para abrir': 'Click to open',
  'Ahora mismo': 'Right now', 'Mostrar la app que estoy usando': "Show the app I'm using", 'Compartir la versión web': 'Share the web version',
  'Copiar enlace': 'Copy link', 'Dejar de compartir': 'Stop sharing', '¡Enlace copiado!': 'Link copied!',
  'Comparte este enlace. Cada persona entra con su propio usuario, también desde el teléfono:': 'Share this link. Everyone signs in with their own username, phones too:',
  'Funciona mientras este programa esté abierto (el enlace cambia cada vez que lo abres). Úsalo solo con gente de confianza.': 'It works while this app is open (the link changes each time). Only share it with people you trust.',
  'Creando tu enlace para compartir...': 'Creating your share link...', 'La primera vez descarga un programa de Cloudflare (unos 60 MB), puede tardar un minuto.': 'The first time it downloads a Cloudflare program (about 60 MB); it may take a minute.',
  'Busca por nombre, tema o creador. Los privados aparecen al escribir su nombre completo o su código.': 'Search by name, topic or creator. Private ones show up when you type their full name or code.',
  'Buscar foros: nombre, tema, creador o código FORO-...': 'Search forums: name, topic, creator or FORO-... code', 'Ningún foro público coincide.': 'No public forum matches.',
  'Buscando también foros privados con ese nombre...': 'Also looking for private forums with that name...', 'Foro privado encontrado': 'Private forum found',
  'Se actualiza sola según la app que tengas abierta': 'Updates by itself based on the app you have open',
  'Tus contactos verán, por ejemplo, «Jugando a Minecraft»': 'Your contacts will see, for example, «Playing Minecraft»',  'Hola,': 'Hi,', 'Comparte tu usuario': 'Share your username', 'Comparte tu código': 'Share your code', 'y tu código es': 'and your code is',
  'Se verá en la sección Cortos, a pantalla completa y en vertical': 'It will show in the Shorts section, full screen and vertical',
  'Adjuntar imágenes, GIF, música, vídeo o archivos': 'Attach images, GIFs, music, video or files', 'Grabar una nota de voz': 'Record a voice note',
  'Enviar un zumbido': 'Send a nudge', 'Cambiar fuente': 'Change font', 'Emoticonos y stickers': 'Emoticons and stickers',
  'Filtra los públicos, o escribe el nombre exacto o el código de un foro privado': 'Filter public ones, or type the exact name or code of a private forum',
  'No hago nada. Soy muy bueno en eso. Soy el último bot inútil que queda.': "I don't do anything. I'm very good at it. I'm the last useless bot left.",
  'Nadie': 'Nobody', 'Quitar': 'Remove', 'Rechazar': 'Decline', 'Ver perfil': 'View profile', 'Aceptar solicitud': 'Accept request', 'Rechazaste la solicitud de': 'You declined the request from', 'Ya pueden chatear': 'You can chat now','Escribe un mensaje personal': 'Write a personal message',
  // Bot Nada
  'No hago nada. Soy muy bueno en eso.': "I don't do anything. I'm very good at it.", 'Soy el último bot inútil que queda.': "I'm the last useless bot left.",
  'Mientras tanto, Nada (el último bot inútil) siempre está conectado. No sirve de nada, pero contesta.': "Meanwhile, Nada (the last useless bot) is always online. It's useless, but it answers.",
};

// Textos con partes variables: {0}, {1}... se conservan
const EN_PAT = [
  ['Conectados ({0})', 'Online ({0})'], ['Desconectados ({0})', 'Offline ({0})'], ['Esperando respuesta ({0})', 'Waiting for reply ({0})'],
  ['Solicitudes ({0})', 'Requests ({0})'], ['Bot inútil ({0})', 'Useless bot ({0})'], ['Mis foros ({0})', 'My forums ({0})'],
  ['Foros públicos ({0})', 'Public forums ({0})'], ['Conectados ahora ({0})', 'Online now ({0})'],
  ['Cifrado de extremo a extremo · {0} de {1} contactos conectados', 'End-to-end encrypted · {0} of {1} contacts online'],
  ['{0} de {1} contactos conectados', '{0} of {1} contacts online'],
  ['{0} temas · {1} respuestas', '{0} topics · {1} replies'], ['{0} tema · {1} respuestas', '{0} topic · {1} replies'],
  ['{0} temas · {1}', '{0} topics · {1}'], ['{0} tema · {1}', '{0} topic · {1}'], ['{0} temas', '{0} topics'], ['{0} tema', '{0} topic'],
  ['por {0} · {1} · {2} respuestas · última {3}', 'by {0} · {1} · {2} replies · last {3}'], ['por {0} · {1} · {2} respuestas', 'by {0} · {1} · {2} replies'],
  ['por {0} · {1} · {2} respuesta · última {3}', 'by {0} · {1} · {2} reply · last {3}'], ['por {0} · {1} · {2} respuesta', 'by {0} · {1} · {2} reply'],
  ['por', 'by'], ['respuestas', 'replies'], ['respuesta', 'reply'],
  ['Esta es una conversación nueva con {0}.', 'This is a new conversation with {0}.'], ['{0} dice:', '{0} says:'], ['{0} dice: ({1})', '{0} says: ({1})'],
  ['{0} está escribiendo un mensaje...', '{0} is typing a message...'], ['{0} te ha enviado un zumbido.', '{0} sent you a nudge.'],
  ['{0} está desconectado. Tus mensajes se entregarán cuando se conecte mientras tienes el programa abierto.', '{0} is offline. Your messages will be delivered when they come online while your app is open.'],
  ['{0} está desconectado: el zumbido no le llegaría.', "{0} is offline: the nudge wouldn't reach them."], ['{0} está ocupado y puede que no responda.', '{0} is busy and may not reply.'],
  ['{0} está en otra llamada.', '{0} is in another call.'], ['{0} no contesta.', '{0} is not answering.'], ['{0} rechazó la llamada.', '{0} declined the call.'],
  ['{0} te está llamando...', '{0} is calling you...'], ['Llamada · {0}', 'Call · {0}'], ['Llamada finalizada · duración {0}', 'Call ended · duration {0}'],
  ['{0} quiere agregarte', '{0} wants to add you'], ['({0}) quiere agregarte como contacto.', '({0}) wants to add you as a contact.'],
  ['{0} comentó tu publicación', '{0} commented on your post'], ['{0} respondió a tu tema', '{0} replied to your topic'],
  ['te ha enviado un zumbido.', 'sent you a nudge.'], ['hace {0} min', '{0} min ago'], ['hace {0} h', '{0} h ago'], ['Activo {0}', 'Active {0}'],
  ['Activo hace {0} min', 'Active {0} min ago'], ['Activo hace {0} h', 'Active {0} h ago'], ['Activo ahora mismo', 'Active just now'],
  ['{0} · {1} · {2}', '{0} · {1} · {2}'], ['{0} min', '{0} min'], ['{0} h', '{0} h'], ['{0} días', '{0} days'],
  ['(quedan {0})', '({0} left)'], ['Caduca en {0}', 'Expires in {0}'], ['Caduca en {0}. Cambia el texto o la duración para renovarlo.', 'Expires in {0}. Change the text or duration to renew it.'],
  ['Al menos 8 caracteres ({0})', 'At least 8 characters ({0})'], ['Cargando... {0}%', 'Loading... {0}%'], ['Recibiendo... {0}%', 'Receiving... {0}%'],
  ['Grabando {0}:{1} · clic para enviar', 'Recording {0}:{1} · click to send'], ['Hasta {0} MB por archivo', 'Up to {0} MB per file'],
  ['Buscando «{0}»...', 'Searching «{0}»...'], ['Creado por {0} · {1}', 'Created by {0} · {1}'], ['Creado por {0}', 'Created by {0}'],
  ['{0} publicación nueva · Ver', '{0} new post · View'], ['{0} publicaciones nuevas · Ver', '{0} new posts · View'],
  ['Descargando la versión {0}... {1}%', 'Downloading version {0}... {1}%'], ['Versión {0} lista: reiniciar ahora', 'Version {0} ready: restart now'],
  ['Hay una versión {0} (estás usando el código fuente)', 'Version {0} is available (you are running the source code)'],
  ['ya está descargada y verificada.', 'is downloaded and verified.'], ['Comparte tu usuario {0} para que te agreguen.', 'Share your username {0} so people can add you.'],
  ['Comparte tu', 'Share your'], ['usuario', 'username'], ['código', 'code'], ['para que te agreguen.', 'so people can add you.'],
  ['Usuario {0} · tu código', 'Username {0} · your code'], ['Usuario', 'Username'], ['· tu código', '· your code'],
  ['Hola, {0}', 'Hi, {0}'], ['¿Qué quieres compartir, {0}? Puedes poner enlaces y #etiquetas', 'What do you want to share, {0}? You can add links and #tags'],
  ['El archivo pesa más de {0} MB.', 'The file is larger than {0} MB.'], ['Entre todos los archivos no pueden pasar de {0} MB.', 'All files together cannot exceed {0} MB.'],
  ['«{0}» es demasiado grande.', '«{0}» is too big.'], ['«{0}» pesa más de {1} MB.', '«{0}» is larger than {1} MB.'],
  ['«{0}» no es una foto ni un vídeo. Para otros archivos usa los chats o los foros.', '«{0}» is not a photo or video. For other files use chats or forums.'],
  ['No se pudo abrir el puerto {0}: {1}', "Couldn't open port {0}: {1}"], ['Tu usuario: {0}', 'Your username: {0}'], ['Tu código: {0}', 'Your code: {0}'],
  ['Tu usuario es {0} y tu código es {1}. Compártelos para que también te puedan agregar.', 'Your username is {0} and your code is {1}. Share them so others can add you too.'],
  ['Tu código es {0}. Compártelos para que también te puedan agregar.', 'Your code is {0}. Share it so others can add you too.'],
  ['Tu usuario es', 'Your username is'], ['y tu', 'and your'], ['Tu', 'Your'], ['código es', 'code is'],
  ['Nota de voz {0}.{1}', 'Voice note {0}.{1}'], ['Jugando a {0}', 'Playing {0}'], ['Usando {0}', 'Using {0}'], ['Escuchando {0}', 'Listening to {0}'], ['Viendo {0}', 'Watching {0}'], ['Desde {0}', 'Since {0}'],
  ['({0})', '({0})'], ['· {0}', '· {0}'], ['{0} ·', '{0} ·'],
  ['Conectado al servidor · v{0}', 'Connected to server · v{0}'], ['Conectando con el servidor... · v{0}', 'Connecting to server... · v{0}'],
  ['Conectado al servidor · v{0} ·', 'Connected to server · v{0} ·'], ['Conectando con el servidor... · v{0} ·', 'Connecting to server... · v{0} ·'],
];

let LANG = 'es';
const PAT_RE = EN_PAT.map(([es, en]) => {
  const re = new RegExp('^' + es.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\d)\}/g, '(.+?)') + '$');
  return [re, en];
});
const NO_I18N = '.tx, .fpt, .ptext, .stxt, .pmsg, .tsn, .cmt .ci > :not(.tm), .mono, .bigcode, #myCode, #meName, .chead .cn, .fph b, ' +
  '.contact[data-code] .nm > span:first-child, .contact[data-req] .nm > span:first-child, .contact[data-forum] .nm > span:first-child, ' +
  '.hbub span, .ptitle, .tt, .lcard, .wnow b, .cap, [contenteditable], .webtoast .line, .tbody .line, .pchip span, .ci > b, .hme b';

function tr(s) {
  if (LANG !== 'en' || !s) return s;
  const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const core = m[2].replace(/\s+/g, ' ');
  if (!core || !/[a-záéíóúñ¿¡]/i.test(core)) return s;
  let out = EN[core];
  if (out === undefined) {
    for (const [re, en] of PAT_RE) {
      const g = core.match(re);
      if (!g) continue;
      const parts = g.slice(1).map(x => tr(x));
      // los comodines genéricos (paréntesis, viñetas) solo valen si el contenido sí se tradujo
      if (/^[(·{]/.test(en) && en.length <= 6 && parts.every((x, i) => x === g[i + 1])) continue;
      out = en.replace(/\{(\d)\}/g, (_, i) => parts[+i]);
      break;
    }
  }
  return out === undefined ? s : m[1] + out + m[3];
}

function trNode(root) {
  if (LANG !== 'en' || !root) return;
  if (root.nodeType === 3) {
    const p = root.parentElement;
    if (p && !p.closest(NO_I18N) && !/^(SCRIPT|STYLE|TEXTAREA)$/.test(p.tagName)) {
      const t = tr(root.nodeValue);
      if (t !== root.nodeValue) root.nodeValue = t;
    }
    return;
  }
  if (root.nodeType !== 1 || /^(SCRIPT|STYLE)$/.test(root.tagName)) return;
  for (const attr of ['placeholder', 'title']) {
    if (root.hasAttribute && root.hasAttribute(attr)) {
      const v = root.getAttribute(attr), t = tr(v);
      if (t !== v) root.setAttribute(attr, t);
    }
  }
  if (root.tagName === 'OPTION' || root.tagName === 'BUTTON' || root.tagName === 'LABEL') { /* se recorren igual que el resto */ }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = walker.nextNode())) {
    if (n.nodeType === 1) {
      if (/^(SCRIPT|STYLE)$/.test(n.tagName)) continue;
      for (const attr of ['placeholder', 'title']) {
        if (n.hasAttribute(attr)) { const v = n.getAttribute(attr), t = tr(v); if (t !== v) n.setAttribute(attr, t); }
      }
    } else trNode(n);
  }
}

let i18nObs = null;
const queued = new Set();
let flushT = 0;
function setLang(lang) {
  const prev = LANG;
  LANG = lang === 'en' ? 'en' : 'es';
  document.documentElement.lang = LANG;
  if (LANG === 'en') {
    trNode(document.body);
    document.title = tr(document.title);
    if (!i18nObs) {
      i18nObs = new MutationObserver(muts => {
        for (const m of muts) {
          if (m.type === 'characterData') queued.add(m.target);
          else if (m.type === 'attributes') queued.add(m.target);
          else m.addedNodes.forEach(x => queued.add(x));
        }
        if (!flushT) flushT = requestAnimationFrame(() => { flushT = 0; const q = [...queued]; queued.clear(); q.forEach(trNode); });
      });
      i18nObs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title'] });
    }
  } else if (prev === 'en') {
    location.reload();  // volver al español: lo más fiable es recargar la interfaz
  }
}

// Fechas y horas en el idioma elegido
for (const fn of ['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString']) {
  const orig = Date.prototype[fn];
  Date.prototype[fn] = function (loc, opts) { return orig.call(this, LANG === 'en' && (loc === 'es' || !loc) ? 'en' : loc, opts); };
}
