// Ventana principal: perfil, contactos, chats y el reparto de eventos que llegan de Python
let S = null;            // estado que manda Python: me, contacts, requests, forums, settings, connected
let sel = null;          // código de contacto, 'bot:...', 'forum:<fid>', 'explore' o null (= Inicio)
let leftTab = 'inicio';
const H = {};            // historiales de chat cargados
const collapsed = new Set();
const bootT = Date.now();
let fontI = 0;

const isBot = code => !!code && code.startsWith('bot:');
const isChat = code => !!code && !code.startsWith('forum:') && code !== 'explore';
const person = code => isBot(code) ? BOTS[code] : S.contacts[code];
function statusOf(code) {
  if (isBot(code)) return BOTS[code].profile.status;
  const c = S.contacts[code];
  return c && c.state === 'friend' && c.online ? c.profile.status : 'offline';
}
const nameOf = code => person(code) ? person(code).profile.name : '';
const DURS = [[30, '30 minutos'], [60, '1 hora'], [240, '4 horas'], [480, '8 horas'], [1440, '24 horas'], [4320, '3 días'], [10080, '1 semana']];
const FONTS = [
  ['Segoe UI', '#000'], ['Comic Sans MS', '#7b1fa2'], ['Tahoma', '#1b7d1b'],
  ['Times New Roman', '#c62828'], ['Lucida Console', '#1565c0'], ['Georgia', '#e65100']
];

function applySettings(s) {
  applyTheme(s.theme);
  window.SOUNDS_ON = s.sounds !== false;
  setLang(s.lang);
}

// ---------- Cabecera ----------
function renderTop() {
  const p = S.me.profile;
  $('meAv').innerHTML = avatarHtml(p, 72, p.status);
  if (document.activeElement !== $('meName')) $('meName').textContent = p.name;
  $('meStatus').value = p.status;
  if (document.activeElement !== $('meMsg')) $('meMsg').value = p.msg;
  const mood = moodOf(p.mood);
  $('meSub').innerHTML =
    (mood ? `<span class="chip">${moodHtml(p.mood, 16)}</span>` : '') +
    (p.activity ? `<span class="chip" title="Se actualiza sola según la app que tengas abierta">${actHtml(p.activity, 16)}</span>` : '') +
    (tempActive(p)
      ? `<span class="chip link" id="tempChip" title="Cambiar o quitar">${emoImg('clock', 16)} ${fmt(p.temp.text)} <small>(quedan ${leftTxt(p.temp.until)})</small></span>`
      : `<span class="chip link ghost" id="tempChip">${emoImg('clock', 16)} Añadir un mensaje temporal...</span>`);
  $('tempChip').onclick = editTemp;
  $('myCode').textContent = S.me.pretty;
  document.querySelector('.codebox .lbl').innerHTML = S.me.user ? `Usuario <b>${esc(S.me.user)}</b> · tu código` : 'Tu código personal';
  $('logoutBtn').hidden = !S.me.user;
}
$('logoutBtn').onclick = () => logout();
async function saveProfile() {
  S.me.profile = await api().set_profile(S.me.profile);
  renderTop();
  if (!sel) renderRight();
}
$('meName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
$('meName').addEventListener('blur', () => {
  const v = $('meName').textContent.trim().slice(0, 40);
  if (v && v !== S.me.profile.name) { S.me.profile.name = v; saveProfile(); } else renderTop();
});
$('meStatus').onchange = () => { S.me.profile.status = $('meStatus').value; saveProfile(); };
$('meMsg').addEventListener('change', () => { S.me.profile.msg = $('meMsg').value; saveProfile(); });
$('meMsg').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
$('meAv').onclick = () => openEditor('imagen');
$('editProf').onclick = () => openEditor('perfil');

function editTemp() {
  const p = S.me.profile, cur = tempActive(p) ? p.temp.text : '';
  dialog(`Tus contactos verán este mensaje junto a tu nombre hasta que caduque.
    <input type="text" id="tmpIn" maxlength="80" value="${esc(cur)}" placeholder="Ej.: En clase hasta las 3 (A)" style="width:100%;margin-top:8px">
    <div style="margin-top:8px;font-size:12px;color:#555">Duración: <select class="field" id="tmpDur">${DURS.map(([m, l]) => `<option value="${m}" ${m === 240 ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`,
    { title: 'Mensaje temporal', icon: emoImg('clock', 34), focus: 'tmpIn', buttons: [
      ['Publicar', () => { const t = $('tmpIn').value.trim(); if (!t) return false; setTemp(t, +$('tmpDur').value); }],
      ...(cur ? [['Quitar', () => setTemp('', 0)]] : []),
      ['Cancelar']] });
  $('tmpIn').onkeydown = e => { if (e.key === 'Enter') $('dFoot').firstChild.click(); };
}
function setTemp(text, mins) {
  S.me.profile.temp = text ? { text, until: Date.now() + mins * 60000 } : null;
  saveProfile();
}

function copyCode(btn) {
  api().copy(S.me.pretty);
  if (btn) { const t = btn.textContent; btn.textContent = '¡Copiado!'; setTimeout(() => btn.textContent = t, 1500); }
}
$('copyCode').onclick = e => copyCode(e.target);

// ---------- Columna izquierda: pestañas Contactos / Foros ----------
function renderTabs() {
  const unreadC = Object.values(S.contacts).reduce((n, c) => n + (c.unread || 0), 0) + Object.keys(S.requests).length;
  const unreadF = Object.values(S.forums).reduce((n, f) => n + (f.unread || 0), 0);
  const tab = (k, icon, label, n) => `<span data-tab="${k}" class="${leftTab === k ? 'on' : ''}">${emoImg(icon, 16)} ${label}${n ? ` <span class="badge">${n}</span>` : ''}</span>`;
  renderMnav();
  $('ltabs').innerHTML = tab('inicio', 'star', 'Inicio', 0) + tab('contactos', 'people', 'Contactos', unreadC) + tab('foros', 'forum', 'Foros', unreadF);
  $('addBtn').hidden = leftTab !== 'contactos';
  $('ltools').hidden = leftTab === 'inicio';
  $('q').placeholder = leftTab === 'contactos' ? 'Buscar contactos...' : 'Buscar en mis foros...';
}
$('ltabs').onclick = e => {
  const t = e.target.closest('[data-tab]');
  if (!t) return;
  if (t.dataset.tab === 'inicio') { leftTab = 'inicio'; homeFilter = ''; return select(null); }
  if (t.dataset.tab === leftTab) return;
  leftTab = t.dataset.tab;
  $('q').value = '';
  renderTabs(); renderList();
};

function contactRow(code) {
  const c = person(code), p = c.profile, st = statusOf(code);
  const unread = !isBot(code) && c.unread ? `<span class="badge">${c.unread}</span>` : '';
  const inCall = typeof call !== 'undefined' && call && call.code === code ? emoImg('call', 14) : '';
  return `<div class="contact ${st === 'offline' ? 'off' : ''} ${sel === code ? 'sel' : ''}" data-code="${esc(code)}">
    ${avatarHtml(p, 34, st)}
    <div class="ci"><div class="nm"><span>${esc(p.name)}</span>${inCall}${unread}</div><div class="pm">${c.state === 'pending' ? 'Esperando a que acepte...' : subline(p, 14)}</div></div></div>`;
}
function requestRow(r) {
  return `<div class="contact req" data-req="${esc(r.code)}">
    ${avatarHtml(r.profile, 34, 'online')}
    <div class="ci"><div class="nm"><span>${esc(r.profile.name)}</span></div><div class="pm">${esc(r.pretty)} quiere agregarte</div></div>
    <div class="rb"><button class="btn small" data-acc="${esc(r.code)}" title="Aceptar">✓</button><button class="btn small" data-rej="${esc(r.code)}" title="Rechazar">✕</button></div></div>`;
}
function group(id, label, rows, emptyText) {
  if (!rows.length && !emptyText) return '';
  const closed = collapsed.has(id);
  return `<div class="group ${closed ? 'closed' : ''}" data-g="${id}"><span class="arr">▼</span>${label}</div>` +
    (closed ? '' : rows.join('') || `<div class="empty">${emptyText}</div>`);
}
function renderList() {
  renderTabs();
  const friends = Object.values(S.contacts).filter(c => c.state === 'friend');
  $('cnt').innerHTML = `${emoImg('lock', 14)} Cifrado de extremo a extremo &nbsp;·&nbsp; ${friends.filter(c => c.online).length} de ${friends.length} contactos conectados`;
  if (leftTab === 'foros') return renderForumList();
  if (leftTab === 'inicio') return renderHomeList();
  const q = $('q').value.trim().toLowerCase();
  const match = code => !q || nameOf(code).toLowerCase().includes(q) || code.toLowerCase().includes(q.replace(/^wind-?|-/g, ''));
  const byName = (a, b) => nameOf(a).localeCompare(nameOf(b));
  const codes = Object.keys(S.contacts).filter(match).sort(byName);
  const on = codes.filter(c => S.contacts[c].state === 'friend' && S.contacts[c].online);
  const off = codes.filter(c => S.contacts[c].state === 'friend' && !S.contacts[c].online);
  const pend = codes.filter(c => S.contacts[c].state === 'pending');
  const bots = Object.keys(BOTS).filter(match);
  const reqs = Object.values(S.requests);
  $('list').innerHTML =
    group('req', `Solicitudes (${reqs.length})`, reqs.map(requestRow)) +
    group('on', `Conectados (${on.length})`, on.map(contactRow), q ? '' : 'Nadie conectado ahora mismo.') +
    group('off', `Desconectados (${off.length})`, off.map(contactRow), q || on.length ? '' : 'Agrega amigos con su código: botón ＋ Agregar.') +
    group('pend', `Esperando respuesta (${pend.length})`, pend.map(contactRow)) +
    group('bots', `Bot inútil (${bots.length})`, bots.map(contactRow));
}
$('q').oninput = renderList;
$('list').addEventListener('click', e => {
  const acc = e.target.closest('[data-acc]'), rej = e.target.closest('[data-rej]');
  if (acc || rej) return respond((acc || rej).dataset[acc ? 'acc' : 'rej'], !!acc);
  const g = e.target.closest('.group');
  if (g) { collapsed.has(g.dataset.g) ? collapsed.delete(g.dataset.g) : collapsed.add(g.dataset.g); return renderList(); }
  const c = e.target.closest('.contact[data-code]');
  if (c) select(c.dataset.code);
  const f = e.target.closest('.contact[data-forum]');
  if (f) openForum(f.dataset.forum);
  const h = e.target.closest('.contact[data-hf]');
  if (h) setHomeFilter(h.dataset.hf);
});

async function respond(code, accept) {
  const name = S.requests[code] ? S.requests[code].profile.name : '';
  const v = await api().respond_request(code, accept);
  delete S.requests[code];
  if (v) { S.contacts[code] = v; select(code); sounds.online(); }
  else renderList();
  if (!accept) dialog(`Rechazaste la solicitud de <b>${esc(name)}</b>.`);
}

// ---------- Selección ----------
async function select(code) {
  sel = code && (!isChat(code) || person(code)) ? code : null;
  if (isMob()) mobView('center');
  if (sel && sel.startsWith('forum:')) return openForum(sel.slice(6));
  if (sel === 'explore') return openExplore();
  if (!sel) homePerson = null;
  renderList();
  renderRight();
  await renderCenter();
}
window.selectContact = code => { leftTab = 'contactos'; select(code); };

// ---------- Centro ----------
async function renderCenter() {
  const box = $('center');
  if (sel === 'explore') return renderExplore();
  if (sel && sel.startsWith('forum:')) return renderForumCenter();
  if (!sel) return renderHome();
  const c = person(sel);
  if (!isBot(sel) && c.state === 'pending') {
    box.innerHTML = `<div class="welcome">
      ${avatarHtml(c.profile, 96, 'offline')}
      <h2>Solicitud enviada</h2>
      <p>Esperando a que <b>${esc(c.pretty)}</b> acepte tu solicitud. Cuando lo haga, verás su perfil y podrán chatear.</p>
      <p class="tip">Si no está conectado, la solicitud le llegará cuando abra Wind OS Messenger (con tu programa abierto).</p>
      <button class="btn" id="wCancel">Cancelar solicitud</button></div>`;
    $('wCancel').onclick = () => removeContact(sel, true);
    return;
  }
  const extra = `<div class="tool" data-c="nudge" title="Enviar un zumbido">${emoImg('nudge', 20)}Zumbido</div>` +
    `<div class="tool" data-c="font" title="Cambiar fuente"><b style="font-family:Georgia;font-size:15px">A</b><span id="fName">Fuente</span></div>`;
  box.innerHTML = `
    <div class="chead">
      <div id="chAv"></div>
      <div class="who"><div><span class="cn" id="chName"></span> <span class="cs" id="chStat"></span></div><div class="cp" id="chMsg"></div></div>
      ${isBot(sel) ? `<span class="lock">${emoImg('robot', 16)} Bot local</span>` :
        `<button class="btn small callbtn" id="chCall" title="Llamada de voz (con pantalla compartida)">${emoImg('call', 16)} Llamar</button><span class="lock">${emoImg('lock', 16)} Cifrado</span>`}
    </div>
    <div class="convwrap">
      <div class="conv" id="conv"></div>
      <div class="typing" id="typing"></div>
      ${composerHtml('ccomp', { extraTools: extra, placeholder: 'Escribe un mensaje... (puedes pegar o arrastrar imágenes)' })}
    </div>`;
  renderChatHead();
  const code = sel;
  if ($('chCall')) $('chCall').onclick = () => startCall(code);
  wireComposer('ccomp', {
    dropZone: $('convwrap') || box,
    onSend: ({ text, att, sticker }) => sendChat(code, text, att, sticker),
    onTool: t => { if (t === 'nudge') sendNudge(); if (t === 'font') { fontI = (fontI + 1) % FONTS.length; showFont(); } },
    onTyping: () => { if (!isBot(sel) && Date.now() - lastTyping > 3000) { lastTyping = Date.now(); api().send_typing(sel); } }
  });
  showFont();
  if (!H[code]) H[code] = isBot(code) ? [] : await api().get_history(code);
  if (sel !== code) return;
  $('conv').innerHTML = H[code].map(m => msgHtml(m, code)).join('') ||
    `<div class="sys">Esta es una conversación nueva con ${esc(nameOf(code))}.</div>`;
  scrollDown();
  $('conv').querySelectorAll('img').forEach(img => img.addEventListener('load', scrollDown, { once: true }));
  markRead(code);
  $('ccomp').querySelector('textarea').focus();
}

function renderChatHead() {
  if (!isChat(sel) || !$('chName')) return;
  const p = person(sel).profile, st = statusOf(sel);
  $('chAv').innerHTML = avatarHtml(p, 40, st);
  $('chName').textContent = p.name;
  $('chStat').textContent = `(${STATUS[st]})`;
  $('chMsg').innerHTML = subline(p, 14);
  if ($('chCall')) $('chCall').disabled = st === 'offline';
}

const STATUS_TXT = { pending: () => emoImg('clock', 12) + ' pendiente', sent: () => '✓ enviado', delivered: () => '✓✓ entregado' };
function msgHtml(m, code) {
  if (m.kind === 'nudge') return `<div class="sys">${m.from === 'me' ? 'Has enviado un zumbido.' : esc(nameOf(code)) + ' te ha enviado un zumbido.'}</div>`;
  if (m.kind === 'sys') return `<div class="sys">${esc(m.text)}</div>`;
  const who = m.from === 'me' ? S.me.profile.name : nameOf(code);
  const st = m.from === 'me' && STATUS_TXT[m.status] ? `<span class="mst ${m.status}">${STATUS_TXT[m.status]()}</span>` : '';
  const f = FONTS[(m.font | 0) % FONTS.length];
  return `<div class="m" data-id="${esc(m.id || '')}"><div class="w">${esc(who)} dice: <span class="ts">(${hhmm(m.ts)})</span>${st}</div>` +
    (m.text ? `<div class="tx" style="font-family:'${f[0]}';color:${f[1]}">${fmt(m.text)}</div>` : '') +
    (m.sticker ? `<div class="tx">${stickerHtml(m.sticker)}</div>` : '') +
    (m.att ? `<div class="tx">${attHtml(m.att)}</div>` : '') + '</div>';
}
function scrollDown() { const c = $('conv'); if (c) c.scrollTop = c.scrollHeight; }
function pushMsg(code, m) {
  if (H[code]) H[code].push(m);
  if (sel === code && $('conv')) {
    $('conv').insertAdjacentHTML('beforeend', msgHtml(m, code));
    $('conv').lastElementChild.querySelectorAll('img').forEach(img => img.addEventListener('load', scrollDown, { once: true }));
    scrollDown();
  }
}
const sysMsg = (code, text) => pushMsg(code, { kind: 'sys', text });

function markRead(code) {
  const c = S.contacts[code];
  if (!isBot(code) && c && c.unread && document.hasFocus()) { c.unread = 0; api().mark_read(code); renderList(); }
}
window.addEventListener('focus', () => isChat(sel) && markRead(sel));

// Cuando un adjunto termina de llegar, también se actualizan las copias en memoria
function onAttReadyHook(att) {
  for (const list of Object.values(H)) for (const m of list) if (m.att && m.att.id === att.id) m.att = att;
  for (const fc of Object.values(FC)) for (const p of Object.values(fc.posts)) if (p.att && p.att.id === att.id) p.att = att;
  homeAttReady(att);
  if (isChat(sel)) scrollDown();
}

// ---------- Enviar ----------
let lastTyping = 0;
function showFont() {
  if (!$('fName')) return;
  $('fName').textContent = FONTS[fontI][0];
  const ta = $('ccomp').querySelector('textarea');
  ta.style.fontFamily = FONTS[fontI][0];
  ta.style.color = FONTS[fontI][1];
}

const warnedOffline = new Set();
async function sendChat(code, text, att, sticker) {
  if (isBot(code)) {
    const m = { id: 'l' + Date.now(), from: 'me', kind: 'msg', text, ts: Date.now(), font: fontI, sticker };
    if (att) m.att = ATT[att];
    pushMsg(code, m);
    botReply(code, text || '...');
    return true;
  }
  const m = await api().send_message(code, text, fontI, att || null, sticker || null);
  if (!m) return false;
  pushMsg(code, m);
  if (!S.contacts[code].online && !warnedOffline.has(code)) {
    warnedOffline.add(code);
    sysMsg(code, `${nameOf(code)} está desconectado. Tus mensajes se entregarán cuando se conecte mientras tienes el programa abierto.`);
  }
  return true;
}

// ---------- Bot ----------
let botTimers = [];
function botReply(code, t) {
  botTimers.forEach(clearTimeout); botTimers = [];
  const r = BOTS[code].reply(t);
  botTimers.push(setTimeout(() => {
    showTyping(code);
    botTimers.push(setTimeout(() => {
      hideTyping();
      if (r.text != null) { pushMsg(code, { id: 'b' + Date.now(), from: 'them', kind: 'msg', text: r.text, ts: Date.now() }); sounds.msg(); }
      if (r.nudge) setTimeout(() => receiveNudge(code), 600);
    }, r.typing || 1300));
  }, 500 + Math.random() * 900));
}

// ---------- "Está escribiendo" ----------
let typingT;
function showTyping(code) {
  if (sel !== code || !$('typing')) return;
  $('typing').textContent = `${nameOf(code)} está escribiendo un mensaje...`;
  clearTimeout(typingT); typingT = setTimeout(hideTyping, 5000);
}
function hideTyping() { if ($('typing')) $('typing').textContent = ''; }

// ---------- Zumbidos ----------
let lastNudge = 0;
function shake() { sounds.nudge(); api().shake(); }
function receiveNudge(code, m) { pushMsg(code, m || { kind: 'nudge', from: 'them', ts: Date.now() }); shake(); }
async function sendNudge() {
  const code = sel;
  if (Date.now() - lastNudge < 6000) return sysMsg(code, 'No puedes enviar zumbidos con tanta frecuencia.');
  if (isBot(code)) {
    lastNudge = Date.now();
    pushMsg(code, { kind: 'nudge', from: 'me', ts: Date.now() }); shake();
    if (Math.random() < .5) setTimeout(() => receiveNudge(code), 2500);
    return;
  }
  if (!S.contacts[code].online) return sysMsg(code, `${nameOf(code)} está desconectado: el zumbido no le llegaría.`);
  const m = await api().send_nudge(code);
  if (m) { lastNudge = Date.now(); pushMsg(code, m); shake(); }
}

// ---------- Panel de perfil ----------
function renderRight() {
  if (sel === 'explore' || (sel && sel.startsWith('forum:'))) return renderForumRight();
  if (!sel) return renderHomeRight();
  let p, st, kind, c = null;
  if (!sel) { p = S.me.profile; st = p.status; kind = 'me'; }
  else { c = person(sel); p = c.profile; st = statusOf(sel); kind = isBot(sel) ? 'bot' : c.state; }
  const sec = (title, body, cls = '') => `<div class="psec ${cls}"><h4>${title}</h4>${body}</div>`;
  const temp = tempActive(p)
    ? sec(emoImg('clock', 14) + ' Mensaje temporal', `<p>${fmt(p.temp.text)}</p><div class="small">Caduca en ${leftTxt(p.temp.until)}</div>`, 'hl')
    : (kind === 'me' ? sec(emoImg('clock', 14) + ' Mensaje temporal', '<p><i>Ninguno.</i></p><div class="small">Haz clic en «Añadir un mensaje temporal» arriba.</div>') : '');
  const btns = {
    me: '<button class="btn small" data-a="edit">Editar perfil</button><button class="btn small" data-a="copy">Copiar mi código</button>',
    friend: `<button class="btn small" data-a="call" ${st === 'offline' ? 'disabled' : ''}>${emoImg('call', 16)} Llamar</button><button class="btn small" data-a="nudge">${emoImg('nudge', 16)} Zumbido</button><button class="btn small" data-a="remove">Eliminar contacto</button>`,
    pending: '<button class="btn small" data-a="cancel">Cancelar solicitud</button>',
    bot: ''
  }[kind];
  $('right').innerHTML = `<div class="pcard">
    <div class="tag">${{ me: 'Tu perfil', friend: 'Contacto', pending: 'Solicitud enviada', bot: 'Bot inútil' }[kind]}</div>
    ${avatarHtml(p, 128, st)}
    <div class="pname">${esc(p.name)}</div>
    <div class="pstat"><span class="orb s-${st}"></span>${kind === 'pending' ? 'Pendiente' : STATUS[st]}</div>
    ${p.msg ? `<div class="pmsg">“${fmt(p.msg)}”</div>` : ''}
    ${temp}
    ${p.activity && st !== 'offline' ? sec('Ahora mismo', `<p>${actHtml(p.activity, 18)}</p><div class="small">${p.activity.since ? 'Desde ' + hhmm(p.activity.since) : ''}</div>`, 'hl') : ''}
    ${sec('Estado de ánimo', `<p>${moodHtml(p.mood, 18) || '—'}</p>`)}
    ${sec('Acerca de mí', `<p>${p.about ? fmt(p.about) : '<i>Sin descripción todavía.</i>'}</p>`)}
    ${kind !== 'bot' ? sec('Código personal', `<p class="mono">${esc(kind === 'me' ? S.me.pretty : c.pretty)}</p>`) : ''}
    ${kind === 'friend' && c.since ? sec('Contactos desde', `<p>${new Date(c.since).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</p>`) : ''}
    <div class="pbtns">${btns}</div>
  </div>`;
}
$('right').addEventListener('click', e => {
  if (!isChat(sel) && sel) return;
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (a === 'edit') openEditor('perfil');
  else if (a === 'copy') copyCode(e.target);
  else if (a === 'nudge') sendNudge();
  else if (a === 'call') startCall(sel);
  else if (a === 'remove') removeContact(sel);
  else if (a === 'cancel') removeContact(sel, true);
});

function removeContact(code, pending) {
  const name = pending ? person(code).pretty : nameOf(code);
  dialog(pending ? `¿Cancelar la solicitud a <b>${esc(name)}</b>?` : `¿Eliminar a <b>${esc(name)}</b> de tus contactos?<br>También se borrará el historial de la conversación.`, {
    icon: '?', buttons: [[pending ? 'Cancelar solicitud' : 'Eliminar', async () => {
      await api().remove_contact(code);
      delete S.contacts[code]; delete H[code];
      select(null);
    }], ['No']]
  });
}

// ---------- Agregar contactos ----------
function addContact() {
  dialog(`Escribe el <b>usuario</b> o el código personal de la persona que quieres agregar:
    <input type="text" id="addIn" placeholder="usuario o WIND-XXXX-XXXX" maxlength="20" spellcheck="false"
      style="width:100%;margin-top:8px;font:600 16px Consolas,monospace;letter-spacing:1px">
    <div class="small" style="margin-top:6px">${S.me.user ? `Tu usuario es <b>${esc(S.me.user)}</b> y tu` : 'Tu'} código es <b>${esc(S.me.pretty)}</b>. Compártelos para que también te puedan agregar.</div>`,
    { title: 'Agregar un contacto', icon: '+', focus: 'addIn', buttons: [['Agregar', () => { doAdd($('addIn').value); }], ['Cancelar']] });
  $('addIn').onkeydown = e => { if (e.key === 'Enter') $('dFoot').firstChild.click(); };
}
async function doAdd(v) {
  if (!v.trim()) return;
  dialog('Buscando a esa persona en el servidor...', { title: 'Agregar un contacto', icon: '…', buttons: [] });
  const r = await api().add_contact(v);
  dialog(r.msg, { title: 'Agregar un contacto', icon: r.ok ? emoImg('thumbsup', 34) : '!' });
}
$('addBtn').onclick = addContact;

// ---------- Editor: perfil, imagen y apariencia ----------
let draft, draftT, tempTouched;
$('edDur').innerHTML = DURS.map(([m, l]) => `<option value="${m}">${l}</option>`).join('');
$('edMoods').innerHTML = MOODS.map(([k, l, e]) => `<div class="optchip" data-mood="${k}">${e ? emoImg(e, 18) : ''}<span>${l}</span></div>`).join('');
$('edAvGrid').innerHTML = RETRO.AV_ORDER.map(id => `<div class="avopt" data-av="${id}" title="${esc(RETRO.AV[id].name)}"><img src="${RETRO.AV[id].src}" alt="">${esc(RETRO.AV[id].name)}</div>`).join('');
$('edScenes').innerHTML = Object.entries(SCENES).map(([k, l]) => `<div class="optchip" data-scene="${k}">${l}</div>`).join('');
$('edChats').innerHTML = Object.entries(CHATBG).map(([k, l]) => `<div class="optchip" data-chat="${k}">${l}</div>`).join('');

function edTab(t) {
  document.querySelectorAll('#edTabs span').forEach(s => s.classList.toggle('on', s.dataset.t === t));
  document.querySelectorAll('#ed .pane').forEach(p => p.hidden = p.dataset.p !== t);
}
$('edTabs').onclick = e => { if (e.target.dataset.t) edTab(e.target.dataset.t); };

function edRefresh() {
  $('edAvSmall').innerHTML = avatarHtml(draft, 76, S.me.profile.status);
  $('edAv').innerHTML = avatarHtml(draft, 110, S.me.profile.status);
  const a = draft.avatar;
  $('edAvName').textContent = a.type === 'img' ? 'Tu imagen' : (RETRO.AV[a.id] || RETRO.AV.duck).name;
  document.querySelectorAll('#edAvGrid .avopt').forEach(o => o.classList.toggle('on', a.type !== 'img' && o.dataset.av === a.id));
  document.querySelectorAll('#edMoods .optchip').forEach(o => o.classList.toggle('on', o.dataset.mood === (draft.mood || '')));
  $('edPresets').innerHTML = Object.entries(PRESETS).map(([k, p]) =>
    `<div class="preset ${draftT.preset === k ? 'on' : ''}" data-preset="${k}" style="background:linear-gradient(${p.glass}, ${p.accent})"><span>${p.name}</span></div>`).join('') +
    `<div class="preset ${PRESETS[draftT.preset] ? '' : 'on'}" style="background:linear-gradient(${draftT.glass}, ${draftT.accent});cursor:default"><span>Personalizado</span></div>`;
  $('edGlass').value = draftT.glass; $('edAccent').value = draftT.accent;
  $('edAlpha').value = Math.round(draftT.alpha * 100); $('edAlphaV').textContent = Math.round((1 - draftT.alpha) * 100) + '%';
  document.querySelectorAll('#edScenes .optchip').forEach(o => o.classList.toggle('on', o.dataset.scene === draftT.scene));
  document.querySelectorAll('#edChats .optchip').forEach(o => o.classList.toggle('on', o.dataset.chat === draftT.chat));
  $('edBubbles').checked = draftT.bubbles; $('edShine').checked = draftT.shine;
  document.querySelectorAll('#edLang .optchip').forEach(o => o.classList.toggle('on', o.dataset.lang === draftLang));
  document.querySelectorAll('#edSkins .skinopt').forEach(o => o.classList.toggle('on', o.dataset.skin === (draftT.skin || 'aero')));
  $('edAeroOpts').hidden = (draftT.skin || 'aero') !== 'aero';
  applyTheme(draftT);
}
function openEditor(tab) {
  draft = JSON.parse(JSON.stringify(S.me.profile));
  draftT = { ...DEFAULT_THEME, ...S.settings.theme };
  tempTouched = false;
  $('edName').value = draft.name; $('edMsg').value = draft.msg; $('edAbout').value = draft.about;
  $('edTemp').value = tempActive(draft) ? draft.temp.text : '';
  $('edDur').value = '240';
  $('edTempLeft').textContent = tempActive(draft) ? `Caduca en ${leftTxt(draft.temp.until)}. Cambia el texto o la duración para renovarlo.` : '';
  $('edSounds').checked = S.settings.sounds !== false;
  $('edActivity').checked = S.settings.activity !== false;
  draftLang = S.settings.lang || 'es';
  edRefresh(); edTab(tab || 'perfil');
  $('ed').classList.add('show');
}
function closeEditor() { applySettings(S.settings); $('ed').classList.remove('show'); }

$('edAvSmall').onclick = () => edTab('imagen');
$('edMoods').onclick = e => { const o = e.target.closest('[data-mood]'); if (o) { draft.mood = o.dataset.mood; edRefresh(); } };
$('edAvGrid').onclick = e => { const o = e.target.closest('[data-av]'); if (o) { draft.avatar = { type: 'icon', id: o.dataset.av }; edRefresh(); } };
$('edTemp').oninput = $('edDur').onchange = () => { tempTouched = true; };
$('edPresets').onclick = e => {
  const k = e.target.closest('[data-preset]')?.dataset.preset; if (!k) return;
  const { name, ...p } = PRESETS[k];
  draftT = { ...draftT, ...p, preset: k }; edRefresh();
};
const custom = patch => { draftT = { ...draftT, ...patch, preset: 'custom' }; edRefresh(); };
$('edGlass').oninput = () => custom({ glass: $('edGlass').value });
$('edAccent').oninput = () => custom({ accent: $('edAccent').value });
$('edAlpha').oninput = () => custom({ alpha: +$('edAlpha').value / 100 });
$('edScenes').onclick = e => { const o = e.target.closest('[data-scene]'); if (o) custom({ scene: o.dataset.scene }); };
$('edChats').onclick = e => { const o = e.target.closest('[data-chat]'); if (o) { draftT = { ...draftT, chat: o.dataset.chat }; edRefresh(); } };
let draftLang = 'es';
$('edLang').onclick = e => { const o = e.target.closest('[data-lang]'); if (o) { draftLang = o.dataset.lang; edRefresh(); } };
$('edSkins').innerHTML =Object.entries(SKINS).map(([k, l]) => `<div class="skinopt sk-${k}" data-skin="${k}"><div class="skprev"><i></i><i></i><i></i></div><span>${l}</span></div>`).join('');
$('edSkins').onclick = e => { const o = e.target.closest('[data-skin]'); if (o) { draftT = { ...draftT, skin: o.dataset.skin }; edRefresh(); } };
$('edBubbles').onchange =() => { draftT = { ...draftT, bubbles: $('edBubbles').checked }; edRefresh(); };
$('edShine').onchange = () => { draftT = { ...draftT, shine: $('edShine').checked }; edRefresh(); };

$('edUpload').onclick = () => $('edFile').click();
$('edFile').onchange = () => {
  const f = $('edFile').files[0]; if (!f) return;
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const s = Math.min(img.width, img.height);
    cv.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128);
    draft.avatar = { type: 'img', src: cv.toDataURL('image/jpeg', .85) };
    URL.revokeObjectURL(img.src); edRefresh();
  };
  img.onerror = () => dialog('No se pudo leer esa imagen.', { icon: '!' });
  img.src = URL.createObjectURL(f);
  $('edFile').value = '';
};
$('edSave').onclick = async () => {
  Object.assign(draft, { name: $('edName').value.trim() || draft.name, msg: $('edMsg').value, about: $('edAbout').value });
  const tt = $('edTemp').value.trim();
  if (!tt) draft.temp = null;
  else if (tempTouched || !tempActive(draft)) draft.temp = { text: tt, until: Date.now() + +$('edDur').value * 60000 };
  S.me.profile = draft;
  S.settings = await api().set_settings({ theme: draftT, sounds: $('edSounds').checked, lang: draftLang, activity: $('edActivity').checked });
  if (!S.settings.activity) S.me.profile.activity = null;
  closeEditor();
  await saveProfile();
  renderList(); renderRight();
  if (isChat(sel)) renderChatHead(); else if (!sel) renderCenter();
};
$('edCancel').onclick = closeEditor;
$('edX').onclick = closeEditor;

// ---------- Barra de estado y notificaciones ----------
function renderStatus() {
  const u = S.update || {};
  const upd = u.status === 'downloading' ? ` · <span class="upd">Descargando la versión ${esc(u.new)}... ${Math.round((u.p || 0) * 100)}%</span>`
    : u.status === 'ready' ? ` · <a href="#" class="upd ready" id="updNow">${emoImg('star', 14)} Versión ${esc(u.new)} lista: reiniciar ahora</a>`
    : u.status === 'dev' ? ` · <span class="upd">Hay una versión ${esc(u.new)} (estás usando el código fuente)</span>` : '';
  $('conn').innerHTML = (S.connected
    ? '<span class="orb s-online"></span> Conectado al servidor'
    : '<span class="orb s-offline"></span> Conectando con el servidor...') + (S.version ? ` · v${esc(S.version)}` : '') + upd;
  if ($('updNow')) $('updNow').onclick = e => { e.preventDefault(); updateDialog(); };
}
function updateDialog() {
  const u = S.update;
  dialog(`La versión <b>${esc(u.new)}</b> ya está descargada y verificada.${u.notes ? `<br><br><b>Novedades:</b><br>${fmt(u.notes)}` : ''}
    <br><br>Se instalará sola la próxima vez que cierres el programa, o ahora mismo si reinicias.`,
    { title: 'Actualización disponible', icon: emoImg('star', 34), buttons: [['Reiniciar ahora', () => {
      if (typeof call !== 'undefined' && call) hangup();
      api().update_now().then(r => r && !r.ok && dialog(esc(r.msg), { icon: '!' }));
    }], ['Más tarde']] });
}
function notify(title, text, profile, status, code, always) {
  if (!always && document.hasFocus()) return;
  api().toast({ title, text, profile: profile || {}, status, code, theme: S.settings.theme, sounds: S.settings.sounds, lang: S.settings.lang });
}
function attLabel(m) {
  if (m.sticker) return '[sticker]';
  if (!m.att) return m.text;
  return ({ image: '[imagen]', gif: '[GIF]', audio: '[audio]', voice: '[nota de voz]', video: '[vídeo]', file: '[archivo]' }[m.att.kind] || '') + ' ' + (m.text || '');
}

// ---------- Eventos que llegan desde Python ----------
window.onEvent = e => {
  if (!S) return;
  switch (e.t) {
    case 'me_profile':
      S.me.profile.activity = e.p.activity; renderTop(); if (!sel || sel === 'explore') renderRight(); break;
    case 'conn':
      S.connected = e.ok; renderStatus(); break;
    case 'update': {
      const before = S.update && S.update.status;
      S.update = e; renderStatus();
      if (e.status === 'ready' && before !== 'ready') updateDialog();
      break;
    }
    case 'contact': {
      const prev = S.contacts[e.c.code];
      S.contacts[e.c.code] = e.c;
      if (e.came_online && Date.now() - bootT > 8000) {
        sounds.online();
        notify(e.c.profile.name, 'acaba de iniciar sesión.', e.c.profile, e.c.profile.status, e.c.code, true);
      }
      if (e.accepted) {
        sounds.online();
        notify(e.c.profile.name, 'aceptó tu solicitud. ¡Ya pueden chatear! (Y)', e.c.profile, 'online', e.c.code, true);
      }
      renderList();
      if (sel === e.c.code) {
        if (prev && prev.state !== e.c.state) renderCenter(); else renderChatHead();
        renderRight();
      }
      if (typeof call !== 'undefined' && call && call.code === e.c.code) renderCall();
      break;
    }
    case 'contact_removed':
      delete S.contacts[e.code]; delete H[e.code];
      if (sel === e.code) select(null); else renderList();
      break;
    case 'request':
      S.requests[e.r.code] = e.r;
      collapsed.delete('req');
      renderList(); sounds.request();
      notify(e.r.profile.name, `(${e.r.pretty}) quiere agregarte como contacto.`, e.r.profile, 'online', null, true);
      break;
    case 'msg':
      S.contacts[e.code] = e.c;
      pushMsg(e.code, e.m);
      if (sel === e.code) { hideTyping(); markRead(e.code); }
      sounds.msg();
      renderList();
      if (!document.hasFocus() || sel !== e.code)
        notify(e.c.profile.name + ' dice:', attLabel(e.m).slice(0, 120), e.c.profile, statusOf(e.code), e.code, sel !== e.code);
      break;
    case 'msgstatus': {
      const m = (H[e.code] || []).find(x => x.id === e.id);
      if (m) m.status = e.status;
      const el = document.querySelector(`.m[data-id="${CSS.escape(e.id)}"] .mst`);
      if (el && STATUS_TXT[e.status]) { el.className = 'mst ' + e.status; el.innerHTML = STATUS_TXT[e.status](); }
      break;
    }
    case 'nudge':
      receiveNudge(e.code, e.m);
      if (sel !== e.code) notify(nameOf(e.code), 'te ha enviado un zumbido.', person(e.code).profile, statusOf(e.code), e.code, true);
      break;
    case 'typing':
      showTyping(e.code); break;
    case 'att_ready': onAttReady(e.att); break;
    case 'att_progress': onAttProgress(e.id, e.p); homeAttProgress(e.id, e.p); break;
    case 'rtc': onRtc(e.code, e.d); break;
    case 'fpost': case 'fdel': case 'forum': case 'fdir': onForumEvent(e); break;
    case 'feed_post': case 'feed_like': case 'feed_comment': case 'feed_del': onHomeEvent(e); break;
  }
};

// ---------- Teléfono: una columna cada vez y barra de navegación abajo ----------
const isMob = () => matchMedia('(max-width: 760px)').matches;
let mobTab = 'inicio';
function mobView(v) {
  document.body.classList.remove('mob-left', 'mob-center', 'mob-right');
  document.body.classList.add('mob-' + v);
  if (v === 'center' && !sel) mobTab = homeFilter === 'short' ? 'cortos' : 'inicio';
  else if (v === 'center') mobTab = isChat(sel) ? 'contactos' : 'foros';
  renderMnav();
}
function renderMnav() {
  if (!S) return;
  const unreadC = Object.values(S.contacts).reduce((n, c) => n + (c.unread || 0), 0) + Object.keys(S.requests).length;
  const unreadF = Object.values(S.forums).reduce((n, f) => n + (f.unread || 0), 0);
  const b = (k, icon, label, n = 0) => `<button data-mn="${k}" class="${mobTab === k ? 'on' : ''}">${emoImg(icon, 24)}${label}${n ? `<span class="badge">${n}</span>` : ''}</button>`;
  $('mnav').innerHTML = b('inicio', 'star', 'Inicio') + b('cortos', 'video', 'Cortos') + b('contactos', 'people', 'Chats', unreadC) +
    b('foros', 'forum', 'Foros', unreadF) + b('info', 'doc', 'Info');
}
$('mnav').onclick = e => {
  const k = e.target.closest('[data-mn]')?.dataset.mn;
  if (!k) return;
  mobTab = k;
  if (k === 'inicio') { leftTab = 'inicio'; homeFilter = ''; select(null); }
  else if (k === 'cortos') { leftTab = 'inicio'; setHomeFilter('short'); mobView('center'); }
  else if (k === 'info') { renderRight(); mobView('right'); mobTab = 'info'; renderMnav(); }
  else { leftTab = k; $('q').value = ''; renderTabs(); renderList(); mobView('left'); mobTab = k; renderMnav(); }
};
for (const name of ['openForum', 'openExplore']) {  // al abrir un foro en el teléfono se muestra la columna central
  const orig = window[name];
  window[name] = (...a) => { if (isMob()) mobView('center'); return orig(...a); };
}
document.body.classList.add('mob-center');

// ---------- Versión web y ajustes de llamadas ----------
async function webShare() {
  if (S.web) return dialog('Ya estás usando la versión web.', { title: 'Versión web' });
  dialog('Creando tu enlace para compartir...<br><span class="small">La primera vez descarga un programa de Cloudflare (unos 60 MB), puede tardar un minuto.</span>',
    { title: 'Compartir la versión web', icon: emoImg('monitor', 34), buttons: [] });
  const r = await api().web_tunnel();
  if (!r.ok) return dialog(esc(r.msg), { title: 'Compartir la versión web', icon: '!' });
  dialog(`Comparte este enlace. Cada persona entra con su propio usuario, también desde el teléfono:
    <div class="bigcode" style="font-size:14px;margin:10px 0;word-break:break-all;user-select:text">${esc(r.url)}</div>
    <span class="small">Funciona mientras este programa esté abierto (el enlace cambia cada vez que lo abres). Úsalo solo con gente de confianza.</span>`,
    { title: 'Compartir la versión web', icon: emoImg('monitor', 34), buttons: [
      ['Copiar enlace', () => { api().copy(r.url); setTimeout(() => dialog('¡Enlace copiado!', { title: 'Compartir la versión web' }), 0); }],
      ['Abrir', () => { api().open_url(r.url); }], ['Dejar de compartir', () => { api().web_stop_tunnel(); }], ['Cerrar']] });
}function callSettings() {
  const t = S.settings.turn || {};
  dialog(`Si las llamadas no conectan entre redes distintas (datos móviles, redes de empresa o colegio), hace falta un servidor <b>TURN</b>.
    Puedes conseguir uno gratis en <b>metered.ca</b> (20 GB al mes) y copiar aquí sus datos:
    <label class="small">Dirección (por ejemplo turn:global.relay.metered.ca:443)</label><input type="text" id="tuUrl" style="width:100%" value="${esc(t.url || '')}">
    <label class="small">Usuario</label><input type="text" id="tuUser" style="width:100%" value="${esc(t.user || '')}">
    <label class="small">Contraseña</label><input type="password" id="tuPass" style="width:100%" value="${esc(t.pass || '')}">`,
    { title: 'Configurar llamadas', icon: emoImg('call', 34), buttons: [['Guardar', () => {
      api().set_settings({ turn: { url: $('tuUrl').value, user: $('tuUser').value, pass: $('tuPass').value } })
        .then(s => { S.settings = s; dialog(s.turn.url ? 'Guardado. Las próximas llamadas usarán ese servidor si hace falta.' : 'Guardado (sin servidor TURN).', { icon: emoImg('thumbsup', 34) }); });
    }], ['Cancelar']] });
}

// ---------- Menús ----------
const menus = {
  'Inicio': () => { leftTab = 'inicio'; homeFilter = ''; select(null); },
  'Archivo': () => dialog(S.me.user ? `Sesión iniciada como <b>${esc(S.me.user)}</b>.` : 'Todavía no tienes cuenta.', { title: 'Archivo', icon: '?', buttons: S.me.user
    ? [['Versión web', webShare], ['Configurar llamadas', callSettings], ['Cambiar contraseña', changePassword], ['Cerrar sesión', logout], ['Salir', confirmQuit]]
    : [['Crear cuenta', () => { authMode = 'register'; showAuth(); }], ['Salir', confirmQuit], ['Cancelar']] }),
  'Contactos': () => dialog(`${S.me.user ? `Tu usuario: <b>${esc(S.me.user)}</b><br>` : ''}Tu código: <b class="mono">${esc(S.me.pretty)}</b>`, { title: 'Contactos', buttons: [['Agregar contacto', addContact], ['Copiar mi código', () => copyCode()], ['Cancelar']] }),
  'Foros': () => { leftTab = 'foros'; renderTabs(); openExplore(); },
  'Herramientas': () => openEditor('apariencia'),
  'Ayuda': () => dialog(`<b>Wind OS Messenger</b> 2.0<br><br>
    · Agrega a tus amigos con su código personal (WIND-XXXX-XXXX).<br>
    · En los chats puedes enviar imágenes, GIF, música, vídeos, archivos, notas de voz y stickers (hasta 20 MB).<br>
    · Llama a un contacto conectado con el botón ${emoImg('call', 16)}: puedes compartir tu pantalla y seguir usando la app durante la llamada.<br>
    · En Foros puedes unirte a foros públicos, buscar privados por su nombre exacto o código, y crear los tuyos.<br><br>
    Todo va cifrado de extremo a extremo; las llamadas van directas entre las dos PCs.<br><br>
    Emoticonos: ${[':)', ':D', ';)', '(H)', '(Y)', '(L)', '(A)', '(6)'].map(k => fmt(k) + ' <code>' + esc(k) + '</code>').join(' &nbsp;')}`, { title: 'Acerca de' })
};
$('menu').onclick = e => { if (e.target.tagName === 'SPAN') menus[e.target.textContent](); };
function confirmQuit() {
  dialog('¿Salir de <b>Wind OS Messenger</b>?<br>Tus contactos te verán desconectado.' + (S && S.me.user ? '<br>Tu sesión seguirá iniciada en esta PC para la próxima vez.' : '') + (call ? '<br><b>Se colgará la llamada en curso.</b>' : ''),
    { icon: '?', buttons: [['Salir', () => { if (call) hangup(); setTimeout(() => api().quit(), call ? 400 : 0); }], ['Cancelar']] });
}
wireCaps(confirmQuit);

// Los mensajes temporales caducan solos: refrescamos cada minuto
setInterval(() => {
  if (!S) return;
  renderTop(); renderList(); renderChatHead();
  if (!$('right').matches(':hover') && isChat(sel)) renderRight();
}, 60000);

// ---------- Arranque ----------
applyTheme(DEFAULT_THEME);
onReady(async () => {
  S = await api().init();
  S.dir = {};
  applySettings(S.settings);
  renderTop(); renderStatus();
  select(null);
  if (!S.me.user) { authMode = S.me.fresh ? 'login' : 'register'; showAuth(); }
});
startBubbles(1700);
