// Llamadas de voz con pantalla compartida.
// El audio y la pantalla van directos entre las dos PCs (WebRTC); por el servidor solo pasa
// la señalización, cifrada como cualquier otro mensaje entre contactos.
// STUN públicos + (opcional) un servidor TURN propio para redes estrictas (Archivo > Configurar llamadas)
function iceServers() {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  const t = S && S.settings && S.settings.turn;
  if (t && t.url) list.push({ urls: t.url.split(/[\s,]+/).filter(Boolean), username: t.user, credential: t.pass });
  return list;
}
let call = null;
const NET_FAIL = 'No se pudo conectar la llamada. Suele pasar cuando una de las dos redes (de empresa, colegio o datos móviles) ' +
  'bloquea las conexiones directas. Solución: configura un servidor TURN en Archivo › Configurar llamadas.';

const callSig = d => call && api().call_signal(call.code, { ...d, cid: call.cid });
const fmtDur = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

let ringT = null;
function ring(dir) {
  stopRing();
  const play = dir === 'in' ? () => tone([784, 659, 784, 659, 523], .13, 'triangle', .13) : () => tone([440, 480], .4, 'sine', .05);
  play();
  ringT = setInterval(play, dir === 'in' ? 2200 : 3200);
}
function stopRing() { clearInterval(ringT); ringT = null; }

async function getMic() {
  if (!window.isSecureContext || !navigator.mediaDevices) throw new Error('https');
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
}
const micError = e => e && e.message === 'https' ? MIC_HTTPS_MSG
  : 'No se pudo usar el micrófono. Revisa que esté conectado y que el permiso no esté bloqueado.';

// ---------- Iniciar, recibir, contestar, colgar ----------
async function startCall(code) {
  const c = S.contacts[code];
  if (!c || c.state !== 'friend') return;
  if (call) return dialog('Ya estás en una llamada.', { icon: '!' });
  if (!c.online) return dialog(`<b>${esc(c.profile.name)}</b> está desconectado. Solo puedes llamar a contactos conectados.`, { icon: '!' });
  call = { code, cid: Math.random().toString(36).slice(2, 10), dir: 'out', state: 'calling', polite: false, queue: [], chain: Promise.resolve() };
  renderCall();
  try { call.mic = await getMic(); }
  catch (e) { endCall(micError(e)); return; }
  if (!call) return;
  callSig({ type: 'ring' });
  ring('out');
  call.timeout = setTimeout(() => { if (call && call.state === 'calling') { callSig({ type: 'hangup' }); endCall(`${nameOf(code)} no contesta.`); } }, 45000);
}

function onRtc(code, d) {
  const name = nameOf(code);
  if (d.type === 'ring') {
    if (call) { api().call_signal(code, { type: 'busy', cid: d.cid }); return; }
    call = { code, cid: String(d.cid), dir: 'in', state: 'ringing', polite: true, queue: [], chain: Promise.resolve() };
    renderCall();
    ring('in');
    notify('Llamada entrante', `${name} te está llamando...`, person(code)?.profile, 'online', code, true);
    call.timeout = setTimeout(() => { if (call && call.state === 'ringing') endCall('Llamada perdida.'); }, 45000);
    return;
  }
  if (!call || call.code !== code || d.cid !== call.cid) return;
  switch (d.type) {
    case 'accept':
      if (call.dir === 'out' && call.state === 'calling') {
        stopRing(); clearTimeout(call.timeout);
        call.state = 'connecting';
        setupPeer(); renderCall();
      }
      break;
    case 'decline': endCall(`${name} rechazó la llamada.`); break;
    case 'busy': endCall(`${name} está en otra llamada.`); break;
    case 'hangup': endCall(call.state === 'ringing' ? 'Llamada perdida.' : null); break;
    case 'sdp': case 'ice':
      if (call.pc) queueSignal(d); else call.queue.push(d);
      break;
    case 'screen': call.remoteScreen = !!d.on; if (!d.on) call.big = false; renderCall(); break;
    case 'mute': call.remoteMuted = !!d.on; renderCall(); break;
  }
}

async function acceptCall() {
  if (!call || call.state !== 'ringing') return;
  stopRing(); clearTimeout(call.timeout);
  try { call.mic = await getMic(); }
  catch (e) { callSig({ type: 'decline' }); endCall(micError(e)); return; }
  call.state = 'connecting';
  setupPeer();
  callSig({ type: 'accept' });
  renderCall();
}
function declineCall() { callSig({ type: 'decline' }); endCall(null, 'Rechazaste la llamada.'); }
function hangup() { callSig({ type: 'hangup' }); endCall(); }

function endCall(reason, note) {
  if (!call) return;
  const c = call;
  call = null;
  stopRing();
  clearTimeout(c.timeout); clearTimeout(c.discT); clearTimeout(c.connT);
  dockRemove('call');
  c.mic && c.mic.getTracks().forEach(t => t.stop());
  c.screen && c.screen.getTracks().forEach(t => t.stop());
  try { c.pc && c.pc.close(); } catch (e) { /* ya cerrada */ }
  $('callAudio').srcObject = null;
  const dur = c.t0 ? Math.round((Date.now() - c.t0) / 1000) : 0;
  sysMsg(c.code, c.t0 ? `Llamada finalizada · duración ${fmtDur(dur)}` : (reason || note || 'Llamada cancelada.'));
  if (reason && !c.t0) dialog(esc(reason), { title: 'Llamada', icon: emoImg('hangup', 34) });
  renderCall();
}
window.addEventListener('beforeunload', () => call && hangup());

// ---------- WebRTC con "negociación perfecta" (sirve también para añadir la pantalla a mitad de llamada) ----------
function setupPeer() {
  const pc = call.pc = new RTCPeerConnection({ iceServers: iceServers(), iceCandidatePoolSize: 2 });
  call.makingOffer = false;
  call.ignoreOffer = false;
  call.restarted = false;
  // Si en 30 s no hay conexión, se avisa en vez de quedarse "Conectando..." para siempre
  call.connT = setTimeout(() => {
    if (call && call.pc === pc && call.state !== 'active') { callSig({ type: 'hangup' }); endCall(NET_FAIL); }
  }, 30000);
  call.mic.getTracks().forEach(t => pc.addTrack(t, call.mic));
  pc.onnegotiationneeded = async () => {
    const me = call;
    try {
      me.makingOffer = true;
      await pc.setLocalDescription();
      if (call === me) callSig({ type: 'sdp', sdp: pc.localDescription.toJSON() });
    } catch (e) { console.warn(e); }
    finally { me.makingOffer = false; }
  };
  pc.onicecandidate = e => { if (e.candidate) callSig({ type: 'ice', c: e.candidate.toJSON() }); };
  pc.ontrack = e => {
    if (e.track.kind === 'audio') $('callAudio').srcObject = e.streams[0] || new MediaStream([e.track]);
    else { call.remoteVideo = new MediaStream([e.track]); renderCall(); }
  };
  pc.onconnectionstatechange = () => {
    if (!call || call.pc !== pc) return;
    const s = pc.connectionState;
    if (s === 'connected' && call.state !== 'active') { call.state = 'active'; call.t0 = Date.now(); clearTimeout(call.discT); clearTimeout(call.connT); sounds.online(); renderCall(); }
    else if (s === 'connected') clearTimeout(call.discT);
    if (s === 'failed') {
      if (!call.restarted && pc.restartIce) { call.restarted = true; pc.restartIce(); return; }  // un reintento antes de rendirse
      callSig({ type: 'hangup' }); endCall(NET_FAIL);
    }
    if (s === 'disconnected') call.discT = setTimeout(() => {
      if (!call || call.pc !== pc || pc.connectionState === 'connected') return;
      if (!call.restarted && pc.restartIce) { call.restarted = true; pc.restartIce(); return; }
      callSig({ type: 'hangup' }); endCall('Se perdió la conexión.');
    }, 6000);
  };
  call.queue.splice(0).forEach(queueSignal);
}

function queueSignal(d) {
  const me = call;
  me.chain = me.chain.then(() => handleSignal(me, d));
}
async function handleSignal(me, d) {
  if (call !== me) return;
  const pc = me.pc;
  try {
    if (d.type === 'sdp') {
      const desc = d.sdp;
      const collision = desc.type === 'offer' && (me.makingOffer || pc.signalingState !== 'stable');
      me.ignoreOffer = !me.polite && collision;
      if (me.ignoreOffer) return;
      await pc.setRemoteDescription(desc);
      if (desc.type === 'offer') {
        await pc.setLocalDescription();
        callSig({ type: 'sdp', sdp: pc.localDescription.toJSON() });
      }
    } else if (d.type === 'ice') {
      try { await pc.addIceCandidate(d.c); } catch (e) { if (!me.ignoreOffer) console.warn(e); }
    }
  } catch (e) { console.warn(e); }
}

// ---------- Micrófono y pantalla ----------
function toggleMute() {
  if (!call || !call.mic) return;
  call.muted = !call.muted;
  call.mic.getAudioTracks().forEach(t => t.enabled = !call.muted);
  callSig({ type: 'mute', on: call.muted });
  renderCall();
}
async function toggleScreen() {
  if (!call || call.state !== 'active') return;
  if (call.screen) return stopScreen();
  let s;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia)
    return dialog('Este dispositivo no permite compartir la pantalla (los teléfonos no suelen dejar). Sí puedes ver la pantalla que comparta la otra persona.', { icon: '!' });
  try { s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false }); }
  catch (e) { return; }  // canceló el selector
  if (!call) { s.getTracks().forEach(t => t.stop()); return; }
  const track = s.getVideoTracks()[0];
  track.contentHint = 'detail';
  call.screen = s;
  call.screenSender = call.pc.addTrack(track, s);
  track.onended = stopScreen;  // "Dejar de compartir" desde la barra de Windows
  callSig({ type: 'screen', on: true });
  renderCall();
}
function stopScreen() {
  if (!call || !call.screen) return;
  call.screen.getTracks().forEach(t => t.stop());
  try { call.pc.removeTrack(call.screenSender); } catch (e) { /* ya quitada */ }
  call.screen = call.screenSender = null;
  callSig({ type: 'screen', on: false });
  renderCall();
}

// ---------- Panel flotante (se puede seguir usando el resto de la app) ----------
setInterval(() => { if (call && call.t0 && $('cpTimer')) $('cpTimer').textContent = fmtDur(Math.round((Date.now() - call.t0) / 1000)); }, 1000);

function renderCall() {
  const p = $('callPanel');
  document.body.classList.toggle('incall', !!call);
  if (S && leftTab === 'contactos') renderList();  // icono de llamada junto al contacto
  if (!call) { p.hidden = true; p.innerHTML = ''; p.classList.remove('big'); return; }
  const prof = person(call.code)?.profile || { name: '?' };
  const showVideo = call.remoteScreen && call.remoteVideo;
  const st = { calling: 'Llamando...', ringing: 'Te está llamando...', connecting: 'Conectando...', active: 'En llamada' }[call.state];
  const b = (k, icon, label, cls = '') => `<button class="cpb ${cls}" data-cp="${k}" title="${label}">${emoImg(icon, 26)}<span>${label}</span></button>`;
  const btns = call.state === 'ringing'
    ? b('accept', 'call', 'Contestar', 'go') + b('decline', 'hangup', 'Rechazar', 'stop')
    : call.state === 'calling'
      ? b('hangup', 'hangup', 'Cancelar', 'stop')
      : b('mute', call.muted ? 'micoff' : 'mic', call.muted ? 'Activar micro' : 'Silenciar', call.muted ? 'on' : '') +
        b('screen', 'monitor', call.screen ? 'Dejar de compartir' : 'Compartir pantalla', call.screen ? 'on' : '') +
        b('hangup', 'hangup', 'Colgar', 'stop');
  if (call.state === 'ringing') call.min = false;
  p.classList.toggle('big', !!call.big);
  p.classList.toggle('ringing', call.state === 'ringing');
  p.hidden = !!call.min;
  if (call.min) dockAdd('call', `Llamada · ${prof.name}`, 'call', () => { if (call) { call.min = false; renderCall(); } });
  else dockRemove('call');
  p.innerHTML = `
    <div class="cphead" id="cpDrag">${emoImg('call', 16)}<b>Llamada</b><span class="grow"></span>${call.state === 'active' ? `<span id="cpTimer">${fmtDur(Math.round((Date.now() - call.t0) / 1000))}</span>` : ''}
      <span class="cpcaps"><button data-cp="min" title="Minimizar">_</button><button data-cp="big" title="${call.big ? 'Restaurar' : 'Maximizar'}">${call.big ? '❐' : '□'}</button></span></div>
    ${showVideo ? `<div class="cpvideo"><video id="cpRemote" autoplay playsinline muted></video><button class="btn small cpexp" data-cp="big">${call.big ? 'Reducir' : 'Ampliar'}</button></div>` : ''}
    <div class="cpwho">${avatarHtml(prof, 46, 'online')}<div class="ci"><b>${esc(prof.name)}</b>
      <div class="cpst">${st}${call.remoteMuted ? ` · ${emoImg('micoff', 14)} sin micro` : ''}${call.remoteScreen ? ` · ${emoImg('monitor', 14)} comparte su pantalla` : ''}</div></div></div>
    ${call.screen ? `<div class="cpmine">${emoImg('monitor', 14)} Estás compartiendo tu pantalla</div>` : ''}
    <div class="cpbtns">${btns}</div>`;
  if (showVideo) $('cpRemote').srcObject = call.remoteVideo;
}

$('callPanel').addEventListener('click', e => {
  const k = e.target.closest('[data-cp]')?.dataset.cp;
  if (!k) return;
  ({ accept: acceptCall, decline: declineCall, hangup, mute: toggleMute, screen: toggleScreen,
     big: () => { call.big = !call.big; renderCall(); },
     min: () => { call.min = true; renderCall(); } })[k]();
});
// Arrastrar el panel por su cabecera
(() => {
  let drag = null;
  const p = $('callPanel');
  p.addEventListener('pointerdown', e => {
    if (!e.target.closest('#cpDrag') || e.target.closest('button') || p.classList.contains('big')) return;
    const r = p.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    p.setPointerCapture(e.pointerId);
  });
  p.addEventListener('pointermove', e => {
    if (!drag) return;
    p.style.left = Math.max(0, Math.min(innerWidth - p.offsetWidth, e.clientX - drag.dx)) + 'px';
    p.style.top = Math.max(0, Math.min(innerHeight - p.offsetHeight, e.clientY - drag.dy)) + 'px';
    p.style.right = p.style.bottom = 'auto';
  });
  p.addEventListener('pointerup', () => drag = null);
})();
