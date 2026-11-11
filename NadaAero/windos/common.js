// Utilidades compartidas por las ventanas de Wind OS Messenger (necesita retro.js antes)
const $ = id => document.getElementById(id);
const api = () => window.WEBAPI || (window.pywebview && window.pywebview.api) || null;  // WEBAPI: versión web
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const hhmm = ts => new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

function onReady(fn) {
  if (api()) fn(); else window.addEventListener('pywebviewready', fn, { once: true });
}

const STATUS = { online: 'Disponible', busy: 'Ocupado', away: 'Ausente', offline: 'Desconectado' };

// ---------- Emoticonos retro ----------
function emoImg(name, size = 19) {
  const src = RETRO.E[name];
  return src ? `<img class="emo" src="${src}" width="${size}" height="${size}" alt="" draggable="false">` : '';
}
// Códigos clásicos; los más largos primero para que ":'(" gane a ":("
const EMO_CODES = [
  ['(PI)', 'pizza'], ['(MP)', 'phone'], ['(XX)', 'gamepad'],
  [":'(", 'cry'], ['|-)', 'sleepy'], ['+o(', 'sick'], ['(H)', 'cool'], ['(A)', 'angel'], ['(6)', 'devil'], ['(Y)', 'thumbsup'],
  ['(N)', 'thumbsdown'], ['(L)', 'heart'], ['(U)', 'broken'], ['(K)', 'kiss'], ['(*)', 'star'], ['(F)', 'rose'], ['(G)', 'gift'],
  ['(^)', 'cake'], ['(C)', 'coffee'], ['(8)', 'note'],
  [':)', 'smile'], [':D', 'grin'], [';)', 'wink'], [':(', 'sad'], [':P', 'tongue'], [':O', 'surprised'], [':|', 'neutral'],
  [':S', 'confused'], [':@', 'angry'], [':$', 'blush'], ['<3', 'heart']
];
// Emojis del teclado de Windows -> su versión retro
const UNI_EMO = {
  '🙂': 'smile', '😊': 'blush', '☺️': 'smile', '😃': 'grin', '😄': 'grin', '😁': 'grin', '😀': 'grin', '😉': 'wink', '🙁': 'sad', '☹️': 'sad',
  '😢': 'cry', '😭': 'cry', '😛': 'tongue', '😜': 'tongue', '😝': 'tongue', '😮': 'surprised', '😲': 'surprised', '😯': 'surprised',
  '😐': 'neutral', '😑': 'neutral', '😕': 'confused', '😖': 'confused', '😠': 'angry', '😡': 'angry', '😎': 'cool', '😳': 'blush',
  '😴': 'sleepy', '🤢': 'sick', '🤒': 'sick', '😍': 'love', '🥰': 'love', '🤔': 'think', '🥳': 'party', '😈': 'devil', '😇': 'angel',
  '👍': 'thumbsup', '👎': 'thumbsdown', '❤️': 'heart', '❤': 'heart', '💔': 'broken', '💋': 'kiss', '⭐': 'star', '🌟': 'star',
  '🌹': 'rose', '🎁': 'gift', '🎂': 'cake', '☕': 'coffee', '🎵': 'note', '🎶': 'note', '🍕': 'pizza', '📱': 'phone', '🎮': 'gamepad'
};
function fmt(text) {
  const marks = [];
  const mark = name => { marks.push(name); return '\u0001' + (marks.length - 1) + '\u0002'; };
  let s = String(text ?? '').replace(/[\u0001\u0002]/g, '');
  for (const [u, n] of Object.entries(UNI_EMO)) if (s.includes(u)) s = s.split(u).join(mark(n));
  for (const [k, n] of EMO_CODES) {
    if (s.includes(k)) s = s.split(k).join(mark(n));
    const lk = k.toLowerCase();
    if (lk !== k && s.includes(lk)) s = s.split(lk).join(mark(n));
  }
  return esc(s).replace(/\u0001(\d+)\u0002/g, (_, i) => emoImg(marks[+i]));
}

// ---------- Estados de ánimo ----------
const MOODS = [
  ['', 'Ninguno', ''], ['feliz', 'Feliz', 'smile'], ['genial', 'Genial', 'cool'], ['sueno', 'Con sueño', 'sleepy'],
  ['triste', 'Triste', 'sad'], ['enfadado', 'Enfadado', 'angry'], ['pensativo', 'Pensativo', 'think'], ['fiesta', 'De fiesta', 'party'],
  ['enfermo', 'Enfermo', 'sick'], ['enamorado', 'Enamorado', 'love'], ['sorprendido', 'Sorprendido', 'surprised'],
  ['travieso', 'Travieso', 'devil'], ['angelical', 'Angelical', 'angel'], ['jugando', 'Jugando', 'gamepad'],
  ['estudiando', 'Estudiando', 'book'], ['trabajando', 'Trabajando', 'briefcase'], ['comiendo', 'Comiendo', 'pizza'],
  ['cafe', 'Tomando café', 'coffee'], ['musica', 'Escuchando música', 'note'], ['cumple', 'De cumpleaños', 'cake']
];
const moodOf = k => (k && MOODS.find(m => m[0] === k)) || null;
const moodHtml = (k, size = 16) => { const m = moodOf(k); return m ? `${emoImg(m[2], size)} ${esc(m[1])}` : ''; };

// ---------- Mensaje temporal ----------
const tempActive = p => !!(p && p.temp && p.temp.text && p.temp.until > Date.now());
function leftTxt(until) {
  const m = Math.max(1, Math.ceil((until - Date.now()) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.ceil(m / 60);
  return h < 48 ? `${h} h` : `${Math.ceil(h / 24)} días`;
}
// Línea bajo el nombre: el mensaje temporal tiene prioridad sobre el personal
// Actividad: la app que está usando ahora («Jugando a Minecraft»)
const ACT = { play: ['gamepad', 'Jugando a'], use: ['monitor', 'Usando'], listen: ['note', 'Escuchando'], watch: ['video', 'Viendo'] };
const actText = a => a && a.app ? `${(ACT[a.kind] || ACT.use)[1]} ${a.app}` : '';
const actHtml = (a, size = 14) => a && a.app ? `${emoImg((ACT[a.kind] || ACT.use)[0], size)} <span class="act-t">${esc(actText(a))}</span>` : '';
// Línea bajo el nombre: mensaje temporal > actividad > mensaje personal
const subline = (p, size = 14) => tempActive(p) ? `${emoImg('clock', size)} ${fmt(p.temp.text)}`
  : p && p.activity && p.activity.app ? actHtml(p.activity, size) : fmt((p && p.msg) || '');

// ---------- Avatares ----------
const IMG_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
function avatarSrc(p) {
  const a = (p && p.avatar) || {};
  if (a.type === 'img' && IMG_RE.test(a.src || '')) return a.src;
  return (RETRO.AV[a.id] || RETRO.AV.duck).src;
}
function avatarHtml(p, size, status) {
  return `<div class="avatar s-${status || 'online'}" style="--s:${size}px"><img src="${avatarSrc(p)}" alt="" draggable="false"></div>`;
}

// ---------- Temas ----------
const SCENES = { colinas: 'Colinas', oceano: 'Océano', nubes: 'Nubes', atardecer: 'Atardecer', noche: 'Noche', aurora: 'Aurora', liso: 'Liso' };
const CHATBG = { blanco: 'Blanco', cielo: 'Cielo', cuaderno: 'Cuaderno', burbujas: 'Burbujas', crema: 'Crema' };
const PRESETS = {
  aero:      { name: 'Aero azul', glass: '#9cc8f0', alpha: .55, scene: 'colinas', accent: '#1e3287' },
  esmeralda: { name: 'Esmeralda', glass: '#8fe0b0', alpha: .55, scene: 'colinas', accent: '#13623a' },
  oceano:    { name: 'Océano', glass: '#7ad8e8', alpha: .5, scene: 'oceano', accent: '#0a5a70' },
  chicle:    { name: 'Chicle', glass: '#ffb0d8', alpha: .55, scene: 'nubes', accent: '#9a1a5a' },
  atardecer: { name: 'Atardecer', glass: '#ffc090', alpha: .55, scene: 'atardecer', accent: '#8a3c08' },
  violeta:   { name: 'Violeta', glass: '#c0a8f0', alpha: .55, scene: 'aurora', accent: '#4b2a99' },
  grafito:   { name: 'Grafito', glass: '#4a5562', alpha: .72, scene: 'noche', accent: '#2c3540' }
};
const DEFAULT_THEME = { preset: 'aero', glass: '#9cc8f0', alpha: .55, scene: 'colinas', accent: '#1e3287', bubbles: true, shine: true, chat: 'blanco', skin: 'aero' };
const SKINS = { aero: 'Aero (Windows 7)', discord: 'Oscuro (tipo Discord)', insta: 'Claro (tipo Instagram)' };
const SCENE_HTML = {
  colinas: '<div class="ray"></div><div class="sun"></div><div class="hill back"></div><div class="hill front"></div>',
  oceano: '<div class="ray"></div><div class="sun"></div><div class="sea"></div><div class="wave"></div>',
  nubes: '<div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div><div class="cloud c4"></div>',
  atardecer: '<div class="sun low"></div><div class="hill back dusk"></div><div class="hill front dusk"></div>',
  noche: '<div class="stars"></div><div class="moon"></div><div class="hill back night"></div>',
  aurora: '<div class="stars"></div><div class="aurora"></div><div class="hill front night"></div>',
  liso: ''
};
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mixRgb = (c, t, k) => c.map((v, i) => Math.round(v + (t[i] - v) * k));
function applyTheme(theme) {
  const t = { ...DEFAULT_THEME, ...(theme || {}) };
  const c = hexRgb(/^#[0-9a-f]{6}$/i.test(t.glass) ? t.glass : DEFAULT_THEME.glass);
  const a = Math.min(.95, Math.max(.2, +t.alpha || .55));
  const st = document.body.style;
  st.setProperty('--g1', `rgba(${mixRgb(c, [255, 255, 255], .35)},${a})`);
  st.setProperty('--g2', `rgba(${mixRgb(c, [0, 0, 0], .12)},${Math.min(.97, a + .05)})`);
  st.setProperty('--glass-solid', `rgb(${c})`);
  st.setProperty('--accent', /^#[0-9a-f]{6}$/i.test(t.accent) ? t.accent : DEFAULT_THEME.accent);
  const cls = document.body.classList;
  [...cls].forEach(k => /^(scene|chat|skin)-/.test(k) && cls.remove(k));
  cls.add('scene-' + (SCENES[t.scene] ? t.scene : 'colinas'), 'chat-' + (CHATBG[t.chat] ? t.chat : 'blanco'), 'skin-' + (SKINS[t.skin] ? t.skin : 'aero'));
  cls.toggle('dark-glass', (.299 * c[0] + .587 * c[1] + .114 * c[2]) / 255 < .45);
  cls.toggle('no-bubbles', !t.bubbles);
  cls.toggle('no-shine', !t.shine);
  const sc = $('scene');
  if (sc && sc.dataset.s !== t.scene) { sc.dataset.s = t.scene; sc.innerHTML = SCENE_HTML[t.scene] || ''; }
}

// ---------- Sonidos sintetizados ----------
let actx;
window.SOUNDS_ON = true;
function tone(freqs, dur = .12, type = 'sine', vol = .15) {
  if (!window.SOUNDS_ON) return;
  try {
    actx = actx || new AudioContext();
    const t0 = actx.currentTime;
    freqs.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = t0 + i * dur;
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + .01);
      g.gain.exponentialRampToValueAtTime(.001, t + dur * 2.5);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + dur * 3);
    });
  } catch (e) { /* sin sonido */ }
}
const sounds = {
  msg:     () => tone([988, 1319], .09),
  online:  () => tone([659, 880, 1175], .1),
  request: () => tone([523, 659, 784, 1047], .08),
  nudge:   () => tone([220, 180, 220, 180, 150], .06, 'square', .07)
};

// ---------- Ventana: botones, burbujas, diálogos ----------
function wireCaps(onClose) {
  if ($('bMin')) $('bMin').onclick = () => api() && api().minimize();
  if ($('bMax')) {
    $('bMax').onclick = () => api() && api().toggle_maximize();
    $('title').addEventListener('dblclick', e => { if (!e.target.closest('.cap')) $('bMax').click(); });
  }
  $('bClose').onclick = onClose || (() => api() && api().close());
}

function startBubbles(every = 1300) {
  const host = $('bubbles');
  function bubble() {
    if (document.body.classList.contains('no-bubbles')) return;
    const b = document.createElement('div');
    const s = 14 + Math.random() * 50;
    b.className = 'bubble';
    b.style.width = b.style.height = s + 'px';
    b.style.left = Math.random() * 100 + 'vw';
    b.style.animationDuration = (7 + Math.random() * 9) + 's';
    b.addEventListener('animationend', () => b.remove());
    host.appendChild(b);
  }
  for (let i = 0; i < 4; i++) setTimeout(bubble, i * 500);
  setInterval(bubble, every);
}

document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="ov">
    <div class="dialog">
      <div class="titlebar"><div class="ico"></div><div class="t" id="dTitle"></div>
        <div class="caps"><div class="cap close" id="dX">✕</div></div></div>
      <div class="inner">
        <div class="msg"><div class="icon" id="dIcon">i</div><div id="dMsg"></div></div>
        <div class="foot" id="dFoot"></div>
      </div>
    </div>
  </div>`);
$('dX').onclick = () => $('ov').classList.remove('show');

// icon: un carácter o el HTML de un emoticono retro. Si un botón devuelve false, el diálogo sigue abierto.
function dialog(msg, { title = 'Wind OS Messenger', icon = 'i', buttons = [['Aceptar']], focus } = {}) {
  const isImg = icon.startsWith('<');
  $('dTitle').textContent = title;
  $('dIcon').className = 'icon' + (isImg ? ' img' : '');
  $('dIcon').innerHTML = isImg ? icon : esc(icon);
  $('dMsg').innerHTML = msg;
  const foot = $('dFoot'); foot.innerHTML = '';
  buttons.forEach(([label, fn]) => {
    const b = document.createElement('button');
    b.className = 'btn'; b.textContent = label;
    b.onclick = () => { $('ov').classList.remove('show'); if (fn && fn() === false) $('ov').classList.add('show'); };
    foot.appendChild(b);
  });
  $('ov').classList.add('show');
  const f = focus ? $(focus) : foot.firstChild;
  if (f) f.focus();
}
