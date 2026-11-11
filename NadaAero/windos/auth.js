// Pantalla de entrada: iniciar sesión o crear cuenta (y cambiar contraseña / cerrar sesión)
let authMode = 'login';
const authVals = { user: '', pass: '', pass2: '' };

// Igual que norm_user() en Python: "Juan David Rincón" -> "juan_david_rincon"
const normUser = u => String(u || '').trim().replace(/^@/, '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[\s-]+/g, '_').replace(/[^a-z0-9_.]/g, '').replace(/_+/g, '_').replace(/^[_.]+|[_.]+$/g, '').slice(0, 20);

function showAuth() {
  const fresh = S.me.fresh, reg = authMode === 'register';
  $('auth').innerHTML = `<div class="authbox">
    <div class="wlogo"></div>
    <h1>Wind OS Messenger</h1>
    <div class="atabs"><span data-am="login" class="${reg ? '' : 'on'}">Iniciar sesión</span><span data-am="register" class="${reg ? 'on' : ''}">Crear cuenta</span></div>
    <label for="auUser">Usuario</label><input type="text" id="auUser" maxlength="40" spellcheck="false" autocomplete="username" placeholder="Por ejemplo: juan_david">
    <div class="ahint" id="auUserHint"></div>
    <label for="auPass">Contraseña</label>
    <div class="apass"><input type="password" id="auPass" maxlength="200" autocomplete="${reg ? 'new-password' : 'current-password'}"><button class="btn small" id="auShow" type="button" tabindex="-1">Mostrar</button></div>
    ${reg ? '<label for="auPass2">Repite la contraseña</label><input type="password" id="auPass2" maxlength="200" autocomplete="new-password"><div class="ahint" id="auPassHint"></div>' : ''}
    <div class="amsg" id="auMsg">${reg
      ? (fresh ? 'Elige un usuario y una contraseña de al menos 8 caracteres (puede tener espacios, tildes o símbolos).'
               : 'Tu código, tus contactos y tus foros actuales quedarán guardados en esta cuenta.')
      : (fresh ? '¿Ya tienes cuenta? Entra con tu usuario y contraseña desde cualquier PC.'
               : '<b>Ojo:</b> si entras con otra cuenta, el perfil que hay ahora en este programa (sin cuenta) se reemplazará. Si es tuyo, usa «Crear cuenta».')}</div>
    <button class="bigbtn" id="auGo">${reg ? 'Crear cuenta' : 'Entrar'}</button>
    <div class="small" style="margin-top:10px">${S.web
      ? 'Versión web: tu cuenta funciona en el PC de quien te pasó este enlace, así que esa persona podría llegar a ver tus mensajes. Úsala solo con gente de confianza.'
      : 'Tu contraseña nunca sale de tu PC: con ella se cifra tu cuenta antes de guardarla en el servidor.'} Si olvidas la contraseña, no se puede recuperar.</div>
  </div>`;
  $('auth').hidden = false;
  $('auUser').value = authVals.user; $('auPass').value = authVals.pass;
  if (reg) $('auPass2').value = authVals.pass2;

  const check = () => {
    authVals.user = $('auUser').value; authVals.pass = $('auPass').value;
    if (reg) authVals.pass2 = $('auPass2').value;
    const u = normUser(authVals.user), raw = authVals.user.trim().replace(/^@/, '');
    const uOk = u.length >= 3;
    $('auUserHint').innerHTML = !raw ? '' : !uOk ? '<span class="bad">✗ Mínimo 3 letras o números</span>'
      : u !== raw.toLowerCase() ? `Tu usuario será: <b>${esc(u)}</b>` : '<span class="ok">✓</span>';
    if (!reg) return uOk && authVals.pass.length > 0;
    const lenOk = authVals.pass.length >= 8, same = authVals.pass === authVals.pass2 && authVals.pass2.length > 0;
    $('auPassHint').innerHTML = `<span class="${lenOk ? 'ok' : 'bad'}">${lenOk ? '✓' : '✗'} Al menos 8 caracteres (${authVals.pass.length})</span> &nbsp; ` +
      (authVals.pass2 ? `<span class="${same ? 'ok' : 'bad'}">${same ? '✓ Coinciden' : '✗ No coinciden'}</span>` : '<span>Repite la contraseña</span>');
    return uOk && lenOk && same;
  };
  $('auth').querySelectorAll('input').forEach(i => {
    i.oninput = check;
    i.onkeydown = e => { if (e.key === 'Enter') $('auGo').click(); };
  });
  check();
  (authVals.user ? $('auPass') : $('auUser')).focus();

  $('auShow').onclick = () => {
    const show = $('auPass').type === 'password';
    $('auth').querySelectorAll('input[id^="auPass"]').forEach(i => i.type = show ? 'text' : 'password');
    $('auShow').textContent = show ? 'Ocultar' : 'Mostrar';
  };
  $('auth').querySelector('.atabs').onclick = e => { const m = e.target.dataset.am; if (m && m !== authMode) { authMode = m; showAuth(); } };

  $('auGo').onclick = async () => {
    const msg = $('auMsg'), btn = $('auGo');
    if (!check()) {
      msg.innerHTML = `<b class="err">${normUser(authVals.user).length < 3 ? 'Escribe un usuario de al menos 3 letras o números.'
        : !reg ? 'Escribe tu contraseña.' : authVals.pass.length < 8 ? 'La contraseña necesita al menos 8 caracteres.' : 'Las dos contraseñas no coinciden.'}</b>`;
      return;
    }
    btn.disabled = true;
    msg.innerHTML = reg ? 'Creando tu cuenta... (tarda unos segundos)' : 'Comprobando...';
    let r;
    try { r = reg ? await api().register(authVals.user, authVals.pass) : await api().login(authVals.user, authVals.pass); }
    catch (e) { r = { ok: false, msg: 'Algo falló: ' + esc(e && e.message || e) + '. Inténtalo de nuevo.' }; }
    btn.disabled = false;
    if (!r || !r.ok) { msg.innerHTML = `<b class="err">${(r && r.msg) || 'No se pudo completar.'}</b>`; return; }
    authVals.pass = authVals.pass2 = '';
    if (reg) {
      S.me.user = r.user; S.me.profile = r.profile;
      $('auth').hidden = true;
      renderTop(); renderRight(); renderCenter();
      dialog(`¡Cuenta creada! Tu usuario es <b>${esc(r.user)}</b>.<br>Tus amigos pueden agregarte escribiendo ese usuario en «＋ Agregar».`, { title: 'Bienvenido', icon: emoImg('thumbsup', 34) });
    } else msg.innerHTML = '¡Listo! Abriendo tu cuenta...';
  };
}

function changePassword() {
  dialog(`<label class="small">Contraseña actual</label><input type="password" id="cpOld" style="width:100%">
    <label class="small">Nueva contraseña (mínimo 8 caracteres)</label><input type="password" id="cpNew" style="width:100%">
    <label class="small">Repite la nueva</label><input type="password" id="cpNew2" style="width:100%">`,
    { title: 'Cambiar contraseña', icon: emoImg('lock', 34), focus: 'cpOld', buttons: [['Cambiar', () => {
      const o = $('cpOld').value, n = $('cpNew').value;
      if (n.length < 8) { setTimeout(() => dialog('La nueva contraseña necesita al menos 8 caracteres.', { icon: '!' }), 0); return; }
      if (n !== $('cpNew2').value) { setTimeout(() => dialog('Las contraseñas nuevas no coinciden.', { icon: '!' }), 0); return; }
      api().change_password(o, n).then(r => dialog(r.msg, { icon: r.ok ? emoImg('thumbsup', 34) : '!' }),
        e => dialog('Algo falló: ' + esc(e && e.message || e), { icon: '!' }));
    }], ['Cancelar']] });
}

function logout() {
  dialog('¿Cerrar sesión en esta PC?<br>Se borrarán de aquí tus chats y archivos descargados. Tu cuenta, contactos y foros siguen guardados: vuelve a entrar con tu usuario y contraseña cuando quieras.',
    { icon: '?', buttons: [['Cerrar sesión', async () => {
      const r = await api().logout();
      if (!r.ok) dialog(r.msg, { icon: '!' });
    }], ['Cancelar']] });
}
