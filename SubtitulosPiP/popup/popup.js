// Popup: cada cambio se guarda al instante y la ventana PiP se actualiza en vivo.
const D = SUBPIP_DEFAULTS;
const $ = (s) => document.querySelector(s);
const inputs = [...document.querySelectorAll('[data-key]')];
let tabId = null;

function fmt(v, f) {
  if (f === 'pct') return Math.round(v * 100) + '%';
  if (f === 'px') return v + ' px';
  if (f === 'px0') return v ? v + ' px' : 'original';
  if (f === '%') return v + '%';
  return String(v);
}
function fill(S) {
  for (const el of inputs) {
    const v = S[el.dataset.key];
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'radio') el.checked = el.value === v;
    else el.value = v;
  }
  for (const o of document.querySelectorAll('output[data-for]')) o.textContent = fmt(S[o.dataset.for], o.dataset.fmt);
  for (const cb of document.querySelectorAll('[data-use]')) {
    const k = cb.dataset.use;
    cb.checked = !!S[k];
    if (S[k]) document.querySelector(`[data-color="${k}"]`).value = S[k];
  }
  document.body.dataset.mode = S.mode;
  document.body.dataset.preset = S.stylePreset;
  document.body.dataset.desk = S.desktop;
  if (S.desktop) {
    chrome.runtime.sendMessage({ type: 'deskPing' }, (r) => {
      $('#deskStatus').textContent = r && r.ok ? '✔ Programa de escritorio conectado.'
        : '✖ Programa no encontrado: ejecuta «SubtitulosPiP\\escritorio\\iniciar.bat».';
    });
  }
  $('#pv-style').textContent = subpipCss(subpipStyle(S), '#pv-sub');
}

// Colores: casilla marcada = color propio; desmarcada = original del sitio ('').
for (const cb of document.querySelectorAll('[data-use]')) {
  const k = cb.dataset.use;
  const color = document.querySelector(`[data-color="${k}"]`);
  cb.addEventListener('change', () => chrome.storage.local.set({ [k]: cb.checked ? color.value : '' }));
  color.addEventListener('input', () => chrome.storage.local.set({ [k]: color.value }));
}

// Vista previa: imita el estilo por defecto de YouTube y aplica el mismo CSS que la ventana PiP.
const pvStyle = document.head.appendChild(document.createElement('style'));
pvStyle.id = 'pv-style';
const BASE = 'color:#fff;background-color:rgba(8,8,8,.75);padding:0 .25em;font-family:"YouTube Noto",Roboto,Arial,sans-serif;' +
  '-webkit-box-decoration-break:clone;box-decoration-break:clone';
let rollT = 0;
const seg = (text, extra = '') => {
  const s = document.createElement('span');
  s.dataset.tx = '1';
  s.style.cssText = BASE + ';' + extra;
  s.textContent = text;
  return s;
};
const line = (...kids) => {
  const d = document.createElement('div');
  d.append(...kids);
  return d;
};
function drawPreview() {
  clearInterval(rollT);
  const box = $('#pv-sub');
  const t = $('#pvType').value;
  $('#preview').dataset.pos = t === 'styled' ? 'top' : 'bottom';
  if (t === 'normal') box.replaceChildren(line(seg('Así se verán tus subtítulos')), line(seg('en la ventana flotante')));
  else if (t === 'styled') box.replaceChildren(line(seg('[MÚSICA]', 'font-style:italic')), line(seg('¿Dónde '), seg('estabas', 'color:#ffe500'), seg('?')));
  else if (t === 'dialog') box.replaceChildren(line(seg('- ¿Vienes conmigo?')), line(seg('- Claro que sí.')));
  else {
    const words = 'esto es un subtítulo automático que aparece palabra por palabra igual que en youtube'.split(' ');
    let i = 0;
    const step = () => {
      i = (i % words.length) + 1;
      const shown = words.slice(Math.max(0, i - 8), i);
      box.replaceChildren(line(seg(shown.slice(0, 4).join(' '))), ...(shown.length > 4 ? [line(seg(shown.slice(4).join(' ')))] : []));
    };
    step();
    rollT = setInterval(step, 350);
  }
}
$('#pvType').addEventListener('change', drawPreview);
drawPreview();
function load() {
  chrome.storage.local.get(null, (all) => {
    const S = { ...D };
    for (const k in D) if (k in all) S[k] = all[k];
    fill(S);
  });
}
for (const el of inputs) {
  if (el.id === 'hotkey') continue;
  el.addEventListener('input', () => {
    if (el.type === 'radio' && !el.checked) return;
    const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
    chrome.storage.local.set({ [el.dataset.key]: v });
  });
}
// Grabador de atajo: exige al menos un modificador.
$('#hotkey').addEventListener('keydown', (e) => {
  e.preventDefault();
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean);
  if (!mods.length) return;
  const key = e.code.replace(/^Key|^Digit/, '');
  chrome.storage.local.set({ hotkey: [...mods, key].join('+') });
});
chrome.storage.onChanged.addListener((_c, area) => area === 'local' && load());

function send(msg, cb) {
  if (tabId == null) return;
  chrome.tabs.sendMessage(tabId, msg, (r) => { void chrome.runtime.lastError; cb && cb(r); });
}
// En la pestaña (iframe del menú) o como popup de la barra del navegador.
const IN_PANEL = location.search.includes('panel=1');
document.body.classList.toggle('panel', IN_PANEL);
const done = () => (IN_PANEL ? setTimeout(refresh, 700) : window.close());

function refresh() {
  send({ type: 'status' }, (r) => {
    if (!r) {
      $('#status').textContent = 'No se detectó ningún vídeo en esta pestaña (recarga la página si acabas de instalar la extensión).';
      return;
    }
    $('#status').textContent = r.active ? 'PiP con subtítulos abierto.' :
      `Vídeo detectado en ${r.host}` + (r.docPip ? '.' : ' (modo lienzo: PiP estándar del navegador).');
    $('#open').textContent = r.active ? 'Cerrar PiP' : 'Abrir PiP con subtítulos';
    $('#live').hidden = !r.active;
    $('[data-live="cc"]').classList.toggle('off', !r.subsOn);
    $('#pick').textContent = r.pick ? `Elegidos a mano: ${r.pick}` : 'Detección automática.';
  });
}
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  tabId = tab && tab.id;
  refresh();
});
$('#open').addEventListener('click', () => send({ type: 'open' }, done));
$('#pickBtn').addEventListener('click', () => { send({ type: 'pick' }); if (!IN_PANEL) window.close(); });
$('#closePanel').addEventListener('click', () => send({ type: 'closePanel' }));
for (const b of document.querySelectorAll('[data-desk]')) {
  b.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'deskCmd', cmd: b.dataset.desk }, () => void chrome.runtime.lastError));
}
// Controles rápidos de la ventana PiP abierta.
$('#live').addEventListener('click', (e) => {
  const act = e.target.dataset && e.target.dataset.live;
  if (!act) return;
  if (act === 'cc') return send({ type: 'toggleSubs' }, refresh);
  chrome.storage.local.get(['scale', 'mode'], (v) => {
    const scale = v.scale ?? D.scale, mode = v.mode ?? D.mode;
    const modes = ['scale', 'fixed', 'outside'];
    if (act === 'mode') chrome.storage.local.set({ mode: modes[(modes.indexOf(mode) + 1) % 3] });
    else chrome.storage.local.set({ scale: Math.round(Math.min(4, Math.max(0.3, scale + (act === 'bigger' ? 0.1 : -0.1))) * 10) / 10 });
  });
});
$('#forget').addEventListener('click', () => { send({ type: 'forgetPick' }); $('#pick').textContent = 'Detección automática.'; });
$('#reset').addEventListener('click', () => chrome.storage.local.set({ ...D }));
load();
