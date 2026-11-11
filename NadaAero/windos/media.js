// Adjuntos, stickers, notas de voz y visor de imágenes (compartido por chats y foros)
const MIC_HTTPS_MSG = 'El navegador solo deja usar el micrófono en páginas seguras (https).<br>' +
  'Abre la versión web con el enlace https (el de VS Code) en lugar de la dirección http de tu red.';
const fmtSize = n => n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
const KIND_ICON = { image: 'picture', gif: 'picture', audio: 'note', voice: 'mic', video: 'video', file: 'doc' };
const ATT = {};                 // id -> última vista conocida del adjunto
const fetching = new Set();     // adjuntos de foros ya pedidos

// ---------- Mostrar un adjunto ----------
function attHtml(att, fid) {
  if (!att) return '';
  const a = ATT[att.id] = { ...(ATT[att.id] || {}), ...att, url: att.url || (ATT[att.id] || {}).url };
  const data = `data-att="${esc(a.id)}"${fid ? ` data-fid="${esc(fid)}"` : ''}`;
  if (!a.url) {
    const auto = fid && (a.kind === 'image' || a.kind === 'gif' || a.kind === 'voice') && a.size <= 6 * 1048576;
    if (auto) fetchForumAtt(fid, a.id);
    const what = fid ? (auto || fetching.has(a.id) ? 'Descargando...' : '<a href="#" data-fetch>Descargar</a>') : 'Recibiendo...';
    return `<div class="att pending" ${data}>${emoImg(KIND_ICON[a.kind] || 'doc', 26)}<div class="ai"><b>${esc(a.name)}</b><span>${fmtSize(a.size)} · <span class="prog">${what}</span></span></div></div>`;
  }
  const url = esc(a.url);
  switch (a.kind) {
    case 'image': case 'gif':
      return `<img class="attimg" ${data} src="${url}" alt="" title="${esc(a.name)}" loading="lazy">`;
    case 'voice': case 'audio':
      return `<div class="att player" ${data}>${playerHtml(a.url, a.kind, a.name)}</div>`;
    case 'video':
      return `<div class="att player vid" ${data}>${playerHtml(a.url, 'video', a.name)}<div class="cap">${esc(a.name)} · ${fmtSize(a.size)}</div></div>`;
    default:
      return `<div class="att file" ${data}>${emoImg('doc', 32)}<div class="ai"><b>${esc(a.name)}</b><span>${fmtSize(a.size)}</span></div>` +
        `<button class="btn small" data-open>Abrir</button><button class="btn small" data-save>Guardar</button></div>`;
  }
}
const stickerHtml = id => RETRO.STK[id] ? `<img class="sticker" src="${RETRO.STK[id].src}" alt="${esc(RETRO.STK[id].name)}" title="${esc(RETRO.STK[id].name)}" draggable="false">` : '';

function fetchForumAtt(fid, id) {
  if (fetching.has(id)) return;
  fetching.add(id);
  (fid === 'feed' ? api().feed_fetch_att(id) : api().forum_fetch_att(fid, id)).then(v => { if (v && v.url) onAttReady(v); });
}

// Un adjunto terminó de llegar: se redibuja donde aparezca
function onAttReady(att) {
  ATT[att.id] = { ...(ATT[att.id] || {}), ...att };
  document.querySelectorAll(`[data-att="${CSS.escape(att.id)}"]`).forEach(el => {
    el.outerHTML = attHtml(ATT[att.id], el.dataset.fid);
  });
  if (typeof onAttReadyHook === 'function') onAttReadyHook(att);
}
function onAttProgress(id, p) {
  document.querySelectorAll(`[data-att="${CSS.escape(id)}"] .prog`).forEach(el => el.textContent = `Recibiendo... ${Math.round(p * 100)}%`);
}

// Botones de los adjuntos y visor de imágenes
document.addEventListener('click', async e => {
  const box = e.target.closest('[data-att]');
  if (!box) return;
  const id = box.dataset.att;
  if (e.target.matches('img.attimg')) return openViewer(id);
  if (e.target.closest('[data-fetch]')) { e.preventDefault(); fetchForumAtt(box.dataset.fid, id); e.target.closest('.prog').textContent = 'Descargando...'; }
  if (e.target.closest('[data-save]')) api().save_att(id);
  if (e.target.closest('[data-open]')) { const err = await api().open_att(id); if (err) dialog(esc(err), { icon: '!' }); }
});

function openViewer(id) {
  const a = ATT[id];
  if (!a || !a.url) return;
  $('viewer').innerHTML = `<img src="${esc(a.url)}" alt=""><div class="vbar"><span>${esc(a.name)} · ${fmtSize(a.size)}</span>` +
    `<button class="btn small" id="vSave">Guardar...</button><button class="btn small" id="vClose">Cerrar</button></div>`;
  $('viewer').classList.add('show');
  $('vSave').onclick = () => api().save_att(id);
  $('vClose').onclick = () => $('viewer').classList.remove('show');
}
$('viewer').addEventListener('click', e => { if (e.target.id === 'viewer') $('viewer').classList.remove('show'); });

// ---------- Selector de emoticonos y stickers ----------
const PICKER = EMO_CODES.filter(([k]) => k !== '<3');
let pickerCb = null;
function openPicker(anchor, cb, emoOnly = false) {
  pickerCb = cb;
  const p = $('picker');
  p.innerHTML = `<div class="ptabs"><span data-pt="emo" class="on">Emoticonos</span>${emoOnly ? '' : '<span data-pt="stk">Stickers</span>'}</div>` +
    `<div class="pgrid emo">${PICKER.map(([k, n]) => `<span data-k="${esc(k)}" title="${esc(k)}">${emoImg(n, 24)}</span>`).join('')}</div>` +
    `<div class="pgrid stk" hidden>${RETRO.STK_ORDER.map(id => `<span data-s="${id}" title="${esc(RETRO.STK[id].name)}"><img src="${RETRO.STK[id].src}" alt=""></span>`).join('')}</div>`;
  const r = anchor.getBoundingClientRect();
  p.style.left = Math.max(8, Math.min(r.left, innerWidth - 400)) + 'px';
  p.style.bottom = (innerHeight - r.top + 6) + 'px';
  p.classList.add('show');
}
$('picker').addEventListener('click', e => {
  e.stopPropagation();
  const tab = e.target.closest('[data-pt]');
  if (tab) {
    $('picker').querySelectorAll('[data-pt]').forEach(t => t.classList.toggle('on', t === tab));
    $('picker').querySelector('.emo').hidden = tab.dataset.pt !== 'emo';
    $('picker').querySelector('.stk').hidden = tab.dataset.pt !== 'stk';
    return;
  }
  const k = e.target.closest('[data-k]'), s = e.target.closest('[data-s]');
  if (k && pickerCb) pickerCb({ code: k.dataset.k });
  if (s && pickerCb) { pickerCb({ sticker: s.dataset.s }); $('picker').classList.remove('show'); }
});
document.addEventListener('click', () => { $('picker').classList.remove('show'); $('attmenu').classList.remove('show'); });

// ---------- Compositor reutilizable (chat, nuevo tema, respuesta) ----------
// opts: { title, placeholder, sendLabel, extraTools, onSend({text,title,att,sticker}) -> Promise<bool>, onTool(name), onTyping() }
function composerHtml(id, opts = {}) {
  return `<div class="composer" id="${id}">
    ${opts.title ? '<input type="text" class="ctitle" placeholder="Título del tema" maxlength="120">' : ''}
    <div class="pend"></div>
    <div class="ctools">
      <div class="tool" data-c="emo" title="Emoticonos y stickers">${emoImg('smile', 20)}</div>
      <div class="tool" data-c="attach" title="Adjuntar imágenes, GIF, música, vídeo o archivos">${emoImg('clip', 20)}Adjuntar</div>
      <div class="tool" data-c="voice" title="Grabar una nota de voz">${emoImg('mic', 20)}<span class="vlabel">Nota de voz</span></div>
      ${opts.extraTools || ''}
    </div>
    <div class="crow"><textarea placeholder="${esc(opts.placeholder || 'Escribe un mensaje...')}"></textarea><button class="btn" data-c="send">${esc(opts.sendLabel || 'Enviar')}</button></div>
  </div>`;
}

function wireComposer(id, opts) {
  const root = $(id), ta = root.querySelector('textarea'), pendEl = root.querySelector('.pend');
  const st = { pending: [], rec: null };
  root._st = st;

  const renderPend = () => {
    pendEl.innerHTML = st.pending.map((a, i) => `<div class="pchip">${a.kind === 'image' || a.kind === 'gif' ? `<img src="${esc(a.url)}" alt="">` : emoImg(KIND_ICON[a.kind] || 'doc', 20)}` +
      `<span>${esc(a.name)} <small>${fmtSize(a.size)}</small></span><b data-rm="${i}" title="Quitar">✕</b></div>`).join('');
  };
  const addAtts = list => {
    for (const a of list || []) {
      if (!a) continue;
      if (a.error) dialog(esc(a.error), { icon: '!' });
      else { ATT[a.id] = a; st.pending.push(a); }
    }
    renderPend();
  };
  pendEl.addEventListener('click', e => { const i = e.target.dataset.rm; if (i != null) { st.pending.splice(+i, 1); renderPend(); } });

  async function send(extra = {}) {
    const text = ta.value, title = root.querySelector('.ctitle')?.value || '';
    if (!extra.sticker && !extra.att && !text.trim() && !st.pending.length && !title.trim()) return;
    if (extra.sticker || extra.att) return opts.onSend({ text: '', title, ...extra });
    const atts = st.pending.splice(0);
    renderPend();
    const ok = await opts.onSend({ text, title, att: atts[0] && atts[0].id });
    if (ok === false) { st.pending.unshift(...atts); renderPend(); return; }
    ta.value = '';
    if (root.querySelector('.ctitle')) root.querySelector('.ctitle').value = '';
    for (const a of atts.slice(1)) await opts.onSend({ text: '', title: '', att: a.id });
  }
  root._send = send;

  root.querySelector('.ctools').addEventListener('click', e => {
    const t = e.target.closest('[data-c]');
    if (!t) return;
    e.stopPropagation();
    const c = t.dataset.c;
    if (c === 'emo') openPicker(t, r => {
      if (r.code) { const p = ta.selectionStart; ta.value = ta.value.slice(0, p) + r.code + ta.value.slice(ta.selectionEnd); ta.focus(); ta.selectionStart = ta.selectionEnd = p + r.code.length; }
      if (r.sticker) send({ sticker: r.sticker });
    });
    else if (c === 'attach') openAttachMenu(t, kind => api().pick_files(kind).then(addAtts));
    else if (c === 'voice') toggleVoice(t, st, att => send({ att: att.id }));
    else if (opts.onTool) opts.onTool(c);
  });
  root.querySelector('[data-c="send"]').onclick = () => send();
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  if (opts.onTyping) ta.addEventListener('input', opts.onTyping);

  // Pegar imágenes desde el portapapeles y arrastrar archivos
  ta.addEventListener('paste', e => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); blobsToAtts(files).then(addAtts); }
  });
  const dropZone = opts.dropZone || root;
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('dragover');
    blobsToAtts([...e.dataTransfer.files]).then(addAtts);
  });
  return root;
}

function openAttachMenu(anchor, cb) {
  const m = $('attmenu');
  m.innerHTML = [['image', 'picture', 'Imagen o GIF'], ['audio', 'note', 'Música o audio'], ['video', 'video', 'Vídeo'], ['any', 'doc', 'Cualquier archivo']]
    .map(([k, ic, l]) => `<div data-k="${k}">${emoImg(ic, 20)} ${l}</div>`).join('') +
    `<div class="mnote">Hasta ${Math.round((S.limits?.max_file || 20971520) / 1048576)} MB por archivo</div>`;
  const r = anchor.getBoundingClientRect();
  m.style.left = r.left + 'px';
  m.style.bottom = (innerHeight - r.top + 6) + 'px';
  m.classList.add('show');
  m.onclick = e => { const k = e.target.closest('[data-k]'); if (k) { m.classList.remove('show'); cb(k.dataset.k); } };
}

const blobToB64 = blob => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result).split(',')[1] || '');
  fr.onerror = rej;
  fr.readAsDataURL(blob);
});
async function blobsToAtts(files) {
  if (window.webUpload) return window.webUpload(files.slice(0, 10));  // versión web: subida directa
  const out = [];
  for (const f of files.slice(0, 10)) {
    if (f.size > (S.limits?.max_file || 20971520)) { out.push({ error: `«${f.name}» es demasiado grande.` }); continue; }
    out.push(await api().prepare_blob(await blobToB64(f), f.name || 'imagen.png', f.type || ''));
  }
  return out;
}

// ---------- Notas de voz ----------
async function toggleVoice(btn, st, onDone) {
  if (st.rec) { st.rec.stop(); return; }
  let stream;
  if (!window.isSecureContext || !navigator.mediaDevices) return dialog(MIC_HTTPS_MSG, { icon: '!' });
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (e) { return dialog('No se pudo usar el micrófono. Revisa que esté conectado y que hayas dado permiso.', { icon: '!' }); }
  // Safari (iPhone) no graba webm: se usa lo que el navegador soporte
  const mt = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  const chunks = [], rec = new MediaRecorder(stream, mt ? { mimeType: mt } : undefined);
  const ext = (rec.mimeType || mt).includes('mp4') || (rec.mimeType || mt).includes('aac') ? 'm4a' : 'webm';
  const t0 = Date.now(), label = btn.querySelector('.vlabel');
  st.rec = rec;
  btn.classList.add('recording');
  const tick = setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    label.textContent = `Grabando ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · clic para enviar`;
    if (s >= 300) rec.stop();
  }, 250);
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = async () => {
    clearInterval(tick);
    stream.getTracks().forEach(t => t.stop());
    st.rec = null;
    btn.classList.remove('recording');
    label.textContent = 'Nota de voz';
    if (Date.now() - t0 < 700) return;
    const type = rec.mimeType || mt || 'audio/webm';
    const blob = new Blob(chunks, { type });
    const fname = `Nota de voz ${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }).replace(':', '.')}.${ext}`;
    const att = window.webUpload ? (await window.webUpload([new File([blob], fname, { type })], true))[0]
      : await api().prepare_blob(await blobToB64(blob), fname, type, true);
    if (att && !att.error) { ATT[att.id] = att; onDone(att); }
  };
  rec.start();
}
