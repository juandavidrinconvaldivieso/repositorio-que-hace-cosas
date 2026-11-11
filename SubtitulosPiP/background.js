// Puente hacia «Subtítulos en el escritorio» (programa local en 127.0.0.1:47321).
const BASE = 'http://127.0.0.1:47321';

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'desk') {
    fetch(BASE + '/subs', { method: 'POST', body: JSON.stringify(msg.data) }).catch(() => {});
  } else if (msg.type === 'deskCmd') {
    fetch(BASE + '/cmd', { method: 'POST', body: JSON.stringify({ cmd: msg.cmd }) })
      .then(() => reply({ ok: true }), () => reply({ ok: false }));
    return true;
  } else if (msg.type === 'deskPing') {
    fetch(BASE + '/ping').then(() => reply({ ok: true }), () => reply({ ok: false }));
    return true;
  }
});
