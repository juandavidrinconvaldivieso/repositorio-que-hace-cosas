// Foros: públicos (aparecen en Explorar) y privados (solo con su nombre exacto o su código)
const FC = {};            // fid -> { posts: {id: publicación} }
let curThread = null;     // tema abierto dentro del foro
let rightAuthor = null;   // autor que se muestra en el panel derecho
let exploreQ = '';
let newTopicOpen = false;

const fidOf = () => sel && sel.startsWith('forum:') ? sel.slice(6) : null;
const forumIcon = (f, size) => `<div class="avatar ficon" style="--s:${size}px"><img src="${(RETRO.AV[f.icon] || RETRO.AV.globe).src}" alt="" draggable="false"></div>`;
const privTag = f => `<span class="ftag ${f.private ? 'priv' : ''}">${f.private ? emoImg('lock', 12) + ' Privado' : 'Público'}</span>`;
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'ahora mismo';
  if (m < 60) return `hace ${m} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}
const dateTime = ts => new Date(ts).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// ---------- Columna izquierda ----------
function forumRow(f) {
  return `<div class="contact ${sel === 'forum:' + f.fid ? 'sel' : ''}" data-forum="${esc(f.fid)}">${forumIcon(f, 34)}
    <div class="ci"><div class="nm"><span>${esc(f.name)}</span>${f.private ? emoImg('lock', 13) : ''}${f.unread ? `<span class="badge">${f.unread}</span>` : ''}</div>
    <div class="pm">${f.threads} ${f.threads === 1 ? 'tema' : 'temas'}${f.desc ? ' · ' + esc(f.desc) : ''}</div></div></div>`;
}
function renderForumList() {
  const q = $('q').value.trim().toLowerCase();
  const fs = Object.values(S.forums).filter(f => fmatch(f, q) > 0).sort((a, b) => b.last - a.last);
  $('list').innerHTML = `<div class="fbtns"><button class="btn small ${sel === 'explore' ? 'on' : ''}" data-fx="explore">${emoImg('search', 14)} Explorar foros</button>` +
    `<button class="btn small" data-fx="create">＋ Crear foro</button></div>` +
    group('fmine', `Mis foros (${fs.length})`, fs.map(forumRow), q ? '' : 'Todavía no estás en ningún foro. Explora los públicos o crea el tuyo.');
}

// ---------- Abrir un foro / tema ----------
async function openForum(fid, tid = null) {
  sel = 'forum:' + fid;
  curThread = tid;
  rightAuthor = null;
  newTopicOpen = false;
  const r = await api().forum_get(fid);
  if (!r) { delete S.forums[fid]; return select(null); }
  S.forums[fid] = r.forum;
  FC[fid] = { posts: Object.fromEntries(r.posts.map(p => [p.id, p])) };
  renderList(); renderRight(); renderCenter();
}
function openThread(tid) { curThread = tid; rightAuthor = null; renderCenter(); renderRight(); }

function threadsOf(fid) {
  const posts = Object.values(FC[fid].posts);
  return posts.filter(p => p.kind === 't').map(t => {
    const replies = posts.filter(r => r.kind === 'r' && r.tid === t.id);
    return { t, replies, last: Math.max(t.ts, ...replies.map(r => r.ts)) };
  }).sort((a, b) => b.last - a.last);
}

function renderForumCenter() {
  const fid = fidOf(), f = S.forums[fid], fc = FC[fid];
  if (!f || !fc) { $('center').innerHTML = '<div class="welcome"><p>Cargando foro...</p></div>'; return; }
  if (curThread && fc.posts[curThread]) return renderThread(fid, curThread);
  curThread = null;
  const threads = threadsOf(fid);
  $('center').innerHTML = `
    <div class="fhead">${forumIcon(f, 52)}<div class="who"><div class="fname">${esc(f.name)} ${privTag(f)}</div><div class="fdesc">${f.desc ? fmt(f.desc) : '<i>Sin descripción.</i>'}</div></div>
      <button class="bigbtn small" id="fNew">${emoImg('forum', 18)} Nuevo tema</button></div>
    <div class="fbody" id="fbody">
      <div class="newtopic" id="newTopic" ${newTopicOpen ? '' : 'hidden'}>
        ${composerHtml('fcomp', { title: true, placeholder: 'Escribe tu tema. Puedes añadir imágenes, GIF, música, vídeos, stickers...', sendLabel: 'Publicar' })}</div>
      <div id="tlist">${threads.length ? threads.map(threadCard).join('') : `<div class="fempty">${emoImg('forum', 48)}<p>Todavía no hay temas. ¡Escribe el primero!</p></div>`}</div>
    </div>`;
  $('fNew').onclick = () => { newTopicOpen = !newTopicOpen; $('newTopic').hidden = !newTopicOpen; if (newTopicOpen) $('fcomp').querySelector('.ctitle').focus(); };
  wireComposer('fcomp', {
    onSend: async ({ text, title, att, sticker }) => {
      if (!title.trim()) { dialog('Ponle un título al tema.', { icon: '!' }); return false; }
      const r = await api().forum_post(fid, null, title, text, att || null, sticker || null);
      if (r.error) { dialog(esc(r.error), { icon: '!' }); return false; }
      addPost(r.post, r.f);
      newTopicOpen = false;
      renderForumCenter();
      return true;
    }
  });
}

function threadCard({ t, replies, last }) {
  const extra = t.att ? `${emoImg(KIND_ICON[t.att.kind] || 'doc', 15)} ` : t.sticker ? `${emoImg('sticker', 15)} ` : '';
  return `<div class="tcard" data-thread="${esc(t.id)}">${avatarHtml(t.author, 40, 'online')}
    <div class="ci"><div class="tt">${esc(t.title)}</div>
    <div class="tsn">${extra}${fmt(t.text.slice(0, 160))}</div>
    <div class="tm">por <b>${esc(t.author.name)}</b> · ${ago(t.ts)} · ${replies.length} ${replies.length === 1 ? 'respuesta' : 'respuestas'}${replies.length ? ' · última ' + ago(last) : ''}</div></div></div>`;
}

function postCard(p) {
  const f = S.forums[p.fid];
  return `<div class="post ${p.kind === 't' ? 'op' : ''}" data-post="${esc(p.id)}">
    <div class="pa" data-author="${esc(p.author.code)}" title="Ver perfil">${avatarHtml(p.author, 46, 'online')}<b>${esc(p.author.name)}</b>${f && p.author.code === f.owner ? '<span class="ftag">Creador</span>' : ''}</div>
    <div class="pb"><div class="pmeta">${dateTime(p.ts)}</div>
      ${p.kind === 't' ? `<div class="ptitle">${esc(p.title)}</div>` : ''}
      ${p.text ? `<div class="ptext">${fmt(p.text)}</div>` : ''}
      ${p.sticker ? stickerHtml(p.sticker) : ''}
      ${p.att ? attHtml(p.att, p.fid) : ''}
      <div class="pact"><a href="#" data-reply>Responder</a>${p.can_del ? ' · <a href="#" data-del>Borrar</a>' : ''}</div>
    </div></div>`;
}

function renderThread(fid, tid) {
  const f = S.forums[fid], posts = Object.values(FC[fid].posts);
  const t = FC[fid].posts[tid];
  const list = [t, ...posts.filter(p => p.kind === 'r' && p.tid === tid).sort((a, b) => a.ts - b.ts)];
  $('center').innerHTML = `
    <div class="fhead slim"><button class="btn small" id="fBack">← ${esc(f.name)}</button><div class="who"><div class="fname">${esc(t.title)}</div></div></div>
    <div class="fbody" id="fbody">${list.map(postCard).join('')}</div>
    <div class="replybox">${composerHtml('rcomp', { placeholder: 'Escribe una respuesta...', sendLabel: 'Responder' })}</div>`;
  $('fBack').onclick = () => { curThread = null; renderCenter(); renderRight(); };
  wireComposer('rcomp', {
    dropZone: $('fbody'),
    onSend: async ({ text, att, sticker }) => {
      const r = await api().forum_post(fid, tid, '', text, att || null, sticker || null);
      if (r.error) { dialog(esc(r.error), { icon: '!' }); return false; }
      addPost(r.post, r.f);
      return true;
    }
  });
  $('fbody').scrollTop = $('fbody').scrollHeight;
}

function addPost(p, f) {
  if (f) S.forums[p.fid] = f;
  if (!FC[p.fid]) return;
  const isNew = !FC[p.fid].posts[p.id];
  FC[p.fid].posts[p.id] = p;
  if (fidOf() !== p.fid || !isNew) return;
  if (curThread && p.tid === curThread && p.kind === 'r' && $('fbody')) {
    $('fbody').insertAdjacentHTML('beforeend', postCard(p));
    $('fbody').scrollTop = $('fbody').scrollHeight;
  } else if (!curThread && $('tlist')) {
    const ths = threadsOf(p.fid);
    $('tlist').innerHTML = ths.map(threadCard).join('');
  }
  renderRight();
}

// Clics dentro de un foro (temas, autores, responder, borrar)
$('center').addEventListener('click', e => {
  const fid = fidOf();
  if (!fid) return;
  const th = e.target.closest('[data-thread]');
  if (th) return openThread(th.dataset.thread);
  const au = e.target.closest('[data-author]');
  if (au) { rightAuthor = au.dataset.author; return renderRight(); }
  const post = e.target.closest('[data-post]');
  if (!post) return;
  const p = FC[fid].posts[post.dataset.post];
  if (e.target.closest('[data-reply]')) {
    e.preventDefault();
    const ta = $('rcomp')?.querySelector('textarea');
    if (ta) { ta.value = `@${p.author.name} ` + ta.value; ta.focus(); }
  }
  if (e.target.closest('[data-del]')) {
    e.preventDefault();
    dialog(p.kind === 't' ? '¿Borrar este tema y sus respuestas?' : '¿Borrar esta respuesta?', { icon: '?', buttons: [['Borrar', async () => {
      if (await api().forum_delete(fid, p.id)) removePost(fid, p.id);
    }], ['Cancelar']] });
  }
});

function removePost(fid, pid, f) {
  if (f) S.forums[fid] = f;
  if (!FC[fid] || !FC[fid].posts[pid]) return;
  const p = FC[fid].posts[pid];
  delete FC[fid].posts[pid];
  if (p.kind === 't') for (const [id, r] of Object.entries(FC[fid].posts)) if (r.tid === pid) delete FC[fid].posts[id];
  if (fidOf() === fid) {
    if (curThread === pid) curThread = null;
    renderCenter(); renderRight();
  }
  renderList();
}

// ---------- Explorar ----------
async function openExplore() {
  sel = 'explore';
  curThread = rightAuthor = null;
  renderList(); renderRight(); renderCenter();
  for (const f of await api().forum_directory()) S.dir[f.fid] = f;
  if (sel === 'explore') renderExploreList();
}
function dirCard(f) {
  const joined = !!S.forums[f.fid];
  return `<div class="ecard">${forumIcon(f, 50)}<div class="ci"><b>${esc(f.name)}</b> ${privTag(f)}
    <div class="fdesc">${f.desc ? fmt(f.desc) : '<i>Sin descripción.</i>'}</div>
    <div class="tm">Creado por ${esc(f.owner_name || f.owner)} · <span class="mono">${esc(f.code)}</span></div></div>
    ${joined ? `<button class="btn small" data-fopen="${esc(f.fid)}">Abrir</button>` : `<button class="btn small" data-fjoin="${esc(f.fid)}">Unirse</button>`}</div>`;
}
// Búsqueda: sin mayúsculas ni tildes, por palabras sueltas, en nombre, descripción y creador
const normQ = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
function fmatch(f, q) {
  const words = normQ(q).split(' ').filter(Boolean);
  if (!words.length) return 1;
  const name = normQ(f.name), all = `${name} ${normQ(f.desc)} ${normQ(f.owner_name)} ${normQ(f.code)}`;
  if (!words.every(w => all.includes(w))) return 0;
  return (name === words.join(' ') ? 100 : 0) + (name.startsWith(words[0]) ? 20 : 0) + words.filter(w => name.includes(w)).length * 5 + 1;
}
let privT = 0, privSeq = 0;
function renderExplore() {
  $('center').innerHTML = `
    <div class="fhead">${emoImg('search', 44)}<div class="who"><div class="fname">Explorar foros</div>
      <div class="fdesc">Busca por nombre, tema o creador. Los privados aparecen al escribir su nombre completo o su código.</div></div>
      <button class="bigbtn small" data-fx="create">＋ Crear foro</button></div>
    <div class="fbody">
      <div class="esearch"><input type="text" id="eQ" placeholder="Buscar foros: nombre, tema, creador o código FORO-..." value="${esc(exploreQ)}" spellcheck="false"></div>
      <div id="eFound"></div>
      <div id="eList"></div>
    </div>`;
  $('eQ').oninput = () => { exploreQ = $('eQ').value; renderExploreList(); schedulePrivate(); };
  $('eQ').onkeydown = e => { if (e.key === 'Enter') { clearTimeout(privT); findPrivate(); } };
  $('eQ').focus();
  renderExploreList();
  schedulePrivate();
}
function renderExploreList() {
  if (!$('eList')) return;
  const list = Object.values(S.dir).map(f => [fmatch(f, exploreQ), f]).filter(x => x[0] > 0)
    .sort((a, b) => b[0] - a[0] || b[1].ts - a[1].ts).map(x => x[1]);
  $('eList').innerHTML = `<div class="group" style="padding-left:0">Foros públicos (${list.length})</div>` +
    (list.map(dirCard).join('') || `<div class="fempty"><p>${exploreQ.trim() ? 'Ningún foro público coincide.' : 'Todavía no hay foros públicos. ¡Crea el primero!'}</p></div>`);
}
// Los privados se buscan solos (nombre completo o código) un momento después de dejar de escribir
function schedulePrivate() {
  clearTimeout(privT);
  if ($('eFound')) $('eFound').innerHTML = '';
  if (normQ(exploreQ).length >= 3) privT = setTimeout(findPrivate, 700);
}
async function findPrivate() {
  const q = exploreQ.trim(), seq = ++privSeq;
  if (normQ(q).length < 3 || !$('eFound')) return;
  $('eFound').innerHTML = `<div class="small" style="padding:4px 0">${emoImg('lock', 12)} Buscando también foros privados con ese nombre...</div>`;
  const r = await api().forum_find(q);
  if (seq !== privSeq || !$('eFound')) return;
  $('eFound').innerHTML = r.ok && !S.dir[r.forum.fid]
    ? `<div class="group" style="padding-left:0">${r.forum.private ? emoImg('lock', 14) + ' Foro privado encontrado' : 'Resultado'}</div>${dirCard(r.forum)}` : '';
}async function joinForum(fid) {
  const f = await api().forum_join(fid);
  if (!f) return dialog('No se pudo unir a ese foro. Vuelve a buscarlo.', { icon: '!' });
  S.forums[fid] = f;
  if (S.dir[fid]) S.dir[fid].joined = true;
  sounds.online();
  leftTab = 'foros'; renderTabs();
  openForum(fid);
}
document.addEventListener('click', e => {
  const j = e.target.closest('[data-fjoin]'), o = e.target.closest('[data-fopen]'), x = e.target.closest('[data-fx]');
  if (j) joinForum(j.dataset.fjoin);
  if (o) { leftTab = 'foros'; renderTabs(); openForum(o.dataset.fopen); }
  if (x) x.dataset.fx === 'explore' ? openExplore() : openCreateForum();
});

// ---------- Crear un foro ----------
let fcIcon = 'globe';
function openCreateForum() {
  fcIcon = 'globe';
  $('fcName').value = ''; $('fcDesc').value = '';
  $('fcPublic').checked = true;
  $('fcIcons').innerHTML = RETRO.AV_ORDER.filter(id => id !== 'nada').map(id => `<div class="avopt ${id === fcIcon ? 'on' : ''}" data-ic="${id}" title="${esc(RETRO.AV[id].name)}"><img src="${RETRO.AV[id].src}" alt=""></div>`).join('');
  $('fcreate').classList.add('show');
  $('fcName').focus();
}
$('fcIcons').onclick = e => {
  const o = e.target.closest('[data-ic]'); if (!o) return;
  fcIcon = o.dataset.ic;
  $('fcIcons').querySelectorAll('.avopt').forEach(x => x.classList.toggle('on', x === o));
};
$('fcCancel').onclick = $('fcX').onclick = () => $('fcreate').classList.remove('show');
$('fcOk').onclick = async () => {
  const btn = $('fcOk');
  btn.disabled = true;
  const r = await api().forum_create($('fcName').value, $('fcDesc').value, fcIcon, $('fcPrivate').checked);
  btn.disabled = false;
  if (!r.ok) return dialog(r.msg, { icon: '!' });
  $('fcreate').classList.remove('show');
  S.forums[r.forum.fid] = r.forum;
  leftTab = 'foros'; renderTabs();
  await openForum(r.forum.fid);
  dialog(`¡Foro creado! Su código es <b class="mono">${esc(r.forum.code)}</b>.<br>` +
    (r.forum.private ? 'Es privado: solo podrá entrar quien escriba su nombre exacto o este código.' : 'Es público: aparece en «Explorar foros» para todo el mundo.'),
    { title: 'Foro creado', icon: emoImg('forum', 34) });
};

// ---------- Panel derecho ----------
function renderForumRight() {
  const box = $('right');
  if (sel === 'explore') {
    box.innerHTML = `<div class="pcard"><div class="tag">Foros</div>${emoImg('forum', 96)}
      <div class="pname">¿Cómo funcionan?</div>
      <div class="psec"><h4>Públicos</h4><p>Aparecen en Explorar y cualquiera puede unirse.</p></div>
      <div class="psec"><h4>${emoImg('lock', 14)} Privados</h4><p>No aparecen en ninguna lista. Para entrar hay que escribir su nombre exacto o su código.</p></div>
      <div class="psec"><h4>Temas</h4><p>Cada foro tiene temas (mini foros) donde se escribe, se suben imágenes, GIF, música o archivos, y se responde.</p></div>
      <div class="psec"><h4>${emoImg('lock', 14)} Seguridad</h4><p>Todo va cifrado y cada publicación va firmada por su autor: nadie puede escribir en tu nombre.</p></div></div>`;
    return;
  }
  const fid = fidOf(), f = S.forums[fid];
  if (!f) { box.innerHTML = ''; return; }
  const posts = Object.values(FC[fid]?.posts || {});
  if (rightAuthor) {
    const mine = posts.filter(p => p.author.code === rightAuthor).sort((a, b) => b.ts - a.ts);
    const a = mine[0]?.author || { name: rightAuthor, code: rightAuthor, pretty: rightAuthor, avatar: {} };
    const isMe = rightAuthor === S.me.code, contact = S.contacts[rightAuthor];
    const action = isMe ? '<div class="small">Eres tú.</div>'
      : contact ? `<button class="btn small" data-chat="${esc(rightAuthor)}">Abrir chat</button>`
      : `<button class="btn small" data-addc="${esc(a.pretty)}">＋ Agregar a contactos</button>`;
    box.innerHTML = `<div class="pcard"><div class="tag">Autor</div>${avatarHtml(a, 110, 'online')}<div class="pname">${esc(a.name)}</div>
      ${rightAuthor === f.owner ? '<span class="ftag">Creador del foro</span>' : ''}
      <div class="psec"><h4>Código personal</h4><p class="mono">${esc(a.pretty)}</p></div>
      <div class="psec"><h4>En este foro</h4><p>${mine.filter(p => p.kind === 't').length} temas · ${mine.filter(p => p.kind === 'r').length} respuestas</p>
        ${mine[0] ? `<div class="small">Última actividad ${ago(mine[0].ts)}</div>` : ''}</div>
      <div class="pbtns">${action}<button class="btn small" data-back>← Info del foro</button></div></div>`;
    return;
  }
  box.innerHTML = `<div class="pcard"><div class="tag">Foro</div>${forumIcon(f, 110)}<div class="pname">${esc(f.name)}</div>${privTag(f)}
    ${f.desc ? `<div class="pmsg">${fmt(f.desc)}</div>` : ''}
    <div class="psec"><h4>Código del foro</h4><p class="mono">${esc(f.code)}</p><div class="small">${f.private ? 'Compártelo con quien quieras invitar.' : 'También sirve para encontrarlo directamente.'}</div></div>
    <div class="psec"><h4>Creado por</h4><p>${esc(f.owner_name || f.owner)}${f.owner === S.me.code ? ' (tú)' : ''}</p><div class="small">${new Date(f.ts).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
    <div class="psec"><h4>Actividad</h4><p>${posts.filter(p => p.kind === 't').length} temas · ${posts.filter(p => p.kind === 'r').length} respuestas</p></div>
    <div class="pbtns"><button class="btn small" data-fcopy>Copiar código</button><button class="btn small" data-fleave>Salir del foro</button></div></div>`;
}
$('right').addEventListener('click', async e => {
  const fid = fidOf();
  if (e.target.closest('[data-back]')) { rightAuthor = null; renderRight(); }
  if (e.target.closest('[data-chat]')) { leftTab = 'contactos'; renderTabs(); select(e.target.closest('[data-chat]').dataset.chat); }
  if (e.target.closest('[data-addc]')) { doAdd(e.target.closest('[data-addc]').dataset.addc); }
  if (e.target.closest('[data-fcopy]') && fid) { api().copy(S.forums[fid].code); e.target.textContent = '¡Copiado!'; }
  if (e.target.closest('[data-fleave]') && fid) dialog(`¿Salir de <b>${esc(S.forums[fid].name)}</b>?` + (S.forums[fid].private ? '<br>Para volver tendrás que buscarlo otra vez por su nombre o código.' : ''),
    { icon: '?', buttons: [['Salir', async () => { await api().forum_leave(fid); delete S.forums[fid]; delete FC[fid]; select(null); }], ['Cancelar']] });
});

// ---------- Eventos desde Python ----------
function onForumEvent(e) {
  switch (e.t) {
    case 'fpost': {
      const viewing = fidOf() === e.fid;
      addPost(e.post, e.f);
      if (viewing && document.hasFocus()) api().forum_mark_read(e.fid).then(f => { if (f) S.forums[e.fid] = f; renderList(); });
      else renderList();
      const op = FC[e.fid]?.posts[e.post.tid];
      if (e.fresh && !e.post.mine && e.post.kind === 'r' && op && op.mine) {
        sounds.msg();
        notify(`${e.post.author.name} respondió a tu tema`, `«${op.title}»: ${e.post.text.slice(0, 90)}`, e.post.author, 'online', null, !(viewing && curThread === op.id));
      }
      break;
    }
    case 'fdel': removePost(e.fid, e.pid, e.f); break;
    case 'forum':
      S.forums[e.f.fid] = e.f;
      if (fidOf() === e.f.fid && !curThread && !newTopicOpen) renderCenter();
      renderList();
      break;
    case 'fdir':
      S.dir[e.f.fid] = e.f;
      if (sel === 'explore') renderExploreList();
      break;
  }
}
