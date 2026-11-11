// Mundo de la página: redirige el botón PiP del sitio a nuestra ventana con subtítulos.
(() => {
  'use strict';
  const VP = window.HTMLVideoElement && HTMLVideoElement.prototype;
  if (!VP || !VP.requestPictureInPicture || VP.__subpipHooked) return;
  Object.defineProperty(VP, '__subpipHooked', { value: true });
  const DP = Document.prototype;
  const origRequest = VP.requestPictureInPicture;
  const origElem = Object.getOwnPropertyDescriptor(DP, 'pictureInPictureElement');
  const origExit = DP.exitPictureInPicture;
  let marked = null, active = null, fakeWin = null;
  const makeWin = () => Object.assign(new EventTarget(), { width: 480, height: 270, onresize: null });

  VP.requestPictureInPicture = function requestPictureInPicture() {
    const ev = new CustomEvent('subpip:request', { cancelable: true });
    if (this.isConnected) this.dispatchEvent(ev);
    if (ev.defaultPrevented) return Promise.resolve(fakeWin = makeWin());
    return origRequest.apply(this, arguments);
  };

  window.addEventListener('subpip:mark', (e) => { marked = e.target; }, true);
  window.addEventListener('subpip:state', (e) => {
    const enter = e.detail === 'enter';
    if (!marked) return;
    active = enter ? marked : null;
    const ev = new Event(enter ? 'enterpictureinpicture' : 'leavepictureinpicture', { bubbles: true });
    Object.defineProperty(ev, 'pictureInPictureWindow', { value: fakeWin || (fakeWin = makeWin()) });
    try { marked.dispatchEvent(ev); } catch (_) {}
    if (!enter) fakeWin = null;
  });

  if (origElem && origElem.get) {
    Object.defineProperty(DP, 'pictureInPictureElement', {
      configurable: true,
      get() { return this === document && active ? active : origElem.get.call(this); }
    });
  }
  if (origExit) {
    DP.exitPictureInPicture = function exitPictureInPicture() {
      if (this === document && active) { window.dispatchEvent(new CustomEvent('subpip:exit')); return Promise.resolve(); }
      return origExit.apply(this, arguments);
    };
  }
})();
