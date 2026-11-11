// Versión web: imita window.pywebview.api hablando con el servidor (/api) y recibe eventos por /events.
// Lo que en escritorio hace Windows (elegir archivos, guardar, copiar, notificaciones...) aquí lo hace el navegador.
(() => {
  window.WEB = true;
  document.documentElement.classList.add('web');

  const call = (m, a) => fetch('api', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ m, a }) })
    .then(async r => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || ('Error ' + r.status));
      return j.r;
    });

  function upload(files, voice) {
    const fd = new FormData();
    for (const f of files) fd.append('f', f, f.name || 'archivo');
    if (voice) fd.append('voice', '1');
    return fetch('upload', { method: 'POST', body: fd, credentials: 'same-origin' }).then(r => r.json()).then(j => j.r || []);
  }
  window.webUpload = upload;

  function pickFiles(kind) {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.multiple = true;
      inp.accept = { image: 'image/*', audio: 'audio/*', video: 'video/*', media: 'image/*,video/*' }[kind] || '';
      inp.onchange = () => upload([...inp.files].slice(0, 10)).then(resolve);
      inp.click();
    });
  }

  let lastShake = 0;
  const local = {
    pick_files: kind => pickFiles(kind),
    prepare_blob: (b64, name, mime, voice) => {
      const bin = atob(b64), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return upload([new File([arr], name, { type: mime || '' })], voice).then(r => r[0]);
    },
    save_att: id => { const a = document.createElement('a'); a.href = 'download/' + encodeURIComponent(id); a.download = ''; a.click(); return true; },
    open_att: id => { window.open('download/' + encodeURIComponent(id), '_blank'); return ''; },
    open_url: url => { window.open(url, '_blank', 'noopener'); return true; },
    copy: text => navigator.clipboard ? navigator.clipboard.writeText(text) : null,
    shake: () => {
      if (Date.now() - lastShake < 600) return;
      lastShake = Date.now();
      document.body.classList.remove('shaking'); void document.body.offsetWidth; document.body.classList.add('shaking');
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    },
    toast: d => webToast(d),
    minimize: () => null, toggle_maximize: () => null, focus: () => null,
    quit: () => { document.body.innerHTML = '<p style="font:16px Segoe UI;padding:30px">Puedes cerrar esta pestaña. Tu sesión sigue iniciada.</p>'; },
    web_start: () => ({ ok: false, msg: 'Ya estás en la versión web.' }), web_info: () => null
  };
  window.WEBAPI = new Proxy({}, { get: (_, m) => (...a) => local[m] ? Promise.resolve(local[m](...a)) : call(m, a) });

  // Notificaciones dentro de la página (y del sistema si se permite)
  function webToast(d) {
    let box = document.getElementById('webtoasts');
    if (!box) { box = document.createElement('div'); box.id = 'webtoasts'; document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = 'webtoast';
    el.innerHTML = `${avatarHtml(d.profile || {}, 40, d.status)}<div><b>${esc(d.title)}</b><div>${fmt(d.text || '')}</div></div>`;
    el.onclick = () => { if (d.code && window.selectContact) selectContact(d.code); el.remove(); };
    box.appendChild(el);
    setTimeout(() => el.remove(), 6000);
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification(d.title, { body: String(d.text || '').slice(0, 120) }); } catch (e) { /* sin notificación */ }
    }
  }
  document.addEventListener('click', () => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  }, { once: true });

  // Eventos en vivo
  function connect() {
    const es = new EventSource('events');
    es.onmessage = e => {
      const ev = JSON.parse(e.data);
      if (ev.t === 'reload') return location.reload();
      if (window.onEvent) window.onEvent(ev);
    };
    es.onerror = () => { if (es.readyState === 2) setTimeout(connect, 3000); };
  }
  window.addEventListener('load', () => setTimeout(connect, 300));
})();
