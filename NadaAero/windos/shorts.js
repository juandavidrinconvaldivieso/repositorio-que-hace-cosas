// Cortos: vídeos verticales a pantalla completa, uno tras otro (se pasa con la rueda o deslizando)
let shortsObs = null;
const watched = new Set();

async function renderShorts() {
  $('center').innerHTML = `<div class="shorts" id="shorts"><div class="fempty" style="color:#cfe2f5"><p>Cargando cortos...</p></div></div>`;
  const list = await api().feed_get('short');
  if (!isHome() || homeFilter !== 'short' || !$('shorts')) return;
  for (const p of list) HP[p.id] = p;
  $('shorts').innerHTML = list.map(shortHtml).join('') || `<div class="fempty" style="color:#cfe2f5">${emoImg('video', 56)}
    <p>Todavía no hay cortos.<br>Publica un vídeo desde Inicio y marca «Publicar como corto».</p><p><button class="btn" data-hf="">← Volver a Inicio</button></p></div>`;
  observeShorts();
}

function shortVideo(p) {
  const a = ATT[p.atts[0].id] = { ...(ATT[p.atts[0].id] || {}), ...p.atts[0], url: p.atts[0].url || (ATT[p.atts[0].id] || {}).url };
  if (!a.url) {
    fetchForumAtt('feed', a.id);
    return `<div class="spend" data-satt="${esc(a.id)}">${emoImg('video', 48)}<span class="prog">Cargando vídeo...</span></div>`;
  }
  return playerHtml(a.url, 'short', a.name, `data-pv="${esc(p.id)}" data-sid="${esc(p.id)}"`);
}

function shortHtml(p) {
  return `<div class="short" data-pid="${esc(p.id)}">
    <div class="sframe">${shortVideo(p)}
      <div class="sinfo"><span data-person="${esc(p.author.code)}">${avatarHtml(p.author, 36, 'online')}</span>
        <div><b data-person="${esc(p.author.code)}">${esc(p.author.name)}</b><div class="stxt">${p.text ? richText(p.text) : ''}</div></div></div>
    </div>
    <div class="sside">
      <button class="sbtn ${p.liked ? 'on' : ''}" data-like>${emoImg('heart', 28)}<span>${p.likes || ''}</span></button>
      <button class="sbtn" data-cm>${emoImg('forum', 28)}<span>${p.comments || ''}</span></button>
    </div>
    <div class="fcm scm" hidden></div>
  </div>`;
}

// Al aparecer un corto se reproduce solo; al salir se pausa
function observeShorts() {
  if (!shortsObs) shortsObs = new IntersectionObserver(entries => {
    for (const en of entries) {
      const v = en.target.querySelector('video');
      if (!v) continue;
      if (en.isIntersecting && en.intersectionRatio > .7) { v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); }
      else if (!v.paused) v.pause();
    }
  }, { threshold: [0, .7, 1] });
  document.querySelectorAll('.short').forEach(el => shortsObs.observe(el));
}

// Visto casi entero = le interesa (se guarda solo en esta PC, para ordenar mejor)
document.addEventListener('timeupdate', e => {
  const pid = e.target.dataset && e.target.dataset.sid;
  if (!pid || watched.has(pid) || !e.target.duration) return;
  if (e.target.currentTime / e.target.duration > .8) { watched.add(pid); api().feed_signal(pid, 'watch'); }
}, true);

function shortsAttReady(att) {
  document.querySelectorAll(`[data-satt="${CSS.escape(att.id)}"]`).forEach(el => {
    const pid = el.closest('.short').dataset.pid;
    el.outerHTML = playerHtml(att.url, 'short', att.name, `data-pv="${esc(pid)}" data-sid="${esc(pid)}"`);
  });
  observeShorts();
}
