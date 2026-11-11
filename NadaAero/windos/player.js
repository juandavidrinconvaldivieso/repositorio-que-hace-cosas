// Reproductor estilo Windows Media Player 11 para vídeos, música y notas de voz.
// Todo funciona por delegación de eventos: basta con insertar el HTML de playerHtml().
const fmtT = s => !isFinite(s) ? '0:00' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function playerHtml(src, kind, name = '', extraAttrs = '') {
  const isVideo = kind === 'video' || kind === 'short';
  const media = isVideo
    ? `<video src="${esc(src)}" preload="metadata" playsinline ${kind === 'short' ? 'loop' : ''} ${extraAttrs}></video><div class="wbig"></div>`
    : `<audio src="${esc(src)}" preload="metadata" ${extraAttrs}></audio>
       <div class="wnow">${emoImg(kind === 'voice' ? 'mic' : 'note', 30)}<div class="ci"><b>${esc(name || (kind === 'voice' ? 'Nota de voz' : 'Audio'))}</b><span class="wst">Detenido</span></div>
       <div class="wviz">${'<i></i>'.repeat(9)}</div></div>`;
  return `<div class="wmp ${isVideo ? 'isv' : 'isa'} ${kind}">${media}
    <div class="wbar">
      <button class="wplay" title="Reproducir"></button>
      <button class="wstop" title="Detener"></button>
      <div class="wseek"><div class="wfill"></div><div class="wknob"></div></div>
      <span class="wtime">0:00 / 0:00</span>
      <button class="wmute" title="Silenciar"></button>
      <input class="wvol" type="range" min="0" max="1" step="0.05" value="1" title="Volumen">
      ${isVideo ? '<button class="wfs" title="Pantalla completa"></button>' : ''}
    </div></div>`;
}

const wmpOf = el => el && el.closest && el.closest('.wmp');
const mediaOf = w => w.querySelector('video, audio');

function wmpUpdate(w) {
  const m = mediaOf(w);
  const p = m.duration ? m.currentTime / m.duration : 0;
  w.querySelector('.wfill').style.width = (p * 100) + '%';
  w.querySelector('.wknob').style.left = (p * 100) + '%';
  w.querySelector('.wtime').textContent = `${fmtT(m.currentTime)} / ${fmtT(m.duration)}`;
  w.classList.toggle('playing', !m.paused && !m.ended);
  w.classList.toggle('muted', m.muted || m.volume === 0);
  const st = w.querySelector('.wst');
  if (st) st.textContent = m.ended ? 'Finalizado' : m.paused ? (m.currentTime ? 'En pausa' : 'Detenido') : 'Reproduciendo';
}

// Las actualizaciones de los <video>/<audio> no suben por el DOM, pero se pueden escuchar en captura
for (const ev of ['timeupdate', 'play', 'pause', 'ended', 'loadedmetadata', 'volumechange', 'durationchange']) {
  document.addEventListener(ev, e => {
    const w = wmpOf(e.target);
    if (!w) return;
    if (ev === 'play')  // solo suena un reproductor a la vez
      document.querySelectorAll('.wmp video, .wmp audio').forEach(o => { if (o !== e.target && !o.paused) o.pause(); });
    wmpUpdate(w);
  }, true);
}

document.addEventListener('click', e => {
  const w = wmpOf(e.target);
  if (!w) return;
  const m = mediaOf(w), t = e.target;
  if (t.closest('.wplay') || t.matches('video') || t.closest('.wbig')) { e.preventDefault(); m.paused || m.ended ? m.play().catch(() => {}) : m.pause(); }
  else if (t.closest('.wstop')) { m.pause(); m.currentTime = 0; }
  else if (t.closest('.wmute')) m.muted = !m.muted;
  else if (t.closest('.wfs')) {
    if (document.fullscreenElement) document.exitFullscreen();
    else (w.requestFullscreen ? w.requestFullscreen() : m.webkitEnterFullscreen && m.webkitEnterFullscreen());
  }
});
document.addEventListener('input', e => { if (e.target.matches('.wvol')) { const m = mediaOf(wmpOf(e.target)); m.volume = +e.target.value; m.muted = false; } });

// Arrastrar en la barra para avanzar o retroceder
document.addEventListener('pointerdown', e => {
  const bar = e.target.closest && e.target.closest('.wseek');
  if (!bar) return;
  const m = mediaOf(wmpOf(bar));
  const seek = ev => { const r = bar.getBoundingClientRect(); if (m.duration) m.currentTime = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)) * m.duration; };
  seek(e);
  bar.setPointerCapture(e.pointerId);
  bar.onpointermove = seek;
  bar.onpointerup = () => { bar.onpointermove = bar.onpointerup = null; };
});
