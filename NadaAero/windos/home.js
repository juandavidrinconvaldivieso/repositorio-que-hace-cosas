// Inicio: publicaciones con fotos, vídeos y enlaces, lo principal de un vistazo y sugerencias
const CATS = [
  ['', 'Sin categoría', 'forum'], ['musica', 'Música', 'note'], ['juegos', 'Juegos', 'gamepad'], ['arte', 'Arte', 'sticker'],
  ['foto', 'Fotografía', 'picture'], ['humor', 'Humor', 'grin'], ['tecno', 'Tecnología', 'monitor'], ['deporte', 'Deportes', 'star'],
  ['cine', 'Cine y series', 'video'], ['natura', 'Naturaleza', 'rose'], ['comida', 'Comida', 'pizza'], ['viajes', 'Viajes', 'phone'],
  ['anime', 'Anime', 'party'], ['estudio', 'Estudios', 'book'], ['otros', 'Otros', 'doc']
];
const CATMAP = Object.fromEntries(CATS.map(c => [c[0], c]));
const URL_RE = /https?:\/\/[^\s<>"']{3,2000}/g;

let homeFilter = '';        // '', 'mine', 'c:<categoría>', 't:<etiqueta>', 'u:<código>'
let HP = {};                // publicaciones cargadas
let homePending = [];       // fotos y vídeos elegidos para la próxima publicación
let homePerson = null;      // persona que se ve en el panel derecho
let homeNew = 0;
let homeReloadT = null;

const isHome = () => !sel;
const postEl = pid => document.querySelector(`.fpost[data-pid="${CSS.escape(pid)}"], .short[data-pid="${CSS.escape(pid)}"]`);
const homeTitle = () => homeFilter === 'mine' ? 'Mis publicaciones' : homeFilter === 'short' ? 'Cortos'
  : homeFilter.startsWith('c:') ? (CATMAP[homeFilter.slice(2)] || ['', 'Categoría'])[1]
  : homeFilter.startsWith('t:') ? '#' + homeFilter.slice(2)
  : homeFilter.startsWith('u:') ? 'Publicaciones de ' + (homeAuthorName || 'esta persona') : '';
let homeAuthorName = '';

// ---------- Columna izquierda ----------
function renderHomeList() {
  const item = (f, icon, label) => `<div class="contact navi ${isHome() && homeFilter === f ? 'sel' : ''}" data-hf="${esc(f)}">${emoImg(icon, 22)}<div class="ci"><div class="nm"><span>${label}</span></div></div></div>`;
  const online = Object.entries(S.contacts).filter(([, c]) => c.state === 'friend' && c.online);
  $('list').innerHTML =
    item('', 'star', '<b>Inicio</b>') + item('short', 'video', '<b>Cortos</b>') + item('mine', 'doc', 'Mis publicaciones') +
    group('hcats', 'Categorías', CATS.filter(c => c[0]).map(c => item('c:' + c[0], c[2], c[1]))) +
    group('honline', `Conectados ahora (${online.length})`, online.map(([code]) => contactRow(code)), 'Ninguno de tus contactos está conectado.');
}

// ---------- Centro ----------
function stripHtml() {
  const online = Object.entries(S.contacts).filter(([, c]) => c.state === 'friend' && c.online);
  const forums = Object.values(S.forums).sort((a, b) => b.last - a.last).slice(0, 8);
  const noFriends = !Object.values(S.contacts).some(c => c.state === 'friend');
  return `<div class="hstrip">
    <div class="hsec"><div class="hst">${emoImg('people', 16)} Conectados</div><div class="hrow">${online.length
      ? online.map(([code, c]) => `<div class="hbub" data-chat="${esc(code)}" title="${esc(c.profile.name)}">${avatarHtml(c.profile, 46, c.profile.status)}<span>${esc(c.profile.name)}</span></div>`).join('')
      : `<div class="hhint">${noFriends ? `Comparte tu ${S.me.user ? `usuario <b>${esc(S.me.user)}</b>` : `código <b class="mono">${esc(S.me.pretty)}</b>`} para que te agreguen.` : 'Nadie conectado ahora.'}</div>`}</div></div>
    <div class="hsec"><div class="hst">${emoImg('forum', 16)} Tus foros</div><div class="hrow">${forums.length
      ? forums.map(f => `<div class="hbub" data-fopen="${esc(f.fid)}" title="${esc(f.name)}">${forumIcon(f, 46)}<span>${esc(f.name)}</span>${f.unread ? `<i class="badge">${f.unread}</i>` : ''}</div>`).join('')
      : `<div class="hhint"><a href="#" data-fx="explore">Explora foros</a> para unirte a alguno.</div>`}</div></div>
  </div>`;
}

function composerCard() {
  const p = S.me.profile;
  return `<div class="hcomp" id="hcomp">
    <div class="row" style="align-items:flex-start">${avatarHtml(p, 44, p.status)}
      <textarea id="hText" maxlength="3000" placeholder="¿Qué quieres compartir, ${esc(p.name)}? Puedes poner enlaces y #etiquetas"></textarea></div>
    <div class="pend" id="hPend"></div>
    <div id="hLinks"></div>
    <div class="hbar">
      <div class="tool" data-h="media">${emoImg('picture', 20)} Fotos / vídeos</div>
      <div class="tool" data-h="emo">${emoImg('smile', 20)}</div>
      <select class="field" id="hCat">${CATS.map(([k, l]) => `<option value="${k}">${k ? l : 'Categoría...'}</option>`).join('')}</select>
      <label class="hshort" id="hShortL" hidden title="Se verá en la sección Cortos, a pantalla completa y en vertical"><input type="checkbox" id="hShort"> ${emoImg('video', 16)} Publicar como corto</label>
      <span class="grow"></span>
      <button class="bigbtn small" id="hPost">Publicar</button>
    </div>
  </div>`;
}

async function renderHome() {
  if (homeFilter === 'short') return renderShorts();
  const title = homeTitle();
  $('center').innerHTML = `<div class="fbody hbody" id="hbody">
    ${homeFilter ? '' : stripHtml()}
    ${title ? `<div class="hfilter"><button class="btn small" data-hf="">← Inicio</button><b>${esc(title)}</b></div>` : ''}
    ${!homeFilter || homeFilter === 'mine' ? composerCard() : ''}
    <div class="newpill" id="newpill" hidden></div>
    <div id="feed"><div class="fempty"><p>Cargando publicaciones...</p></div></div>
  </div>`;
  if ($('hcomp')) wireHomeComposer();
  const filt = homeFilter, list = await api().feed_get(filt);
  if (!isHome() || filt !== homeFilter || !$('feed')) return;
  HP = Object.fromEntries(list.map(p => [p.id, p]));
  homeNew = 0;
  $('feed').innerHTML = list.map(postHtml).join('') || `<div class="fempty">${emoImg('picture', 48)}<p>${filt === 'mine'
    ? 'Todavía no has publicado nada.' : filt ? 'No hay publicaciones aquí todavía.' : 'Aún no hay publicaciones. ¡Comparte la primera!'}</p></div>`;
  observePosts();
}

// ---------- Publicar ----------
function wireHomeComposer() {
  const ta = $('hText');
  const renderPend = () => {
    $('hPend').innerHTML = homePending.map((a, i) => `<div class="pchip">${a.kind === 'video' ? emoImg('video', 20) : `<img src="${esc(a.url)}" alt="">`}` +
      `<span>${esc(a.name)} <small>${fmtSize(a.size)}</small></span><b data-rm="${i}" title="Quitar">✕</b></div>`).join('') +
      (homePending.length ? `<div class="small" style="align-self:center">${homePending.length}/10</div>` : '');
    // Un solo vídeo: se puede publicar como corto (se marca solo si el vídeo es vertical)
    const one = homePending.length === 1 && homePending[0].kind === 'video';
    $('hShortL').hidden = !one;
    if (!one) $('hShort').checked = false;
    else if ($('hShortL').dataset.vid !== homePending[0].id) {
      $('hShortL').dataset.vid = homePending[0].id;
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => { $('hShort').checked = v.videoHeight > v.videoWidth; };
      v.src = homePending[0].url;
    }
  };
  const add = list => {
    for (const a of list || []) {
      if (!a) continue;
      if (a.error) { dialog(esc(a.error), { icon: '!' }); continue; }
      if (!['image', 'gif', 'video'].includes(a.kind)) { dialog(`«${esc(a.name)}» no es una foto ni un vídeo. Para otros archivos usa los chats o los foros.`, { icon: '!' }); continue; }
      if (homePending.length >= 10) { dialog('Puedes poner hasta 10 fotos o vídeos por publicación.', { icon: '!' }); break; }
      ATT[a.id] = a; homePending.push(a);
    }
    renderPend();
  };
  renderPend();
  const links = () => {
    const urls = [...new Set(ta.value.match(URL_RE) || [])].slice(0, 3);
    $('hLinks').innerHTML = urls.map(linkCard).join('');
  };
  ta.addEventListener('input', links);
  links();
  $('hPend').onclick = e => { const i = e.target.dataset.rm; if (i != null) { homePending.splice(+i, 1); renderPend(); } };
  $('hcomp').querySelector('.hbar').addEventListener('click', e => {
    const t = e.target.closest('[data-h]');
    if (!t) return;
    e.stopPropagation();
    if (t.dataset.h === 'media') api().pick_files('media').then(add);
    if (t.dataset.h === 'emo') openPicker(t, r => {
      if (r.code) { const p = ta.selectionStart; ta.value = ta.value.slice(0, p) + r.code + ta.value.slice(ta.selectionEnd); ta.focus(); }
    }, true);
  });
  ta.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])]; if (f.length) { e.preventDefault(); blobsToAtts(f).then(add); } });
  const hc = $('hcomp');
  hc.addEventListener('dragover', e => { e.preventDefault(); hc.classList.add('dragover'); });
  hc.addEventListener('dragleave', () => hc.classList.remove('dragover'));
  hc.addEventListener('drop', e => { e.preventDefault(); hc.classList.remove('dragover'); blobsToAtts([...e.dataTransfer.files]).then(add); });
  $('hPost').onclick = async () => {
    const btn = $('hPost');
    btn.disabled = true;
    const r = await api().feed_post(ta.value, $('hCat').value, homePending.map(a => a.id), $('hShort').checked);
    btn.disabled = false;
    if (!r || r.error) return dialog(esc(r ? r.error : 'No se pudo publicar.'), { icon: '!' });
    homePending = [];
    ta.value = ''; $('hCat').value = '';
    renderPend(); links();
    HP[r.id] = r;
    $('feed').querySelector('.fempty')?.remove();
    $('feed').insertAdjacentHTML('afterbegin', postHtml(r));
    observePosts();
    sounds.online();
  };
}

// ---------- Mostrar publicaciones ----------
function richText(text) {
  let out = '', last = 0;
  for (const m of text.matchAll(URL_RE)) {
    out += fmt(text.slice(last, m.index));
    const u = m[0];
    out += `<a href="#" class="ext" data-url="${esc(u)}" title="${esc(u)}">${esc(u.replace(/^https?:\/\//, '').slice(0, 60))}${u.length > 68 ? '…' : ''}</a>`;
    last = m.index + u.length;
  }
  out += fmt(text.slice(last));
  return out.replace(/(^|\s|>)#([\wáéíóúñü]{2,30})/gi, (_, pre, tag) => `${pre}<a href="#" class="htag" data-tag="${esc(tag.toLowerCase())}">#${tag}</a>`);
}
function linkCard(u) {
  let host = u;
  try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { /* enlace raro */ }
  const yt = /(^|\.)youtube\.com$|^youtu\.be$/.test(host);
  return `<div class="lcard" data-url="${esc(u)}">${emoImg(yt ? 'video' : 'search', 28)}<div class="ci"><b>${esc(yt ? 'Vídeo de YouTube' : host)}</b><span>${esc(u)}</span></div><span class="lgo">Abrir ↗</span></div>`;
}

function mediaCell(a, pid, extra = '') {
  ATT[a.id] = { ...(ATT[a.id] || {}), ...a, url: a.url || (ATT[a.id] || {}).url };
  a = ATT[a.id];
  const data = `data-matt="${esc(a.id)}" data-pid="${esc(pid)}"`;
  if (!a.url) {
    if (a.size <= 25 * 1048576) fetchForumAtt('feed', a.id);
    return `<div class="mcell pend" ${data}>${emoImg(KIND_ICON[a.kind] || 'doc', 30)}<span class="prog">Cargando...</span>${extra}</div>`;
  }
  if (a.kind === 'video') return `<div class="mcell vid" ${data}>${playerHtml(a.url, 'video', a.name, `data-pv="${esc(pid)}"`)}${extra}</div>`;
  return `<div class="mcell" ${data}><img src="${esc(a.url)}" alt="" data-gal="${esc(pid)}" data-gid="${esc(a.id)}" loading="lazy">${extra}</div>`;
}
function mediaGrid(p) {
  const n = p.atts.length;
  if (!n) return '';
  const show = p.atts.slice(0, 4);
  for (const a of p.atts.slice(4)) {  // las que quedan tras el "+N" también se bajan, para la galería
    ATT[a.id] = { ...(ATT[a.id] || {}), ...a, url: a.url || (ATT[a.id] || {}).url };
    if (!ATT[a.id].url) fetchForumAtt('feed', a.id);
  }
  return `<div class="mgrid n${show.length}">` + show.map((a, i) =>
    mediaCell(a, p.id, i === 3 && n > 4 ? `<div class="mmore" data-gal="${esc(p.id)}" data-gid="${esc(a.id)}">+${n - 4}</div>` : '')).join('') + '</div>';
}

function postHtml(p) {
  const cat = CATMAP[p.cat];
  const urls = [...new Set((p.text || '').match(URL_RE) || [])].slice(0, 3);
  return `<div class="fpost" data-pid="${esc(p.id)}">
    <div class="fph"><span data-person="${esc(p.author.code)}" style="cursor:pointer">${avatarHtml(p.author, 42, 'online')}</span>
      <div class="ci"><b data-person="${esc(p.author.code)}">${esc(p.author.name)}</b>${p.contact ? ' <span class="ftag">Contacto</span>' : ''}
      <div class="tm">${ago(p.ts)}${p.cat && cat ? ` · <a href="#" data-hf="c:${esc(p.cat)}">${emoImg(cat[2], 13)} ${esc(cat[1])}</a>` : ''}</div></div>
      ${p.mine ? '<button class="btn small" data-pdel>Borrar</button>' : ''}</div>
    ${p.text ? `<div class="fpt">${richText(p.text)}</div>` : ''}
    ${urls.map(linkCard).join('')}
    ${mediaGrid(p)}
    <div class="fpa"><button class="lk ${p.liked ? 'on' : ''}" data-like>${emoImg('heart', 18)}<span>${p.likes || ''}</span> Me gusta</button>
      <button class="lk" data-cm>${emoImg('forum', 18)}<span>${p.comments || ''}</span> Comentarios</button></div>
    <div class="fcm" hidden></div>
  </div>`;
}

// ---------- Interacción ----------
$('center').addEventListener('click', async e => {
  if (!isHome()) return;
  const t = e.target;
  const hf = t.closest('[data-hf]');
  if (hf) { e.preventDefault(); return setHomeFilter(hf.dataset.hf); }
  const chat = t.closest('[data-chat]');
  if (chat) { leftTab = 'contactos'; return select(chat.dataset.chat); }
  const post = t.closest('[data-pid]');
  const pid = post && post.dataset.pid;
  const url = t.closest('[data-url]');
  if (url) { e.preventDefault(); api().open_url(url.dataset.url); if (pid) api().feed_signal(pid, 'link'); return; }
  const tag = t.closest('.htag');
  if (tag) { e.preventDefault(); if (pid) api().feed_signal(pid, 'tag'); return setHomeFilter('t:' + tag.dataset.tag); }
  const person = t.closest('[data-person]');
  if (person) { homePerson = person.dataset.person; if (pid) api().feed_signal(pid, 'profile'); return renderRight(); }
  const gal = t.closest('[data-gal]');
  if (gal) { api().feed_signal(gal.dataset.gal, 'open'); return openGallery(gal.dataset.gal, gal.dataset.gid); }
  if (!pid) return;
  if (t.closest('[data-like]')) {
    const p = HP[pid];
    const v = await api().feed_like(pid, !p.liked);
    if (v) { HP[pid] = v; updateLike(pid, v.likes, v.liked); if (v.liked) tone([880, 1175], .07); }
  }
  if (t.closest('[data-cm]')) toggleComments(pid);
  if (t.closest('[data-pdel]')) dialog('¿Borrar esta publicación? Desaparecerá para todo el mundo.', { icon: '?', buttons: [['Borrar', async () => {
    if (await api().feed_delete(pid)) removeHomePost(pid);
  }], ['Cancelar']] });
  const cdel = t.closest('[data-cdel]');
  if (cdel && await api().feed_comment_delete(pid, cdel.dataset.cdel)) { cdel.closest('.cmt')?.remove(); }
});
$('center').addEventListener('play', e => { const pid = e.target.dataset?.pv; if (pid && isHome()) api().feed_signal(pid, 'play'); }, true);

function setHomeFilter(f) {
  homeFilter = f;
  if (f.startsWith('u:')) homeAuthorName = homePerson === f.slice(2) ? (lastPersonName || '') : '';
  if (sel) { sel = null; }
  leftTab = 'inicio';
  renderList(); renderRight(); renderCenter();
}

function updateLike(pid, likes, liked) {
  const b = postEl(pid)?.querySelector('[data-like]');
  if (!b) return;
  b.classList.toggle('on', liked);
  b.querySelector('span').textContent = likes || '';
}
function removeHomePost(pid) {
  delete HP[pid];
  postEl(pid)?.remove();
}

const commentHtml = c => `<div class="cmt" data-cid="${esc(c.id)}">${avatarHtml(c.author, 28, 'online')}<div class="ci"><b data-person="${esc(c.author.code)}">${esc(c.author.name)}</b> ${fmt(c.text)}` +
  `<div class="tm">${ago(c.ts)}${c.can_del ? ` · <a href="#" data-cdel="${esc(c.id)}">Borrar</a>` : ''}</div></div></div>`;
async function toggleComments(pid) {
  const box = postEl(pid)?.querySelector('.fcm');
  if (!box) return;
  if (!box.hidden) { box.hidden = true; return; }
  box.hidden = false;
  const list = await api().feed_comments(pid);
  box.innerHTML = `<div class="cmts">${list.map(commentHtml).join('')}</div>` +
    `<div class="crow2">${avatarHtml(S.me.profile, 28, S.me.profile.status)}<input type="text" maxlength="1000" placeholder="Escribe un comentario..."><button class="btn small">Enviar</button></div>`;
  const inp = box.querySelector('input'), send = async () => {
    const v = inp.value.trim();
    if (!v) return;
    inp.value = '';
    const c = await api().feed_comment(pid, v);
    if (c) addComment(pid, c);
  };
  box.querySelector('button').onclick = send;
  inp.onkeydown = e => { if (e.key === 'Enter') send(); };
  inp.focus();
}
function addComment(pid, c, count) {
  const box = postEl(pid)?.querySelector('.fcm');
  if (box && !box.hidden && !box.querySelector(`[data-cid="${CSS.escape(c.id)}"]`)) box.querySelector('.cmts').insertAdjacentHTML('beforeend', commentHtml(c));
  const n = count ?? (HP[pid] ? HP[pid].comments + 1 : 0);
  if (HP[pid]) HP[pid].comments = n;
  const span = postEl(pid)?.querySelector('[data-cm] span');
  if (span) span.textContent = n || '';
}

// Galería de fotos de una publicación
function openGallery(pid, gid) {
  const imgs = (HP[pid]?.atts || []).map(a => ATT[a.id] || a).filter(a => a.url && (a.kind === 'image' || a.kind === 'gif'));
  let i = Math.max(0, imgs.findIndex(a => a.id === gid));
  if (!imgs.length) return;
  const show = () => {
    const a = imgs[i];
    $('viewer').innerHTML = `${imgs.length > 1 ? '<button class="vnav l" id="vPrev">‹</button><button class="vnav r" id="vNext">›</button>' : ''}<img src="${esc(a.url)}" alt="">` +
      `<div class="vbar"><span>${imgs.length > 1 ? `${i + 1} de ${imgs.length} · ` : ''}${esc(a.name)}</span><button class="btn small" id="vSave">Guardar...</button><button class="btn small" id="vClose">Cerrar</button></div>`;
    $('vSave').onclick = () => api().save_att(a.id);
    $('vClose').onclick = () => $('viewer').classList.remove('show');
    if ($('vPrev')) { $('vPrev').onclick = () => { i = (i + imgs.length - 1) % imgs.length; show(); }; $('vNext').onclick = () => { i = (i + 1) % imgs.length; show(); }; }
  };
  show();
  $('viewer').classList.add('show');
}
document.addEventListener('keydown', e => {
  if (!$('viewer').classList.contains('show')) return;
  if (e.key === 'Escape') $('viewer').classList.remove('show');
  if (e.key === 'ArrowLeft') $('vPrev')?.click();
  if (e.key === 'ArrowRight') $('vNext')?.click();
});

// Lo que la persona mira con calma también cuenta (se guarda solo en su PC)
const viewed = new Set();
let postObserver = null;
function observePosts() {
  if (!postObserver) {
    const timers = new Map();
    postObserver = new IntersectionObserver(entries => {
      for (const en of entries) {
        const pid = en.target.dataset.pid;
        if (en.isIntersecting && en.intersectionRatio >= .6) {
          if (!viewed.has(pid) && !timers.has(pid)) timers.set(pid, setTimeout(() => { viewed.add(pid); timers.delete(pid); api().feed_signal(pid, 'view'); }, 2500));
        } else if (timers.has(pid)) { clearTimeout(timers.get(pid)); timers.delete(pid); }
      }
    }, { threshold: [0, .6] });
  }
  document.querySelectorAll('.fpost[data-pid]').forEach(el => { if (!el._obs) { el._obs = 1; postObserver.observe(el); } });
}

// Un archivo de una publicación terminó de descargarse
function homeAttReady(att) {
  for (const p of Object.values(HP)) p.atts = p.atts.map(a => a.id === att.id ? att : a);
  shortsAttReady(att);
  document.querySelectorAll(`[data-matt="${CSS.escape(att.id)}"]`).forEach(el => {
    const more = el.querySelector('.mmore');
    el.outerHTML = mediaCell(att, el.dataset.pid, more ? more.outerHTML : '');
  });
}
function homeAttProgress(id, p) {
  document.querySelectorAll(`[data-matt="${CSS.escape(id)}"] .prog`).forEach(el => el.textContent = `Cargando... ${Math.round(p * 100)}%`);
}

// ---------- Panel derecho: sugerencias ----------
let lastPersonName = '';
async function renderHomeRight() {
  const box = $('right');
  if (homePerson) return renderHomePerson();
  const p = S.me.profile;
  const meCard = `<div class="hme">${avatarHtml(p, 56, p.status)}<div class="ci"><b>${esc(p.name)}</b><div class="mono" style="font-size:12px">${esc(S.me.pretty)}</div>
    <div class="row" style="gap:4px;margin-top:4px"><button class="btn small" data-a="edit">Editar perfil</button><button class="btn small" data-a="copy">Copiar código</button></div></div></div>`;
  box.innerHTML = `<div class="pcard" style="align-items:stretch;text-align:left">${meCard}<div class="hrec"><div class="fempty"><p>Cargando sugerencias...</p></div></div></div>`;
  const r = await api().home_recs();
  if (!isHome() || homePerson || !box.querySelector('.hrec')) return;
  const people = r.people.map(u => `<div class="hrow2">${avatarHtml(u, 38, 'online')}<div class="ci"><b data-person="${esc(u.code)}" style="cursor:pointer">${esc(u.name)}</b>
    <div class="tm">Activo ${ago(u.ts)}</div></div><button class="btn small" data-addc="${esc(u.pretty)}">＋ Agregar</button></div>`).join('');
  const forums = r.forums.map(f => `<div class="hrow2">${forumIcon(f, 38)}<div class="ci"><b>${esc(f.name)}</b><div class="tm">${esc(f.desc || 'Foro público')}</div></div>
    <button class="btn small" data-fjoin="${esc(f.fid)}">Unirse</button></div>`).join('');
  box.querySelector('.hrec').innerHTML =
    `<div class="psec"><h4>${emoImg('people', 14)} Personas sugeridas</h4>${people || '<p class="small">Cuando haya más gente publicando, aparecerán aquí.</p>'}</div>` +
    `<div class="psec"><h4>${emoImg('forum', 14)} Foros sugeridos</h4>${forums || '<p class="small">No hay foros públicos nuevos ahora mismo.</p>'}</div>` +
    `<div class="psec"><h4>${emoImg('star', 14)} Categorías populares</h4><div class="chips">${CATS.filter(c => c[0]).slice(0, 8).map(c =>
      `<a href="#" class="optchip" data-hf="c:${c[0]}">${emoImg(c[2], 15)} ${c[1]}</a>`).join('')}</div></div>`;
}
function renderHomePerson() {
  const code = homePerson;
  const posts = Object.values(HP).filter(p => p.author.code === code);
  const a = posts[0]?.author || (S.contacts[code] && { ...S.contacts[code].profile, pretty: S.contacts[code].pretty }) || { name: 'Persona', pretty: code, avatar: {} };
  lastPersonName = a.name;
  const isMe = code === S.me.code, contact = S.contacts[code];
  const action = isMe ? '<div class="small">Eres tú.</div>'
    : contact ? `<button class="btn small" data-chat2="${esc(code)}">Abrir chat</button>`
    : `<button class="btn small" data-addc="${esc(a.pretty)}">＋ Agregar a contactos</button>`;
  $('right').innerHTML = `<div class="pcard"><div class="tag">Perfil</div>${avatarHtml(a, 110, 'online')}<div class="pname">${esc(a.name)}</div>
    <div class="psec"><h4>Código personal</h4><p class="mono">${esc(a.pretty)}</p></div>
    <div class="pbtns">${action}<button class="btn small" data-hf2="u:${esc(code)}">Ver sus publicaciones</button><button class="btn small" data-hback>← Volver</button></div></div>`;
}
$('right').addEventListener('click', e => {
  if (!isHome()) return;
  const t = e.target;
  if (t.closest('[data-hback]')) { homePerson = null; renderRight(); }
  if (t.closest('[data-person]')) { homePerson = t.closest('[data-person]').dataset.person; renderRight(); }
  if (t.closest('[data-chat2]')) { leftTab = 'contactos'; select(t.closest('[data-chat2]').dataset.chat2); }
  if (t.closest('[data-hf2]')) setHomeFilter(t.closest('[data-hf2]').dataset.hf2);
  const hf = t.closest('[data-hf]');
  if (hf) { e.preventDefault(); setHomeFilter(hf.dataset.hf); }
});

// ---------- Eventos desde Python ----------
function onHomeEvent(e) {
  switch (e.t) {
    case 'feed_post':
      if (!isHome() || !$('feed') || HP[e.post.id]) return;
      if (!Object.keys(HP).length || !e.fresh) {  // al arrancar llegan las guardadas en el servidor: recargamos en bloque
        clearTimeout(homeReloadT);
        homeReloadT = setTimeout(() => { if (isHome() && !$('hText')?.value && !homePending.length) renderHome(); }, 900);
        return;
      }
      homeNew++;
      $('newpill').hidden = false;
      $('newpill').textContent = `${homeNew} ${homeNew === 1 ? 'publicación nueva' : 'publicaciones nuevas'} · Ver`;
      break;
    case 'feed_like':
      if (HP[e.pid]) { HP[e.pid].likes = e.likes; HP[e.pid].liked = e.liked; updateLike(e.pid, e.likes, e.liked); }
      break;
    case 'feed_comment':
      if (e.removed) document.querySelector(`.cmt[data-cid="${CSS.escape(e.removed)}"]`)?.remove();
      else addComment(e.pid, e.c, e.count);
      if (e.c && !e.c.mine && HP[e.pid]?.mine) notify(`${e.c.author.name} comentó tu publicación`, e.c.text.slice(0, 100), e.c.author, 'online', null);
      break;
    case 'feed_del':
      removeHomePost(e.pid); break;
  }
}
$('center').addEventListener('click', e => { if (e.target.closest('#newpill')) { homeNew = 0; renderHome(); } });
