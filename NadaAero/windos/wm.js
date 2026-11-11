// Ventanas dentro de la app: se pueden mover, minimizar (a la barra de abajo) y maximizar
const dock = document.createElement('div');
dock.id = 'dock';
document.body.appendChild(dock);

function dockAdd(id, label, icon, onRestore) {
  dockRemove(id);
  const b = document.createElement('div');
  b.className = 'dchip';
  b.dataset.dock = id;
  b.innerHTML = `${emoImg(icon || 'doc', 16)}<span>${esc(label)}</span>`;
  b.onclick = () => { dockRemove(id); onRestore(); };
  dock.appendChild(b);
}
function dockRemove(id) { dock.querySelector(`[data-dock="${CSS.escape(id)}"]`)?.remove(); }

// Prepara una ventana (.dialog dentro de un .overlay): botones de minimizar/maximizar y arrastre
function wmEnhance(ov) {
  const dlg = ov.querySelector('.dialog'), bar = dlg && dlg.querySelector('.titlebar');
  if (!bar || bar.dataset.wm) return;
  bar.dataset.wm = '1';
  const caps = bar.querySelector('.caps');
  caps.insertAdjacentHTML('afterbegin', '<div class="cap" data-w="min" title="Minimizar">_</div><div class="cap" data-w="max" title="Maximizar">□</div>');
  caps.querySelector('.close').style.borderBottomLeftRadius = '0';

  caps.addEventListener('click', e => {
    const w = e.target.dataset.w;
    if (w === 'min') {
      ov.classList.add('wmin');
      dockAdd(ov.id, bar.querySelector('.t').textContent || 'Ventana', 'doc', () => ov.classList.remove('wmin'));
    }
    if (w === 'max') dlg.classList.toggle('wmax');
  });
  bar.addEventListener('dblclick', e => { if (!e.target.closest('.cap')) dlg.classList.toggle('wmax'); });

  // Arrastrar por la barra de título
  bar.addEventListener('pointerdown', e => {
    if (e.target.closest('.cap') || dlg.classList.contains('wmax') || e.button !== 0) return;
    const r = dlg.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    dlg.classList.add('moved');
    dlg.style.left = r.left + 'px'; dlg.style.top = r.top + 'px';
    bar.setPointerCapture(e.pointerId);
    bar.onpointermove = ev => {
      dlg.style.left = Math.max(-r.width + 80, Math.min(innerWidth - 80, ev.clientX - dx)) + 'px';
      dlg.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)) + 'px';
    };
    bar.onpointerup = () => { bar.onpointermove = bar.onpointerup = null; };
  });

  // Al abrirse o cerrarse de nuevo, la ventana vuelve a su sitio y deja de estar minimizada
  let shown = ov.classList.contains('show');
  new MutationObserver(() => {
    const now = ov.classList.contains('show');
    if (now !== shown) {
      ov.classList.remove('wmin');
      dockRemove(ov.id);
      if (now && ov.id === 'ov') { dlg.classList.remove('moved', 'wmax'); dlg.style.left = dlg.style.top = ''; }
    }
    shown = now;
  }).observe(ov, { attributes: true, attributeFilter: ['class'] });
}
document.querySelectorAll('.overlay').forEach(wmEnhance);
