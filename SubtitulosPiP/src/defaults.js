// Ajustes y estilos compartidos por el script de contenido y el popup.
globalThis.SUBPIP_DEFAULTS = Object.freeze({
  enabled: true,
  mode: 'scale',            // 'scale' | 'fixed' | 'outside'
  scale: 1,                 // multiplicador de tamaño
  minFontPx: 10,
  fixedMaxWidth: 90,        // % del ancho del vídeo (modo fijo)
  joinLines: true,          // reacomodar líneas (fijo / fuera)
  outsidePosition: 'auto',  // 'auto' | 'bottom' | 'top'
  outsideLines: 2,          // líneas reservadas en la franja
  outsideFontPx: 0,         // 0 = tamaño original
  // Estilo: 'original' copia tal cual el estilo del sitio (incluido el configurado en YouTube).
  stylePreset: 'original',  // original | youtube | outline | shadow | yellow | contrast | custom
  textColor: '', textOpacity: 100,     // '' = original
  bgColor: '', bgOpacity: 75,
  windowColor: '', windowOpacity: 50,
  edge: 'original',         // original | none | outline | shadow | raised | depressed
  fontFamily: 'original',   // original | sans | serif | mono | casual | cursive | smallcaps
  fontWeight: 'original',   // original | normal | bold
  desktop: false,           // enviar los subtítulos al programa de escritorio
  desktopLayout: 'original',// 'original' (posición del vídeo) | 'compact' (siempre abajo, centrados)
  deskStyle: 'original',    // estilo propio de los subtítulos del escritorio
  deskScale: 1,             // tamaño propio de los subtítulos del escritorio
  deskHideOriginal: false,  // ocultar los subtítulos normales del vídeo
  pipMethod: 'real',        // 'real' = vídeo real (fluido, subtítulos en el escritorio) | 'canvas' = subtítulos dentro del PiP
  showButton: true,
  interceptSitePip: true,
  autoPip: false,
  hotkey: 'Alt+P'
});

globalThis.SUBPIP_FONTS = {
  sans: 'Arial, "Segoe UI", Helvetica, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'Consolas, "Courier New", monospace',
  casual: '"Comic Sans MS", "Comic Neue", cursive',
  cursive: '"Segoe Script", "Brush Script MT", cursive',
  smallcaps: 'Arial, "Segoe UI", sans-serif'
};
globalThis.SUBPIP_EDGES = {
  none: 'none',
  outline: '-.05em -.05em 0 #000, .05em -.05em 0 #000, -.05em .05em 0 #000, .05em .05em 0 #000',
  shadow: '.08em .08em .12em rgba(0,0,0,.9)',
  raised: '-.04em -.04em 0 rgba(255,255,255,.45), .05em .05em 0 #111',
  depressed: '.04em .04em 0 rgba(255,255,255,.45), -.05em -.05em 0 #111'
};
globalThis.SUBPIP_PRESETS = {
  original: {},
  youtube: { color: '#fff', bg: 'rgba(8,8,8,0.75)', win: 'transparent', edge: 'none', family: 'sans' },
  outline: { color: '#fff', bg: 'transparent', win: 'transparent', edge: 'outline' },
  shadow: { color: '#fff', bg: 'transparent', win: 'transparent', edge: 'shadow' },
  yellow: { color: '#ffe500', bg: 'transparent', win: 'transparent', edge: 'outline' },
  contrast: { color: '#fff', bg: '#000', win: 'transparent', edge: 'none', weight: '700' }
};

// Ajustes → cambios de estilo (campos ausentes = se respeta el original).
globalThis.subpipStyle = (S) => {
  if (S.stylePreset !== 'custom') return SUBPIP_PRESETS[S.stylePreset] || {};
  const rgba = (hex, op) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${op / 100})`;
  };
  const o = {};
  if (S.textColor) o.color = rgba(S.textColor, S.textOpacity);
  if (S.bgColor) o.bg = rgba(S.bgColor, S.bgOpacity);
  if (S.windowColor) o.win = rgba(S.windowColor, S.windowOpacity);
  if (S.edge !== 'original') o.edge = S.edge;
  if (S.fontFamily !== 'original') o.family = S.fontFamily;
  if (S.fontWeight !== 'original') o.weight = S.fontWeight === 'bold' ? '700' : '400';
  return o;
};

// Cambios de estilo → CSS (ventana PiP de documento y vista previa del popup).
globalThis.subpipCss = (o, sel) => {
  const all = `${sel},${sel} *`;
  let c = '';
  if (o.color) c += `${all}{color:${o.color}!important}`;
  if (o.family) c += `${all}{font-family:${SUBPIP_FONTS[o.family]}!important;font-variant:${o.family === 'smallcaps' ? 'small-caps' : 'normal'}!important}`;
  if (o.weight) c += `${all}{font-weight:${o.weight}!important}`;
  if (o.edge) c += `${all}{text-shadow:${SUBPIP_EDGES[o.edge]}!important;-webkit-text-stroke:0!important}`;
  if (o.bg !== undefined) {
    c += `${all}{background-color:transparent!important}`;
    c += `${sel}[data-tx],${sel} [data-tx]{background-color:${o.bg}!important;padding:0 .25em!important;-webkit-box-decoration-break:clone;box-decoration-break:clone}`;
  }
  if (o.win !== undefined) {
    c += `${sel}{background-color:${o.win}!important${o.win === 'transparent' ? '' : ';padding:.15em .35em!important;border-radius:.15em'}}`;
  }
  return c;
};
