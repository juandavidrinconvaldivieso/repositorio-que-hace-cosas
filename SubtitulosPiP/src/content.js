// Subtítulos PiP — script de contenido (mundo aislado).
// Mueve el <video> a una ventana Document Picture-in-Picture y replica allí los subtítulos
// (pistas nativas WebVTT, subtítulos en HTML del reproductor o subtítulos dibujados en <canvas>).
(() => {
  'use strict';
  if (window.__subpipLoaded) return;
  window.__subpipLoaded = true;

  const D = globalThis.SUBPIP_DEFAULTS;
  const S = { ...D };
  const HAS_DOC_PIP = window.top === window && 'documentPictureInPicture' in window;
  const PICK_KEY = 'pick:' + location.hostname;
  const MODES = ['scale', 'fixed', 'outside'];
  const MODE_NAMES = { scale: 'Escala', fixed: 'Tamaño fijo', outside: 'Fuera' };
  const ACC = '#fa1e4e';

  // Contenedores de subtítulos de reproductores conocidos.
  const SITE_SEL = [
    '.ytp-caption-window-container', '.player-timedtext', '.atvwebplayersdk-captions-overlay',
    '.dss-subtitle-renderer-wrapper', '.vjs-text-track-display', '.jw-captions', '.plyr__captions',
    '.vp-captions', '.player-captions-container', '.shaka-text-container', '.bmpui-ui-subtitle-overlay',
    '.fp-captions', '.mejs__captions-layer', '.art-subtitle', '.dplayer-subtitle'
  ].join(',');
  const GEN_SEL = '[class*="caption" i],[class*="subtitle" i],[class*="timedtext" i],[class*="texttrack" i],[id*="caption" i],[id*="subtitle" i]';
  const CANVAS_RX = /subtit|caption|libass|jassub|octopus|\bass\b|subs/i;
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SVG', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'IFRAME', 'OBJECT', 'NOSCRIPT']);
  const VTT_COLORS = { white: '#fff', lime: '#0f0', cyan: '#0ff', red: '#f00', yellow: '#ff0', magenta: '#f0f', blue: '#00f', black: '#000' };
  const DASH = /^\s*[-–—]/;

  let SV = 0;            // versión de ajustes (invalida la caché de dibujo)
  let session = null;
  let lastVideo = null;
  let sitePick = null;
  let picker = null;
  let ui = null;

  // ---------------- Ajustes ----------------
  chrome.storage.local.get(null, (all) => {
    for (const k in D) if (k in all) S[k] = all[k];
    sitePick = all[PICK_KEY] || null;
    applySettings();
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    for (const k in ch) if (k in D) S[k] = ch[k].newValue ?? D[k];
    if (ch[PICK_KEY]) {
      sitePick = ch[PICK_KEY].newValue || null;
      if (session) { session.mo.disconnect(); session.domSources = []; session.canvasSources = []; discover(session); }
    }
    if (ch.pickDone) stopPicker();
    if (session && ch.scale) notify(session, 'Tamaño: ' + Math.round(S.scale * 100) + '%');
    if (session && ch.mode) notify(session, 'Modo: ' + MODE_NAMES[S.mode]);
    applySettings();
  });

  function applySettings() {
    SV++;
    if (!S.enabled || !S.showButton) hideButton();
    updateAutoPip();
    updateDesk();
    if (!session) return;
    if (session.kind === 'canvas') sizeCanvas(session);
    else { applyRootData(session); updateControls(session); }
    schedule(session, true);
  }

  // ---------------- Utilidades ----------------
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const isTransparent = (c) => !c || c === 'transparent' || /,\s*0\)$/.test(c);
  const px2em = (str, fs) => str.replace(/(-?\d*\.?\d+)px/g, (_, n) => (parseFloat(n) / fs).toFixed(4) + 'em');
  const videoAspect = (v, fb) => (v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : fb || 16 / 9);
  const normAlign = (a) => (/center/.test(a) ? 'center' : a === 'right' || a === 'end' ? 'right' : 'left');
  const fmt = (t) => {
    t = Math.max(0, Math.floor(t || 0));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = String(t % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  };
  function fitContain(r, a) {
    let w = r.width, h = w / a;
    if (h > r.height) { h = r.height; w = h * a; }
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
  }
  function isVisible(el) {
    if (el.checkVisibility) return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0 && el.getClientRects().length > 0;
  }
  function h(doc, tag, props, ...kids) {
    const el = doc.createElement(tag);
    for (const k in props || {}) {
      if (k === 'class') el.className = props[k];
      else if (k === 'text') el.textContent = props[k];
      else el.setAttribute(k, props[k]);
    }
    for (const c of kids) if (c != null) el.append(c);
    return el;
  }
  // Hojas construidas: no chocan con CSP / Trusted Types de páginas como YouTube.
  function adoptCss(target, win, css) {
    try {
      const sh = new win.CSSStyleSheet();
      sh.replaceSync(css);
      target.adoptedStyleSheets = [...target.adoptedStyleSheets, sh];
    } catch (_) {
      const doc = target.ownerDocument || target;
      const st = doc.createElement('style');
      st.textContent = css;
      (target.head || target).append(st);
    }
  }
  function textAfter(n) {
    let x = n.nextSibling;
    while (x && !(x.textContent || '').trim()) x = x.nextSibling;
    return x ? x.textContent : '';
  }

  // ---------------- Elección de vídeo ----------------
  function videoAt(x, y) {
    let best = null, area = 0;
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect();
      if (r.width < 200 || r.height < 112 || x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      if (r.width * r.height > area) { area = r.width * r.height; best = v; }
    }
    return best;
  }
  function pickVideo() {
    if (lastVideo && lastVideo.isConnected) return lastVideo;
    let best = null, score = 0;
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect();
      const sc = r.width * r.height * (v.paused ? 1 : 4) * (v.readyState > 0 ? 1 : 0.2);
      if (r.width * r.height > 100 && sc > score) { score = sc; best = v; }
    }
    return best;
  }

  // ---------------- Interfaz en la página ----------------
  const UI_CSS = `
.btn{position:fixed;display:none;padding:6px 10px;border:0;border-radius:8px;background:rgba(20,20,24,.85);color:#fff;font:600 13px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.4)}
.btn.on{display:block}.btn:hover{background:${ACC}}
.panel{position:fixed;top:70px;right:20px;width:360px;height:min(600px,calc(100vh - 90px));border:0;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.6);background:#16161c;color-scheme:dark}
.toast{position:fixed;left:50%;bottom:32px;transform:translateX(-50%);max-width:80vw;padding:10px 14px;border-radius:10px;background:rgba(20,20,24,.94);color:#fff;font:14px/1.35 system-ui,sans-serif;opacity:0;transition:opacity .2s;pointer-events:none}
.toast.on{opacity:1}
.prompt{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);display:none;flex-direction:column;align-items:center;gap:8px;padding:18px 22px;border-radius:14px;background:rgba(20,20,24,.96);color:#ccc;font:13px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)}
.prompt.on{display:flex}
.prompt button{padding:10px 16px;border:0;border-radius:10px;background:${ACC};color:#fff;font:600 15px system-ui,sans-serif;cursor:pointer}
.hl{position:fixed;display:none;border:2px solid ${ACC};background:rgba(250,30,78,.15);pointer-events:none;box-sizing:border-box}
.hl.on{display:block}
.hl span{position:absolute;left:0;top:-26px;white-space:nowrap;padding:3px 6px;border-radius:4px;background:${ACC};color:#fff;font:12px system-ui,sans-serif}`;

  function getUI() {
    if (!ui) {
      const host = document.createElement('subpip-ui');
      host.style.cssText = 'all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;';
      const root = host.attachShadow({ mode: 'closed' });
      adoptCss(root, window, UI_CSS);
      const btn = h(document, 'button', { class: 'btn', type: 'button', text: '⧉ CC' });
      const gear = h(document, 'button', { class: 'btn', type: 'button', text: '⚙', title: 'Menú de Subtítulos PiP' });
      const toastEl = h(document, 'div', { class: 'toast' });
      const pbtn = h(document, 'button', { type: 'button', text: '▶ Abrir PiP con subtítulos' });
      const prompt = h(document, 'div', { class: 'prompt' }, pbtn, h(document, 'small', { text: 'El navegador exige un clic para abrir la ventana flotante.' }));
      const hl = h(document, 'div', { class: 'hl' }, h(document, 'span'));
      root.append(btn, gear, toastEl, prompt, hl);
      ui = { host, root, btn, gear, toast: toastEl, prompt, hl };
      gear.addEventListener('click', (e) => { e.preventDefault(); togglePanel(); });
      gear.addEventListener('mouseenter', () => { ui.hover = true; clearTimeout(ui.hideT); });
      gear.addEventListener('mouseleave', () => { ui.hover = false; ui.hideT = setTimeout(hideButton, 2500); });
      for (const ev of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick']) host.addEventListener(ev, (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => { e.preventDefault(); hideButton(); startPip(ui.btnVideo || pickVideo()); });
      btn.addEventListener('mouseenter', () => { ui.hover = true; clearTimeout(ui.hideT); });
      btn.addEventListener('mouseleave', () => { ui.hover = false; ui.hideT = setTimeout(hideButton, 2500); });
      pbtn.addEventListener('click', () => { prompt.classList.remove('on'); startPip(ui.promptVideo, true); });
    }
    const fs = document.fullscreenElement;
    const parent = fs && fs.nodeName !== 'VIDEO' ? fs : document.documentElement;
    if (ui.host.parentNode !== parent) parent.appendChild(ui.host);
    return ui;
  }
  function showButton(v) {
    const u = getUI(), r = v.getBoundingClientRect();
    u.btn.textContent = session ? '✕ PiP' : '⧉ CC';
    u.btn.title = session ? 'Cerrar la ventana PiP' : `Imagen en imagen con subtítulos (${S.hotkey})`;
    u.btn.style.left = clamp(r.right - 84, 4, innerWidth - 90) + 'px';
    u.btn.style.top = clamp(r.top + 10, 4, innerHeight - 40) + 'px';
    u.gear.style.left = parseFloat(u.btn.style.left) - 40 + 'px';
    u.gear.style.top = u.btn.style.top;
    u.btn.classList.add('on');
    u.gear.classList.add('on');
    u.btnVideo = v;
    clearTimeout(u.hideT);
    if (!u.hover) u.hideT = setTimeout(hideButton, 2500);
  }
  function hideButton() { if (ui) { ui.btn.classList.remove('on'); ui.gear.classList.remove('on'); ui.hover = false; } }

  // Menú dentro de la pestaña (la ventana PiP estándar no admite interfaz propia).
  // Es la misma página del popup, cargada en un iframe; un clic dentro también cuenta como clic del usuario.
  let panel = null;
  function togglePanel(force) {
    const open = force ?? !panel;
    if (!open) { if (panel) panel.remove(); panel = null; return; }
    if (panel) return;
    const u = getUI();
    panel = document.createElement('iframe');
    panel.className = 'panel';
    panel.src = chrome.runtime.getURL('popup/popup.html?panel=1');
    u.root.append(panel);
  }
  document.addEventListener('mousedown', () => panel && togglePanel(false)); // clic fuera = cerrar

  // Botón en la barra de controles de YouTube.
  if (/(^|\.)youtube\.com$/.test(location.hostname)) {
    setInterval(() => {
      const bar = document.querySelector('.ytp-right-controls');
      if (!S.enabled || !bar || bar.querySelector('.subpip-yt')) return;
      const b = document.createElement('button');
      b.className = 'ytp-button subpip-yt';
      b.title = 'Subtítulos PiP (menú)';
      b.textContent = '⧉';
      b.style.cssText = 'font-size:20px;color:#fff;text-align:center;vertical-align:top;';
      b.addEventListener('mousedown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); togglePanel(); });
      bar.prepend(b);
    }, 1500);
  }
  function toast(msg, ms = 4000) {
    const u = getUI();
    u.toast.textContent = msg;
    u.toast.classList.add('on');
    clearTimeout(u.toastT);
    u.toastT = setTimeout(() => u.toast.classList.remove('on'), ms);
  }
  function showPrompt(v) {
    const u = getUI();
    u.promptVideo = v;
    u.prompt.classList.add('on');
    clearTimeout(u.promptT);
    u.promptT = setTimeout(() => u.prompt.classList.remove('on'), 8000);
  }

  let moveT = 0;
  document.addEventListener('mousemove', (e) => {
    if (!S.enabled || !S.showButton || picker) return;
    const now = performance.now();
    if (now - moveT < 120) return;
    moveT = now;
    const v = videoAt(e.clientX, e.clientY);
    if (v) { lastVideo = v; showButton(v); }
  }, { passive: true, capture: true });

  // Atajo de teclado (Alt+P por defecto).
  function hotkeyMatch(e) {
    const parts = (S.hotkey || '').split('+');
    const key = parts.pop();
    if (!key || e.metaKey) return false;
    if (e.ctrlKey !== parts.includes('Ctrl') || e.altKey !== parts.includes('Alt') || e.shiftKey !== parts.includes('Shift')) return false;
    const code = e.code.replace(/^Key|^Digit/, '');
    return code === key;
  }
  window.addEventListener('keydown', (e) => {
    if (!S.enabled || !hotkeyMatch(e)) return;
    e.preventDefault();
    e.stopPropagation();
    startPip(session ? session.video : pickVideo());
  }, true);

  // Botón PiP del propio sitio (interceptado en page-hook.js).
  window.addEventListener('subpip:request', (e) => {
    if (!S.enabled || !S.interceptSitePip || e.target.nodeName !== 'VIDEO') return;
    if (!HAS_DOC_PIP && (S.pipMethod === 'real' || !canDraw(e.target))) return; // PiP normal del sitio
    e.preventDefault();
    if (!session) startPip(e.target);
  }, true);
  window.addEventListener('subpip:exit', () => session && session.close());

  // PiP automático al cambiar de pestaña (Media Session, Chromium 120+).
  let autoSet = false;
  function updateAutoPip() {
    if (!HAS_DOC_PIP || !navigator.mediaSession) return;
    try {
      if (S.enabled && S.autoPip) {
        navigator.mediaSession.setActionHandler('enterpictureinpicture', () => { if (!session) startPip(pickVideo()); });
        autoSet = true;
      } else if (autoSet) {
        navigator.mediaSession.setActionHandler('enterpictureinpicture', null);
        autoSet = false;
      }
    } catch (_) {}
  }

  // Mensajes del popup.
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    const v = session ? session.video : pickVideo();
    if (msg.type === 'status') {
      if (!v) return;
      reply({ host: location.hostname, docPip: HAS_DOC_PIP, active: !!session, subsOn: !session || session.subsOn, pick: sitePick });
    } else if (msg.type === 'toggleSubs') {
      if (!session) return;
      session.subsOn = !session.subsOn;
      notify(session, session.subsOn ? 'Subtítulos visibles' : 'Subtítulos ocultos');
      if (session.kind !== 'canvas') updateControls(session);
      schedule(session, true);
      reply({ subsOn: session.subsOn });
    } else if (msg.type === 'closePanel') {
      togglePanel(false);
    } else if (msg.type === 'open') {
      if (!v) return;
      if (session) session.close();
      else if (navigator.userActivation && navigator.userActivation.isActive) startPip(v);
      else showPrompt(v);
      reply({ ok: true });
    } else if (msg.type === 'pick') {
      togglePanel(false);
      startPicker();
    } else if (msg.type === 'forgetPick') {
      chrome.storage.local.remove(PICK_KEY);
    }
  });

  // ---------------- Selector manual de subtítulos ----------------
  function buildSelector(el) {
    const part = (e) => {
      if (e.id && !/\d{3,}/.test(e.id)) return '#' + CSS.escape(e.id);
      const cls = [...e.classList].filter((c) => !/\d{3,}|^(on|active|hover|visible|hidden|show)$/i.test(c)).slice(0, 3);
      let p = e.nodeName.toLowerCase() + cls.map((c) => '.' + CSS.escape(c)).join('');
      if (!cls.length && e.parentElement) p += `:nth-of-type(${[...e.parentElement.children].filter((x) => x.nodeName === e.nodeName).indexOf(e) + 1})`;
      return p;
    };
    const chain = [];
    for (let e = el; e && e !== document.body && chain.length < 3; e = e.parentElement) {
      const p = part(e);
      chain.unshift(p);
      if (p.startsWith('#') || (e.classList.length && chain.length >= 2)) break;
    }
    return chain.join(' > ');
  }
  function startPicker() {
    if (picker) return;
    const u = getUI();
    const label = u.hl.firstChild;
    picker = { el: null, stack: [] };
    const show = (el) => {
      picker.el = el;
      const r = el.getBoundingClientRect();
      Object.assign(u.hl.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
      label.textContent = buildSelector(el) + '   ·   clic: elegir · ↑/↓: contenedor · Esc: cancelar';
      u.hl.classList.add('on');
    };
    const block = (e) => { e.preventDefault(); e.stopPropagation(); };
    picker.handlers = {
      mousemove: (e) => {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el && el !== u.host && el !== picker.base) { picker.base = el; picker.stack = []; show(el); }
      },
      keydown: (e) => {
        if (e.key === 'Escape') stopPicker();
        else if (e.key === 'ArrowUp' && picker.el && picker.el.parentElement && picker.el.parentElement !== document.body) { picker.stack.push(picker.el); show(picker.el.parentElement); }
        else if (e.key === 'ArrowDown' && picker.stack.length) show(picker.stack.pop());
        else return;
        block(e);
      },
      click: (e) => {
        block(e);
        if (!picker.el) return;
        const sel = buildSelector(picker.el);
        chrome.storage.local.set({ [PICK_KEY]: sel, pickDone: Date.now() });
        toast('Subtítulos de este sitio: ' + sel);
        stopPicker();
      },
      mousedown: block, pointerdown: block, mouseup: block, pointerup: block
    };
    for (const k in picker.handlers) document.addEventListener(k, picker.handlers[k], true);
    toast('Señala los subtítulos del vídeo y haz clic. ↑ selecciona el contenedor. Esc cancela.', 6000);
  }
  function stopPicker() {
    if (!picker) return;
    for (const k in picker.handlers) document.removeEventListener(k, picker.handlers[k], true);
    picker = null;
    if (ui) ui.hl.classList.remove('on');
  }

  // ---------------- Búsqueda de subtítulos ----------------
  function playerRoot(refEl) {
    const r0 = refEl.getBoundingClientRect();
    const a0 = Math.max(1, r0.width * r0.height);
    let root = refEl.parentElement || document.body;
    for (let el = root; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      const r = el.getBoundingClientRect();
      if (r.width * r.height > a0 * 1.8) break;
      root = el;
    }
    return root;
  }
  function overlaps(a, b) {
    const r = a.getBoundingClientRect(), q = b.getBoundingClientRect();
    return r.width > 0 && r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top;
  }
  function findCaptionSources(s) {
    const root = playerRoot(s.refEl);
    const dom = [], canvas = [];
    const add = (el) => {
      if (!el || el.closest('subpip-ui') || el.contains(s.refEl)) return;
      if (el.nodeName === 'CANVAS') { canvas.push(el); return; }
      if (SKIP_TAGS.has(el.nodeName.toUpperCase()) || el.closest('button,[role=button],[role=menu],[role=menuitem],[role=dialog]')) return;
      dom.push(el);
    };
    if (sitePick) {
      try { document.querySelectorAll(sitePick).forEach(add); } catch (_) {}
    }
    if (!dom.length && !canvas.length) {
      document.querySelectorAll(SITE_SEL).forEach((el) => (root.contains(el) || overlaps(el, s.refEl)) && add(el));
      if (!dom.length) {
        root.querySelectorAll(GEN_SEL).forEach((el) => {
          if (el.querySelector('button,input,select,video,[role=button]') || (el.textContent || '').length > 600) return;
          add(el);
        });
      }
      root.querySelectorAll('canvas').forEach((c) => {
        if (CANVAS_RX.test(`${c.getAttribute('class') || ''} ${c.id} ${(c.parentElement && c.parentElement.getAttribute('class')) || ''}`)) add(c);
      });
    }
    return { dom: dom.filter((a) => !dom.some((b) => b !== a && b.contains(a))), canvas };
  }
  function discover(s) {
    if (s.closed) return;
    const f = findCaptionSources(s);
    for (const el of f.dom) {
      if (s.domSources.includes(el)) continue;
      s.domSources.push(el);
      s.mo.observe(el, { subtree: true, childList: true, characterData: true, attributes: true });
      schedule(s);
    }
    s.domSources = s.domSources.filter((a) => a.isConnected && !s.domSources.some((b) => b !== a && b.contains(a)));
    for (const c of f.canvas) if (!s.canvasSources.includes(c)) s.canvasSources.push(c);
    s.canvasSources = s.canvasSources.filter((c) => c.isConnected);
  }
  function syncTracks(s) {
    for (const t of s.video.textTracks) {
      if ((t.kind !== 'subtitles' && t.kind !== 'captions') || t.mode !== 'showing') continue;
      if (!s.taken.has(t)) { s.taken.add(t); t.addEventListener('cuechange', s.onCue); }
      t.mode = 'hidden'; // dejamos de pintarla en el vídeo y la dibujamos nosotros
    }
    s.tracks = [...s.taken].filter((t) => t.mode === 'hidden');
    schedule(s);
  }
  function restoreTracks(s) {
    for (const t of s.taken) {
      t.removeEventListener('cuechange', s.onCue);
      if (t.mode === 'hidden') t.mode = 'showing';
    }
    s.taken.clear();
  }

  // ---------------- Extracción a un modelo de bloques ----------------
  // bloque = { node, h:'left|center|right', x, v:'top|bottom', y, w, refH, align, order }
  function refContent(s) {
    let r = s.refEl.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) r = s.lastRef || { left: 0, top: 0, width: 640, height: 360 };
    else s.lastRef = r;
    return fitContain(r, videoAspect(s.video, r.width / r.height));
  }
  function cloneStyled(orig, isRoot) {
    if (orig.nodeType === 3) return document.createTextNode(orig.nodeValue);
    if (orig.nodeType !== 1) return null;
    const tag = orig.nodeName.toUpperCase();
    if (tag === 'BR') return document.createElement('br');
    if (SKIP_TAGS.has(tag) || (!isRoot && !isVisible(orig))) return null;
    const cs = getComputedStyle(orig);
    const fs = parseFloat(cs.fontSize) || 16;
    const disp = cs.display;
    const block = !isRoot && /^(block|flex|grid|list-item|table|flow-root)/.test(disp);
    const el = document.createElement(['RUBY', 'RT', 'RP'].includes(tag) ? tag.toLowerCase() : block ? 'div' : 'span');
    el.dataset.fs = fs.toFixed(2);
    let st = `color:${cs.color};font-family:${cs.fontFamily};font-weight:${cs.fontWeight};font-style:${cs.fontStyle};`;
    if (cs.fontVariant !== 'normal') st += `font-variant:${cs.fontVariant};`;
    if (cs.textTransform !== 'none') st += `text-transform:${cs.textTransform};`;
    if (!isTransparent(cs.backgroundColor)) st += `background-color:${cs.backgroundColor};`;
    if (cs.textDecorationLine !== 'none') st += `text-decoration:${cs.textDecorationLine} ${cs.textDecorationStyle} ${cs.textDecorationColor};`;
    if (cs.textShadow !== 'none') st += `text-shadow:${px2em(cs.textShadow, fs)};`;
    const sw = parseFloat(cs.webkitTextStrokeWidth);
    if (sw > 0) st += `-webkit-text-stroke:${(sw / fs).toFixed(4)}em ${cs.webkitTextStrokeColor};`;
    if (cs.letterSpacing !== 'normal') st += `letter-spacing:${px2em(cs.letterSpacing, fs)};`;
    const lh = parseFloat(cs.lineHeight);
    if (lh) st += `line-height:${(lh / fs).toFixed(3)};`;
    const pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft];
    if (pad.some((p) => parseFloat(p))) st += `padding:${pad.map((p) => px2em(p, fs)).join(' ')};`;
    if (parseFloat(cs.borderTopLeftRadius)) st += `border-radius:${px2em(cs.borderRadius, fs)};`;
    if (+cs.opacity < 1) st += `opacity:${cs.opacity};`;
    if ((cs.boxDecorationBreak || cs.webkitBoxDecorationBreak) === 'clone') st += '-webkit-box-decoration-break:clone;box-decoration-break:clone;';
    if (cs.direction === 'rtl') st += 'direction:rtl;';
    if (!isRoot) {
      if (/^inline-/.test(disp)) st += 'display:inline-block;';
      if (cs.whiteSpace !== 'normal') st += `white-space:${cs.whiteSpace};`;
      if (cs.verticalAlign !== 'baseline') st += `vertical-align:${px2em(cs.verticalAlign, fs)};`;
      if (block) st += `text-align:${normAlign(cs.textAlign)};`;
    }
    el.style.cssText = st;
    if (block) el.dataset.line = '1';
    for (const c of orig.childNodes) { const x = cloneStyled(c, false); if (x) el.append(x); }
    return el;
  }
  function blockRoot(el, container, refArea) {
    let top = el;
    for (let a = el; a && a !== container; a = a.parentElement) {
      const p = getComputedStyle(a).position;
      if (p === 'absolute' || p === 'fixed') {
        const r = a.getBoundingClientRect();
        if (r.width * r.height < refArea * 0.6) return a;
      }
      top = a;
    }
    return top;
  }
  function blockFromRect(node, rect, ref, align) {
    const cx = (rect.left + rect.width / 2 - ref.left) / ref.width;
    const cy = (rect.top + rect.height / 2 - ref.top) / ref.height;
    const b = { node, align, w: clamp(rect.width / ref.width, 0.05, 1), refH: ref.height, order: cy };
    if (Math.abs(cx - 0.5) < 0.12) { b.h = 'center'; b.x = clamp(cx, 0.1, 0.9); }
    else if (cx < 0.5) { b.h = 'left'; b.x = clamp((rect.left - ref.left) / ref.width, 0, 0.9); }
    else { b.h = 'right'; b.x = clamp((ref.left + ref.width - rect.right) / ref.width, 0, 0.9); }
    if (cy < 0.5) { b.v = 'top'; b.y = (rect.top - ref.top) / ref.height; }
    else { b.v = 'bottom'; b.y = (ref.top + ref.height - rect.bottom) / ref.height; }
    b.y = clamp(b.y, 0, 0.9);
    return b;
  }
  function extractDom(container, ref, out) {
    const refArea = ref.width * ref.height;
    const roots = [];
    const tw = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const el = n.parentElement;
      if (!n.nodeValue.trim() || !el || !isVisible(el)) continue;
      const r = blockRoot(el, container, refArea);
      if (!roots.includes(r)) roots.push(r);
    }
    for (const r of roots) {
      if (roots.some((o) => o !== r && o.contains(r))) continue;
      let rect = r.getBoundingClientRect();
      if (rect.width * rect.height >= refArea * 0.5) { // contenedor a pantalla completa: usar la caja del texto
        const rg = document.createRange();
        rg.selectNodeContents(r);
        const tr = rg.getBoundingClientRect();
        if (tr.width > 0) rect = tr;
      }
      if (rect.width < 1 || rect.height < 1) continue;
      const node = cloneStyled(r, true);
      if (node && node.textContent.trim()) out.push(blockFromRect(node, rect, ref, normAlign(getComputedStyle(r).textAlign)));
    }
  }
  function convertCueNode(n) {
    if (n.nodeType === 3) return document.createTextNode(n.nodeValue);
    if (n.nodeType !== 1) return null; // marcas de tiempo (karaoke) se ignoran
    const tag = n.nodeName.toLowerCase();
    const el = document.createElement(['b', 'i', 'u', 'ruby', 'rt'].includes(tag) ? tag : 'span');
    for (const c of n.classList) {
      if (VTT_COLORS[c]) el.style.color = VTT_COLORS[c];
      else if (c.startsWith('bg_') && VTT_COLORS[c.slice(3)]) el.style.backgroundColor = VTT_COLORS[c.slice(3)];
    }
    for (const ch of n.childNodes) { const x = convertCueNode(ch); if (x) el.append(x); }
    return el;
  }
  function extractTrack(track, ref, out) {
    for (const cue of track.activeCues || []) {
      const root = document.createElement('div');
      root.dataset.fs = (ref.height * 0.05).toFixed(2);
      root.style.cssText = 'color:#fff;font-family:Arial,Helvetica,sans-serif;white-space:pre-line;line-height:1.25;';
      const bg = document.createElement('span');
      bg.style.cssText = 'background-color:rgba(0,0,0,.8);padding:0 .25em;-webkit-box-decoration-break:clone;box-decoration-break:clone;';
      let frag = null;
      try { frag = cue.getCueAsHTML && cue.getCueAsHTML(); } catch (_) {}
      if (frag) for (const c of frag.childNodes) { const x = convertCueNode(c); if (x) bg.append(x); }
      else bg.textContent = cue.text || '';
      if (!bg.textContent.trim()) continue;
      root.append(bg);
      // Posición WebVTT: line / position / align / size
      const al = cue.align || 'center';
      const ta = al === 'left' || al === 'start' ? 'left' : al === 'right' || al === 'end' ? 'right' : 'center';
      const pos = typeof cue.position === 'number' ? cue.position : ta === 'left' ? 0 : ta === 'right' ? 100 : 50;
      const b = { node: root, align: ta, w: clamp((cue.size ?? 100) / 100, 0.1, 1), refH: ref.height, h: ta, v: 'bottom', y: 0.04 };
      b.x = ta === 'center' ? clamp(pos / 100, 0.1, 0.9) : ta === 'left' ? clamp(pos / 100, 0, 0.9) : clamp(1 - pos / 100, 0, 0.9);
      if (typeof cue.line === 'number') {
        if (cue.snapToLines !== false) {
          if (cue.line >= 0) { b.v = 'top'; b.y = cue.line * 0.0533; } else b.y = (-cue.line - 1) * 0.0533 + 0.02;
        } else if (cue.lineAlign === 'end' || cue.line >= 50) b.y = 1 - cue.line / 100;
        else { b.v = 'top'; b.y = cue.line / 100; }
      }
      b.y = clamp(b.y, 0, 0.9);
      b.order = b.v === 'top' ? b.y : 1 - b.y;
      out.push(b);
    }
  }
  function collectBlocks(s) {
    const out = [];
    const ph = refContent(s);
    for (const c of s.domSources) {
      if (!c.isConnected) continue;
      const cr = c.getBoundingClientRect();
      const ref = cr.width * cr.height >= 0.4 * ph.width * ph.height ? fitContain(cr, videoAspect(s.video, cr.width / cr.height)) : ph;
      extractDom(c, ref, out);
    }
    for (const t of s.tracks) extractTrack(t, ph, out);
    // Marca los elementos que llevan texto: ahí va el fondo elegido en el menú de estilo.
    for (const b of out) {
      for (const el of [b.node, ...b.node.querySelectorAll('*')]) {
        if ([...el.childNodes].some((t) => t.nodeType === 3 && t.nodeValue.trim())) el.dataset.tx = '1';
      }
    }
    return out.sort((a, b) => a.order - b.order);
  }

  // ---------------- Dibujo en la ventana PiP ----------------
  const maxFs = (node) => Math.max(+node.dataset.fs || 0, ...[...node.querySelectorAll('[data-fs]')].map((e) => +e.dataset.fs));
  function sizeFonts(node, k) {
    for (const el of [node, ...node.querySelectorAll('[data-fs]')]) {
      if (el.dataset.fs) el.style.fontSize = Math.max(S.minFontPx, el.dataset.fs * k).toFixed(1) + 'px';
    }
  }
  // Une las líneas para que el texto se reacomode al ancho disponible (respeta guiones de diálogo).
  function joinLines(node) {
    node.classList.add('sp-join');
    for (const br of node.querySelectorAll('br')) if (!DASH.test(textAfter(br))) br.replaceWith(' ');
    node.querySelectorAll('[data-line]').forEach((ln, i) => (i > 0 && DASH.test(ln.textContent) ? ln.classList.add('sp-keep') : ln.append(' ')));
    const tw = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      if (t.nodeValue.includes('\n')) t.nodeValue = t.nodeValue.replace(/[ \t]*\n[ \t]*(?![-–—])/g, ' ');
    }
  }
  function place(container, b, maxW) {
    const wr = document.createElement('div');
    wr.className = 'sp-wrap';
    const st = wr.style;
    if (b.v === 'top') st.top = b.y * 100 + '%'; else st.bottom = b.y * 100 + '%';
    if (b.h === 'center') {
      st.left = '0'; st.right = '0'; st.textAlign = 'center';
      const off = (b.x - 0.5) * 2; // centrado en x: se recorta el lado contrario
      if (off < 0) st.paddingRight = -off * 100 + '%'; else st.paddingLeft = off * 100 + '%';
    } else if (b.h === 'left') { st.left = b.x * 100 + '%'; st.right = '0'; st.textAlign = 'left'; }
    else { st.right = b.x * 100 + '%'; st.left = '0'; st.textAlign = 'right'; }
    b.node.classList.add('sp-sub');
    b.node.style.maxWidth = `min(100%, ${maxW.toFixed(1)}px)`;
    b.node.style.textAlign = b.align;
    wr.append(b.node);
    container.append(wr);
    b.wr = wr;
  }
  // Evita solapes entre bloques y que se salgan del vídeo.
  function resolveLayout(blocks, H) {
    for (const side of ['bottom', 'top']) {
      const placed = [];
      for (const b of blocks.filter((x) => x.wr && x.v === side).sort((a, c) => a.y - c.y)) {
        const hgt = b.wr.offsetHeight;
        const r = b.node.getBoundingClientRect();
        let pos = b.y * H, moved = true;
        while (moved) {
          moved = false;
          for (const p of placed) {
            if (r.right > p.l && r.left < p.r && pos < p.pos + p.h && pos + hgt > p.pos) { pos = p.pos + p.h + 2; moved = true; }
          }
        }
        pos = clamp(pos, 0, Math.max(0, H - hgt));
        b.wr.style.top = b.wr.style.bottom = '';
        b.wr.style[side] = pos + 'px';
        placed.push({ l: r.left, r: r.right, pos, h: hgt });
      }
    }
  }
  function renderDoc(s, force) {
    const E = s.els;
    const blocks = s.subsOn ? collectBlocks(s) : [];
    const sw = E.stage.clientWidth, sh = E.stage.clientHeight;
    const c = fitContain({ left: 0, top: 0, width: sw, height: sh }, videoAspect(s.video, sw / sh || 16 / 9));
    s.content = c;
    let sig = `${SV}|${sw}x${sh}`;
    for (const b of blocks) sig += `|${b.h}${b.x.toFixed(3)}${b.v}${b.y.toFixed(3)}${b.w.toFixed(2)}${b.refH.toFixed(0)}${b.node.outerHTML}`;
    if (!force && sig === s.sig) return;
    s.sig = sig;
    E.overlay.style.cssText = `left:${c.left}px;top:${c.top}px;width:${c.width}px;height:${c.height}px;`;
    E.overlay.replaceChildren();
    E.bandTop.replaceChildren();
    E.bandBottom.replaceChildren();
    if (S.mode === 'outside') return renderOutside(s, blocks);
    E.bandTop.style.display = E.bandBottom.style.display = 'none';
    const fixed = S.mode === 'fixed';
    for (const b of blocks) {
      // Escala: proporcional a la altura del vídeo. Fijo: tamaño original del reproductor.
      sizeFonts(b.node, fixed ? S.scale : (c.height / b.refH) * S.scale);
      if (fixed && S.joinLines) joinLines(b.node);
      const maxW = fixed ? (c.width * S.fixedMaxWidth) / 100 : Math.min(c.width, b.w * c.width * S.scale * 1.08 + 8);
      place(E.overlay, b, maxW);
    }
    resolveLayout(blocks, c.height);
  }
  function renderOutside(s, blocks) {
    const E = s.els;
    if (blocks.length) {
      const m = Math.max(...blocks.map((b) => maxFs(b.node)));
      if (m > 0 && Math.abs(m - s.basePx) / s.basePx > 0.15) s.basePx = m;
    }
    for (const b of blocks) {
      const base = maxFs(b.node) || s.basePx;
      sizeFonts(b.node, (S.outsideFontPx > 0 ? S.outsideFontPx / base : 1) * S.scale);
      if (S.joinLines) joinLines(b.node);
      b.node.classList.add('sp-sub');
      b.node.style.maxWidth = '100%';
      b.node.style.textAlign = b.align;
      const line = h(document, 'div', { class: 'sp-line' }, b.node);
      line.style.textAlign = b.h;
      if (b.h === 'left') line.style.paddingLeft = Math.min(b.x, 0.3) * 100 + '%';
      if (b.h === 'right') line.style.paddingRight = Math.min(b.x, 0.3) * 100 + '%';
      const toTop = S.outsidePosition === 'top' || (S.outsidePosition === 'auto' && b.v === 'top');
      (toTop ? E.bandTop : E.bandBottom).append(line);
    }
    const minH = Math.round(S.outsideLines * (S.outsideFontPx || s.basePx) * S.scale * 1.3 + 12) + 'px';
    const topMain = S.outsidePosition === 'top';
    E.bandTop.style.minHeight = topMain ? minH : '0';
    E.bandBottom.style.minHeight = topMain ? '0' : minH;
    E.bandTop.style.display = topMain || E.bandTop.childElementCount ? 'flex' : 'none';
    E.bandBottom.style.display = !topMain || E.bandBottom.childElementCount ? 'flex' : 'none';
  }
  // Subtítulos dibujados en <canvas> (ASS/libass): se copian fotograma a fotograma.
  function drawMirrors(s) {
    const c = s.content;
    if (!c) return;
    const ref = refContent(s);
    for (const src of s.canvasSources) {
      let m = s.mirrors.get(src);
      if (!m) {
        m = document.createElement('canvas');
        m.className = 'sp-mirror';
        s.els.stage.insertBefore(m, s.els.overlay);
        s.mirrors.set(src, m);
      }
      const r = src.getBoundingClientRect();
      if (!s.subsOn || !src.isConnected || r.width < 1) { m.style.display = 'none'; continue; }
      if (m.width !== src.width || m.height !== src.height) { m.width = src.width; m.height = src.height; }
      const ctx = m.getContext('2d');
      ctx.clearRect(0, 0, m.width, m.height);
      try { ctx.drawImage(src, 0, 0); } catch (_) {}
      const fx = c.width / ref.width, fy = c.height / ref.height;
      m.style.cssText = `display:block;left:${c.left + (r.left - ref.left) * fx}px;top:${c.top + (r.top - ref.top) * fy}px;width:${r.width * fx}px;height:${r.height * fy}px;`;
    }
  }
  function schedule(s, force) {
    if (force) s.force = true;
    if (s.kind === 'canvas' || s.kind === 'desk') { s.dirty = true; return; } // lo recoge el siguiente tic
    if (s.raf || s.closed) return;
    s.raf = s.pw.requestAnimationFrame(() => {
      s.raf = 0;
      const f = s.force;
      s.force = false;
      try { renderDoc(s, f); } catch (e) { console.warn('[Subtítulos PiP]', e); }
    });
  }

  // ---------------- Subtítulos en el escritorio ----------------
  // Lee los subtítulos del vídeo (con o sin PiP) y los manda al programa local, que los dibuja
  // en una capa transparente sobre todo el escritorio.
  let desk = null;
  function deskSend(data) {
    try { chrome.runtime.sendMessage({ type: 'desk', data }).catch(() => {}); } catch (_) {}
  }
  function updateDesk() {
    const want = S.enabled && S.desktop;
    if (want && !desk) {
      desk = { kind: 'desk', domSources: [], canvasSources: [], tracks: [], taken: new Set(), dirty: true, sig: '', lastSend: 0, lastDisc: 0 };
      desk.mo = new MutationObserver(() => { if (desk) desk.dirty = true; });
      desk.timer = setInterval(deskTick, 40);
    } else if (!want && desk) {
      clearInterval(desk.timer);
      desk.mo.disconnect();
      if (desk.count) deskSend({ blocks: [], settings: {} });
      desk = null;
    } else if (desk) desk.dirty = true;
  }
  function deskTick() {
    const s = desk;
    const now = performance.now();
    const v = session ? session.video : pickVideo();
    if (!v || (v.paused && document.hidden)) return; // pestañas en pausa y ocultas no pisan a la activa
    if (v !== s.video) { s.video = v; s.mo.disconnect(); s.domSources = []; s.canvasSources = []; s.lastDisc = 0; }
    s.refEl = session && session.placeholder ? session.placeholder : v;
    if (now - s.lastDisc > 1500) { s.lastDisc = now; discover(s); }
    // Ocultar los subtítulos normales sin dejar de leerlos (el recorte no afecta a la lectura).
    for (const el of s.domSources) {
      const want = S.deskHideOriginal ? 'inset(100%)' : '';
      if (el.style.clipPath !== want) el.style.clipPath = want;
    }
    s.tracks = [...v.textTracks].filter((t) => (t.kind === 'subtitles' || t.kind === 'captions') &&
      (t.mode === 'showing' || (session && session.taken.has(t) && t.mode === 'hidden')));
    if (!s.dirty && !s.tracks.length && now - s.lastSend < 2000) return;
    s.dirty = false;
    const blocks = collectBlocks(s).map((b) => {
      const { toks, win } = blockTokens(b, false, subpipStyle({ ...S, stylePreset: S.deskStyle }));
      return {
        h: b.h, x: +b.x.toFixed(4), v: b.v, y: +b.y.toFixed(4), w: +b.w.toFixed(3), refH: Math.round(b.refH), align: b.align, win,
        runs: toks.map((t) => t && {
          t: t.text, fs: t.st.fs, c: t.st.color, bg: t.st.bg, pad: t.st.pad, f: t.st.family, w: t.st.weight,
          i: t.st.style === 'italic', sc: t.st.variant === 'small-caps', st: t.st.stroke, u: t.st.deco, a: t.st.alpha,
          sh: parseShadows(t.st.shadow, 1).map((q) => [q.x, q.y, q.blur, q.color]) // en em
        })
      };
    });
    const data = { blocks, settings: { mode: S.mode === 'fixed' ? 'fixed' : 'scale', scale: S.deskScale, minFontPx: S.minFontPx, layout: S.desktopLayout } };
    const sig = JSON.stringify(data);
    // Cambios: al instante. Sin cambios: latido cada 2 s mientras haya texto (si no, el programa lo borra).
    if (sig === s.sig && (!blocks.length || now - s.lastSend < 2000)) return;
    s.sig = sig;
    s.lastSend = now;
    s.count = blocks.length;
    deskSend(data);
  }

  // ---------------- Ventana PiP ----------------
  const PIP_CSS = `
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000;color:#fff;font-family:system-ui,"Segoe UI",sans-serif}
#sp-root{display:flex;flex-direction:column;width:100%;height:100%}
#sp-root:not(.sp-show){cursor:none}
#sp-stage{position:relative;flex:1 1 auto;min-height:48px;overflow:hidden;background:#000}
#sp-stage>video{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;transform:none!important;object-fit:contain!important;opacity:1!important;visibility:visible!important;display:block!important}
#sp-overlay{position:absolute;pointer-events:none}
.sp-mirror{position:absolute;pointer-events:none}
.sp-wrap{position:absolute;box-sizing:border-box;pointer-events:none}
.sp-sub{display:inline-block!important;box-sizing:border-box;line-height:1.25;overflow-wrap:break-word;vertical-align:top;margin:0}
.sp-band{display:none;flex:0 0 auto;flex-direction:column;justify-content:center;gap:.15em;max-height:65vh;overflow:hidden;box-sizing:border-box;padding:6px 10px;background:#000}
.sp-line{width:100%;box-sizing:border-box}
.sp-join,.sp-join *{white-space:pre-line!important}
.sp-join [data-line]:not(.sp-keep){display:inline!important}
.sp-join .sp-keep{display:block!important}
#sp-controls{position:absolute;left:0;right:0;bottom:0;padding:18px 8px 6px;background:linear-gradient(transparent,rgba(0,0,0,.78));opacity:0;transition:opacity .2s;z-index:5}
.sp-show #sp-controls,.sp-paused #sp-controls{opacity:1}
.sp-progress{height:5px;margin:0 4px 6px;border-radius:3px;background:rgba(255,255,255,.25);cursor:pointer}
.sp-fill{height:100%;width:0;border-radius:3px;background:${ACC}}
.sp-row{display:flex;align-items:center;gap:4px}
.sp-row button{min-width:30px;height:28px;padding:0 7px;border:0;border-radius:6px;background:rgba(255,255,255,.14);color:#fff;font:600 12px system-ui,sans-serif;cursor:pointer;white-space:nowrap}
.sp-row button:hover{background:${ACC}}
.sp-row button.off{opacity:.45}
.sp-time{font-size:12px;opacity:.85;margin-left:4px;white-space:nowrap}
.sp-flex{flex:1}
.sp-toast{position:absolute;left:50%;top:10px;transform:translateX(-50%);padding:6px 12px;border-radius:8px;background:rgba(0,0,0,.82);font-size:13px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:6;white-space:nowrap}
.sp-toast.on{opacity:1}
@media (max-width:380px){.sp-time,[data-act="back"],[data-act="fwd"]{display:none}}`;

  function buildPipDom(pd) {
    const btn = (act, label, title) => h(pd, 'button', { 'data-act': act, title, text: label });
    const row = h(pd, 'div', { class: 'sp-row' },
      btn('play', '▶', 'Reproducir / pausar (Espacio)'), btn('back', '«10', 'Retroceder 10 s (J)'), btn('fwd', '10»', 'Avanzar 10 s (L)'),
      h(pd, 'span', { class: 'sp-time', text: '0:00' }), h(pd, 'span', { class: 'sp-flex' }),
      btn('cc', 'CC', 'Mostrar / ocultar subtítulos (C)'), btn('mode', 'Escala', 'Cambiar modo de subtítulos (V)'),
      btn('smaller', 'A−', 'Subtítulos más pequeños (−)'), btn('bigger', 'A+', 'Subtítulos más grandes (+)'), btn('mute', '🔊', 'Silenciar (M)'));
    const fill = h(pd, 'div', { class: 'sp-fill' });
    const progress = h(pd, 'div', { class: 'sp-progress' }, fill);
    const overlay = h(pd, 'div', { id: 'sp-overlay' });
    const controls = h(pd, 'div', { id: 'sp-controls' }, progress, row);
    const toastEl = h(pd, 'div', { class: 'sp-toast' });
    const stage = h(pd, 'div', { id: 'sp-stage' }, overlay, controls, toastEl);
    const bandTop = h(pd, 'div', { class: 'sp-band' });
    const bandBottom = h(pd, 'div', { class: 'sp-band' });
    const root = h(pd, 'div', { id: 'sp-root' }, bandTop, stage, bandBottom);
    pd.body.append(root);
    return { root, stage, overlay, bandTop, bandBottom, controls, progress, fill, toast: toastEl, time: row.querySelector('.sp-time'), btn: (a) => row.querySelector(`[data-act="${a}"]`) };
  }
  function makePlaceholder(video) {
    const cs = getComputedStyle(video), r = video.getBoundingClientRect();
    const pr = video.parentElement ? video.parentElement.getBoundingClientRect() : r;
    const p = document.createElement('div');
    p.className = video.className;
    p.style.cssText = `position:${cs.position};left:${cs.left};top:${cs.top};margin:${cs.margin};transform:${cs.transform};` +
      `width:${Math.abs(r.width - pr.width) < 2 ? '100%' : r.width + 'px'};height:${Math.abs(r.height - pr.height) < 2 ? '100%' : r.height + 'px'};` +
      'display:flex;align-items:center;justify-content:center;background:#000;color:#888;font:14px system-ui,sans-serif;box-sizing:border-box;';
    p.textContent = 'Reproduciendo en la ventana PiP con subtítulos';
    return p;
  }
  const bandHeight = (basePx) => Math.round(S.outsideLines * (S.outsideFontPx || basePx) * S.scale * 1.3 + 12);

  function startPip(video, fromPrompt) {
    if (session) { session.close(); return; }
    if (!video) return toast('No encontré ningún vídeo en esta página.');
    if (HAS_DOC_PIP) return openDocPip(video, fromPrompt);
    if (S.pipMethod === 'real') { // PiP nativo: vídeo real, fluido y con línea de tiempo
      if (document.pictureInPictureElement) return document.exitPictureInPicture().catch(() => {});
      video.requestPictureInPicture().catch(() => (fromPrompt ? toast('No se pudo abrir el PiP.') : showPrompt(video)));
      if (!S.desktop) toast('Para ver los subtítulos fuera, activa «Subtítulos en el escritorio» en el menú ⧉.');
      return;
    }
    if (canDraw(video)) return openCanvasPip(video, fromPrompt);
    toast(video.readyState < 2 ? 'Espera a que el vídeo empiece a cargar y vuelve a intentarlo.'
      : 'Este vídeo está protegido o viene de otro dominio: no se pueden dibujar subtítulos encima. Se abre el PiP normal.');
    video.requestPictureInPicture().catch(() => {});
  }

  // ---------------- Método 2: lienzo + PiP estándar (Opera GX, Firefox, iframes) ----------------
  // Se dibuja vídeo + subtítulos en un <canvas>, se convierte en flujo y ese flujo va al PiP normal.
  function canDraw(el) {
    if (el.nodeName === 'VIDEO' && el.readyState < 2) return false;
    try {
      const x = document.createElement('canvas').getContext('2d');
      x.drawImage(el, 0, 0, 1, 1);
      x.getImageData(0, 0, 1, 1); // falla si el lienzo queda «contaminado» (otro origen / DRM)
      return true;
    } catch (_) { return false; }
  }
  // Temporizador en un Worker: no se congela cuando la pestaña queda en segundo plano.
  function makeTicker(fps, fn) {
    let id = setInterval(fn, 1000 / fps), w = null, url = null;
    try {
      url = URL.createObjectURL(new Blob([`setInterval(()=>postMessage(0),${Math.round(1000 / fps)})`], { type: 'text/javascript' }));
      w = new Worker(url);
      w.onmessage = () => { if (id) { clearInterval(id); id = 0; } fn(); };
    } catch (_) {}
    return () => { clearInterval(id); if (w) w.terminate(); if (url) URL.revokeObjectURL(url); };
  }
  const dispK = (s) => s.cv.width / (s.pipWin && s.pipWin.width ? s.pipWin.width : 480); // px de pantalla → px de lienzo
  function sizeCanvas(s) {
    const v = s.video;
    const W = Math.round(clamp(v.videoWidth || 960, 480, 1280));
    if (s.cv.width !== W) s.cv.width = W;
    s.vh = Math.round(W / videoAspect(v));
    const H = s.vh + (S.mode === 'outside' ? Math.round(bandHeight(s.basePx) * dispK(s)) : 0);
    if (Math.abs(s.cv.height - H) > 4) s.cv.height = H;
  }
  function walkRuns(n, inh, out, join) {
    if (n.nodeType === 3) {
      let t = n.nodeValue;
      if (join) t = t.replace(/[ \t]*\n[ \t]*(?![-–—])/g, ' ');
      const parts = inh.pre ? t.split('\n') : [t.replace(/\s+/g, ' ')];
      parts.forEach((p, i) => { if (i) out.push(null); if (p) out.push({ text: p, st: inh }); });
      return;
    }
    if (n.nodeType !== 1) return;
    if (n.nodeName === 'BR') { out.push(join && !DASH.test(textAfter(n)) ? { text: ' ', st: inh } : null); return; }
    const st = n.style, c = { ...inh }, o = inh.o;
    if (n.dataset.fs) c.fs = +n.dataset.fs;
    if (st.color) c.color = st.color;
    if (st.fontWeight) c.weight = st.fontWeight;
    if (st.fontStyle) c.style = st.fontStyle;
    if (st.fontFamily) c.family = st.fontFamily;
    if (st.fontVariant) c.variant = st.fontVariant;
    if (st.textShadow) c.shadow = st.textShadow;
    if (st.webkitTextStroke) c.stroke = st.webkitTextStroke;
    if (st.opacity) c.alpha = c.alpha * +st.opacity;
    if (/underline|line-through/.test(st.textDecorationLine)) c.deco = st.textDecorationLine;
    if (!inh.isRoot && st.backgroundColor && !isTransparent(st.backgroundColor)) { c.bg = st.backgroundColor; c.pad = parseFloat(st.paddingLeft) || 0; }
    if (st.whiteSpace) c.pre = /pre/.test(st.whiteSpace);
    c.isRoot = false;
    // Cambios del menú de estilo (vacío en «Original»: no se toca nada).
    if (o.color) c.color = o.color;
    if (o.weight) c.weight = o.weight;
    if (o.family) { c.family = SUBPIP_FONTS[o.family]; c.variant = o.family === 'smallcaps' ? 'small-caps' : ''; }
    if (o.edge) { c.shadow = SUBPIP_EDGES[o.edge]; c.stroke = ''; }
    if (o.bg !== undefined) { c.bg = isTransparent(o.bg) ? null : o.bg; c.pad = 0.25; }
    const line = n.dataset.line && !(join && !DASH.test(n.textContent));
    if (line) out.push(null);
    for (const ch of n.childNodes) walkRuns(ch, c, out, join);
    if (line) out.push(null);
    else if (n.dataset.line) out.push({ text: ' ', st: c });
  }
  // Bloque → tramos de texto con su estilo final (null = salto de línea) + fondo de la caja.
  function blockTokens(b, join, o = subpipStyle(S)) {
    const toks = [];
    walkRuns(b.node, { fs: 16, color: '#fff', weight: '400', style: 'normal', family: 'sans-serif', variant: '', shadow: '', stroke: '', alpha: 1, bg: null, pad: 0, pre: false, isRoot: true, o }, toks, join);
    const win = o.win !== undefined ? o.win : b.node.style.backgroundColor;
    return { toks, win: win && !isTransparent(win) ? win : null };
  }
  function layoutText(ctx, b, k, maxW, join, dk) {
    const { toks, win } = blockTokens(b, join);
    const lines = [];
    let cur = { runs: [], w: 0, h: 0 };
    const end = () => {
      while (cur.runs.length && cur.runs[cur.runs.length - 1].sp) cur.w -= cur.runs.pop().w;
      if (cur.runs.length) lines.push(cur);
      cur = { runs: [], w: 0, h: 0 };
    };
    for (const t of toks) {
      if (!t) { end(); continue; }
      const px = Math.max(S.minFontPx * dk, t.st.fs * k);
      ctx.font = `${t.st.style} ${t.st.variant === 'small-caps' ? 'small-caps ' : ''}${t.st.weight} ${px.toFixed(1)}px ${t.st.family}`;
      const font = ctx.font;
      for (const word of t.text.split(/(\s+)/)) {
        if (!word) continue;
        const sp = !word.trim();
        if (sp && !cur.runs.length) continue;
        const w = ctx.measureText(sp ? ' ' : word).width;
        if (!sp && cur.w + w > maxW && cur.runs.length) end();
        cur.runs.push({ text: sp ? ' ' : word, w, px, font, st: t.st, sp });
        cur.w += w;
        cur.h = Math.max(cur.h, px * 1.25);
      }
    }
    end();
    const fs0 = lines.length ? lines[0].runs[0].px : 16;
    return {
      lines, w: Math.max(0, ...lines.map((l) => l.w)), h: lines.reduce((a, l) => a + l.h, 0), align: b.align,
      win, winPad: fs0 * 0.3
    };
  }
  // «rgb(0,0,0) .05em .05em .1em, …» → [{color,x,y,blur}] en px.
  function parseShadows(str, px) {
    if (!str || str === 'none') return [];
    return str.split(/,(?![^(]*\))/).map((p) => {
      const color = (p.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b|\b[a-z]+\b/i) || ['#000'])[0];
      const nums = (p.replace(color, '').match(/-?\d*\.?\d+(em|px)?/g) || []).map((n) => (n.endsWith('em') ? parseFloat(n) * px : parseFloat(n)));
      return { color, x: nums[0] || 0, y: nums[1] || 0, blur: nums[2] || 0 };
    });
  }
  function drawLayout(ctx, L, x, y) {
    if (L.win && L.lines.length) {
      const p = L.winPad;
      ctx.fillStyle = L.win;
      ctx.fillRect(x - p, y - p * 0.4, L.w + 2 * p, L.h + p * 0.8);
    }
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    for (const ln of L.lines) {
      const x0 = x + (L.align === 'center' ? (L.w - ln.w) / 2 : L.align === 'right' ? L.w - ln.w : 0);
      const base = y + ln.h * 0.8;
      // 1) fondos del texto (con su relleno lateral en los extremos de cada tramo)
      let lx = x0;
      ln.runs.forEach((r, i) => {
        const bg = r.st.bg;
        if (bg) {
          const pad = r.st.pad * r.px;
          const padL = !ln.runs[i - 1] || ln.runs[i - 1].st.bg !== bg ? pad : 0;
          const padR = !ln.runs[i + 1] || ln.runs[i + 1].st.bg !== bg ? pad : 0;
          ctx.fillStyle = bg;
          ctx.fillRect(lx - padL - 0.5, y, r.w + padL + padR + 1, ln.h);
        }
        lx += r.w;
      });
      // 2) texto: sombras/bordes del sitio, trazo, relleno y subrayado
      lx = x0;
      for (const r of ln.runs) {
        ctx.font = r.font;
        ctx.globalAlpha = r.st.alpha;
        for (const sh of parseShadows(r.st.shadow, r.px).reverse()) {
          ctx.shadowColor = sh.color;
          ctx.shadowOffsetX = sh.x;
          ctx.shadowOffsetY = sh.y;
          ctx.shadowBlur = sh.blur;
          ctx.fillStyle = sh.color;
          ctx.fillText(r.text, lx, base);
        }
        ctx.shadowColor = 'transparent';
        ctx.shadowOffsetX = ctx.shadowOffsetY = ctx.shadowBlur = 0;
        const sm = r.st.stroke && r.st.stroke.match(/(-?\d*\.?\d+)(em|px)\s+(.+)/);
        if (sm && parseFloat(sm[1]) > 0) {
          ctx.lineWidth = (sm[2] === 'em' ? parseFloat(sm[1]) * r.px : parseFloat(sm[1])) * 2;
          ctx.strokeStyle = sm[3];
          ctx.strokeText(r.text, lx, base);
        }
        ctx.fillStyle = r.st.color;
        ctx.fillText(r.text, lx, base);
        if (r.st.deco) {
          ctx.fillRect(lx, /line-through/.test(r.st.deco) ? base - r.px * 0.3 : base + r.px * 0.1, r.w, Math.max(1, r.px * 0.06));
        }
        lx += r.w;
      }
      ctx.globalAlpha = 1;
      y += ln.h;
    }
  }
  function drawCanvasFrame(s) {
    if (s.closed) return;
    const { ctx, cv, video: v } = s, W = cv.width, H = cv.height, VH = s.vh;
    const outside = S.mode === 'outside';
    const vy = outside && S.outsidePosition === 'top' ? H - VH : 0;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    try { ctx.drawImage(v, 0, vy, W, VH); } catch (_) {}
    if (s.msg && performance.now() < s.msgUntil) { // aviso dentro de la ventana PiP
      const fs = Math.round(W * 0.032);
      ctx.font = `600 ${fs}px system-ui, "Segoe UI", sans-serif`;
      const tw = ctx.measureText(s.msg).width;
      ctx.fillStyle = 'rgba(0,0,0,.78)';
      ctx.fillRect((W - tw) / 2 - fs * 0.6, vy + fs * 0.5, tw + fs * 1.2, fs * 1.7);
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.msg, (W - tw) / 2, vy + fs * 1.35);
    }
    if (!s.subsOn) return;
    const ref = refContent(s);
    for (const src of s.canvasSources) {
      if (!s.clean.has(src)) s.clean.set(src, canDraw(src));
      const r = src.getBoundingClientRect();
      if (!s.clean.get(src) || r.width < 1) continue;
      try { ctx.drawImage(src, ((r.left - ref.left) * W) / ref.width, vy + ((r.top - ref.top) * VH) / ref.height, (r.width * W) / ref.width, (r.height * VH) / ref.height); } catch (_) {}
    }
    const now = performance.now();
    s.newFrame = false;
    s.lastDraw = now;
    if (s.dirty || s.force || now - (s.last || 0) > 500) {
      s.blocks = collectBlocks(s);
      s.last = now;
      s.dirty = s.force = false;
    }
    const dk = dispK(s);
    if (outside) {
      const items = s.blocks.map((b) => [b, layoutText(ctx, b, (S.outsideFontPx > 0 ? S.outsideFontPx / (maxFs(b.node) || s.basePx) : 1) * S.scale * dk, W * 0.96, S.joinLines, dk)]);
      let y = (vy ? 0 : VH) + Math.max(4, (H - VH - items.reduce((a, [, L]) => a + L.h, 0)) / 2);
      for (const [b, L] of items) {
        drawLayout(ctx, L, b.h === 'left' ? W * 0.02 : b.h === 'right' ? W * 0.98 - L.w : (W - L.w) / 2, y);
        y += L.h;
      }
      return;
    }
    const fixed = S.mode === 'fixed';
    for (const b of s.blocks) {
      const k = fixed ? S.scale * dk : (VH / b.refH) * S.scale;
      const L = layoutText(ctx, b, k, fixed ? (W * S.fixedMaxWidth) / 100 : Math.min(W, b.w * W * S.scale * 1.08 + 8), fixed && S.joinLines, dk);
      const x = b.h === 'center' ? b.x * W - L.w / 2 : b.h === 'left' ? b.x * W : W - b.x * W - L.w;
      const y = b.v === 'top' ? b.y * VH : VH - b.y * VH - L.h;
      drawLayout(ctx, L, clamp(x, 4, Math.max(4, W - L.w - 4)), vy + clamp(y, 0, Math.max(0, VH - L.h)));
    }
  }
  function canvasToast(s, msg, ms = 1800) { s.msg = msg; s.msgUntil = performance.now() + ms; }
  // El PiP estándar no admite botones propios: se usan los botones multimedia que sí muestra.
  const MS_ACTIONS = ['previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'togglemicrophone', 'togglecamera'];
  function canvasActions(s, on) {
    const ms = navigator.mediaSession;
    if (!ms) return;
    const v = s.video;
    const seek = (d) => { v.currentTime = clamp(v.currentTime + d, 0, isFinite(v.duration) ? v.duration : 1e9); };
    const map = {
      previoustrack: () => setScale(s, S.scale - 0.1),
      nexttrack: () => setScale(s, S.scale + 0.1),
      seekbackward: (d) => seek(-((d && d.seekOffset) || 10)),
      seekforward: (d) => seek((d && d.seekOffset) || 10),
      togglemicrophone: () => {
        s.subsOn = !s.subsOn;
        canvasToast(s, s.subsOn ? 'Subtítulos visibles' : 'Subtítulos ocultos');
        try { ms.setMicrophoneActive(s.subsOn); } catch (_) {}
      },
      togglecamera: () => setMode(s, MODES[(MODES.indexOf(S.mode) + 1) % MODES.length])
    };
    for (const a of MS_ACTIONS) try { ms.setActionHandler(a, on ? map[a] : null); } catch (_) {}
    if (on) try { ms.setMicrophoneActive(s.subsOn); ms.setCameraActive(true); } catch (_) {}
  }
  function openCanvasPip(video, fromPrompt) {
    const s = {
      kind: 'canvas', video, refEl: video, subsOn: true, domSources: [], canvasSources: [], tracks: [], taken: new Set(),
      clean: new Map(), blocks: [], closed: false, basePx: clamp(video.getBoundingClientRect().height * 0.05, 14, 44)
    };
    s.onCue = () => schedule(s);
    s.mo = new MutationObserver(() => schedule(s));
    s.cv = document.createElement('canvas');
    s.ctx = s.cv.getContext('2d');
    sizeCanvas(s);
    drawCanvasFrame(s);
    const pv = (s.pv = document.createElement('video'));
    pv.muted = true;
    pv.playsInline = true;
    pv.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;';
    pv.srcObject = s.cv.captureStream(); // sin límite: se envía cada vez que se dibuja
    document.documentElement.append(pv);
    session = s;
    hideButton();
    s.close = () => closeCanvas(s);
    s.onTracks = () => syncTracks(s);
    video.textTracks.addEventListener('change', s.onTracks);
    video.textTracks.addEventListener('addtrack', s.onTracks);
    syncTracks(s);
    discover(s);
    // Se reasignan cada segundo porque YouTube vuelve a poner sus propios botones.
    s.timer = setInterval(() => { discover(s); sizeCanvas(s); canvasActions(s, true); if (s.fitCover) s.fitCover(); }, 1000);
    canvasActions(s, true);
    canvasToast(s, '⏮ ⏭ tamaño   ·   🎤 subtítulos   ·   📷 modo', 4500);
    // Un solo ciclo de dibujo: solo redibuja si hay fotograma nuevo, cambio de subtítulo o aviso.
    const rvfc = !!video.requestVideoFrameCallback;
    if (rvfc) {
      const onFrame = () => { if (s.closed) return; s.newFrame = true; video.requestVideoFrameCallback(onFrame); };
      video.requestVideoFrameCallback(onFrame);
    }
    s.stopTick = makeTicker(60, () => {
      const now = performance.now();
      if (s.newFrame || s.dirty || s.force || (!rvfc && !video.paused) || now < (s.msgUntil || 0) || now - (s.lastDraw || 0) > 250) drawCanvasFrame(s);
    });
    // El vídeo original sigue reproduciéndose (es la fuente); en la página se tapa con una capa negra.
    s.cover = document.createElement('div');
    s.cover.style.cssText = 'position:absolute;background:#000;pointer-events:none;z-index:0;';
    video.after(s.cover);
    const fitCover = () => {
      s.cover.style.left = video.offsetLeft + 'px';
      s.cover.style.top = video.offsetTop + 'px';
      s.cover.style.width = video.offsetWidth + 'px';
      s.cover.style.height = video.offsetHeight + 'px';
    };
    fitCover();
    s.fitCover = fitCover;
    // Play/pausa de la ventana PiP ↔ vídeo real
    s.onMedia = () => { if (video.paused !== pv.paused) (video.paused ? pv.pause() : pv.play().catch(() => {})); };
    video.addEventListener('play', s.onMedia);
    video.addEventListener('pause', s.onMedia);
    pv.addEventListener('pause', () => { if (!s.closed && !video.paused) video.pause(); });
    pv.addEventListener('play', () => { if (!s.closed && video.paused) video.play().catch(() => {}); });
    pv.addEventListener('leavepictureinpicture', s.close);
    pv.play().catch(() => {}).then(() => pv.requestPictureInPicture()).then((win) => {
      s.pipWin = win;
      win.addEventListener('resize', () => sizeCanvas(s));
      sizeCanvas(s);
      s.onMedia();
    }, (err) => {
      s.close();
      if (err && err.name === 'NotAllowedError' && !fromPrompt) showPrompt(video);
      else toast('No se pudo abrir el PiP: ' + ((err && err.message) || err));
    });
  }
  function closeCanvas(s) {
    if (s.closed) return;
    s.closed = true;
    s.stopTick();
    clearInterval(s.timer);
    s.mo.disconnect();
    const v = s.video;
    v.textTracks.removeEventListener('change', s.onTracks);
    v.textTracks.removeEventListener('addtrack', s.onTracks);
    v.removeEventListener('play', s.onMedia);
    v.removeEventListener('pause', s.onMedia);
    restoreTracks(s);
    canvasActions(s, false);
    if (s.cover) s.cover.remove();
    if (document.hidden) v.pause(); // cerrado desde fuera del navegador: no seguir sonando
    if (document.pictureInPictureElement === s.pv) document.exitPictureInPicture().catch(() => {});
    s.pv.srcObject = null;
    s.pv.remove();
    if (session === s) session = null;
  }

  async function openDocPip(video, fromPrompt) {
    const vr = video.getBoundingClientRect();
    const aspect = videoAspect(video, vr.width / vr.height || 16 / 9);
    const w = Math.round(clamp(screen.availWidth * 0.3, 320, 720));
    const basePx = clamp(vr.height * 0.05, 14, 44);
    const band = S.mode === 'outside' ? bandHeight(basePx) : 0;
    let pw;
    try {
      pw = await documentPictureInPicture.requestWindow({ width: w, height: Math.round(w / aspect) + band });
    } catch (err) {
      if (err && err.name === 'NotAllowedError' && !fromPrompt) showPrompt(video);
      else toast('No se pudo abrir la ventana PiP: ' + ((err && err.message) || err));
      return;
    }
    const pd = pw.document;
    pd.title = 'Subtítulos PiP';
    adoptCss(pd, pw, PIP_CSS);
    const s = {
      video, pw, pd, basePx, subsOn: true, domSources: [], canvasSources: [], tracks: [], taken: new Set(),
      mirrors: new Map(), sig: '', closed: false, els: buildPipDom(pd)
    };
    s.onCue = () => schedule(s);
    s.mo = new MutationObserver(() => schedule(s));
    s.placeholder = s.refEl = makePlaceholder(video);
    const wasPlaying = !video.paused;
    video.dispatchEvent(new CustomEvent('subpip:mark'));
    video.parentNode.insertBefore(s.placeholder, video);
    s.els.stage.prepend(video);
    if (wasPlaying && video.paused) video.play().catch(() => {});
    session = s;
    hideButton();

    s.onTracks = () => syncTracks(s);
    video.textTracks.addEventListener('change', s.onTracks);
    video.textTracks.addEventListener('addtrack', s.onTracks);
    syncTracks(s);
    discover(s);
    s.timers = [pw.setInterval(() => discover(s), 1500), pw.setInterval(() => schedule(s), 250)];
    const loop = () => { if (s.closed) return; if (s.canvasSources.length) drawMirrors(s); pw.requestAnimationFrame(loop); };
    pw.requestAnimationFrame(loop);
    setupControls(s);
    applyRootData(s);
    s.close = () => closeDoc(s);
    pw.addEventListener('pagehide', s.close);
    pw.addEventListener('resize', () => schedule(s, true));
    window.dispatchEvent(new CustomEvent('subpip:state', { detail: 'enter' }));
    schedule(s, true);
  }

  function closeDoc(s) {
    if (s.closed) return;
    s.closed = true;
    s.mo.disconnect();
    s.timers.forEach((t) => s.pw.clearInterval(t));
    const v = s.video;
    v.textTracks.removeEventListener('change', s.onTracks);
    v.textTracks.removeEventListener('addtrack', s.onTracks);
    for (const ev of s.mediaEvents) v.removeEventListener(ev, s.onMedia);
    v.removeEventListener('click', s.onVideoClick);
    restoreTracks(s);
    const wasPlaying = !v.paused;
    if (s.placeholder.isConnected) s.placeholder.replaceWith(v);
    else v.pause();
    if (wasPlaying && v.paused && v.isConnected) v.play().catch(() => {});
    if (session === s) session = null;
    window.dispatchEvent(new CustomEvent('subpip:state', { detail: 'leave' }));
    try { s.pw.close(); } catch (_) {}
  }

  function applyRootData(s) {
    s.els.root.dataset.mode = S.mode;
    const css = subpipCss(subpipStyle(S), '.sp-sub'); // vacío con el estilo «Original»
    if (!s.ovSheet) {
      try {
        s.ovSheet = new s.pw.CSSStyleSheet();
        s.pd.adoptedStyleSheets = [...s.pd.adoptedStyleSheets, s.ovSheet];
      } catch (_) {
        s.ovSheet = s.pd.head.appendChild(s.pd.createElement('style'));
      }
    }
    if (s.ovSheet.replaceSync) s.ovSheet.replaceSync(css);
    else s.ovSheet.textContent = css;
  }
  function pipToast(s, msg) {
    const t = s.els.toast;
    t.textContent = msg;
    t.classList.add('on');
    s.pw.clearTimeout(s.toastT);
    s.toastT = s.pw.setTimeout(() => t.classList.remove('on'), 1600);
  }
  const notify = (s, msg) => (s.kind === 'canvas' ? canvasToast(s, msg) : pipToast(s, msg));
  function setMode(s, m) {
    const E = s.els;
    const oldBand = E ? E.bandTop.offsetHeight + E.bandBottom.offsetHeight : 0;
    const wasOutside = S.mode === 'outside';
    S.mode = m;
    chrome.storage.local.set({ mode: m });
    // Ajusta el alto de la ventana para la franja (requiere el clic del usuario, que ya tenemos).
    try {
      if (s.pw && m === 'outside' && !wasOutside) s.pw.resizeBy(0, bandHeight(s.basePx));
      else if (s.pw && m !== 'outside' && wasOutside && oldBand) s.pw.resizeBy(0, -oldBand);
    } catch (_) {}
    notify(s, 'Modo: ' + MODE_NAMES[m]);
    applySettings();
  }
  function setScale(s, v) {
    S.scale = Math.round(clamp(v, 0.3, 4) * 10) / 10;
    chrome.storage.local.set({ scale: S.scale });
    notify(s, 'Tamaño: ' + Math.round(S.scale * 100) + '%');
    applySettings();
  }
  function setupControls(s) {
    const { pd, pw, video: v, els: E } = s;
    const seek = (d) => { v.currentTime = clamp(v.currentTime + d, 0, isFinite(v.duration) ? v.duration : 1e9); };
    const act = {
      play: () => (v.paused ? v.play().catch(() => {}) : v.pause()),
      back: () => seek(-10),
      fwd: () => seek(10),
      cc: () => { s.subsOn = !s.subsOn; pipToast(s, s.subsOn ? 'Subtítulos visibles' : 'Subtítulos ocultos'); updateControls(s); schedule(s, true); },
      mode: () => setMode(s, MODES[(MODES.indexOf(S.mode) + 1) % MODES.length]),
      smaller: () => setScale(s, S.scale - 0.1),
      bigger: () => setScale(s, S.scale + 0.1),
      mute: () => { v.muted = !v.muted; },
      close: () => s.close()
    };
    E.controls.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) { e.stopPropagation(); act[b.dataset.act](); }
    });
    E.progress.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = E.progress.getBoundingClientRect();
      if (isFinite(v.duration)) v.currentTime = clamp((e.clientX - r.left) / r.width, 0, 1) * v.duration;
    });
    s.onVideoClick = act.play;
    v.addEventListener('click', s.onVideoClick);
    s.mediaEvents = ['play', 'pause', 'timeupdate', 'volumechange', 'durationchange'];
    s.onMedia = () => updateControls(s);
    for (const ev of s.mediaEvents) v.addEventListener(ev, s.onMedia);
    let hideT = 0;
    const show = () => {
      E.root.classList.add('sp-show');
      pw.clearTimeout(hideT);
      hideT = pw.setTimeout(() => E.root.classList.remove('sp-show'), 2500);
    };
    pd.addEventListener('mousemove', show);
    pd.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      const map = { ' ': 'play', k: 'play', j: 'back', l: 'fwd', c: 'cc', v: 'mode', m: 'mute', '+': 'bigger', '=': 'bigger', '-': 'smaller', escape: 'close' };
      if (k === 'arrowleft') seek(-5);
      else if (k === 'arrowright') seek(5);
      else if (k === 'arrowup') v.volume = clamp(v.volume + 0.1, 0, 1);
      else if (k === 'arrowdown') v.volume = clamp(v.volume - 0.1, 0, 1);
      else if (map[k]) act[map[k]]();
      else return;
      e.preventDefault();
      show();
    });
    show();
    updateControls(s);
  }
  function updateControls(s) {
    if (!s || s.closed) return;
    const { video: v, els: E } = s;
    E.btn('play').textContent = v.paused ? '▶' : '❚❚';
    E.btn('mute').textContent = v.muted || v.volume === 0 ? '🔇' : '🔊';
    E.btn('cc').classList.toggle('off', !s.subsOn);
    E.btn('mode').textContent = MODE_NAMES[S.mode];
    const d = v.duration;
    E.time.textContent = isFinite(d) ? `${fmt(v.currentTime)} / ${fmt(d)}` : fmt(v.currentTime);
    E.fill.style.width = isFinite(d) && d > 0 ? (v.currentTime / d) * 100 + '%' : '0';
    E.root.classList.toggle('sp-paused', v.paused);
  }
})();
