// Gráficos retro dibujados a mano en SVG: emoticonos estilo 2005, iconos y avatares.
// Ningún emoji del sistema: todo sale de aquí.
const RETRO = (() => {
  const uri = s => 'data:image/svg+xml,' + encodeURIComponent(s);
  const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}">${body}</svg>`;
  const lin = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const rad = (id, stops, cx = '38%', cy = '32%', r = '72%') =>
    `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</radialGradient>`;
  const pts = (cx, cy, rs, rot = -90) => rs.map((r, i) => {
    const a = (rot + i * 360 / rs.length) * Math.PI / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const poly = (cx, cy, r, n, rot) => pts(cx, cy, Array(n).fill(r), rot);
  const star = (cx, cy, R, r) => pts(cx, cy, Array.from({ length: 10 }, (_, i) => i % 2 ? r : R));

  // ---------- Emoticonos (caritas) ----------
  const INK = '#3b2300';
  const ln = (d, w = 1.7, c = INK) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const EYES = `<ellipse cx="11.5" cy="13" rx="1.7" ry="2.5" fill="${INK}"/><ellipse cx="20.5" cy="13" rx="1.7" ry="2.5" fill="${INK}"/><circle cx="12" cy="12" r=".6" fill="#fff"/><circle cx="21" cy="12" r=".6" fill="#fff"/>`;
  const SMILE = ln('M9.5 19.5 Q16 25.5 22.5 19.5');
  const GRIN = `<path d="M8.5 18.5 Q16 28.5 23.5 18.5 Z" fill="#8a1a00" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M9.7 19.2 H22.3 L21.5 20.9 H10.5Z" fill="#fff"/>`;
  const FROWN = ln('M10 23.5 Q16 18 22 23.5');
  const WAVY = ln('M9.5 22 Q12 19.8 14.2 22 T18.8 22 T22.5 21');
  const YELLOW = ['#fff8b8', '#ffd71f', '#e38f00'];
  const face = (feat, { col = YELLOW, stroke = '#9a5a00', under = '', over = '' } = {}) => svg(32,
    `<defs>${rad('f', col)}</defs>${under}<circle cx="16" cy="16.5" r="14" fill="url(#f)" stroke="${stroke}" stroke-width="1.3"/>` +
    `<ellipse cx="13" cy="8.2" rx="6.5" ry="3" fill="#fff" opacity=".55"/>${feat}${over}`);
  const tear = x => `<path d="M${x} 16.3 Q${x - 1.9} 20.6 ${x} 21.6 Q${x + 1.9} 20.6 ${x} 16.3Z" fill="#59b8ff" stroke="#1f6fc0" stroke-width=".7"/>`;
  const HEART_D = 'M16 28.5 C5 20.5 2.5 15 2.5 10.5 C2.5 6.5 5.5 3.5 9.3 3.5 C12.3 3.5 14.6 5.2 16 7.6 C17.4 5.2 19.7 3.5 22.7 3.5 C26.5 3.5 29.5 6.5 29.5 10.5 C29.5 15 27 20.5 16 28.5Z';
  const miniHeart = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s}) translate(-16 -16)" d="${HEART_D}" fill="#ff2a3a" stroke="#7a0010" stroke-width="2.5"/>`;
  const zz = `<text x="21" y="9" font-family="Arial Black,Arial" font-weight="900" font-size="10" fill="#3b7bff" stroke="#fff" stroke-width=".8" paint-order="stroke">z</text>` +
             `<text x="26.5" y="4.8" font-family="Arial Black,Arial" font-weight="900" font-size="6.5" fill="#3b7bff" stroke="#fff" stroke-width=".6" paint-order="stroke">z</text>`;

  // ---------- Objetos ----------
  const THUMB = `<defs>${lin('h', '#fff3a6', '#f2b300')}</defs><rect x="3.5" y="14" width="6.5" height="14.5" rx="1.5" fill="#3d8be0" stroke="#1d4f90" stroke-width="1.1"/>` +
    `<path d="M10 15.2 L13.8 15.2 L17 6.6 Q18.2 3.8 20.3 5.1 Q21.8 6.2 21.1 9.2 L20.2 13 L26.2 13 Q28.8 13.2 28.3 16 L26.8 25.3 Q26.2 28.4 23.1 28.4 L10 28.4 Z" fill="url(#h)" stroke="#9a6200" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M20.5 17.6 H27.6 M20.5 21.4 H27 M20.5 25 H26.2" stroke="#b07a00" stroke-width="1" stroke-linecap="round"/>`;
  const heart = (cols, extra = '') => svg(32, `<defs>${rad('r', cols, '35%', '30%', '75%')}</defs><path d="${HEART_D}" fill="url(#r)" stroke="#7a0010" stroke-width="1.2"/>` +
    `<ellipse cx="9.5" cy="9.2" rx="3.6" ry="2.1" fill="#fff" opacity=".6" transform="rotate(-30 9.5 9.2)"/>${extra}`);
  const ROBOT = `<defs>${lin('rb', '#eef3f8', '#8d9aa8')}</defs><path d="M16 2.5 V6.5" stroke="#5a6672" stroke-width="1.6"/><circle cx="16" cy="2.6" r="1.8" fill="#ff3a3a"/>` +
    `<rect x="5" y="6.5" width="22" height="19" rx="4" fill="url(#rb)" stroke="#3a4450" stroke-width="1.1"/><rect x="2.5" y="12" width="2.5" height="7" rx="1" fill="#8d9aa8"/><rect x="27" y="12" width="2.5" height="7" rx="1" fill="#8d9aa8"/>` +
    `<circle cx="11.5" cy="14" r="3" fill="#2ad4ff" stroke="#0a6a8a"/><circle cx="20.5" cy="14" r="3" fill="#2ad4ff" stroke="#0a6a8a"/><circle cx="10.6" cy="13" r=".9" fill="#fff"/><circle cx="19.6" cy="13" r=".9" fill="#fff"/>` +
    `<rect x="10" y="20" width="12" height="3" rx="1" fill="#3a4450"/><path d="M13 20 V23 M16 20 V23 M19 20 V23" stroke="#8d9aa8" stroke-width=".8"/>`;
  const PAD = `<defs>${lin('gp', '#6f7a86', '#252b33')}</defs><path d="M8 9 H24 Q30 9 30.5 17 Q31 25 26.5 25 Q24 25 21.5 21.5 H10.5 Q8 25 5.5 25 Q1 25 1.5 17 Q2 9 8 9Z" fill="url(#gp)" stroke="#111" stroke-width="1"/>` +
    `<path d="M8.5 13.5 V20.5 M5 17 H12" stroke="#ddd" stroke-width="2.4"/><circle cx="22" cy="14.8" r="1.7" fill="#3fd23a"/><circle cx="25.3" cy="17.6" r="1.7" fill="#ff3a3a"/><circle cx="18.8" cy="17.6" r="1.7" fill="#3a8bff"/><circle cx="22" cy="20.4" r="1.7" fill="#ffd21f"/>` +
    `<path d="M8 10.5 H24" stroke="#fff" stroke-width="1" opacity=".35"/>`;
  const HANDSET = 'M5 2.5 H8.6 Q9.4 2.5 9.7 3.3 L11 7.2 Q11.2 8 10.6 8.5 L8.4 10.2 Q10.2 14 14 15.8 L15.6 13.6 Q16.1 13 16.9 13.2 L20.8 14.5 Q21.5 14.8 21.5 15.6 V19 Q21.5 21.5 19 21.5 Q4.5 20.5 2.5 5 Q2.5 2.5 5 2.5Z';
  const MIC = `<defs>${lin('mc', '#f2f6fa', '#7d8a99', 1, 0)}</defs><rect x="11" y="3" width="10" height="16" rx="5" fill="url(#mc)" stroke="#3a4450" stroke-width="1.1"/>` +
    `<path d="M13 7.5 H19 M13 10.5 H19 M13 13.5 H19" stroke="#9aa6b4" stroke-width=".9"/><path d="M7.5 14 Q7.5 23 16 23 Q24.5 23 24.5 14" fill="none" stroke="#3a4450" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M16 23 V28 M11 28.5 H21" stroke="#3a4450" stroke-width="2" stroke-linecap="round"/>`;
  const keys = Array.from({ length: 12 }, (_, i) => `<rect x="${(11.4 + (i % 3) * 3.4).toFixed(1)}" y="${(16 + Math.floor(i / 3) * 3.1).toFixed(1)}" width="2.4" height="1.9" rx=".4" fill="#3a424a"/>`).join('');
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = i * 30 * Math.PI / 180, x1 = 16 + 9 * Math.sin(a), y1 = 16 - 9 * Math.cos(a), x2 = 16 + 10.6 * Math.sin(a), y2 = 16 - 10.6 * Math.cos(a);
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="#3a4a60" stroke-width="${i % 3 ? .8 : 1.6}"/>`;
  }).join('');

  const E = {
    smile: face(EYES + SMILE),
    grin: face(EYES + GRIN),
    wink: face(`<ellipse cx="20.5" cy="13" rx="1.7" ry="2.5" fill="${INK}"/>` + ln('M9 13.5 Q11.5 11.3 14 13.5') + SMILE),
    sad: face(EYES + FROWN),
    tongue: face(EYES + ln('M9.5 19.5 Q16 24 22.5 19.5') + `<path d="M14.6 21.4 Q15 27 18.4 26.2 Q20.6 25.2 19.8 21Z" fill="#ff7096" stroke="#a3123c" stroke-width="1"/>`),
    surprised: face(`<ellipse cx="11.5" cy="12.5" rx="2" ry="3" fill="${INK}"/><ellipse cx="20.5" cy="12.5" rx="2" ry="3" fill="${INK}"/><ellipse cx="16" cy="22" rx="3" ry="3.8" fill="#8a1a00" stroke="${INK}" stroke-width="1.3"/>`),
    neutral: face(EYES + ln('M10.5 21.5 H21.5')),
    confused: face(EYES + WAVY),
    angry: face(ln('M8 9.8 L13.8 12.2') + ln('M24 9.8 L18.2 12.2') + EYES + ln('M10.5 23 Q16 19 21.5 23'), { col: ['#ffd8c0', '#ff7a4a', '#c8200a'], stroke: '#7a1400' }),
    cry: face(EYES + FROWN + tear(9.5) + tear(22.5)),
    cool: face(`<path d="M5.4 10.6 H26.6 V12.6 Q26 17.2 21.2 17.2 Q17.3 17.2 16.8 12.9 H15.2 Q14.7 17.2 10.8 17.2 Q6 17.2 5.4 12.6Z" fill="#161616"/><path d="M8 12.2 L10.5 12.2 M19 12.2 L21.5 12.2" stroke="#fff" stroke-width="1" opacity=".7"/>` + SMILE),
    blush: face(EYES + SMILE + `<ellipse cx="8.3" cy="18" rx="2.6" ry="1.6" fill="#ff5f86" opacity=".55"/><ellipse cx="23.7" cy="18" rx="2.6" ry="1.6" fill="#ff5f86" opacity=".55"/>`),
    sleepy: face(ln('M9 13.5 Q11.5 15.6 14 13.5') + ln('M18 13.5 Q20.5 15.6 23 13.5') + `<ellipse cx="16" cy="22" rx="1.9" ry="1.5" fill="#8a1a00"/>`, { over: zz }),
    sick: face(EYES + WAVY, { col: ['#efffc8', '#a6dd4a', '#5a9a12'], stroke: '#3d6b08' }),
    love: face(miniHeart(11.5, 12.8, .3) + miniHeart(20.5, 12.8, .3) + SMILE),
    think: face(`<ellipse cx="13" cy="12.5" rx="1.7" ry="2.5" fill="${INK}"/><ellipse cx="22" cy="12.5" rx="1.7" ry="2.5" fill="${INK}"/>` + ln('M19 8.5 Q22 7 25 8.8') + ln('M12 21.8 Q16 20.5 20 22.3')),
    party: face(EYES + GRIN, { over: `<path d="M18.5 0.8 L28.5 9 L15.5 9.2Z" fill="#8a4dff" stroke="#3a1a80" stroke-width="1"/><path d="M19.5 4 L23 7 M17.5 6.5 L20 8.8" stroke="#ffe14a" stroke-width="1.4"/><circle cx="18.5" cy="1.6" r="1.6" fill="#ff4a8a"/>` }),
    devil: face(ln('M8 10 L13.8 12.3') + ln('M24 10 L18.2 12.3') + EYES + GRIN, { col: ['#ecd2ff', '#a75ae8', '#5f17a6'], stroke: '#3a0d6e',
      under: `<path d="M6.5 9 L3.5 1 L11.5 5.5Z" fill="#d02020" stroke="#600" stroke-width=".8"/><path d="M25.5 9 L28.5 1 L20.5 5.5Z" fill="#d02020" stroke="#600" stroke-width=".8"/>` }),
    angel: face(EYES + SMILE, { over: `<ellipse cx="16" cy="3" rx="8.5" ry="2.2" fill="none" stroke="#b08a00" stroke-width="2.6"/><ellipse cx="16" cy="3" rx="8.5" ry="2.2" fill="none" stroke="#ffe970" stroke-width="1.4"/>` }),
    nudge: face(`<ellipse cx="11.5" cy="12.5" rx="2" ry="3" fill="${INK}"/><ellipse cx="20.5" cy="12.5" rx="2" ry="3" fill="${INK}"/><ellipse cx="16" cy="22" rx="2.4" ry="3" fill="#8a1a00"/>`,
      { over: ln('M1.2 10.5 Q-.3 16.5 1.2 22.5', 1.5, '#2a7fd4') + ln('M30.8 10.5 Q32.3 16.5 30.8 22.5', 1.5, '#2a7fd4') }),

    thumbsup: svg(32, THUMB),
    thumbsdown: svg(32, `<g transform="rotate(180 16 16)">${THUMB}</g>`),
    heart: heart(['#ffb5b5', '#ff2a3a', '#9a000e']),
    broken: heart(['#f0b0b8', '#c8102a', '#5a000a'], `<path d="M16 7.6 L13.4 12.2 L17.6 15.2 L13.8 19.6 L16.8 23.4 L16 28.5" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`),
    kiss: svg(32, `<path d="M3 16 Q8 9 13 11 Q16 12.5 19 11 Q24 9 29 16 Q24 18 16 18 Q8 18 3 16Z" fill="#e8203a" stroke="#7a0010" stroke-width="1.1"/>` +
      `<path d="M3 16 Q8 17.5 16 17.5 Q24 17.5 29 16 Q24 25 16 25 Q8 25 3 16Z" fill="#ff4a5e" stroke="#7a0010" stroke-width="1.1"/><ellipse cx="20" cy="20.5" rx="4" ry="1.4" fill="#fff" opacity=".5"/>`),
    star: svg(32, `<defs>${rad('s', ['#fffbd0', '#ffd21f', '#e08a00'])}</defs><polygon points="${star(16, 16.8, 14.8, 6.3)}" fill="url(#s)" stroke="#9a5a00" stroke-width="1.2" stroke-linejoin="round"/><ellipse cx="13.5" cy="11.5" rx="3" ry="1.6" fill="#fff" opacity=".6"/>`),
    rose: svg(32, `<defs>${rad('rr', ['#ff9aa8', '#e8102e', '#7a0010'])}</defs><path d="M16 17 Q14.8 24 17 30.5" fill="none" stroke="#2f8a1c" stroke-width="2.2" stroke-linecap="round"/>` +
      `<path d="M16.3 23.5 Q21.5 18.8 25 22.3 Q20.6 26 16.3 23.5Z" fill="#4cb52f" stroke="#256b14" stroke-width=".8"/><path d="M15.6 25.5 Q10.5 21.8 7.6 25 Q11.6 28.4 15.6 25.5Z" fill="#4cb52f" stroke="#256b14" stroke-width=".8"/>` +
      `<circle cx="16" cy="11" r="8.6" fill="url(#rr)" stroke="#6a000e" stroke-width="1.1"/><path d="M16 11 m-2.6 0 a2.6 2.6 0 1 1 2.6 2.6 a4.8 4.8 0 1 1 -4.8 -4.8 a6.4 6.4 0 0 1 6.4 -1" fill="none" stroke="#7a0016" stroke-width="1.1" stroke-linecap="round"/>`),
    gift: svg(32, `<defs>${lin('b', '#8fd0ff', '#1f72c8')}${lin('l', '#b5e2ff', '#3a8be0')}</defs><rect x="4.5" y="13.5" width="23" height="15.5" rx="1.5" fill="url(#b)" stroke="#164e8f" stroke-width="1.1"/>` +
      `<rect x="3" y="9.5" width="26" height="5.5" rx="1.2" fill="url(#l)" stroke="#164e8f" stroke-width="1.1"/><rect x="14" y="9.5" width="4" height="19.5" fill="#ff3a4a" stroke="#9a0010" stroke-width=".7"/>` +
      `<path d="M16 9.5 Q9 1.5 7.6 6.6 Q7.4 10.2 16 9.5 Q24.6 10.2 24.4 6.6 Q23 1.5 16 9.5Z" fill="#ff3a4a" stroke="#9a0010" stroke-width="1"/>`),
    cake: svg(32, `<ellipse cx="16" cy="27.5" rx="13" ry="2.2" fill="#cfe6ff" stroke="#6a8bb0" stroke-width=".8"/><rect x="5" y="15.5" width="22" height="11.5" rx="2" fill="#f7c58a" stroke="#9a5a20" stroke-width="1"/>` +
      `<path d="M5 18 Q7 21 9 18 Q11 21 13 18 Q15 21 17 18 Q19 21 21 18 Q23 21 25 18 Q26 20 27 18 V17 Q27 15.5 25.5 15.5 H6.5 Q5 15.5 5 17Z" fill="#fff0f6" stroke="#d48aa8" stroke-width=".8"/>` +
      `<rect x="14.8" y="7.5" width="2.4" height="8" fill="#5aa0ff" stroke="#2a5aa0" stroke-width=".6"/><path d="M16 2 Q18.5 5 16 7.2 Q13.5 5 16 2Z" fill="#ffb000" stroke="#d06000" stroke-width=".6"/>`),
    coffee: svg(32, `<ellipse cx="15" cy="27.5" rx="12.5" ry="2.6" fill="#e8eef5" stroke="#7a8796" stroke-width=".9"/><path d="M5 12 H24 V19.5 Q24 27 14.5 27 Q5 27 5 19.5Z" fill="#fff" stroke="#6f7c8a" stroke-width="1.2"/>` +
      `<path d="M24 14 Q30 13.6 29 19 Q28 23 23 22.4" fill="none" stroke="#6f7c8a" stroke-width="2"/><ellipse cx="14.5" cy="12.3" rx="9" ry="1.9" fill="#6b3a12"/>` +
      `<path d="M10 9 Q8.5 6.5 10.5 4.5 T10 0.8 M15 9 Q13.5 6.5 15.5 4.5 T15 0.8 M20 9 Q18.5 6.5 20.5 4.5 T20 0.8" fill="none" stroke="#b9c3cf" stroke-width="1.2" stroke-linecap="round"/>`),
    note: svg(32, `<defs>${lin('n', '#8fa2ff', '#2a2fb0')}</defs><path d="M11.5 6.8 L26.5 3.2 V8 L11.5 11.6Z" fill="url(#n)" stroke="#1a1f80" stroke-width=".9"/><path d="M12 7 V23.5 M26 3.5 V20.5" stroke="#1a1f80" stroke-width="2.2"/>` +
      `<ellipse cx="8.8" cy="24" rx="4.4" ry="3.3" fill="url(#n)" stroke="#1a1f80" stroke-width="1" transform="rotate(-18 8.8 24)"/><ellipse cx="22.8" cy="21" rx="4.4" ry="3.3" fill="url(#n)" stroke="#1a1f80" stroke-width="1" transform="rotate(-18 22.8 21)"/>`),
    pizza: svg(32, `<path d="M16 29.5 L3.6 6.4 Q16 0.5 28.4 6.4Z" fill="#ffd96b" stroke="#a8600c" stroke-width="1.2" stroke-linejoin="round"/><path d="M3.6 6.4 Q16 0.5 28.4 6.4 L26.8 9.6 Q16 4.2 5.2 9.6Z" fill="#d9862a" stroke="#a8600c" stroke-width="1"/>` +
      `<circle cx="13" cy="12.5" r="2.4" fill="#d8262a"/><circle cx="19.5" cy="13.5" r="2.2" fill="#d8262a"/><circle cx="16" cy="20" r="2" fill="#d8262a"/><path d="M11 17 l1.5 1 M20.5 9.5 l1 1.2" stroke="#3f9a22" stroke-width="1.2"/>`),
    phone: svg(32, `<defs>${lin('p', '#f4f6f8', '#8d98a4', 1, 0)}</defs><rect x="19.5" y="0.5" width="2" height="4" rx="1" fill="#555"/><rect x="9" y="3" width="14" height="27" rx="3" fill="url(#p)" stroke="#3a424a" stroke-width="1.1"/>` +
      `<rect x="11" y="6" width="10" height="8" rx="1" fill="#a8e890" stroke="#2f5040" stroke-width=".8"/>${keys}`),
    gamepad: svg(32, PAD),
    book: svg(32, `<defs>${lin('bk', '#ff7a6a', '#b0180a', 1, 0)}</defs><path d="M6 4 H25 V27 H8 Q6 27 6 25Z" fill="url(#bk)" stroke="#6a0a00" stroke-width="1.1"/>` +
      `<path d="M8 27 Q6 27 6 25 Q6 23 8 23 H25 V27Z" fill="#fff" stroke="#6a0a00" stroke-width="1"/><rect x="10" y="8" width="11" height="4" rx=".8" fill="#ffe7a0" stroke="#8a4a00" stroke-width=".6"/>`),
    briefcase: svg(32, `<defs>${lin('bc', '#c98a4a', '#6a3a12')}</defs><path d="M12 9 V6.5 Q12 5 13.5 5 H18.5 Q20 5 20 6.5 V9" fill="none" stroke="#4a2808" stroke-width="2"/>` +
      `<rect x="3.5" y="9" width="25" height="18" rx="2.5" fill="url(#bc)" stroke="#4a2808" stroke-width="1.1"/><path d="M3.5 16 H28.5" stroke="#4a2808" stroke-width="1"/><rect x="14" y="14.2" width="4" height="4" rx=".8" fill="#ffd21f" stroke="#8a5a00" stroke-width=".7"/>`),
    clock: svg(32, `<defs>${rad('ck', ['#ffffff', '#eef6ff', '#b8d6f2'])}${lin('rim', '#7fc4ff', '#1f5fb0')}</defs><circle cx="16" cy="16" r="14.5" fill="url(#rim)" stroke="#123f80" stroke-width="1"/>` +
      `<circle cx="16" cy="16" r="11.3" fill="url(#ck)"/>${ticks}<path d="M16 16 V8.5 M16 16 L21.5 18.5" stroke="#1a1a1a" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="16" r="1.4" fill="#d02020"/>`),
    lock: svg(32, `<defs>${lin('lk', '#fff1a0', '#d99a00')}</defs><path d="M10 14 V10 Q10 4 16 4 Q22 4 22 10 V14" fill="none" stroke="#8a95a2" stroke-width="3"/>` +
      `<rect x="6.5" y="13.5" width="19" height="15" rx="2.5" fill="url(#lk)" stroke="#8a5a00" stroke-width="1.1"/><circle cx="16" cy="19.5" r="2" fill="#5a3a00"/><path d="M16 20.5 V24" stroke="#5a3a00" stroke-width="1.8" stroke-linecap="round"/>`),
    robot: svg(32, ROBOT),

    // Iconos de la interfaz (llamadas, adjuntos, foros)
    call: svg(32, `<defs>${rad('cg', ['#b8ffa8', '#3fc83a', '#1a7a14'])}</defs><circle cx="16" cy="16" r="14.5" fill="url(#cg)" stroke="#156010" stroke-width="1"/>` +
      `<ellipse cx="13" cy="8.5" rx="7" ry="3.2" fill="#fff" opacity=".5"/><g transform="translate(4 4)"><path d="${HANDSET}" fill="#fff" stroke="#0e4a0a" stroke-width=".7" stroke-linejoin="round"/></g>`),
    hangup: svg(32, `<defs>${rad('hg', ['#ffb8a8', '#ef3a2a', '#9a0e04'])}</defs><circle cx="16" cy="16" r="14.5" fill="url(#hg)" stroke="#6a0a00" stroke-width="1"/>` +
      `<ellipse cx="13" cy="8.5" rx="7" ry="3.2" fill="#fff" opacity=".5"/><g transform="rotate(135 16 16) translate(4 4)"><path d="${HANDSET}" fill="#fff" stroke="#5a0000" stroke-width=".7" stroke-linejoin="round"/></g>`),
    mic: svg(32, MIC),
    micoff: svg(32, MIC + `<path d="M5 4 L27 28" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M5 4 L27 28" stroke="#e8202a" stroke-width="3" stroke-linecap="round"/>`),
    monitor: svg(32, `<defs>${lin('mo', '#9fdcff', '#1f72c8')}</defs><rect x="2.5" y="4" width="27" height="18" rx="2" fill="#2a3440" stroke="#111" stroke-width="1"/><rect x="4.5" y="6" width="23" height="14" fill="url(#mo)"/>` +
      `<path d="M4.5 6 L18 6 L8 20 L4.5 20Z" fill="#fff" opacity=".18"/><path d="M13 22 L12 27 H20 L19 22" fill="#8a95a2" stroke="#3a4450" stroke-width=".8"/><rect x="9" y="27" width="14" height="2.2" rx="1" fill="#5a6672"/>`),
    clip: svg(32, `<path d="M20.5 9.5 L11.5 18.5 Q9.5 20.5 11.5 22.5 Q13.5 24.5 15.5 22.5 L25 13 Q28.5 9.5 25 6 Q21.5 2.5 18 6 L7.5 16.5 Q2.5 21.5 7.5 26.5 Q12.5 31.5 17.5 26.5 L25 19" fill="none" stroke="#4a5a6a" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M20.5 9.5 L11.5 18.5 Q9.5 20.5 11.5 22.5 Q13.5 24.5 15.5 22.5 L25 13 Q28.5 9.5 25 6 Q21.5 2.5 18 6 L7.5 16.5 Q2.5 21.5 7.5 26.5 Q12.5 31.5 17.5 26.5 L25 19" fill="none" stroke="#d8e2ec" stroke-width=".9" stroke-linecap="round"/>`),
    doc: svg(32, `<path d="M7 2.5 H19.5 L26 9 V29.5 H7Z" fill="#fff" stroke="#5a6a7a" stroke-width="1.2" stroke-linejoin="round"/><path d="M19.5 2.5 V9 H26" fill="#dfe7f0" stroke="#5a6a7a" stroke-width="1.2" stroke-linejoin="round"/>` +
      `<path d="M10.5 13 H22.5 M10.5 17 H22.5 M10.5 21 H22.5 M10.5 25 H18" stroke="#8fb4dd" stroke-width="1.6"/>`),
    picture: svg(32, `<defs>${lin('pc', '#9fdcff', '#e9f9ff')}</defs><rect x="2.5" y="5" width="27" height="22" rx="2" fill="url(#pc)" stroke="#5a6a7a" stroke-width="1.2"/><circle cx="22" cy="11" r="3" fill="#ffd21f" stroke="#e0a000" stroke-width=".6"/>` +
      `<path d="M3 24 L11 14 L17 21 L21 17 L29 25 V26 Q29 27 28 27 H4 Q3 27 3 26Z" fill="#4cb52f" stroke="#256b14" stroke-width=".8"/>`),
    video: svg(32, `<defs>${lin('vc', '#6f7a86', '#252b33')}</defs><rect x="2.5" y="10" width="19" height="15" rx="2.5" fill="url(#vc)" stroke="#111"/><path d="M21.5 15 L29.5 10.5 V24.5 L21.5 20Z" fill="url(#vc)" stroke="#111" stroke-linejoin="round"/>` +
      `<circle cx="8" cy="6.5" r="3.6" fill="#3a4450" stroke="#111"/><circle cx="16" cy="6.5" r="3.6" fill="#3a4450" stroke="#111"/><circle cx="6.5" cy="14" r="1.6" fill="#e8202a"/>`),
    forum: svg(32, `<defs>${lin('fb1', '#bfe6ff', '#2a8ae0')}${lin('fb2', '#d8ffc8', '#4cb52f')}</defs>` +
      `<path d="M3 5 Q3 3 5 3 H19 Q21 3 21 5 V13 Q21 15 19 15 H10 L6 19 V15 H5 Q3 15 3 13Z" fill="url(#fb1)" stroke="#164e8f" stroke-width="1.1" stroke-linejoin="round"/>` +
      `<path d="M11 13 Q11 11 13 11 H27 Q29 11 29 13 V21 Q29 23 27 23 H26 V27 L22 23 H13 Q11 23 11 21Z" fill="url(#fb2)" stroke="#256b14" stroke-width="1.1" stroke-linejoin="round"/>` +
      `<path d="M15 15.5 H25 M15 18.5 H22" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`),
    people: svg(32, `<defs>${rad('pp1', ['#bfe6ff', '#2a8ae0', '#0c4f9a'])}${rad('pp2', ['#d8ffc8', '#4cb52f', '#1f6a14'])}</defs>` +
      `<circle cx="21" cy="10" r="5" fill="url(#pp2)" stroke="#1f5a10"/><path d="M13 27 Q13 17 21 17 Q29 17 29 27Z" fill="url(#pp2)" stroke="#1f5a10"/>` +
      `<circle cx="12" cy="12" r="5.5" fill="url(#pp1)" stroke="#123f80"/><path d="M3 29 Q3 19 12 19 Q21 19 21 29Z" fill="url(#pp1)" stroke="#123f80"/>`),
    sticker: svg(32, `<defs>${lin('st', '#fff7b0', '#ffc21f')}</defs><path d="M5 3 H27 Q29 3 29 5 V20 L20 29 H5 Q3 29 3 27 V5 Q3 3 5 3Z" fill="url(#st)" stroke="#9a6a00" stroke-width="1.1"/>` +
      `<path d="M29 20 H22 Q20 20 20 22 V29Z" fill="#fff" stroke="#9a6a00" stroke-width="1.1" stroke-linejoin="round"/><circle cx="12" cy="12" r="1.7" fill="${INK}"/><circle cx="20" cy="12" r="1.7" fill="${INK}"/>` +
      `<path d="M10 17 Q15 22 20 17" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`),
    search: svg(32, `<circle cx="13" cy="13" r="8.5" fill="#dff1ff" stroke="#3a4a60" stroke-width="2.4"/><ellipse cx="11" cy="10.5" rx="4" ry="2.4" fill="#fff" opacity=".8"/><path d="M19.5 19.5 L28 28" stroke="#6a4a2a" stroke-width="4" stroke-linecap="round"/>`)
  };
  const EURI = {};
  for (const k in E) EURI[k] = uri(E[k]);

  // ---------- Stickers (128 px, con borde blanco troquelado) ----------
  const nest = (name, x, y, s) => E[name].replace(/^<svg [^>]*>/, `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 32 32">`);
  const bigHeart = (x, y, s, c = '#ff2a5a') => `<path transform="translate(${x} ${y}) scale(${s}) translate(-16 -16)" d="${HEART_D}" fill="${c}" stroke="#fff" stroke-width="${(2.5 / s).toFixed(1)}"/>`;
  const confetti = [[18, 22, '#3a8bff', 20], [104, 18, '#ffd21f', -30], [112, 60, '#3ac83a', 40], [14, 70, '#ff3a3a', -10], [96, 88, '#a04aff', 60], [26, 96, '#ff9a1a', 30]]
    .map(([x, y, c, r]) => `<rect x="${x}" y="${y}" width="10" height="4" rx="1.5" fill="${c}" transform="rotate(${r} ${x + 5} ${y + 2})"/>`).join('');
  const sparkle = (x, y, s) => `<polygon points="${star(x, y, s, s * .38)}" fill="#ffe14a" stroke="#fff" stroke-width="1.5"/>`;
  const sticker = (face, caption, color, extra = '', rot = -6) => svg(128,
    `<circle cx="66" cy="56" r="47" fill="#000" opacity=".18"/><circle cx="64" cy="53" r="47" fill="#fff"/>${nest(face, 20, 8, 88)}${extra}` +
    `<g transform="rotate(${rot} 64 110)" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="${caption.length > 8 ? 17 : caption.length > 6 ? 20 : 24}" text-anchor="middle">` +
    `<text x="65" y="119" fill="#000" opacity=".25" stroke="#000" stroke-width="9" stroke-linejoin="round">${caption}</text>` +
    `<text x="64" y="117" fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round">${caption}</text>` +
    `<text x="64" y="117" fill="${color}">${caption}</text></g>`);
  const S = [
    ['hola', '¡HOLA!', 'smile', '#ff7a1a'],
    ['jaja', 'JAJAJA', 'grin', '#e8202a'],
    ['ok', '¡OK!', 'thumbsup', '#2fa81f'],
    ['love', 'TE QUIERO', 'love', '#ff3a7a', bigHeart(106, 24, .55) + bigHeart(22, 30, .42, '#ff7aa0')],
    ['zzz', 'ZZZ...', 'sleepy', '#3b7bff'],
    ['wow', '¿¡QUÉ!?', 'surprised', '#8a4dff', '', 5],
    ['sad', 'NOOO', 'cry', '#2a7fd4'],
    ['fiesta', '¡FIESTA!', 'party', '#ff3ab0', confetti],
    ['grr', 'GRRR', 'angry', '#c8200a', '', 4],
    ['genial', 'GENIAL', 'cool', '#1e3287'],
    ['gg', 'GG', 'star', '#e3a312', sparkle(22, 24, 9) + sparkle(106, 30, 7) + sparkle(110, 80, 6)],
    ['chao', '¡CHAO!', 'wink', '#0a8a8a'],
    ['cafe', '¿CAFÉ?', 'coffee', '#6b3a12'],
    ['muac', 'MUAC', 'kiss', '#e8203a', bigHeart(104, 26, .4)],
    ['nope', 'NOPE', 'thumbsdown', '#555'],
    ['jiji', 'JIJIJI', 'devil', '#6a1fb0'],
    ['yonofui', 'YO NO FUI', 'angel', '#2a7fd4'],
    ['mmm', 'MMM...', 'think', '#5a6a7a']
  ];
  const STK = {};
  for (const [id, caption, face, color, extra, rot] of S) STK[id] = { name: caption, src: uri(sticker(face, caption, color, extra, rot)) };

  // ---------- Avatares (imágenes para mostrar, estilo clásico) ----------
  const bg = (a, b) => `<defs>${lin('bg', a, b)}</defs><rect width="96" height="96" fill="url(#bg)"/>`;
  const STARS = [[10, 12, 1.2], [24, 30, .9], [80, 10, 1.4], [66, 26, .8], [88, 44, 1.1], [14, 52, 1], [36, 8, .8], [52, 16, 1.1], [90, 72, .9], [6, 80, 1.1], [40, 88, .8]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".9"/>`).join('');
  const gloss = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".45"/>`;
  const INVADER = ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'];
  const tulip = (x, h, c1, c2, dark) => {
    const t = 92 - h;
    return `<path d="M${x} 92 Q${x - 3} ${92 - h / 2} ${x} ${t}" stroke="#2f8a1c" stroke-width="3.5" fill="none"/>` +
      `<path d="M${x} 84 Q${x + 12} ${78 - h / 4} ${x + 14} ${70 - h / 4} Q${x + 4} ${74 - h / 4} ${x} 84Z" fill="#4cb52f"/>` +
      `<defs>${lin('t' + x, c1, c2)}</defs><path d="M${x - 11} ${t - 10} Q${x - 12} ${t + 8} ${x} ${t + 8} Q${x + 12} ${t + 8} ${x + 11} ${t - 10} L${x + 5.5} ${t - 4} L${x} ${t - 13} L${x - 5.5} ${t - 4}Z" fill="url(#t${x})" stroke="${dark}" stroke-width="1.6" stroke-linejoin="round"/>`;
  };
  const soccer = (() => {
    let s = `<defs><clipPath id="c"><circle cx="48" cy="46" r="27"/></clipPath>${rad('bl', ['#ffffff', '#f2f2f2', '#b8b8b8'])}</defs>` +
      `<ellipse cx="50" cy="78" rx="24" ry="5" fill="#000" opacity=".25"/><circle cx="48" cy="46" r="27" fill="url(#bl)"/><g clip-path="url(#c)">`;
    for (let k = 0; k < 5; k++) {
      const a = (-90 + k * 72) * Math.PI / 180;
      s += `<path d="M${(48 + 9 * Math.cos(a)).toFixed(1)} ${(46 + 9 * Math.sin(a)).toFixed(1)} L${(48 + 18 * Math.cos(a)).toFixed(1)} ${(46 + 18 * Math.sin(a)).toFixed(1)}" stroke="#222" stroke-width="1.6"/>`;
      s += `<polygon points="${poly(48 + 25 * Math.cos(a), 46 + 25 * Math.sin(a), 9, 5, -90 + k * 72 + 180)}" fill="#1a1a1a"/>`;
    }
    return s + `<polygon points="${poly(48, 46, 9.5, 5, -90)}" fill="#1a1a1a"/></g><circle cx="48" cy="46" r="27" fill="none" stroke="#333" stroke-width="2"/>${gloss(40, 32, 12, 7)}`;
  })();

  const A = [
    ['duck', 'Patito de goma', bg('#c9ecff', '#3a96e0') + `<path d="M0 72 Q12 66 24 72 T48 72 T72 72 T96 72 V96 H0Z" fill="#1f6fc0" opacity=".55"/><defs>${rad('dy', ['#fff7b0', '#ffd21f', '#e89a00'])}</defs>` +
      `<path d="M24 60 L13 47 Q22 50 30 56Z" fill="url(#dy)" stroke="#a87000" stroke-width="2" stroke-linejoin="round"/><ellipse cx="48" cy="64" rx="28" ry="15" fill="url(#dy)" stroke="#a87000" stroke-width="2"/>` +
      `<circle cx="60" cy="38" r="15" fill="url(#dy)" stroke="#a87000" stroke-width="2"/><path d="M73 37 Q88 38 85 43 Q80 47 72 45Z" fill="#ff7a1a" stroke="#b04000" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<circle cx="64" cy="33" r="3" fill="#111"/><circle cx="65" cy="32" r="1.1" fill="#fff"/><path d="M34 62 Q46 50 58 62 Q46 72 34 62Z" fill="#ffc400" stroke="#a87000" stroke-width="1.6"/>` +
      `${gloss(54, 29, 7, 4)}<path d="M16 76 Q28 72 40 76 T64 76 T86 75" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>`],
    ['soccer', 'Balón de fútbol', bg('#9fe07a', '#2f7a1c') + `<path d="M0 62 H96 V70 H0Z M0 80 H96 V88 H0Z" fill="#fff" opacity=".1"/>` + soccer],
    ['daisy', 'Margarita', bg('#d8f3ff', '#5fb6ee') + `<path d="M0 80 Q24 72 48 80 T96 78 V96 H0Z" fill="#4cb52f"/><path d="M48 50 Q45 70 50 92" stroke="#2f8a1c" stroke-width="4" fill="none"/>` +
      `<path d="M49 74 Q62 62 70 70 Q60 80 49 74Z" fill="#4cb52f" stroke="#256b14" stroke-width="1.5"/>` +
      Array.from({ length: 14 }, (_, k) => `<ellipse cx="48" cy="22" rx="6" ry="15" fill="#fff" stroke="#c4d2e0" stroke-width="1.2" transform="rotate(${(k * 360 / 14).toFixed(1)} 48 38)"/>`).join('') +
      `<defs>${rad('dc', ['#fff3a0', '#ffc21f', '#e07a00'])}</defs><circle cx="48" cy="38" r="10" fill="url(#dc)" stroke="#a85a00" stroke-width="1.5"/>`],
    ['dog', 'Perrito', bg('#fff0c2', '#f2a64a') + `<defs>${rad('dh', ['#e8b07a', '#b8742e', '#7a4512'])}</defs>` +
      `<ellipse cx="24" cy="42" rx="11" ry="20" fill="#6a3a12" transform="rotate(20 24 42)"/><ellipse cx="72" cy="42" rx="11" ry="20" fill="#6a3a12" transform="rotate(-20 72 42)"/>` +
      `<circle cx="48" cy="50" r="28" fill="url(#dh)" stroke="#5a3008" stroke-width="2"/><ellipse cx="60" cy="36" rx="8" ry="6" fill="#7a4512" opacity=".55"/><ellipse cx="48" cy="64" rx="15" ry="11" fill="#f6dcc0"/>` +
      `<circle cx="37" cy="46" r="4.2" fill="#1a1a1a"/><circle cx="59" cy="46" r="4.2" fill="#1a1a1a"/><circle cx="38.5" cy="44.5" r="1.4" fill="#fff"/><circle cx="60.5" cy="44.5" r="1.4" fill="#fff"/>` +
      `<ellipse cx="48" cy="58" rx="5.5" ry="4" fill="#1a1a1a"/><path d="M48 62 V66 M42 66 Q48 71 54 66" stroke="#3a1a00" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M45 68 Q48 77 51 68Z" fill="#ff6f8f"/>`],
    ['cat', 'Gatito', bg('#ffe3f1', '#c9a0e8') + `<defs>${rad('ch', ['#ffd9a8', '#f29a3a', '#b8600e'])}</defs>` +
      `<path d="M22 36 L26 8 L44 26Z" fill="url(#ch)" stroke="#7a3a00" stroke-width="2" stroke-linejoin="round"/><path d="M74 36 L70 8 L52 26Z" fill="url(#ch)" stroke="#7a3a00" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M27 29 L28.5 16 L37 25Z" fill="#ffb3c8"/><path d="M69 29 L67.5 16 L59 25Z" fill="#ffb3c8"/><ellipse cx="48" cy="54" rx="30" ry="26" fill="url(#ch)" stroke="#7a3a00" stroke-width="2"/>` +
      `<path d="M48 29 V38 M40 30 L42 38 M56 30 L54 38" stroke="#b8600e" stroke-width="3" stroke-linecap="round"/>` +
      `<ellipse cx="37" cy="50" rx="6" ry="7" fill="#7ad94a" stroke="#2a5a10" stroke-width="1.2"/><ellipse cx="59" cy="50" rx="6" ry="7" fill="#7ad94a" stroke="#2a5a10" stroke-width="1.2"/>` +
      `<ellipse cx="37" cy="50" rx="1.8" ry="5.5" fill="#111"/><ellipse cx="59" cy="50" rx="1.8" ry="5.5" fill="#111"/><path d="M44 60 H52 L48 64Z" fill="#ff7aa0" stroke="#a0204a" stroke-width="1"/>` +
      `<path d="M48 64 Q44 69 40 66 M48 64 Q52 69 56 66" stroke="#5a2a00" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M30 62 H14 M30 66 L15 71 M66 62 H82 M66 66 L81 71" stroke="#5a2a00" stroke-width="1.3"/>`],
    ['chess', 'Ajedrez', bg('#d7e7ff', '#7a9cd0') +
      Array.from({ length: 12 }, (_, i) => `<rect x="${(i % 6) * 16}" y="${64 + Math.floor(i / 6) * 16}" width="16" height="16" fill="${(i % 6 + Math.floor(i / 6)) % 2 ? '#2a2a2a' : '#f4f4f4'}"/>`).join('') +
      `<defs>${rad('pw', ['#8a8a8a', '#2a2a2a', '#000'], '35%', '25%', '80%')}</defs><ellipse cx="48" cy="78" rx="22" ry="5" fill="#000" opacity=".3"/>` +
      `<path d="M28 78 Q28 70 34 68 H62 Q68 70 68 78Z" fill="url(#pw)" stroke="#000" stroke-width="1.5"/><path d="M37 68 Q40 50 42 40 H54 Q56 50 59 68Z" fill="url(#pw)" stroke="#000" stroke-width="1.5"/>` +
      `<ellipse cx="48" cy="40" rx="11" ry="3.5" fill="url(#pw)" stroke="#000" stroke-width="1.5"/><circle cx="48" cy="28" r="11" fill="url(#pw)" stroke="#000" stroke-width="1.5"/>${gloss(44, 23, 4, 3)}`],
    ['guitar', 'Guitarra', bg('#ffd08a', '#e0402a') + `<defs>${rad('gb', ['#ffe28a', '#f08a1a', '#6a2a00'], '50%', '45%', '60%')}</defs><g transform="rotate(-35 48 52)">` +
      `<rect x="44" y="0" width="8" height="48" fill="#7a4a1a" stroke="#3a2008" stroke-width="1.2"/><rect x="42" y="-8" width="12" height="12" rx="2" fill="#3a2008"/>` +
      `<path d="M44 12 H52 M44 20 H52 M44 28 H52 M44 36 H52" stroke="#d9c08a" stroke-width="1"/>` +
      `<circle cx="48" cy="58" r="16" fill="url(#gb)" stroke="#3a1a00" stroke-width="2.5"/><circle cx="48" cy="80" r="19" fill="url(#gb)" stroke="#3a1a00" stroke-width="2.5"/>` +
      `<circle cx="48" cy="58" r="14.8" fill="url(#gb)"/><circle cx="48" cy="64" r="6" fill="#2a1200"/><rect x="40" y="82" width="16" height="3.5" rx="1" fill="#3a2008"/>` +
      `<path d="M46 0 V83 M48 0 V83 M50 0 V83" stroke="#f4f4f4" stroke-width=".6"/></g>`],
    ['butterfly', 'Mariposa', bg('#e8ffd8', '#3aa58a') + `<defs>${rad('w1', ['#fff0a0', '#ff9a1a', '#c0400a'])}${rad('w2', ['#c8f0ff', '#3a9af0', '#1a3aa0'])}</defs>` +
      `<ellipse cx="30" cy="36" rx="20" ry="16" fill="url(#w1)" stroke="#3a1a00" stroke-width="2" transform="rotate(-25 30 36)"/><ellipse cx="66" cy="36" rx="20" ry="16" fill="url(#w1)" stroke="#3a1a00" stroke-width="2" transform="rotate(25 66 36)"/>` +
      `<ellipse cx="34" cy="62" rx="14" ry="11" fill="url(#w2)" stroke="#1a1a40" stroke-width="2" transform="rotate(30 34 62)"/><ellipse cx="62" cy="62" rx="14" ry="11" fill="url(#w2)" stroke="#1a1a40" stroke-width="2" transform="rotate(-30 62 62)"/>` +
      `<circle cx="26" cy="32" r="4" fill="#fff" opacity=".8"/><circle cx="70" cy="32" r="4" fill="#fff" opacity=".8"/><ellipse cx="48" cy="50" rx="4.5" ry="22" fill="#2a1a10"/><circle cx="48" cy="27" r="5" fill="#2a1a10"/>` +
      `<path d="M46 24 Q40 12 34 10 M50 24 Q56 12 62 10" stroke="#2a1a10" stroke-width="2" fill="none"/><circle cx="34" cy="10" r="2.5" fill="#2a1a10"/><circle cx="62" cy="10" r="2.5" fill="#2a1a10"/>`],
    ['fish', 'Pececito', bg('#bff4ff', '#1a8ac0') + `<circle cx="78" cy="24" r="5" fill="none" stroke="#fff" stroke-width="1.6" opacity=".8"/><circle cx="85" cy="12" r="3" fill="none" stroke="#fff" stroke-width="1.4" opacity=".8"/><circle cx="72" cy="35" r="2.4" fill="none" stroke="#fff" stroke-width="1.2" opacity=".8"/>` +
      `<path d="M0 86 Q48 78 96 86 V96 H0Z" fill="#f0d890"/><defs>${rad('fs', ['#fff0a0', '#ff9a1a', '#d84a00'])}</defs>` +
      `<path d="M26 48 L8 32 Q12 48 8 64Z" fill="url(#fs)" stroke="#8a2a00" stroke-width="2" stroke-linejoin="round"/><path d="M38 33 Q46 18 56 33Z" fill="#ff7a1a" stroke="#8a2a00" stroke-width="1.6"/>` +
      `<ellipse cx="46" cy="48" rx="24" ry="17" fill="url(#fs)" stroke="#8a2a00" stroke-width="2"/><path d="M50 38 Q46 48 50 58" stroke="#c0400a" stroke-width="1.6" fill="none"/>` +
      `<circle cx="59" cy="43" r="5" fill="#fff" stroke="#333"/><circle cx="60" cy="43" r="2.5" fill="#111"/><path d="M69 51 Q66 53 64 51" stroke="#8a2a00" stroke-width="1.6" fill="none"/>`],
    ['beach', 'Playa', bg('#5fbfff', '#e6f8ff') + `<circle cx="72" cy="22" r="11" fill="#ffe14a" stroke="#ffb000" stroke-width="2"/><rect y="58" width="96" height="16" fill="#1f8fd8"/>` +
      `<path d="M0 62 Q8 60 16 62 T32 62 T48 62 T64 62 T80 62 T96 62" stroke="#fff" stroke-width="1.5" fill="none" opacity=".6"/><path d="M0 72 Q48 64 96 72 V96 H0Z" fill="#f6d88a"/>` +
      `<path d="M30 92 Q26 60 40 34" stroke="#8a5a2a" stroke-width="6" fill="none" stroke-linecap="round"/>` +
      ['M40 34 Q22 22 8 32 Q24 28 40 34Z', 'M40 34 Q50 16 68 18 Q52 24 40 34Z', 'M40 34 Q60 32 70 46 Q54 38 40 34Z', 'M40 34 Q30 40 20 54 Q28 40 40 34Z', 'M40 34 Q36 18 44 6 Q40 22 40 34Z']
        .map(d => `<path d="${d}" fill="#3aa52a" stroke="#1f6a14" stroke-width="1.2"/>`).join('') +
      `<circle cx="38" cy="38" r="3" fill="#6a3a12"/><circle cx="43" cy="38" r="3" fill="#6a3a12"/>`],
    ['rocket', 'Cohete', bg('#1a2a6a', '#000814') + STARS + `<defs>${lin('rk', '#ffffff', '#9aa6b4', 1, 0)}</defs><g transform="rotate(35 48 48)">` +
      `<path d="M40 72 Q48 96 56 72Z" fill="#ffb000"/><path d="M43 72 Q48 88 53 72Z" fill="#fff36a"/><path d="M36 56 L26 74 L38 70Z" fill="#e8202a" stroke="#600" stroke-width="1.2"/><path d="M60 56 L70 74 L58 70Z" fill="#e8202a" stroke="#600" stroke-width="1.2"/>` +
      `<path d="M48 8 Q62 24 60 72 H36 Q34 24 48 8Z" fill="url(#rk)" stroke="#3a4450" stroke-width="1.6"/><path d="M48 8 Q55.5 16 57.5 24 H38.5 Q40.5 16 48 8Z" fill="#e8202a" stroke="#600" stroke-width="1.2"/>` +
      `<circle cx="48" cy="40" r="7" fill="#5ac8ff" stroke="#1a3a6a" stroke-width="2.5"/><circle cx="46" cy="38" r="2" fill="#fff" opacity=".8"/></g>`],
    ['basket', 'Baloncesto', bg('#c0b0ff', '#4a2a9a') + `<defs>${rad('bb', ['#ffc48a', '#f07a1a', '#a04000'])}</defs><circle cx="48" cy="48" r="30" fill="url(#bb)" stroke="#3a1400" stroke-width="2"/>` +
      `<path d="M18 48 H78 M48 18 V78 M27 27 Q42 48 27 69 M69 27 Q54 48 69 69" stroke="#3a1400" stroke-width="2" fill="none"/>${gloss(38, 32, 10, 6)}`],
    ['robot', 'Robot', bg('#e0ecf8', '#6a88b0') + `<g transform="translate(8 8) scale(2.5)">${ROBOT}</g>`],
    ['tulips', 'Tulipanes', bg('#e0f6ff', '#8fd0f0') + `<path d="M0 84 Q48 78 96 84 V96 H0Z" fill="#4cb52f"/>` +
      tulip(26, 44, '#ff8a8a', '#d0102a', '#6a0010') + tulip(48, 58, '#fff6a0', '#f0b000', '#8a5a00') + tulip(70, 40, '#ffc0e0', '#e04a9a', '#7a1050')],
    ['car', 'Coche', bg('#a8dcff', '#eaf7ff') + `<rect y="70" width="96" height="26" fill="#555"/><path d="M0 84 H96" stroke="#ffd21f" stroke-width="2.5" stroke-dasharray="10 8"/><defs>${lin('cr', '#ff8a7a', '#b0100a')}</defs>` +
      `<path d="M8 64 Q8 52 18 50 L30 48 L40 34 Q42 32 46 32 H64 Q68 32 70 35 L78 48 Q88 50 88 58 V64 Q88 68 84 68 H12 Q8 68 8 64Z" fill="url(#cr)" stroke="#5a0000" stroke-width="2"/>` +
      `<path d="M43 37 H54 V48 H35Z" fill="#cfeeff" stroke="#5a0000" stroke-width="1.5"/><path d="M58 37 H66 L72 48 H58Z" fill="#cfeeff" stroke="#5a0000" stroke-width="1.5"/>` +
      `<circle cx="27" cy="68" r="9" fill="#222" stroke="#000"/><circle cx="27" cy="68" r="4" fill="#bbb"/><circle cx="70" cy="68" r="9" fill="#222" stroke="#000"/><circle cx="70" cy="68" r="4" fill="#bbb"/>` +
      `<rect x="82" y="54" width="5" height="4" rx="1" fill="#fff6a0"/>${gloss(52, 42, 18, 3)}`],
    ['planet', 'Planeta', bg('#2a1a5a', '#05030f') + STARS + `<defs>${rad('pl', ['#ffe0a0', '#f0902a', '#8a3a0a'])}<clipPath id="fr"><rect x="-20" y="46" width="140" height="60" transform="rotate(-18 48 46)"/></clipPath></defs>` +
      `<ellipse cx="48" cy="46" rx="40" ry="10" fill="none" stroke="#c9b27a" stroke-width="5" transform="rotate(-18 48 46)"/><circle cx="48" cy="46" r="22" fill="url(#pl)"/>` +
      `<path d="M28 40 Q48 46 68 38 M27 50 Q48 56 69 48" stroke="#c0601a" stroke-width="2.5" fill="none" opacity=".6"/>` +
      `<ellipse cx="48" cy="46" rx="40" ry="10" fill="none" stroke="#f0dca0" stroke-width="5" transform="rotate(-18 48 46)" clip-path="url(#fr)"/>`],
    ['invader', 'Marciano', bg('#0a2a10', '#000') + STARS +
      INVADER.map((row, y) => [...row].map((c, x) => c === '1' ? `<rect x="${9.5 + x * 7}" y="${22 + y * 7}" width="7.2" height="7.2" fill="#3aff5a"/>` : '').join('')).join('')],
    ['penguin', 'Pingüino', bg('#e6f6ff', '#7ab8e8') + `<path d="M0 82 Q48 74 96 82 V96 H0Z" fill="#fff"/>` +
      `<path d="M25 52 Q16 66 24 76 Q28 64 28 54Z" fill="#1a2030"/><path d="M71 52 Q80 66 72 76 Q68 64 68 54Z" fill="#1a2030"/><ellipse cx="48" cy="54" rx="24" ry="30" fill="#1a2030"/>` +
      `<ellipse cx="48" cy="61" rx="16" ry="21" fill="#fff"/><ellipse cx="41" cy="36" rx="6" ry="7" fill="#fff"/><ellipse cx="55" cy="36" rx="6" ry="7" fill="#fff"/>` +
      `<circle cx="42" cy="37" r="2.6" fill="#111"/><circle cx="54" cy="37" r="2.6" fill="#111"/><path d="M43 44 L53 44 L48 51Z" fill="#ff9a1a" stroke="#a04a00" stroke-width="1"/>` +
      `<ellipse cx="40" cy="84" rx="7" ry="3" fill="#ff9a1a"/><ellipse cx="56" cy="84" rx="7" ry="3" fill="#ff9a1a"/>${gloss(40, 30, 6, 3)}`],
    ['rainbow', 'Arcoíris', bg('#8fd6ff', '#e9f9ff') +
      ['#ff3a3a', '#ff9a1a', '#ffe01a', '#3ac83a', '#2a8aff', '#8a4aff'].map((c, i) => { const r = 40 - i * 5; return `<path d="M${48 - r} 78 A${r} ${r} 0 0 1 ${48 + r} 78" stroke="${c}" stroke-width="5.2" fill="none"/>`; }).join('') +
      [[12, 78, 10], [23, 72, 10], [30, 81, 9], [66, 81, 9], [74, 72, 10], [85, 78, 10]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#cfe2f2" stroke-width="1"/>`).join('')],
    ['headphones', 'Auriculares', bg('#ff9ad8', '#7a2ab0') + `<defs>${lin('hp', '#6a7a8a', '#1a1f26', 1, 0)}</defs><path d="M20 58 V46 Q20 18 48 18 Q76 18 76 46 V58" fill="none" stroke="#2a2a2a" stroke-width="7" stroke-linecap="round"/>` +
      `<rect x="12" y="50" width="18" height="28" rx="8" fill="url(#hp)" stroke="#111" stroke-width="2"/><rect x="66" y="50" width="18" height="28" rx="8" fill="url(#hp)" stroke="#111" stroke-width="2"/>` +
      `<rect x="27" y="54" width="5" height="20" rx="2" fill="#ff3ab0"/><rect x="64" y="54" width="5" height="20" rx="2" fill="#ff3ab0"/>${gloss(48, 22, 14, 2)}`],
    ['gamepad', 'Videojuegos', bg('#7af0e0', '#0a6a7a') + `<g transform="translate(8 10) scale(2.5)">${PAD}</g>`],
    ['cupcake', 'Magdalena', bg('#d8ffe8', '#5ad0a0') + `<path d="M26 54 H70 L64 86 H32Z" fill="#ff7ab0" stroke="#a0205a" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M36 54 L39 86 M46 54 L47 86 M56 54 L55 86 M64 54 L60 86" stroke="#a0205a" stroke-width="1.3"/>` +
      `<path d="M22 56 Q16 46 28 42 Q26 30 40 30 Q44 20 56 26 Q70 26 68 38 Q80 42 74 56Z" fill="#fff4f8" stroke="#d48aa8" stroke-width="2"/>` +
      [[34, 40, '#3a8bff', 20], [46, 34, '#ffd21f', -30], [58, 42, '#3ac83a', 40], [42, 48, '#ff3a3a', -10], [62, 34, '#a04aff', 60], [30, 50, '#ff9a1a', 30]]
        .map(([x, y, c, r]) => `<rect x="${x}" y="${y}" width="6" height="2.4" rx="1" fill="${c}" transform="rotate(${r} ${x + 3} ${y + 1})"/>`).join('') +
      `<path d="M50 14 Q52 6 58 4" stroke="#2f8a1c" stroke-width="2" fill="none"/><circle cx="50" cy="20" r="6" fill="#e8102e" stroke="#6a0010"/><circle cx="48" cy="18" r="1.8" fill="#fff" opacity=".7"/>`],
    ['moon', 'Luna', bg('#1a2a6a', '#04081a') + STARS + `<defs>${rad('mn', ['#fffbe0', '#ffe680', '#d9a800'])}<mask id="mk"><rect width="96" height="96" fill="#fff"/><circle cx="62" cy="36" r="26" fill="#000"/></mask></defs>` +
      `<circle cx="44" cy="50" r="30" fill="url(#mn)" mask="url(#mk)"/><circle cx="30" cy="60" r="4" fill="#d9b030" opacity=".5" mask="url(#mk)"/><circle cx="40" cy="72" r="3" fill="#d9b030" opacity=".5"/>`],
    ['cactus', 'Cactus', bg('#ffe0a0', '#f07a3a') + `<circle cx="78" cy="18" r="9" fill="#fff3a0" opacity=".8"/><defs>${lin('cc', '#7ae05a', '#2a8a1c', 1, 0)}</defs>` +
      `<path d="M38 50 H30 Q24 50 24 44 V34" fill="none" stroke="#1a5a10" stroke-width="11" stroke-linecap="round"/><path d="M38 50 H30 Q24 50 24 44 V34" fill="none" stroke="#4cc03a" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M58 42 H66 Q72 42 72 36 V28" fill="none" stroke="#1a5a10" stroke-width="11" stroke-linecap="round"/><path d="M58 42 H66 Q72 42 72 36 V28" fill="none" stroke="#4cc03a" stroke-width="7" stroke-linecap="round"/>` +
      `<rect x="38" y="20" width="20" height="50" rx="10" fill="url(#cc)" stroke="#1a5a10" stroke-width="2"/><path d="M44 30 l-3 -2 M52 38 l3 -2 M44 48 l-3 -2 M52 56 l3 -2" stroke="#fff" stroke-width="1.2"/>` +
      `<circle cx="48" cy="20" r="4.5" fill="#ff5aa0" stroke="#a0205a"/><path d="M30 70 H66 L62 92 H34Z" fill="#c8602a" stroke="#6a2a08" stroke-width="2"/><rect x="27" y="66" width="42" height="8" rx="2" fill="#d9783a" stroke="#6a2a08" stroke-width="2"/>`],
    ['globe', 'Mundo', bg('#bfe8ff', '#1a6ac0') + `<defs>${rad('gl', ['#bff0ff', '#2a8ae0', '#0a3a8a'])}<clipPath id="gc"><circle cx="48" cy="48" r="30"/></clipPath></defs><circle cx="48" cy="48" r="30" fill="url(#gl)"/>` +
      `<g clip-path="url(#gc)" fill="#4cc03a" stroke="#1f7a14" stroke-width="1.2"><path d="M22 30 Q30 22 40 26 Q46 34 38 40 Q36 50 28 48 Q20 42 22 30Z"/><path d="M52 22 Q64 20 70 28 Q66 34 58 32 Q52 30 52 22Z"/>` +
      `<path d="M50 46 Q62 42 72 50 Q74 62 64 70 Q56 72 54 62 Q46 56 50 46Z"/><path d="M30 60 Q36 58 38 66 Q34 74 28 70Z"/></g><circle cx="48" cy="48" r="30" fill="none" stroke="#0a2a6a" stroke-width="2"/>${gloss(38, 30, 12, 6)}`],
    ['nada', 'Nada', bg('#e8f6ff', '#8fcaf0') + `<g stroke="#1a5a9a" stroke-width="7" fill="none" opacity=".25" transform="translate(2 2)"><circle cx="48" cy="48" r="24"/><path d="M28 76 L68 20" stroke-linecap="round"/></g>` +
      `<g stroke="#fff" stroke-width="7" fill="none"><circle cx="48" cy="48" r="24"/><path d="M28 76 L68 20" stroke-linecap="round"/></g>`]
  ];
  const AV = {};
  for (const [id, name, body] of A) AV[id] = { name, src: uri(svg(96, body)) };

  return { E: EURI, AV, AV_ORDER: A.map(a => a[0]), STK, STK_ORDER: S.map(s => s[0]) };
})();
