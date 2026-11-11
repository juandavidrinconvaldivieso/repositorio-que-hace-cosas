// Utilidades compartidas por todas las ventanas de Nada Messenger
const $ = id => document.getElementById(id);
const api = () => (window.pywebview && window.pywebview.api) || null;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function onReady(fn) {
  if (api()) fn(); else window.addEventListener('pywebviewready', fn, { once: true });
}

const STATUS = { online: 'Disponible', busy: 'Ocupado', away: 'Ausente', offline: 'Desconectado' };

const ME_PIC = { glyph: '🐠', bg: 'linear-gradient(#c9f3ff, #2fa3e0)' };

// ---------- Contactos (todos igual de útiles) ----------
const CONTACTS = {
  nada: {
    name: 'Nada', status: 'online', msg: '...', glyph: '∅', bg: 'linear-gradient(#e8f6ff, #8fcaf0)',
    reply(t) {
      if (t.includes('?')) return { text: 'nada' };
      const x = pick(['...', 'nada', '.', 'mm', ':|', 'ok', null, 'zzz', '(nada)', 'no', null]);
      return { text: x, typing: x === null ? 3500 : 1200, nudge: Math.random() < .08 };
    }
  },
  nadie: {
    name: 'Nadie', status: 'busy', msg: 'No estoy. Nunca estuve.', glyph: '?', bg: 'linear-gradient(#ffd9cf, #e0664c)',
    reply: () => ({ text: pick([
      'Nadie te ha leído.', 'Nadie está de acuerdo contigo.', 'Nadie lo sabe.', 'Nadie vendrá.',
      'Nadie es perfecto (Y)', 'Nadie te entiende como yo.', 'Nadie dijo que sería fácil.', 'Nadie te va a contestar. Ah, espera.'
    ]) })
  },
  vacio: {
    name: 'El Vacío', status: 'away', msg: 'mirando al abismo (el abismo me devuelve la mirada)', glyph: '', bg: 'radial-gradient(circle, #000 28%, #2a1d47 55%, #a48fd6)',
    reply(t) {
      const w = esc((t.trim().split(/\s+/).pop() || '...').toLowerCase().replace(/[.,!?¿¡]/g, '')) || '...';
      return { html: true, typing: 2600, text:
        `<span style="opacity:.8">${w}...</span> <span style="opacity:.5">${w}...</span> <span style="opacity:.25;font-size:11px">${w}...</span>` };
    }
  },
  ninguno: {
    name: 'Ninguno', status: 'online', music: "Silencio — 4'33'' (John Cage)", glyph: '♪', bg: 'linear-gradient(#e6ffd9, #4cb52f)',
    reply: () => ({ text: pick(['♪ ♪ ♪', '(silencio)', '...♪', 'shhh, estoy escuchando', "Ahora mismo: 4'33'' en bucle", '(L)']) })
  },
  cero: {
    name: 'Cero', status: 'online', msg: '0 cosas que contar', glyph: '0', bg: 'linear-gradient(#fff4c9, #e3a312)',
    reply: () => ({ text: pick(['0', '0', '00', '0 :)', 'Respuestas útiles enviadas: 0', '0 (Y)']), typing: 700 })
  },
  algo: { name: 'Algo', status: 'offline', msg: 'Algo nunca se conecta', glyph: '…', bg: 'linear-gradient(#eee, #999)' },
  crush: { name: 'Tu crush de 2009', status: 'offline', msg: '', glyph: '💔', bg: 'linear-gradient(#ffd6e7, #d94c86)' }
};

function avatarHtml(pic, status, size) {
  return `<div class="avatar s-${status}" style="--s:${size}px"><div class="pic" style="--bg:${pic.bg}">${pic.glyph}</div></div>`;
}

// ---------- Emoticonos ----------
const EMOTICONS = {
  ':)': '🙂', ':D': '😃', ';)': '😉', ':(': '🙁', ':P': '😛', ':O': '😮', ':|': '😐', ':S': '😖', ':@': '😠',
  '(H)': '😎', '(Y)': '👍', '(N)': '👎', '(L)': '❤️', '(U)': '💔', '(K)': '💋', '(*)': '⭐', '(F)': '🌹', '(Z)': '💤', '<3': '❤️'
};
function fmt(text) {
  let s = esc(text);
  for (const [k, v] of Object.entries(EMOTICONS)) {
    s = s.split(esc(k)).join(`<span class="emo">${v}</span>`);
    if (k !== k.toLowerCase()) s = s.split(esc(k.toLowerCase())).join(`<span class="emo">${v}</span>`);
  }
  return s;
}

// ---------- Sonidos sintetizados ----------
let actx;
function tone(freqs, dur = .12, type = 'sine', vol = .15) {
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
  } catch (e) { /* sin sonido, sin drama */ }
}
const sounds = {
  msg:    () => tone([988, 1319], .09),
  online: () => tone([659, 880, 1175], .1),
  nudge:  () => tone([220, 180, 220, 180, 150], .06, 'square', .07)
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

function dialog(msg, { title = 'Nada Messenger', icon = 'i', buttons = [['Aceptar']] } = {}) {
  $('dTitle').textContent = title;
  $('dIcon').textContent = icon;
  $('dMsg').innerHTML = msg;
  const foot = $('dFoot'); foot.innerHTML = '';
  buttons.forEach(([label, fn]) => {
    const b = document.createElement('button');
    b.className = 'btn'; b.textContent = label;
    b.onclick = () => { $('ov').classList.remove('show'); fn && fn(); };
    foot.appendChild(b);
  });
  $('ov').classList.add('show');
  foot.firstChild.focus();
}
